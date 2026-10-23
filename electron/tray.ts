import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron'
import path from 'node:path'
import { showMainWindow } from './single-instance'

export function setupTray(window:BrowserWindow) {
  let quitting=false, speaking=false, phase=0
  const idle=nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC!, 'app-icon.png')).resize({width:24,height:24})
  const tray=new Tray(idle)
  tray.setToolTip('ConTALK')
  const menu=()=>Menu.buildFromTemplate([{label:'Abrir ConTALK',click:()=>{showMainWindow(window)}},{type:'separator'},{label:'Fechar ConTALK',click:()=>{quitting=true;app.quit()}}])
  tray.on('click',()=>tray.popUpContextMenu(menu()))
  tray.on('right-click',()=>tray.popUpContextMenu(menu()))
  tray.on('double-click',()=>{showMainWindow(window)})
  const allowQuit=()=>{quitting=true}
  app.on('before-quit',allowQuit)
  window.on('close',event=>{if(!quitting){event.preventDefault();window.hide()}})
  const handler=(event:Electron.IpcMainEvent,value:unknown)=>{
    if(event.sender===window.webContents && event.senderFrame===window.webContents.mainFrame)speaking=value===true
  }
  ipcMain.on('voice-speaking',handler)
  const reset=()=>{speaking=false;phase=0;tray.setImage(idle)}
  window.webContents.on('render-process-gone',reset)
  window.webContents.on('did-start-loading',reset)
  const timer=setInterval(()=>{
    if(!speaking){if(phase){tray.setImage(idle);phase=0}return}
    phase=phase%5+1
    const size=24, pixels=Buffer.alloc(size*size*4)
    for(let bar=0;bar<5;bar++){
      const height=4+((bar+phase)%5)*4
      for(let y=Math.floor((size-height)/2);y<(size+height)/2;y++)for(let x=bar*4+2;x<bar*4+4;x++){
        const i=(y*size+x)*4;pixels[i]=210;pixels[i+1]=140;pixels[i+2]=170;pixels[i+3]=255
      }
    }
    tray.setImage(nativeImage.createFromBitmap(pixels,{width:size,height:size}))
  },150)
  window.once('closed',()=>{clearInterval(timer);window.webContents.removeListener('render-process-gone',reset);window.webContents.removeListener('did-start-loading',reset);tray.destroy();ipcMain.removeListener('voice-speaking',handler);app.removeListener('before-quit',allowQuit)})
}
