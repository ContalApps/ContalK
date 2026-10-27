import { app, BrowserWindow, dialog, ipcMain } from 'electron'

const editCommands = ['undo', 'redo', 'cut', 'copy', 'paste', 'delete', 'selectAll'] as const

// Backs the Arquivo/Editar/Exibir menus drawn in the renderer title bar.
export function setupAppMenu(window: BrowserWindow, onQuit: () => void) {
  const trusted = (event: Electron.IpcMainInvokeEvent) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Origem inválida.')
  }
  ipcMain.handle('app-quit', event => { trusted(event); onQuit(); app.quit() })
  ipcMain.handle('window-edit', (event, command: unknown) => {
    trusted(event)
    if (!editCommands.includes(command as typeof editCommands[number])) throw new Error('Comando inválido.')
    window.webContents[command as typeof editCommands[number]]()
  })
  ipcMain.handle('window-fullscreen', event => { trusted(event); window.setFullScreen(!window.isFullScreen()); return window.isFullScreen() })
  ipcMain.handle('dialog-open-folder', async event => {
    trusted(event)
    const result = await dialog.showOpenDialog(window, { title: 'Abrir pasta', properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0] || null
  })
  window.once('closed', () => { for (const channel of ['app-quit', 'window-edit', 'window-fullscreen', 'dialog-open-folder']) ipcMain.removeHandler(channel) })
}
