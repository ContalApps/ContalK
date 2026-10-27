import { app, BrowserWindow, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { IPty } from 'node-pty'

type Spawn = (file: string, args: string[], options: { cwd: string; cols: number; rows: number; env: Record<string, string>; name: string }) => IPty
type Events = { data: (id: string, data: string) => void; exit: (id: string, code: number) => void }

const MAX_SESSIONS = 8
const size = (value: unknown, fallback: number) => Number.isInteger(value) && (value as number) >= 2 && (value as number) <= 500 ? value as number : fallback

export function defaultShell() {
  if (process.platform !== 'win32') return { file: process.env.SHELL || '/bin/bash', args: [] as string[], name: path.basename(process.env.SHELL || 'bash') }
  const pwsh = (process.env.PATH || '').split(';').map(dir => path.join(dir, 'pwsh.exe')).find(file => fs.existsSync(file))
  return pwsh ? { file: pwsh, args: ['-NoLogo'], name: 'pwsh' } : { file: 'powershell.exe', args: ['-NoLogo'], name: 'powershell' }
}

// Terminal sessions stay on this computer; nothing here is sent to the community server.
export function createTerminalManager(spawn: Spawn, events: Events) {
  const sessions = new Map<string, IPty>()
  const manager = {
    create(cwd: unknown, cols: unknown, rows: unknown) {
      if (sessions.size >= MAX_SESSIONS) throw new Error('Limite de terminais abertos atingido.')
      const folder = typeof cwd === 'string' && cwd && path.isAbsolute(cwd) && fs.existsSync(cwd) && fs.statSync(cwd).isDirectory() ? cwd : os.homedir()
      const shell = defaultShell()
      const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      const pty = spawn(shell.file, shell.args, { cwd: folder, cols: size(cols, 80), rows: size(rows, 24), env, name: 'xterm-256color' })
      const id = randomUUID()
      sessions.set(id, pty)
      pty.onData(data => { if (sessions.has(id)) events.data(id, data) })
      pty.onExit(({ exitCode }) => { if (sessions.delete(id)) events.exit(id, exitCode) })
      return { id, shell: shell.name, cwd: folder }
    },
    input(id: unknown, data: unknown) {
      if (typeof data !== 'string' || data.length > 100000) throw new Error('Entrada inválida.')
      sessions.get(id as string)?.write(data)
    },
    resize(id: unknown, cols: unknown, rows: unknown) { sessions.get(id as string)?.resize(size(cols, 80), size(rows, 24)) },
    kill(id: unknown) { const pty = sessions.get(id as string); if (!pty) return; sessions.delete(id as string); try { pty.kill() } catch { /* already gone */ } },
    killAll() { for (const id of [...sessions.keys()]) manager.kill(id) },
    get count() { return sessions.size },
  }
  return manager
}

export function setupTerminal(window: BrowserWindow) {
  const { spawn } = createRequire(import.meta.url)('node-pty') as { spawn: Spawn }
  const send = (channel: string, value: unknown) => { if (!window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send(channel, value) }
  const manager = createTerminalManager(spawn, { data: (id, data) => send('terminal-data', { id, data }), exit: (id, code) => send('terminal-exit', { id, code }) })
  const trusted = (event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent) => event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame
  ipcMain.handle('terminal-create', (event, cwd, cols, rows) => { if (!trusted(event)) throw new Error('Origem inválida.'); return manager.create(cwd, cols, rows) })
  ipcMain.on('terminal-input', (event, id, data) => { if (trusted(event)) try { manager.input(id, data) } catch { /* ignore malformed input */ } })
  ipcMain.on('terminal-resize', (event, id, cols, rows) => { if (trusted(event)) manager.resize(id, cols, rows) })
  ipcMain.handle('terminal-kill', (event, id) => { if (!trusted(event)) throw new Error('Origem inválida.'); manager.kill(id) })
  window.webContents.on('render-process-gone', manager.killAll)
  window.webContents.on('did-start-navigation', (_event, _url, _inPlace, isMainFrame) => { if (isMainFrame) manager.killAll() })
  app.on('before-quit', manager.killAll)
  window.once('closed', () => { manager.killAll(); app.removeListener('before-quit', manager.killAll); ipcMain.removeHandler('terminal-create'); ipcMain.removeHandler('terminal-kill'); ipcMain.removeAllListeners('terminal-input'); ipcMain.removeAllListeners('terminal-resize') })
  return manager
}
