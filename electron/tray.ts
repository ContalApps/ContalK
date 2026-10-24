import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron'
import path from 'node:path'
import { showMainWindow } from './single-instance'

export function setupTray(window:BrowserWindow) {
  // BrowserWindow.webContents cannot be accessed after the native window dies.
  const contents=window.webContents
  let quitting=false, speaking=false, phase=0
  let voice={connected:false,micMuted:true,deafened:false}
  let timer:ReturnType<typeof setInterval>|undefined
  const idle=nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC!, 'app-icon.png')).resize({width:24,height:24})
  const tray=new Tray(idle)
  tray.setToolTip('ConTALK')
  const action=(name:string)=>{if(!window.isDestroyed?.()&&!window.webContents.isDestroyed?.())window.webContents.send('tray-action',name)}
  const menu=()=>Menu.buildFromTemplate([{label:'Abrir ConTALK',click:()=>{showMainWindow(window)}},{type:'separator'},{label:'Silenciar microfone',type:'checkbox',checked:voice.micMuted,enabled:voice.connected,click:()=>action('toggle-microphone')},{label:'Silenciar saída de áudio',type:'checkbox',checked:voice.deafened,enabled:voice.connected,click:()=>action('toggle-output')},{type:'separator'},{label:'Fechar ConTALK',click:()=>{quitting=true;app.quit()}}])
  tray.on('click',()=>tray.popUpContextMenu(menu()))
  tray.on('right-click',()=>tray.popUpContextMenu(menu()))
  tray.on('double-click',()=>{showMainWindow(window)})
  const allowQuit=()=>{quitting=true}
  app.on('before-quit',allowQuit)
  window.on('close',event=>{if(!quitting){event.preventDefault();window.hide()}})
  const handler=(event:Electron.IpcMainEvent,value:unknown)=>{
    if(event.sender!==window.webContents || event.senderFrame!==window.webContents.mainFrame)return
    const active=value===true
    if(active===speaking)return
    speaking=active
    if(active){draw();timer=setInterval(draw,80)}else reset()
  }
  ipcMain.on('voice-speaking',handler)
  const voiceState=(event:Electron.IpcMainEvent,value:unknown)=>{
    if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||!value||typeof value!=='object')return
    const next=value as typeof voice
    if(typeof next.connected==='boolean'&&typeof next.micMuted==='boolean'&&typeof next.deafened==='boolean')voice={connected:next.connected,micMuted:next.micMuted,deafened:next.deafened}
  }
  ipcMain.on('tray-voice-state',voiceState)
  const reset=()=>{clearInterval(timer);timer=undefined;speaking=false;phase=0;tray.setImage(idle)}
  const resetVoice=()=>{reset();voice={connected:false,micMuted:true,deafened:false}}
  contents.on('render-process-gone',resetVoice)
  contents.on('did-start-loading',resetVoice)
  const frames=Array.from({length:5},(_,frame)=>{
    const size=24, pixels=Buffer.alloc(size*size*4)
    for(let bar=0;bar<5;bar++){
      const height=4+((bar+frame)%5)*4
      for(let y=Math.floor((size-height)/2);y<(size+height)/2;y++)for(let x=bar*4+2;x<bar*4+4;x++){
        const i=(y*size+x)*4;pixels[i]=210;pixels[i+1]=140;pixels[i+2]=170;pixels[i+3]=255
      }
    }
    return nativeImage.createFromBitmap(pixels,{width:size,height:size})
  })
  const draw=()=>{if(speaking){tray.setImage(frames[phase%frames.length]);phase++}}
  window.once('closed',()=>{clearInterval(timer);contents.removeListener('render-process-gone',resetVoice);contents.removeListener('did-start-loading',resetVoice);tray.destroy();ipcMain.removeListener('voice-speaking',handler);ipcMain.removeListener('tray-voice-state',voiceState);app.removeListener('before-quit',allowQuit)})
}
