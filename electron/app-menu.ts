import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

const editCommands = ['undo', 'redo', 'cut', 'copy', 'paste', 'delete', 'selectAll'] as const

export interface WorkspaceFileEntry {
  name: string
  path: string
  isDirectory: boolean
  size?: number
}

// Backs the Arquivo/Editar/Exibir menus drawn in the renderer title bar and local workspace fs.
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

  // Workspace filesystem read / write
  ipcMain.handle('workspace-list-files', async (event, dirPath: unknown) => {
    trusted(event)
    if (typeof dirPath !== 'string' || !path.isAbsolute(dirPath)) throw new Error('Caminho de pasta inválido.')
    try {
      const dirents = await fs.readdir(dirPath, { withFileTypes: true })
      const entries: WorkspaceFileEntry[] = []
      for (const ent of dirents) {
        if (ent.name.startsWith('.git') || ent.name === 'node_modules') continue
        const fullPath = path.join(dirPath, ent.name)
        let size: number | undefined
        if (ent.isFile()) {
          try {
            const stat = await fs.stat(fullPath)
            size = stat.size
          } catch { /* ignore */ }
        }
        entries.push({
          name: ent.name,
          path: fullPath,
          isDirectory: ent.isDirectory(),
          size
        })
      }
      return entries
    } catch (e) {
      throw new Error('Falha ao listar diretório: ' + (e instanceof Error ? e.message : String(e)))
    }
  })

  ipcMain.handle('workspace-read-file', async (event, filePath: unknown) => {
    trusted(event)
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) throw new Error('Caminho de arquivo inválido.')
    try {
      const stat = await fs.stat(filePath)
      if (stat.size > 2 * 1024 * 1024) throw new Error('Arquivo maior que 2 MB.')
      const content = await fs.readFile(filePath, 'utf8')
      return content
    } catch (e) {
      throw new Error('Falha ao ler arquivo: ' + (e instanceof Error ? e.message : String(e)))
    }
  })

  ipcMain.handle('workspace-write-file', async (event, filePath: unknown, content: unknown) => {
    trusted(event)
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) throw new Error('Caminho de arquivo inválido.')
    if (typeof content !== 'string') throw new Error('Conteúdo inválido.')
    try {
      await fs.writeFile(filePath, content, 'utf8')
      return true
    } catch (e) {
      throw new Error('Falha ao gravar arquivo: ' + (e instanceof Error ? e.message : String(e)))
    }
  })

  window.once('closed', () => {
    for (const channel of [
      'app-quit',
      'window-edit',
      'window-fullscreen',
      'dialog-open-folder',
      'workspace-list-files',
      'workspace-read-file',
      'workspace-write-file'
    ]) ipcMain.removeHandler(channel)
  })
}
