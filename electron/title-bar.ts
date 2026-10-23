import { BrowserWindow, ipcMain } from 'electron'

export const titleBarOptions = {
  titleBarStyle: 'hidden' as const,
  titleBarOverlay: { color: '#090c0f', symbolColor: '#c7cbd1', height: 36 },
}

export function setupTitleBar(window: BrowserWindow) {
  const appearance = (event: Electron.IpcMainEvent, theme: unknown, scale: unknown) => {
    if (process.platform === 'darwin') return
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) return
    if (!['classic', 'vice-city'].includes(String(theme)) || typeof scale !== 'number' || !Number.isInteger(scale) || scale < 80 || scale > 125 || scale % 5 !== 0) return
    window.setTitleBarOverlay({color: theme === 'vice-city' ? '#172b26' : '#090c0f', symbolColor: theme === 'vice-city' ? '#eee4cb' : '#c7cbd1', height: Math.round(36 * scale / 100)})
  }
  ipcMain.on('window-titlebar-appearance', appearance)
  window.once('closed', () => ipcMain.removeListener('window-titlebar-appearance', appearance))
}
