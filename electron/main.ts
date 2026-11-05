import { app, BrowserWindow, ipcMain, desktopCapturer, shell, screen } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { randomUUID, createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { setupSingleInstance, showMainWindow } from './single-instance'
import { setupStorage } from './storage'
import { setupTray } from './tray'
import { setupUpdates } from './updates'
import { setupTitleBar, titleBarOptions } from './title-bar'
import { setupSpeech } from './speech'
import { setupPushToTalk } from './push-to-talk'
import { setupNotifications } from './notifications'
import { readCommunityConfig, setupCommunity, signInCommunity, signOutCommunity, signUpCommunity } from './community'
import { setupCaptureAudio } from './capture-audio'
import { setupTerminal } from './terminal'
import { setupAppMenu } from './app-menu'
import { setupLinkPreview } from './link-preview'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬ dist-electron
// │ ├── main.js
// │ └── preload.mjs
// ├─┬ dist
// │ └── index.html

process.env.APP_ROOT = path.join(__dirname, '..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = app.isPackaged ? RENDERER_DIST : path.join(process.env.APP_ROOT, 'public')

let win: BrowserWindow | null = null
const isPrimaryInstance=setupSingleInstance(()=>win)


// Database local de usuários (armazenado em AppData/ConTALK/users.json)
function getUsersFilePath(): string {
  const dir = app.getPath('userData')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, 'users.json')
}

export interface LinkedSocialAccount {
  provider: 'google' | 'instagram' | 'linkedin'
  accountId: string
  email?: string
  username?: string
  displayName?: string
  avatarUrl?: string
  linkedAt: string
}

interface StoredUser {
  id: string
  username: string
  display_name: string
  email: string
  password_hash: string
  avatar?: string
  bio?: string
  created_at: string
  // Profiles created before accounts moved to the server are ignored and replaced.
  server?: true
  linkedAccounts?: Record<string, LinkedSocialAccount>
}

function loadUsers(): Record<string, StoredUser> {
  const file = getUsersFilePath()
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'))
    } catch {}
  }
  return {}
}

function saveUsers(users: Record<string, StoredUser>) {
  const file = getUsersFilePath()
  fs.writeFileSync(file, JSON.stringify(users, null, 2), 'utf-8')
}

function publicUser(u: StoredUser) { const { password_hash, ...safe } = u; return safe }
let sessionUser: string | null = null
function issueSession(username: string) {
  username = username.toLowerCase()
  sessionUser = username
  const token = randomUUID()
  fs.writeFileSync(path.join(app.getPath('userData'), 'session.json'), JSON.stringify({ username, token }))
  return token
}
ipcMain.handle('auth-session', (_event, token) => {
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'session.json'), 'utf8'))
    const user = loadUsers()[saved.username]
    if (saved.token !== token || !user?.server || !readCommunityConfig(saved.username)) return null
    sessionUser = saved.username
    return publicUser(user)
  } catch { return null }
})
ipcMain.handle('auth-logout', async () => {
  const owner = sessionUser
  sessionUser = null
  fs.writeFileSync(path.join(app.getPath('userData'), 'session.json'), '{}')
  if (owner) await signOutCommunity(owner)
})
ipcMain.handle('auth-accounts', () => Object.values(loadUsers()).filter(u => u.server).map(publicUser))
ipcMain.handle('auth-profile', (_event, profile) => {
  if (!sessionUser) throw new Error('Entre na sua conta.')
  const users = loadUsers(); const current = users[sessionUser]
  if (!current) throw new Error('Conta não encontrada.')
  if (typeof profile.display_name !== 'string' || !profile.display_name.trim() || profile.display_name.length > 40) throw new Error('Nome inválido.')
  if (typeof profile.bio !== 'string' || profile.bio.length > 240) throw new Error('Descrição inválida.')
  if (typeof profile.avatar !== 'string' || profile.avatar.length > 50000 || (profile.avatar && !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(profile.avatar))) throw new Error('Foto inválida.')
  Object.assign(current, { display_name: profile.display_name.trim(), bio: profile.bio, avatar: profile.avatar })
  saveUsers(users)
  return publicUser(current)
})

ipcMain.handle('auth-social-link', (_event, { provider, accountData }: { provider: 'google' | 'instagram' | 'linkedin'; accountData: Partial<LinkedSocialAccount> }) => {
  if (!sessionUser) throw new Error('Entre na sua conta para vincular redes sociais.')
  const users = loadUsers()
  const current = users[sessionUser]
  if (!current) throw new Error('Conta não encontrada.')
  if (!current.linkedAccounts) current.linkedAccounts = {}
  const accountId = accountData.accountId || accountData.email || accountData.username || `id_${Date.now()}`
  current.linkedAccounts[provider] = {
    provider,
    accountId,
    email: accountData.email,
    username: accountData.username,
    displayName: accountData.displayName || accountData.username || accountData.email,
    avatarUrl: accountData.avatarUrl,
    linkedAt: new Date().toISOString()
  }
  saveUsers(users)
  return publicUser(current)
})

ipcMain.handle('auth-social-unlink', (_event, provider: 'google' | 'instagram' | 'linkedin') => {
  if (!sessionUser) throw new Error('Entre na sua conta.')
  const users = loadUsers()
  const current = users[sessionUser]
  if (!current) throw new Error('Conta não encontrada.')
  if (current.linkedAccounts && current.linkedAccounts[provider]) {
    delete current.linkedAccounts[provider]
    saveUsers(users)
  }
  return publicUser(current)
})

async function syncSocialCommunityAccount(provider: string, email: string, displayName: string) {
  const cleanEmail = email.trim().toLowerCase()
  const cleanBase = (cleanEmail.split('@')[0] || displayName || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 24)
  let baseUsername = cleanBase.length >= 3 ? cleanBase : `${cleanBase}user`

  const socialSecret = createHash('sha256')
    .update(`${provider}:${cleanEmail}:contalk-social-secret-v1`)
    .digest('hex')

  try {
    return await signInCommunity(cleanEmail, socialSecret)
  } catch (loginErr: any) {
    let attemptUsername = baseUsername
    let counter = 1
    while (counter <= 10) {
      try {
        return await signUpCommunity(attemptUsername, cleanEmail, socialSecret)
      } catch (regErr: any) {
        const msg = String(regErr?.message || '')
        if (/já está em uso/i.test(msg) && /e-mail/i.test(msg)) {
          return await signInCommunity(attemptUsername, socialSecret)
        }
        if (/já está em uso/i.test(msg)) {
          attemptUsername = `${baseUsername}${counter++}`
          continue
        }
        throw regErr
      }
    }
    throw loginErr
  }
}

ipcMain.handle('auth-social-popup', async (_event, provider: 'google' | 'instagram' | 'linkedin') => {
  return new Promise(resolve => {
    let resolved = false
    const finish = (result: any) => {
      if (!resolved) {
        resolved = true
        try { if (!authWin.isDestroyed()) authWin.close() } catch {}
        resolve(result)
      }
    }

    const titles: Record<string, string> = {
      google: 'Google',
      instagram: 'Instagram',
      linkedin: 'LinkedIn'
    }
    const urls: Record<string, string> = {
      google: 'https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&hl=pt-BR',
      instagram: 'https://www.instagram.com/accounts/login/',
      linkedin: 'https://www.linkedin.com/login'
    }

    const authWin = new BrowserWindow({
      width: 520,
      height: 680,
      title: `Entrar com ${titles[provider]} - ConTALK`,
      parent: win || undefined,
      modal: true,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      }
    })

    authWin.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')

    authWin.loadURL(urls[provider]).catch(() => {
      finish({ type: 'Error', data: 'fallback_to_modal' })
    })

    const checkSuccess = async () => {
      if (resolved || authWin.isDestroyed()) return
      const currentUrl = authWin.webContents.getURL()

      if (provider === 'google') {
        const isOutsideLogin = currentUrl.includes('myaccount.google.com') ||
          (currentUrl.includes('google.com') && !currentUrl.includes('/signin') && !currentUrl.includes('/ServiceLogin') && !currentUrl.includes('/v2/') && !currentUrl.includes('/v3/'))

        const cookies = await authWin.webContents.session.cookies.get({ domain: '.google.com' }).catch(() => [])
        const hasSession = cookies.some(c => c.name === 'SID' || c.name === 'SAPISID')

        if (isOutsideLogin || hasSession) {
          const profile = await authWin.webContents.executeJavaScript(`(() => {
            try {
              const el = document.querySelector('[data-email]') || document.querySelector('a[aria-label*="@"]');
              const email = el?.getAttribute('data-email') || el?.getAttribute('aria-label')?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/)?.[0] || '';
              const h = document.querySelector('h1, h2')?.textContent || '';
              return { email, name: h };
            } catch { return { email: '', name: '' }; }
          })()`).catch(() => ({ email: '', name: '' }))

          const email = profile.email || cookies.find(c => c.name === 'ACCOUNT_CHOOSER')?.value?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0]
          if (email) {
            try {
              const remote = await syncSocialCommunityAccount('google', email, profile.name || email.split('@')[0])
              const users = loadUsers()
              const current: StoredUser = users[remote.username] || {
                id: `usr_${Date.now()}`,
                username: remote.username,
                display_name: profile.name || remote.username,
                email: remote.email,
                password_hash: '',
                created_at: new Date().toISOString(),
                server: true,
                linkedAccounts: {}
              }
              if (!current.linkedAccounts) current.linkedAccounts = {}
              current.linkedAccounts.google = {
                provider: 'google',
                accountId: email,
                email,
                displayName: profile.name || remote.username,
                linkedAt: new Date().toISOString()
              }
              users[remote.username] = current
              saveUsers(users)
              const token = issueSession(remote.username)
              finish({ type: 'Success', data: { token, user: publicUser(current) } })
              return
            } catch (err: any) {
              finish({ type: 'Error', data: err?.message || 'Falha ao vincular com a comunidade.' })
              return
            }
          } else {
            finish({ type: 'Error', data: 'fallback_to_modal' })
            return
          }
        }
      } else if (provider === 'instagram') {
        if (!currentUrl.includes('/accounts/login/') && currentUrl.includes('instagram.com')) {
          const cookies = await authWin.webContents.session.cookies.get({ domain: '.instagram.com' }).catch(() => [])
          const dsUser = cookies.find(c => c.name === 'ds_user_id')?.value
          if (dsUser) {
            finish({ type: 'Error', data: 'fallback_to_modal' })
            return
          }
        }
      } else if (provider === 'linkedin') {
        if (currentUrl.includes('/feed') || currentUrl.includes('/in/')) {
          finish({ type: 'Error', data: 'fallback_to_modal' })
          return
        }
      }
    }

    const checkInterval = setInterval(checkSuccess, 1000)

    authWin.webContents.on('did-navigate', () => { void checkSuccess() })
    authWin.webContents.on('did-navigate-in-page', () => { void checkSuccess() })

    authWin.on('closed', () => {
      clearInterval(checkInterval)
      if (!resolved) {
        resolved = true
        resolve({ type: 'Cancelled', error: 'Autenticação cancelada pelo usuário.' })
      }
    })
  })
})

ipcMain.handle('auth-social-login', async (_event, { provider, accountData }: { provider: 'google' | 'instagram' | 'linkedin'; accountData?: { email?: string; username?: string; displayName?: string; accountId?: string; avatarUrl?: string } }) => {
  try {
    const data = accountData || {}
    const rawEmail = data.email || (data.accountId?.includes('@') ? data.accountId : '')
    const rawUsername = data.username || (!data.accountId?.includes('@') ? data.accountId : '')
    const displayName = data.displayName || rawUsername || rawEmail.split('@')[0] || ''

    if (!rawEmail && !rawUsername && !displayName) {
      const users = loadUsers()
      const existing = Object.values(users).find(u => u.linkedAccounts?.[provider])
      if (existing) {
        const token = issueSession(existing.username)
        return { type: 'Success', data: { token, user: publicUser(existing) } }
      }
      return { type: 'Error', data: 'Nenhuma conta vinculada encontrada. Autentique-se com sua conta para continuar.' }
    }

    const cleanUsername = (rawUsername || rawEmail.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9_-]/g, '')
    const email = rawEmail || `${cleanUsername}@${provider}.social`
    const finalDisplayName = displayName || cleanUsername

    const remote = await syncSocialCommunityAccount(provider, email, finalDisplayName)

    const users = loadUsers()
    const current: StoredUser = users[remote.username] || {
      id: `usr_${Date.now()}`,
      username: remote.username,
      display_name: finalDisplayName,
      email: remote.email,
      password_hash: '',
      created_at: new Date().toISOString(),
      server: true,
      linkedAccounts: {}
    }

    if (!current.linkedAccounts) current.linkedAccounts = {}
    current.linkedAccounts[provider] = {
      provider,
      accountId: data.accountId || email,
      email: remote.email,
      username: rawUsername || undefined,
      displayName: finalDisplayName,
      avatarUrl: data.avatarUrl,
      linkedAt: new Date().toISOString()
    }
    current.display_name = finalDisplayName
    current.email = remote.email
    users[remote.username] = current
    saveUsers(users)

    const token = issueSession(remote.username)
    return { type: 'Success', data: { token, user: publicUser(current) } }
  } catch (error) {
    return { type: 'Error', data: error instanceof Error ? error.message : 'Falha ao autenticar com rede social.' }
  }
})

function createWindow() {
  if(process.platform==='win32')app.setAppUserModelId('com.contalk.app')
  const iconPath = path.join(process.env.VITE_PUBLIC!, 'app-icon.png')

  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#000000',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    ...titleBarOptions,
    title: 'ConTALK',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  })

  setupUpdates(win)
  setupTitleBar(win)
  setupNotifications(win)
  setupTray(win)
  setupStorage(win,()=>sessionUser)
  setupCommunity(win,()=>sessionUser)
  setupCaptureAudio(win)
  setupPushToTalk(win)
  setupSpeech(win)
  const terminals = setupTerminal(win)
  setupAppMenu(win, terminals.killAll)
  setupLinkPreview(win)

  // Test active push message to Renderer_process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// ─── IPC: Captura Nativa de Tela (Arquitetura Discord) ───────────────
ipcMain.handle('get-desktop-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 360, height: 200 },
      fetchWindowIcons: true,
    })

    return sources.map((s) => ({
      id: s.id, // ex: "screen:0:0" ou "window:12345:0"
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
      appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
      display_id: s.display_id,
      isScreen: s.id.startsWith('screen:'),
      width: Math.round((screen.getAllDisplays().find(d => String(d.id) === s.display_id)?.bounds.width || 1920) * (screen.getAllDisplays().find(d => String(d.id) === s.display_id)?.scaleFactor || 1)),
      height: Math.round((screen.getAllDisplays().find(d => String(d.id) === s.display_id)?.bounds.height || 1080) * (screen.getAllDisplays().find(d => String(d.id) === s.display_id)?.scaleFactor || 1)),
      isPrimary: s.display_id === String(screen.getPrimaryDisplay().id),
    }))
  } catch (err: any) {
    console.error('Falha ao obter desktop sources:', err)
    return []
  }
})

// ─── IPC: Autenticação de Usuários ──────────────────────────────────
// Accounts exist only on the ConTALK server; this computer keeps the session and a profile cache (name, photo, bio).
function rememberProfile(remote: { username: string; email: string }, fresh: boolean) {
  const users = loadUsers(), cached = users[remote.username]
  const profile: StoredUser = !fresh && cached?.server ? { ...cached, email: remote.email } : { id: `usr_${Date.now()}`, username: remote.username, display_name: remote.username, email: remote.email, password_hash: '', created_at: new Date().toISOString(), server: true }
  users[remote.username] = profile
  saveUsers(users)
  return { type: 'Success', data: { token: issueSession(profile.username), user: publicUser(profile) } }
}
ipcMain.handle('auth-login', async (_event, { identifier, password }) => {
  try { return rememberProfile(await signInCommunity(identifier, password), false) } catch (error) {
    return { type: 'Error', data: error instanceof Error ? error.message : 'Não foi possível entrar.' }
  }
})

ipcMain.handle('auth-register', async (_event, { username, email, password }) => {
  try { return rememberProfile(await signUpCommunity(username, email, password), true) } catch (error) {
    return { type: 'Error', data: error instanceof Error ? error.message : 'Não foi possível criar a conta.' }
  }
})

// ─── Ciclo de Vida da Aplicação ─────────────────────────────────────
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if(!isPrimaryInstance)return
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  } else {
    showMainWindow(win)
  }
})

if(isPrimaryInstance)app.whenReady().then(createWindow)
