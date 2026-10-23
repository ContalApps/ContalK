import { app, BrowserWindow, desktopCapturer, ipcMain, screen } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'

export function setupCaptureAudio(window: BrowserWindow) {
  let active: { id: string; child: ChildProcessWithoutNullStreams } | null = null
  let starting = false
  const stop = () => {
    const previous = active
    active = null
    previous?.child.kill()
  }
  const trusted = (event: Electron.IpcMainInvokeEvent) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Origem inválida.')
  }
  ipcMain.handle('capture-audio-start', async (event, sourceId: unknown) => {
    trusted(event)
    if (starting) throw new Error('A captura de áudio já está iniciando.')
    if (process.platform !== 'win32') throw new Error('A captura isolada está disponível no Windows.')
    if (typeof sourceId !== 'string') throw new Error('Fonte de captura inválida.')
    starting = true
    try {
      stop()
      const sources = await desktopCapturer.getSources({ types: ['window', 'screen'], thumbnailSize: { width: 0, height: 0 } })
      const source = sources.find(s => s.id === sourceId)
      if (!source) throw new Error('A janela ou tela selecionada não está mais disponível.')
      let args: string[]
      if (source.id.startsWith('window:')) {
        const handle = source.id.split(':')[1]
        if (!/^\d+$/.test(handle)) throw new Error('Janela inválida.')
        args = ['--window', handle, '--exclude', String(process.pid)]
      } else {
        const display = screen.getAllDisplays().find(d => String(d.id) === source.display_id)
        if (!display) throw new Error('Não foi possível identificar o monitor selecionado.')
        const bounds = screen.dipToScreenRect(null, display.bounds)
        args = ['--monitor', String(bounds.x), String(bounds.y), String(bounds.x + bounds.width), String(bounds.y + bounds.height), '--exclude', String(process.pid)]
      }
      const executable = app.isPackaged ? path.join(process.resourcesPath, 'audio', 'contalk-audio.exe') : path.join(process.env.APP_ROOT!, 'native', 'bin', 'contalk-audio.exe')
      if (!fs.existsSync(executable)) throw new Error('O componente de áudio não foi instalado. Reinstale a versão mais recente do ConTALK.')
      const id = randomUUID()
      const child = spawn(executable, args, { windowsHide: true, stdio: 'pipe' })
      active = { id, child }
      await new Promise<void>((resolve, reject) => {
        let ready = false
        let stderr = ''
        let reportedError = false
        const timeout = setTimeout(() => { reject(new Error('A captura de áudio não respondeu.')); if (active?.id === id) stop() }, 15000)
        const fail = (error: string) => {
          if (reportedError) return
          reportedError = true
          clearTimeout(timeout)
          if (!ready) reject(new Error(error))
          else if (!window.isDestroyed()) window.webContents.send('capture-audio-error', { sessionId: id, error })
          if (active?.id === id) stop()
        }
        child.stderr.on('data', buffer => {
          stderr += buffer.toString('utf8')
          let newline: number
          while ((newline = stderr.indexOf('\n')) >= 0) {
            const line = stderr.slice(0, newline); stderr = stderr.slice(newline + 1)
            try {
              const event = JSON.parse(line)
              if (event.error) fail(event.error)
              else if (event.ready && !ready) { ready = true; clearTimeout(timeout); resolve() }
            } catch { /* Ignore non-protocol diagnostic output. */ }
          }
        })
        child.stdout.on('data', (data: Buffer) => {
          if (ready && active?.id === id && !window.isDestroyed()) window.webContents.send('capture-audio-data', { sessionId: id, data: new Uint8Array(data) })
        })
        child.once('error', error => fail(error.message))
        child.once('exit', () => { if (active?.id === id) fail('A captura de áudio terminou. Inicie a transmissão novamente.'); else if (!ready) { clearTimeout(timeout); reject(new Error('Captura cancelada.')) } })
      })
      return { sessionId: id, sampleRate: 48000, channels: 2 }
    } finally { starting = false }
  })
  ipcMain.handle('capture-audio-stop', (event, id: unknown) => { trusted(event); if (id === active?.id) stop() })
  window.webContents.on('render-process-gone', stop)
  window.webContents.on('did-start-navigation', (_event, _url, _inPlace, isMainFrame) => { if (isMainFrame) stop() })
  window.once('closed', () => { stop(); ipcMain.removeHandler('capture-audio-start'); ipcMain.removeHandler('capture-audio-stop') })
  app.once('before-quit', stop)
}
