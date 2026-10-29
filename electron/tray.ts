import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron'
import path from 'node:path'
import { showMainWindow } from './single-instance'

export function setupTray(window:BrowserWindow) {
  // BrowserWindow.webContents cannot be accessed after the native window dies.
  const contents=window.webContents
  let quitting=false, speaking=false, phase=0
  let voice:{connected:boolean;micMuted:boolean;deafened:boolean;micBlocked?:boolean;outputBlocked?:boolean}={connected:false,micMuted:true,deafened:false}
  let timer:ReturnType<typeof setInterval>|undefined
  const idle=nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC!, 'app-icon.png')).resize({width:24,height:24})
  const tray=new Tray(idle)
  tray.setToolTip('ConTALK')

  const createMutedIcon=()=>{
    const size=24, pixels=Buffer.alloc(size*size*4)
    const setPixel=(x:number,y:number,r:number,g:number,b:number,a=255)=>{
      if(x<0||x>=size||y<0||y>=size)return
      const i=(y*size+x)*4
      pixels[i]=r; pixels[i+1]=g; pixels[i+2]=b; pixels[i+3]=a
    }
    // Draw microphone capsule (light silver #dcdce6)
    for(let y=4;y<=11;y++){
      for(let x=10;x<=13;x++){
        if(y===4&&(x===10||x===13))continue
        setPixel(x,y,220,220,230)
      }
    }
    // Cradle (U shape)
    for(let y=9;y<=12;y++){
      setPixel(8,y,220,220,230)
      setPixel(15,y,220,220,230)
    }
    for(let x=9;x<=14;x++)setPixel(x,13,220,220,230)
    // Stem
    for(let y=14;y<=16;y++){
      setPixel(11,y,220,220,230)
      setPixel(12,y,220,220,230)
    }
    // Base plate
    for(let x=8;x<=15;x++)setPixel(x,17,220,220,230)
    // Red diagonal slash (#fa423e)
    for(let i=4;i<=19;i++){
      setPixel(i,i,250,66,62)
      setPixel(i+1,i,250,66,62)
    }
    return nativeImage.createFromBitmap(pixels,{width:size,height:size})
  }
  const mutedIcon=createMutedIcon()

  const isMuted=()=>voice.connected&&(voice.micMuted||voice.deafened||voice.micBlocked)

  const updateTrayIcon=()=>{
    if(isMuted()){
      if(timer){clearInterval(timer);timer=undefined;speaking=false;phase=0}
      tray.setImage(mutedIcon)
      tray.setToolTip(voice.deafened?'ConTALK (Áudio e microfone silenciados)':voice.micBlocked?'ConTALK (Microfone bloqueado)':'ConTALK (Microfone silenciado)')
    }else if(speaking){
      tray.setImage(frames[phase%frames.length])
      tray.setToolTip('ConTALK (Transmitindo voz)')
    }else{
      if(timer){clearInterval(timer);timer=undefined;speaking=false;phase=0}
      tray.setImage(idle)
      tray.setToolTip(voice.connected?'ConTALK (Conectado à voz)':'ConTALK')
    }
  }

  const action=(name:string)=>{if(!window.isDestroyed?.()&&!window.webContents.isDestroyed?.())window.webContents.send('tray-action',name)}
  const menu=()=>Menu.buildFromTemplate([
    {label:'Abrir ConTALK',click:()=>{showMainWindow(window)}},
    {type:'separator'},
    {
      label:voice.micBlocked?'Microfone bloqueado pelo servidor':'Silenciar microfone',
      type:'checkbox',
      checked:voice.micMuted,
      enabled:voice.connected&&!voice.micBlocked,
      click:()=>{action('toggle-microphone')}
    },
    {
      label:voice.outputBlocked?'Áudio bloqueado pelo servidor':'Silenciar saída de áudio',
      type:'checkbox',
      checked:voice.deafened,
      enabled:!voice.outputBlocked,
      click:()=>{action('toggle-output')}
    },
    {type:'separator'},
    {label:'Fechar ConTALK',click:()=>{quitting=true;app.quit()}}
  ])
  tray.on('click',()=>tray.popUpContextMenu(menu()))
  tray.on('right-click',()=>tray.popUpContextMenu(menu()))
  tray.on('double-click',()=>{showMainWindow(window)})
  const allowQuit=()=>{quitting=true}
  app.on('before-quit',allowQuit)
  window.on('close',event=>{if(!quitting){event.preventDefault();window.hide()}})

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
  const draw=()=>{if(speaking&&!isMuted()){tray.setImage(frames[phase%frames.length]);phase++}}

  const handler=(event:Electron.IpcMainEvent,value:unknown)=>{
    if(event.sender!==window.webContents || event.senderFrame!==window.webContents.mainFrame)return
    const active=value===true&&!isMuted()
    if(active===speaking)return
    speaking=active
    if(active){phase=0;draw();timer=setInterval(draw,80)}else reset()
  }
  ipcMain.on('voice-speaking',handler)

  const voiceState=(event:Electron.IpcMainEvent,value:unknown)=>{
    if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||!value||typeof value!=='object')return
    const next=value as typeof voice
    if(typeof next.connected==='boolean'&&typeof next.micMuted==='boolean'&&typeof next.deafened==='boolean'){
      voice={connected:next.connected,micMuted:next.micMuted,deafened:next.deafened,micBlocked:next.micBlocked===true,outputBlocked:next.outputBlocked===true}
      updateTrayIcon()
    }
  }
  ipcMain.on('tray-voice-state',voiceState)

  const reset=()=>{clearInterval(timer);timer=undefined;speaking=false;phase=0;updateTrayIcon()}
  const resetVoice=()=>{voice={connected:false,micMuted:true,deafened:false};reset()}
  contents.on('render-process-gone',resetVoice)
  contents.on('did-start-loading',resetVoice)

  window.once('closed',()=>{clearInterval(timer);contents.removeListener('render-process-gone',resetVoice);contents.removeListener('did-start-loading',resetVoice);tray.destroy();ipcMain.removeListener('voice-speaking',handler);ipcMain.removeListener('tray-voice-state',voiceState);app.removeListener('before-quit',allowQuit)})
}
