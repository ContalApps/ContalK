import { app, BrowserWindow, ipcMain, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { CommunitySnapshot, CommunityAction } from '../src/roles/types'
import { validInviteCode } from '../src/roles/invites'

const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[\w:-]{1,100}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value)

const COMMUNITY_URL = (typeof process !== 'undefined' && process.env.CONTALK_COMMUNITY_URL) || 'https://comunidade.contalapps.com.br'
type CommunityConfig = { url: string; token: string }
const configFile = (owner: string) =>
  path.join(app.getPath('userData'), 'community-' + createHash('sha256').update(owner).digest('hex') + '.enc')

export function readCommunityConfig(owner: string | null): CommunityConfig | null {
  if (!owner || !safeStorage.isEncryptionAvailable() || !fs.existsSync(configFile(owner))) return null
  try {
    return JSON.parse(safeStorage.decryptString(fs.readFileSync(configFile(owner))))
  } catch {
    return null
  }
}

function storeSession(owner: string, token: string) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Proteção de credenciais do sistema indisponível.')
  fs.writeFileSync(configFile(owner), safeStorage.encryptString(JSON.stringify({ url: COMMUNITY_URL, token })))
}

async function accountRequest(route: 'login' | 'register', body: Record<string, unknown>) {
  let response: Response
  try {
    response = await fetch(new URL('/' + route, COMMUNITY_URL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    })
  } catch {
    throw new Error('Não foi possível falar com o servidor do ConTALK. Verifique sua conexão.')
  }
  const data = (await response.json().catch(() => ({}))) as {
    username?: string
    email?: string
    token?: string
    error?: string
  }
  if (!response.ok || !data.token || !data.username) throw new Error(data.error || 'Não foi possível acessar sua conta.')
  storeSession(data.username, data.token)
  return { username: data.username, email: data.email || '' }
}

export const signUpCommunity = (username: string, email: string, password: string) =>
  accountRequest('register', { username, email, password })
export const signInCommunity = (identifier: string, password: string) =>
  accountRequest('login', { identifier, password })
export async function signOutCommunity(owner: string) {
  const saved = readCommunityConfig(owner)
  if (fs.existsSync(configFile(owner))) fs.unlinkSync(configFile(owner))
  if (saved)
    await fetch(new URL('/logout', saved.url), {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + saved.token },
      signal: AbortSignal.timeout(5000)
    }).catch(() => {})
}

export function setupCommunity(window: BrowserWindow, getUsername: () => string | null) {
  const contents = window.webContents
  let stream: AbortController | undefined

  const config = (): CommunityConfig => {
    const owner = getUsername()
    if (!owner) throw new Error('Entre no ConTALK.')
    const saved = readCommunityConfig(owner)
    if (!saved) throw new Error('Sua sessão terminou. Saia e entre novamente.')
    return saved
  }

  const request = async (route: string, body?: unknown, timeout = 15000) => {
    const owner = getUsername()
    const { url, token } = config()
    const response = await fetch(new URL(route, url), {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(timeout)
    })
    const result = await response.json()
    if (getUsername() !== owner) throw new Error('A conta foi alterada durante a solicitação.')
    if (response.status === 401) throw new Error('Sua sessão na comunidade expirou. Saia e entre novamente.')
    if (!response.ok)
      throw new Error(typeof result.error === 'string' ? result.error : 'Não foi possível acessar a comunidade.')
    return result
  }

  const send = (serverId: string, value: { snapshot?: CommunitySnapshot; error?: string; accessRevoked?: boolean }) => {
    if (!window.isDestroyed() && !contents.isDestroyed()) contents.send('community-state', { serverId, ...value })
  }

  const subscribe = async (serverId: string, owner: string, controller: AbortController) => {
    let delay = 1000
    while (!controller.signal.aborted && getUsername() === owner) {
      const attempt = new AbortController()
      const cancel = () => attempt.abort()
      controller.signal.addEventListener('abort', cancel, { once: true })
      try {
        const { url, token } = config()
        const connectionTimer = setTimeout(() => attempt.abort(), 10000)
        let response: Response
        try {
          response = await fetch(new URL(`/servers/${serverId}/events`, url), {
            headers: { Authorization: 'Bearer ' + token },
            signal: attempt.signal
          })
        } finally {
          clearTimeout(connectionTimer)
        }
        if (response.status === 403) {
          send(serverId, { accessRevoked: true })
          controller.abort()
          return
        }
        if (!response.ok || !response.body) throw new Error('Não foi possível acompanhar a comunidade.')
        const reader = response.body.getReader(),
          decoder = new TextDecoder()
        let buffer = ''
        delay = 1000
        try {
          while (!controller.signal.aborted) {
            const chunk = await reader.read()
            if (chunk.done) throw new Error('A conexão com a comunidade foi interrompida.')
            if (getUsername() !== owner) {
              controller.abort()
              break
            }
            buffer += decoder.decode(chunk.value, { stream: true })
            if (buffer.length > 32 * 1024 * 1024) throw new Error('Resposta da comunidade grande demais.')
            let end: number
            while ((end = buffer.indexOf('\n\n')) !== -1) {
              const packet = buffer.slice(0, end)
              buffer = buffer.slice(end + 2)
              const data = packet
                .split('\n')
                .filter(line => line.startsWith('data: '))
                .map(line => line.slice(6))
                .join('\n')
              if (data) {
                const snapshot = JSON.parse(data) as CommunitySnapshot
                if (snapshot.actor !== owner || snapshot.id !== serverId)
                  throw new Error('Identidade da comunidade inconsistente.')
                if (packet.split('\n').includes('event: access-revoked')) {
                  send(serverId, { accessRevoked: true })
                  controller.abort()
                  return
                }
                send(serverId, { snapshot })
              }
            }
          }
        } finally {
          await reader.cancel().catch(() => {})
        }
      } catch (error) {
        if (controller.signal.aborted || getUsername() !== owner) return
        send(serverId, { error: error instanceof Error ? error.message : 'Falha na conexão com a comunidade.' })
      } finally {
        controller.signal.removeEventListener('abort', cancel)
        attempt.abort()
      }
      if (!controller.signal.aborted)
        await new Promise<void>(resolve => {
          const done = () => {
            clearTimeout(timer)
            controller.signal.removeEventListener('abort', done)
            resolve()
          }
          const timer = setTimeout(done, delay)
          controller.signal.addEventListener('abort', done, { once: true })
        })
      delay = Math.min(30000, delay * 2)
    }
  }

  const handlers: Record<string, (...args: any[]) => unknown> = {
    'community-status': () => {
      const owner = getUsername()
      return owner && readCommunityConfig(owner)
        ? { configured: true, url: COMMUNITY_URL }
        : { configured: false, url: COMMUNITY_URL }
    },
    'community-servers': async () => ((await request('/identity')).servers as Array<{ id: string; name: string }>),
    'community-create-server': async (name: string) => {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 60)
        throw new Error('Use um nome de 1 a 60 caracteres.')
      return request('/servers', { name: name.trim() })
    },
    'community-snapshot': async (serverId: string) => {
      if (!validId(serverId)) throw new Error('Servidor inválido.')
      return request(`/servers/${serverId}`)
    },
    'community-invite-preview': async (code: string) => {
      if (!validInviteCode(code)) throw new Error('Convite inválido.')
      return request(`/invites/${code}`)
    },
    'community-invite-accept': async (code: string) => {
      if (!validInviteCode(code)) throw new Error('Convite inválido.')
      return request(`/invites/${code}/accept`, {})
    },
    'community-presence-token': async (name: string) => {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 40)
        throw new Error('Nome de exibição inválido.')
      return request('/presence-token', { name: name.trim() })
    },
    'community-expression-libraries': () => request('/expression-libraries'),
    'community-expressions': (serverId: string) => {
      if (!validId(serverId)) throw new Error('Servidor inválido.')
      return request('/servers/' + serverId + '/expressions')
    },
    'community-webhook': async (
      serverId: string,
      revision: number,
      action: import('../src/roles/webhooks').WebhookCommand
    ) => {
      if (!validId(serverId) || !Number.isSafeInteger(revision) || revision < 0 || !action || JSON.stringify(action).length > 2000)
        throw new Error('Operação de integração inválida.')
      return request('/servers/' + serverId + '/webhooks', { revision, action })
    },
    'community-message': async (serverId: string, channelId: string, messageId: string) => {
      if (!validId(serverId) || !validId(channelId) || !validId(messageId)) throw new Error('Mensagem inválida.')
      return request(`/servers/${serverId}/messages/${channelId}/${messageId}`)
    },
    'community-insights': async (serverId: string, days: number, timeZone: string) => {
      if (!validId(serverId) || ![7, 30].includes(days) || typeof timeZone !== 'string' || timeZone.length > 100)
        throw new Error('Consulta de estatísticas inválida.')
      return request(`/servers/${serverId}/insights?days=${days}&timeZone=${encodeURIComponent(timeZone)}`)
    },
    'community-pins': async (serverId: string, channelId: string) => {
      if (!validId(serverId) || !validId(channelId)) throw new Error('Canal inválido.')
      return request(`/servers/${serverId}/pins/${channelId}`)
    },
    'community-history': async (serverId: string, channelId: string, before?: string) => {
      if (!validId(serverId) || !validId(channelId) || (before !== undefined && !validId(before)))
        throw new Error('Histórico inválido.')
      return request(`/servers/${serverId}/history/${channelId}${before ? '?before=' + encodeURIComponent(before) : ''}`)
    },
    'community-command': async (serverId: string, revision: number, action: CommunityAction) => {
      if (!validId(serverId) || !Number.isSafeInteger(revision) || revision < 0)
        throw new Error('Revisão da comunidade inválida.')
      const serialized = JSON.stringify(action)
      if (!serialized || serialized.length > 100000) throw new Error('Comando inválido.')
      return request(`/servers/${serverId}/commands`, { revision, action })
    },
    'community-voice-token': async (serverId: string, channelId: string) => {
      if (!validId(serverId) || !validId(channelId)) throw new Error('Canal inválido.')
      return request(`/servers/${serverId}/voice-token`, { channelId })
    },
    'community-occupants': async (serverId: string) => {
      if (!validId(serverId)) throw new Error('Servidor inválido.')
      return request(`/servers/${serverId}/occupants`)
    },
    'community-subscribe': (serverId: string) => {
      if (!validId(serverId)) throw new Error('Servidor inválido.')
      config()
      stream?.abort()
      stream = new AbortController()
      void subscribe(serverId, getUsername()!, stream)
    },
    'community-unsubscribe': () => {
      stream?.abort()
      stream = undefined
    }
  }

  for (const [channel, handler] of Object.entries(handlers))
    ipcMain.handle(channel, (event, ...args) => {
      if (event.sender !== contents || event.senderFrame !== contents.mainFrame) throw new Error('Origem inválida.')
      if (!getUsername() && channel !== 'community-unsubscribe') throw new Error('Entre no ConTALK.')
      return handler(...args)
    })

  window.once('closed', () => {
    stream?.abort()
    for (const channel of Object.keys(handlers)) ipcMain.removeHandler(channel)
  })
}
