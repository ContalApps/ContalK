import { BrowserWindow, ipcMain, Notification } from 'electron'
import { showMainWindow } from './single-instance'
export function setupNotifications(window:BrowserWindow){
  const shown=new Map<string,Notification>()
  const notify=(event:Electron.IpcMainEvent,value:unknown)=>{
    if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||!Notification.isSupported()||!value||typeof value!=='object')return
    const notice=value as {id?:unknown;kind?:unknown;title?:unknown;body?:unknown;channelId?:unknown}
    if(typeof notice.id!=='string'||notice.id.length>200||typeof notice.title!=='string'||typeof notice.body!=='string'||!['message','friendship','live','voice'].includes(String(notice.kind)))return
    const group=typeof notice.channelId==='string'?notice.channelId:notice.id
    shown.get(group)?.close()
    if(shown.size>=30){const oldest=shown.keys().next().value;if(oldest){shown.get(oldest)?.close();shown.delete(oldest)}}
    const notification=new Notification({title:notice.title.slice(0,100),body:notice.body.slice(0,240)})
    shown.set(group,notification)
    notification.on('click',()=>{if(!window.isDestroyed()){showMainWindow(window);if(!window.webContents.isDestroyed())window.webContents.send('notification-open',notice.id)}})
    notification.on('close',()=>{if(shown.get(group)===notification)shown.delete(group)})
    notification.on('failed',()=>{if(shown.get(group)===notification)shown.delete(group)})
    notification.show()
  }
  ipcMain.on('activity-notify',notify)
  window.once('closed',()=>{ipcMain.removeListener('activity-notify',notify);for(const notice of shown.values())notice.close();shown.clear()})
}
