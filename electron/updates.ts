import { app, BrowserWindow, ipcMain } from 'electron'
import { createUpdateProgress, startInstallProgress, finishInstallProgress } from './update-progress'
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
  let installing = false
  let popup: ReturnType<typeof createUpdateProgress> | null = null
  let cancelInstallProgress: (() => void) | undefined
  window.webContents.once('did-finish-load', finishInstallProgress)
  const send = (next: Partial<UpdateState>) => {
    state = { ...state, ...next }
    if (!window.isDestroyed()) { window.webContents.send('update-state', state); window.setProgressBar(state.status === 'downloading' ? state.progress / 100 : -1) }
    popup?.send(state)
  }
  const check = async (manual = false) => {
    if (!app.isPackaged || checking || downloading || installing || state.status === 'ready') return state
    checking = true
    manualCheck = manual
    if (manual) send({ status: 'checking', error: undefined })
    try { await autoUpdater.checkForUpdates() }
    catch (error) {
      if (manual) send({ status: 'error', error: error instanceof Error ? error.message : 'Não foi possível buscar atualizações.' })
    } finally { checking = false; manualCheck = false }
    return state
  }
  const install = async () => {
    if (installing) return
    if (state.status !== 'ready') throw new Error('A atualização ainda não está pronta.')
    installing = true
    send({ status: 'installing', error: undefined })
    try {
      cancelInstallProgress = await startInstallProgress(state.version)
      popup?.destroy(); popup = null
      window.hide()
      setImmediate(() => {
        try { autoUpdater.quitAndInstall(true, true) }
        catch (error) { installing = false; cancelInstallProgress?.(); cancelInstallProgress = undefined; window.show(); send({status:'error',error:error instanceof Error ? error.message : 'Falha ao iniciar o instalador.'}) }
      })
    } catch (error) {
      installing = false; cancelInstallProgress?.(); cancelInstallProgress = undefined
      send({status:'error',error:error instanceof Error ? error.message : 'Não foi possível iniciar a instalação.'})
      window.show()
      throw error
    }
  }
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowDowngrade = false
  autoUpdater.allowPrerelease = false
  autoUpdater.on('update-available', info => send({ status: 'available', version: info.version, releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : info.releaseNotes?.map(note => `v${note.version}\n${note.note || ''}`).join('\n\n') || '', progress: 0, error: undefined }))
  autoUpdater.on('update-not-available', () => send({ status: 'idle', version: '', releaseNotes: '', error: undefined }))
  autoUpdater.on('download-progress', info => send({ status: 'downloading', progress: Math.round(info.percent) }))
  autoUpdater.on('update-downloaded', info => send({ status: 'ready', version: info.version, progress: 100, error: undefined }))
  autoUpdater.on('error', error => {
    if (installing) { installing = false; cancelInstallProgress?.(); cancelInstallProgress = undefined; window.show(); send({status:'error',error:error.message}) }
    else if (manualCheck || downloading) send({ status: 'error', error: error.message })
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
    try {
      popup?.destroy(); popup = createUpdateProgress(window, () => state)
      send({ status: 'downloading', progress: 0, error: undefined })
      window.hide()
      await autoUpdater.downloadUpdate(); if (state.status === 'ready') await install()
    }
    catch (error) { window.show(); send({ status: 'error', error: error instanceof Error ? error.message : 'Falha no download.' }); throw error }
    finally { downloading = false }
  })
  ipcMain.handle('update-install', event => { trusted(event); return install() })
  window.on('close', event => { if (downloading && !installing) event.preventDefault() })
  const startup = setTimeout(() => void check(), 5000)
  window.on('focus',()=>void check())
  const interval = setInterval(() => void check(), 5 * 60 * 1000)
  window.once('closed', () => {
    clearTimeout(startup); clearInterval(interval)
    popup?.destroy()
    for (const channel of ['update-get-state', 'update-check', 'update-download', 'update-install']) ipcMain.removeHandler(channel)
    autoUpdater.removeAllListeners()
  })
}
