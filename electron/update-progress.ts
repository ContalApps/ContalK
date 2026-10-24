import { app, BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { UpdateState } from '../src/types/desktop'

export function createUpdateProgress(parent: BrowserWindow, state: () => UpdateState) {
  const popup = new BrowserWindow({ width: 400, height: 310, frame: false, resizable: false, maximizable: false, minimizable: false, show: false, parent, modal: true, backgroundColor: '#110e19', title: 'Atualizando ConTALK', webPreferences: { preload: path.join(process.env.APP_ROOT!, 'dist-electron/preload.mjs'), contextIsolation: true, nodeIntegration: false } })
  let disposed = false
  popup.on('close', event => { if (!disposed && state().status !== 'error') event.preventDefault() })
  popup.webContents.once('did-finish-load', () => { if (!popup.isDestroyed()) { popup.webContents.send('update-state', state()); popup.show() } })
  void popup.loadFile(path.join(process.env.VITE_PUBLIC!, 'update-progress.html')).catch(() => { disposed = true; popup.destroy() })
  return {
    send: (value: UpdateState) => { if (!popup.isDestroyed()&&!popup.webContents.isDestroyed()) popup.webContents.send('update-state', value) },
    destroy: () => { disposed = true; if (!popup.isDestroyed()) popup.destroy() },
  }
}
const markerPath = () => path.join(app.getPath('userData'), 'pending-update.json')
export async function startInstallProgress(version: string): Promise<() => void> {
  const directory = fs.mkdtempSync(path.join(app.getPath('temp'), 'contalk-update-'))
  const executable = path.join(directory, 'contalk-update.exe')
  fs.copyFileSync(app.isPackaged ? path.join(process.resourcesPath, 'update/contalk-update.exe') : path.join(process.env.APP_ROOT!, 'native/bin/contalk-update.exe'), executable)
  const logo = path.join(directory, 'logo.png')
  fs.copyFileSync(path.join(process.env.VITE_PUBLIC!, 'contalk-avatar.png'), logo)
  const eventName = `Local\\ContalKUpdate-${randomUUID()}`
  const child = spawn(executable, ['--wait', eventName, logo], { detached: true, windowsHide: true, stdio: ['ignore','pipe','pipe'] })
  const cancel = () => { child.kill(); try { fs.unlinkSync(markerPath()) } catch { /* No pending marker. */ } }
  await new Promise<void>((resolve,reject) => {
    let output = ''
    const timeout = setTimeout(() => { cancel(); reject(new Error('A janela de atualização não respondeu.')) }, 5000)
    child.stdout.on('data', data => { output += data.toString(); if (output.includes('ready\n')) { clearTimeout(timeout); resolve() } })
    child.once('error', error => { clearTimeout(timeout); reject(error) })
    child.once('exit', () => { clearTimeout(timeout); reject(new Error('A janela de atualização foi encerrada antes de iniciar.')) })
    child.stderr.resume()
  })
  try { fs.writeFileSync(markerPath(), JSON.stringify({ version, eventName, executable, createdAt: Date.now() })) }
  catch (error) { cancel(); throw error }
  child.unref()
  return cancel
}
export function finishInstallProgress() {
  if (!app.isPackaged) return
  try {
    const pending = JSON.parse(fs.readFileSync(markerPath(),'utf8'))
    if (pending.version !== app.getVersion() || Date.now() - pending.createdAt > 24*60*60*1000) return
    const directory = path.dirname(pending.executable)
    if (path.dirname(directory) !== app.getPath('temp') || !/^contalk-update-[\w-]+$/.test(path.basename(directory)) || path.basename(pending.executable) !== 'contalk-update.exe' || !/^Local\\ContalKUpdate-[a-f0-9-]{36}$/.test(pending.eventName)) return
    const child = spawn(pending.executable, ['--finish', pending.eventName], { windowsHide: true, stdio: 'ignore' })
    child.on('error', () => {})
    child.unref()
    fs.unlinkSync(markerPath())
  } catch { /* Ordinary startup has no pending update. */ }
}
