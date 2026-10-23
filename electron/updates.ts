import { app, BrowserWindow, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import type { UpdateState } from '../src/types/desktop'

// electron-updater is CommonJS; keep it external to the Vite main-process bundle.
const require = createRequire(import.meta.url)
const { autoUpdater } = require('electron-updater') as typeof import('electron-updater')

export function setupUpdates(window: BrowserWindow) {
  let state: UpdateState = { status: 'idle', version: '', progress: 0 }
  let checking = false
  let downloading = false
  let manualCheck = false
  const send = (next: Partial<UpdateState>) => {
    state = { ...state, ...next }
    if (!window.isDestroyed()) window.webContents.send('update-state', state)
  }
  const check = async (manual = false) => {
    if (!app.isPackaged || checking || downloading || state.status === 'ready') return state
    checking = true
    manualCheck = manual
    if (manual) send({ status: 'checking', error: undefined })
    try { await autoUpdater.checkForUpdates() }
    catch (error) {
      if (manual) send({ status: 'error', error: error instanceof Error ? error.message : 'Não foi possível buscar atualizações.' })
    } finally { checking = false; manualCheck = false }
    return state
  }
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowDowngrade = false
  autoUpdater.allowPrerelease = false
  autoUpdater.on('update-available', info => send({ status: 'available', version: info.version, progress: 0, error: undefined }))
  autoUpdater.on('update-not-available', () => send({ status: 'idle', error: undefined }))
  autoUpdater.on('download-progress', info => send({ status: 'downloading', progress: Math.round(info.percent) }))
  autoUpdater.on('update-downloaded', info => send({ status: 'ready', version: info.version, progress: 100, error: undefined }))
  autoUpdater.on('error', error => {
    if (manualCheck || downloading) send({ status: 'error', error: error.message })
    else console.warn('Falha na verificação automática de atualização:', error.message)
  })
  const trusted = (event: Electron.IpcMainInvokeEvent) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Origem inválida.')
  }
  ipcMain.handle('update-get-state', event => { trusted(event); return state })
  ipcMain.handle('update-check', event => { trusted(event); return check(true) })
  ipcMain.handle('update-download', async event => {
    trusted(event)
    if (downloading || !['available', 'error'].includes(state.status) || !state.version) return
    downloading = true
    send({ status: 'downloading', progress: 0, error: undefined })
    try { await autoUpdater.downloadUpdate() }
    catch (error) { send({ status: 'error', error: error instanceof Error ? error.message : 'Falha no download.' }); throw error }
    finally { downloading = false }
  })
  ipcMain.handle('update-install', event => {
    trusted(event)
    if (state.status !== 'ready') throw new Error('A atualização ainda não está pronta.')
    // Leave time for the IPC reply before closing the renderer and starting NSIS.
    setImmediate(() => autoUpdater.quitAndInstall(false, true))
  })
  const startup = setTimeout(() => void check(), 5000)
  const interval = setInterval(() => void check(), 30 * 60 * 1000)
  window.once('closed', () => {
    clearTimeout(startup); clearInterval(interval)
    for (const channel of ['update-get-state', 'update-check', 'update-download', 'update-install']) ipcMain.removeHandler(channel)
    autoUpdater.removeAllListeners()
  })
}
