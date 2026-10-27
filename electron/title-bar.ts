import { BrowserWindow, ipcMain } from 'electron'

export const titleBarOptions = {
  titleBarStyle: 'hidden' as const,
  titleBarOverlay: { color: '#000000', symbolColor: '#b3b3b3', height: 44 },
}

export function setupTitleBar(window: BrowserWindow) {
  const appearance = (event: Electron.IpcMainEvent, theme: unknown, scale: unknown) => {
    if (process.platform === 'darwin') return
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) return
    if (!['classic', 'vice-city'].includes(String(theme)) || typeof scale !== 'number' || !Number.isInteger(scale) || scale < 80 || scale > 120) return
    window.setTitleBarOverlay({color: theme === 'vice-city' ? '#172b26' : '#000000', symbolColor: theme === 'vice-city' ? '#eee4cb' : '#b3b3b3', height: Math.round(44 * scale / 100)})
  }
  ipcMain.on('window-titlebar-appearance', appearance)
  window.once('closed', () => ipcMain.removeListener('window-titlebar-appearance', appearance))
}
