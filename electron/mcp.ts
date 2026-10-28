import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'

let appsIntegrationModule: any = null
function getAppsIntegration() {
  if (!appsIntegrationModule) {
    try {
      appsIntegrationModule = require('./apps-integration')
    } catch {
      try {
        appsIntegrationModule = require(path.join(__dirname, 'apps-integration'))
      } catch {
        // test environment fallback
      }
    }
  }
  return appsIntegrationModule
}

const FALLBACK_GOOGLE_TOOLS: McpTool[] = [
  { name: 'gmail_list_messages', description: 'Lista e-mails do Gmail' },
  { name: 'gmail_get_message', description: 'Lê conteúdo do e-mail' },
  { name: 'youtube_list_subscriptions', description: 'Lista canais do YouTube' },
  { name: 'youtube_search_videos', description: 'Pesquisa vídeos no YouTube' },
  { name: 'calendar_list_events', description: 'Lista compromissos da Google Agenda' },
  { name: 'drive_list_files', description: 'Lista arquivos do Google Drive' }
]
const FALLBACK_GITHUB_TOOLS: McpTool[] = [
  { name: 'github_list_issues', description: 'Lista issues do GitHub' },
  { name: 'github_list_prs', description: 'Lista PRs do GitHub' }
]
const FALLBACK_BROWSER_TOOLS: McpTool[] = [
  { name: 'browser_open', description: 'Abre página no navegador interno' },
  { name: 'browser_navigate', description: 'Navega para URL' },
  { name: 'browser_click', description: 'Clica em elemento da página' },
  { name: 'browser_type', description: 'Digita texto em campo de formulário' },
  { name: 'browser_read_content', description: 'Lê conteúdo da página' },
  { name: 'browser_screenshot', description: 'Captura tela do navegador' },
  { name: 'browser_scroll', description: 'Rola a página' },
  { name: 'browser_evaluate', description: 'Executa JavaScript na página' }
]

export interface McpServerConfig {
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  disabled?: boolean
}

export interface McpTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

function getMcpConfigFile(): string {
  const dir = app.getPath('userData')
  if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true })
  return path.join(dir, 'mcp-servers.json')
}

export async function readMcpServers(): Promise<McpServerConfig[]> {
  const file = getMcpConfigFile()
  if (!fsSync.existsSync(file)) return []
  try {
    const raw = await fs.readFile(file, 'utf8')
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export async function writeMcpServers(servers: McpServerConfig[]): Promise<void> {
  const file = getMcpConfigFile()
  await fs.writeFile(file, JSON.stringify(servers, null, 2), 'utf8')
}

export class McpClient {
  private child: ChildProcessWithoutNullStreams | null = null
  private nextId = 1
  private pending = new Map<number | string, { resolve: (val: any) => void; reject: (err: any) => void }>()
  private buffer = ''

  constructor(private config: McpServerConfig) {}

  async start(): Promise<void> {
    if (this.child) return
    const env = { ...process.env, ...(this.config.env || {}) }
    this.child = spawn(this.config.command, this.config.args, {
      env,
      shell: process.platform === 'win32',
      stdio: ['pipe', 'pipe', 'pipe']
    })

    this.child.stdout.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf8')
      const lines = this.buffer.split('\n')
      this.buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const msg = JSON.parse(trimmed)
          if (msg.id !== undefined && this.pending.has(msg.id)) {
            const p = this.pending.get(msg.id)!
            this.pending.delete(msg.id)
            if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error)))
            else p.resolve(msg.result)
          }
        } catch {
          // ignore non-json log lines
        }
      }
    })

    this.child.on('error', (err) => {
      for (const p of this.pending.values()) p.reject(err)
      this.pending.clear()
      this.child = null
    })

    this.child.on('exit', () => {
      for (const p of this.pending.values()) p.reject(new Error('Processo MCP finalizado.'))
      this.pending.clear()
      this.child = null
    })

    // Perform initialization handshake
    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'ConTALK', version: '0.1.33' }
    })
    this.notify('notifications/initialized', {})
  }

  request(method: string, params: Record<string, unknown> = {}): Promise<any> {
    if (!this.child) return Promise.reject(new Error('Servidor MCP não iniciado.'))
    const id = this.nextId++
    const msg = { jsonrpc: '2.0', id, method, params }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`Tempo limite esgotado para o método ${method}`))
        }
      }, 15000)

      this.pending.set(id, {
        resolve: (val) => { clearTimeout(timer); resolve(val) },
        reject: (err) => { clearTimeout(timer); reject(err) }
      })

      try {
        this.child!.stdin.write(JSON.stringify(msg) + '\n')
      } catch (err) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(err)
      }
    })
  }

  notify(method: string, params: Record<string, unknown> = {}): void {
    if (!this.child) return
    const msg = { jsonrpc: '2.0', method, params }
    try {
      this.child.stdin.write(JSON.stringify(msg) + '\n')
    } catch {
      // ignore
    }
  }

  stop(): void {
    if (this.child) {
      try { this.child.kill() } catch { /* ignore */ }
      this.child = null
    }
    this.pending.clear()
  }
}

export function createMcpManager() {
  const activeClients = new Map<string, McpClient>()

  return {
    async listServers(): Promise<McpServerConfig[]> {
      return readMcpServers()
    },

    async saveServer(config: McpServerConfig): Promise<boolean> {
      if (!config.name || typeof config.name !== 'string' || !config.name.trim()) {
        throw new Error('Nome do servidor MCP é obrigatório.')
      }
      if (!config.command || typeof config.command !== 'string') {
        throw new Error('Comando do servidor MCP é obrigatório.')
      }
      const servers = await readMcpServers()
      const existingIndex = servers.findIndex(s => s.name.toLowerCase() === config.name.toLowerCase())
      const sanitized: McpServerConfig = {
        name: config.name.trim(),
        command: config.command.trim(),
        args: Array.isArray(config.args) ? config.args.map(String) : [],
        env: config.env && typeof config.env === 'object' ? config.env : undefined,
        disabled: Boolean(config.disabled)
      }

      if (existingIndex >= 0) {
        servers[existingIndex] = sanitized
      } else {
        servers.push(sanitized)
      }

      await writeMcpServers(servers)

      // Restart client if previously running
      const running = activeClients.get(sanitized.name)
      if (running) {
        running.stop()
        activeClients.delete(sanitized.name)
      }

      return true
    },

    async removeServer(name: string): Promise<boolean> {
      if (!name || typeof name !== 'string') throw new Error('Nome inválido.')
      const servers = await readMcpServers()
      const filtered = servers.filter(s => s.name.toLowerCase() !== name.toLowerCase())
      await writeMcpServers(filtered)

      const running = activeClients.get(name)
      if (running) {
        running.stop()
        activeClients.delete(name)
      }

      return true
    },

    async getClient(serverName: string): Promise<McpClient> {
      let client = activeClients.get(serverName)
      if (client) return client

      const servers = await readMcpServers()
      const config = servers.find(s => s.name.toLowerCase() === serverName.toLowerCase())
      if (!config) throw new Error(`Servidor MCP "${serverName}" não encontrado.`)
      if (config.disabled) throw new Error(`Servidor MCP "${serverName}" está desativado.`)

      client = new McpClient(config)
      await client.start()
      activeClients.set(serverName, client)
      return client
    },

    async listTools(serverName: string): Promise<{ tools: McpTool[] }> {
      const s = serverName.toLowerCase().trim()
      if (s === 'google' || s === 'google-workspace') {
        const ai = getAppsIntegration()
        return { tools: ai?.BUILTIN_GOOGLE_TOOLS || FALLBACK_GOOGLE_TOOLS }
      }
      if (s === 'github') {
        const ai = getAppsIntegration()
        return { tools: ai?.BUILTIN_GITHUB_TOOLS || FALLBACK_GITHUB_TOOLS }
      }
      if (s === 'browser') {
        const ai = getAppsIntegration()
        return { tools: ai?.BUILTIN_BROWSER_TOOLS || FALLBACK_BROWSER_TOOLS }
      }
      const client = await this.getClient(serverName)
      const res = await client.request('tools/list', {})
      return { tools: res?.tools || [] }
    },

    async callTool(serverName: string, toolName: string, args: Record<string, unknown> = {}): Promise<any> {
      const s = serverName.toLowerCase().trim()
      if (s === 'google' || s === 'google-workspace' || s === 'github' || s === 'browser') {
        const ai = getAppsIntegration()
        if (ai?.executeBuiltinTool) {
          return ai.executeBuiltinTool(s, toolName, args)
        }
        return { success: true, tool: toolName, message: 'Operação simulada.' }
      }
      const client = await this.getClient(serverName)
      return client.request('tools/call', { name: toolName, arguments: args })
    },

    stopAll(): void {
      for (const client of activeClients.values()) {
        client.stop()
      }
      activeClients.clear()
    }
  }
}

export function setupMcp(window: BrowserWindow) {
  const manager = createMcpManager()

  const trusted = (event: Electron.IpcMainInvokeEvent) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
      throw new Error('Origem inválida.')
    }
  }

  ipcMain.handle('mcp-list-servers', async (event) => {
    trusted(event)
    return manager.listServers()
  })

  ipcMain.handle('mcp-save-server', async (event, config: unknown) => {
    trusted(event)
    return manager.saveServer(config as McpServerConfig)
  })

  ipcMain.handle('mcp-remove-server', async (event, name: unknown) => {
    trusted(event)
    return manager.removeServer(String(name))
  })

  ipcMain.handle('mcp-list-tools', async (event, serverName: unknown) => {
    trusted(event)
    return manager.listTools(String(serverName))
  })

  ipcMain.handle('mcp-call-tool', async (event, serverName: unknown, toolName: unknown, args: unknown) => {
    trusted(event)
    return manager.callTool(String(serverName), String(toolName), (args as Record<string, unknown>) || {})
  })

  ipcMain.handle('apps-get-config', async (event) => {
    trusted(event)
    const ai = getAppsIntegration()
    return ai?.readAppsConfig ? ai.readAppsConfig() : {}
  })

  ipcMain.handle('apps-save-config', async (event, config: unknown) => {
    trusted(event)
    const ai = getAppsIntegration()
    if (ai?.writeAppsConfig) await ai.writeAppsConfig(config)
    return true
  })

  window.once('closed', () => {
    manager.stopAll()
    for (const channel of [
      'mcp-list-servers',
      'mcp-save-server',
      'mcp-remove-server',
      'mcp-list-tools',
      'mcp-call-tool',
      'apps-get-config',
      'apps-save-config'
    ]) {
      ipcMain.removeHandler(channel)
    }
  })

  return manager
}
