import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pushToTalkKeys, validPushToTalkKey } from '../src/media/voice-input'

export function setupPushToTalk(window:BrowserWindow){
  let active:ChildProcessWithoutNullStreams|null=null,generation=0,activeId:string|null=null
  const send=(value:{pressed:boolean;error?:string},id=activeId)=>{if(!window.isDestroyed()&&!window.webContents.isDestroyed())window.webContents.send('voice-input-key',{...value,id})}
  const stop=()=>{generation++;const child=active;active=null;child?.kill();send({pressed:false});activeId=null}
  ipcMain.handle('voice-input-configure',async(event,value:unknown)=>{
    if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)throw new Error('Origem inválida.')
    stop();if(value===null)return
    const {key,id}=value as {key?:unknown;id?:unknown}||{}
    if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw new Error('Sessão de atalho inválida.')
    if(!validPushToTalkKey(key))throw new Error('Atalho de voz inválido.')
    if(process.platform!=='win32')throw new Error('Atalho global disponível no Windows; mantenha a janela ativa para usar o atalho local.')
    const executable=app.isPackaged?path.join(process.resourcesPath,'voice-input','contalk-voice-input.exe'):path.join(process.env.APP_ROOT!,'native','bin','contalk-voice-input.exe')
    if(!fs.existsSync(executable))throw new Error('O componente de atalho global não foi instalado. Reinstale o ConTALK; o atalho local continua disponível.')
    const child=spawn(executable,['--key',String(pushToTalkKeys[key].virtualKey)],{windowsHide:true,stdio:'pipe'}),version=generation
    active=child;activeId=id
    await new Promise<void>((resolve,reject)=>{
      let buffer='',ready=false
      const fail=()=>{if(version!==generation){if(!ready)resolve();return}stop();const error='O atalho global foi interrompido. Use a janela ativa ou reconfigure a tecla.';send({pressed:false,error},id);if(!ready)reject(new Error(error))}
      const timer=setTimeout(()=>{if(!ready)fail()},2500)
      child.stdout.on('data',data=>{
        if(version!==generation)return
        buffer+=data.toString();if(buffer.length>4096){fail();return}
        let newline
        while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);try{const value=JSON.parse(line);if(value.ready===true&&!ready){ready=true;clearTimeout(timer);resolve()}else if(ready&&typeof value.pressed==='boolean')send({pressed:value.pressed});else fail()}catch{fail()}}
      })
      child.stderr.resume()
      child.once('error',()=>{clearTimeout(timer);fail()})
      child.once('exit',()=>{clearTimeout(timer);fail()})
    })
  })
  const unload=()=>stop()
  window.webContents.on('did-start-loading',unload)
  window.webContents.on('render-process-gone',unload)
  window.once('closed',()=>{stop();ipcMain.removeHandler('voice-input-configure')})
}
