import {app,BrowserWindow,ipcMain} from 'electron'
import {spawn,execFile,type ChildProcessWithoutNullStreams} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export function setupSpeech(window:BrowserWindow){
 let active:{child:ChildProcessWithoutNullStreams;cancel:()=>void}|null=null
 const trusted=(event:Electron.IpcMainEvent|Electron.IpcMainInvokeEvent)=>{if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)throw new Error('Origem inválida.')}
 const executable=()=>{if(process.platform!=='win32')throw new Error('A leitura em voz está disponível no aplicativo Windows.');const file=app.isPackaged?path.join(process.resourcesPath,'voice-input','contalk-voice-input.exe'):path.join(process.env.APP_ROOT!,'native','bin','contalk-voice-input.exe');if(!fs.existsSync(file))throw new Error('O componente de voz não foi instalado. Reinstale o ConTALK.');return file}
 const cancel=()=>{const previous=active;active=null;previous?.cancel();previous?.child.kill()}
 ipcMain.handle('speech-voices',async event=>{trusted(event);return new Promise((resolve,reject)=>execFile(executable(),['--voices'],{windowsHide:true,timeout:10000,maxBuffer:65536,encoding:'utf8'},(error,stdout)=>{if(error){reject(new Error('Não foi possível consultar as vozes instaladas no Windows.'));return}try{const data=JSON.parse(stdout);if(!Array.isArray(data)||data.some(item=>typeof item?.id!=='string'||typeof item?.label!=='string'||typeof item?.language!=='string'))throw Error();resolve(data)}catch{reject(new Error('A lista de vozes recebida é inválida.'))}}))})
 ipcMain.handle('speech-synthesize',async(event,text:unknown,voice:unknown)=>{
  trusted(event)
  if(typeof text!=='string'||!text.trim()||text.length>2500||typeof voice!=='string'||voice.length>200)throw new Error('Texto ou voz inválidos.')
  const file=executable();cancel()
  return new Promise<string|null>((resolve,reject)=>{
   const child=spawn(file,['--speech',voice||'default'],{windowsHide:true,stdio:'pipe'}),chunks:Buffer[]=[];let size=0,done=false
   const finish=(error?:Error,cancelled=false)=>{if(done)return;done=true;clearTimeout(timer);if(active?.child===child)active=null;if(error)reject(error);else if(cancelled)resolve(null);else{const data=Buffer.concat(chunks);if(data.length<44||data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WAVE')reject(new Error('Não foi possível gerar a leitura em voz.'));else resolve('data:audio/wav;base64,'+data.toString('base64'))}}
   const timer=setTimeout(()=>{finish(new Error('A leitura em voz demorou demais para ser gerada.'));child.kill()},25000)
   active={child,cancel:()=>finish(undefined,true)}
   child.stdout.on('data',data=>{size+=data.length;if(size>24*1024*1024){finish(new Error('O áudio de leitura excedeu o limite.'));child.kill()}else chunks.push(data)})
   child.stderr.resume();child.once('error',()=>finish(new Error('Não foi possível iniciar o componente de voz.')))
   child.once('exit',code=>finish(code===0?undefined:new Error('Não foi possível gerar a leitura. Confira a voz instalada no Windows.')))
   child.stdin.on('error',()=>{if(!done)finish(new Error('O componente de voz foi interrompido.'))})
   // Text travels only through the private pipe, not process arguments or disk.
   child.stdin.write(Buffer.from(text,'utf8').toString('base64')+'\n')
  })
 })
 const stop=(event:Electron.IpcMainEvent)=>{if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)return;cancel()}
 ipcMain.on('speech-cancel',stop)
 window.webContents.on('did-start-loading',cancel);window.webContents.on('render-process-gone',cancel)
 window.once('closed',()=>{cancel();ipcMain.removeHandler('speech-voices');ipcMain.removeHandler('speech-synthesize');ipcMain.removeListener('speech-cancel',stop)})
}
