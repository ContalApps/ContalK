import { app, BrowserWindow } from 'electron'

export function showMainWindow(window:BrowserWindow|null) {
  if(!window||window.isDestroyed())return
  if(window.isMinimized())window.restore()
  window.show()
  window.focus()
}

export function setupSingleInstance(getWindow:()=>BrowserWindow|null):boolean {
  if(!app.requestSingleInstanceLock()) {
    app.quit()
    return false
  }
  app.on('second-instance',()=>showMainWindow(getWindow()))
  return true
}
