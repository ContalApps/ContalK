import { BrowserWindow, ipcMain } from 'electron'

// Sem a sobreposição nativa do Windows: minimizar, maximizar e fechar são desenhados pelo app
// (src/components/WindowControls.tsx) para seguir o tema e o visual do ConTalk.
export const titleBarOptions = {
  titleBarStyle: 'hidden' as const,
}

type WindowAction = 'minimize' | 'maximize' | 'close'

export function setupTitleBar(window: BrowserWindow) {
  const fromMainFrame = (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame
  // Mantido por compatibilidade com renderers antigos; o tema já não altera nada nativo.
  const appearance = () => {}
  const control = (event: Electron.IpcMainInvokeEvent, action: unknown) => {
    if (!fromMainFrame(event) || !['minimize', 'maximize', 'close'].includes(String(action))) return false
    const value = action as WindowAction
    if (value === 'minimize') window.minimize()
    else if (value === 'maximize') { if (window.isMaximized()) window.unmaximize(); else window.maximize() }
    else window.close()
    return window.isMaximized()
  }
  const state = (event: Electron.IpcMainInvokeEvent) => fromMainFrame(event) ? window.isMaximized() : false
  const notify = () => { if (!window.isDestroyed()) window.webContents.send('window-maximized', window.isMaximized()) }
  ipcMain.on('window-titlebar-appearance', appearance)
  ipcMain.handle('window-control', control)
  ipcMain.handle('window-maximized-state', state)
  window.on('maximize', notify)
  window.on('unmaximize', notify)
  window.once('closed', () => {
    ipcMain.removeListener('window-titlebar-appearance', appearance)
    ipcMain.removeHandler('window-control')
    ipcMain.removeHandler('window-maximized-state')
  })
}
