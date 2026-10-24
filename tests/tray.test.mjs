import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { loadTypescript } from './load-typescript.mjs'
function fixture(){
 const app=new EventEmitter(),ipc=new EventEmitter(),window=new EventEmitter();let hidden=0,shown=0,quits=0,menu,tick,images=0;const sent=[]
 app.quit=()=>{quits++;app.emit('before-quit')}
 window.webContents=Object.assign(new EventEmitter(),{mainFrame:{},send:(...args)=>sent.push(args)});window.hide=()=>hidden++;window.show=()=>shown++;window.focus=()=>{}
 const image={resize:()=>image};let tray
 class Tray extends EventEmitter{constructor(){super();tray=this}setToolTip(){}setImage(){images++}popUpContextMenu(value){menu=value}destroy(){}}
 const {setupTray}=loadTypescript('electron/tray.ts',{'./single-instance':{showMainWindow:w=>{w.show();w.focus()}},electron:{app,ipcMain:ipc,Tray,Menu:{buildFromTemplate:x=>x},nativeImage:{createFromPath:()=>image,createFromBitmap:()=>image}}},{process:{env:{VITE_PUBLIC:'.'}},Buffer,setInterval:fn=>{tick=fn;return 1},clearInterval(){}})
 setupTray(window)
 return {app,ipc,window,tray,sent,tick:()=>tick?.(),get hidden(){return hidden},get shown(){return shown},get quits(){return quits},get menu(){return menu},get images(){return images}}
}
test('closing hides the app; left-click menu offers an explicit exit',()=>{
 const f=fixture();let prevented=false;f.window.emit('close',{preventDefault(){prevented=true}})
 assert.equal(prevented,true);assert.equal(f.hidden,1);assert.equal(f.quits,0)
 f.tray.emit('click');assert.equal(f.menu.at(-1).label,'Fechar ConTALK');f.menu.at(-1).click()
 prevented=false;f.window.emit('close',{preventDefault(){prevented=true}});assert.equal(prevented,false);assert.equal(f.quits,1);f.window.emit('closed')
})
test('tray animation only accepts speaking state from the trusted renderer',()=>{
 const f=fixture();f.ipc.emit('voice-speaking',{sender:{},senderFrame:{}},true);f.tick();assert.equal(f.images,0)
 f.ipc.emit('voice-speaking',{sender:f.window.webContents,senderFrame:f.window.webContents.mainFrame},true);assert.equal(f.images,1,'first frame appears before any interval');f.tick();assert.equal(f.images,2)
 f.ipc.emit('voice-speaking',{sender:f.window.webContents,senderFrame:f.window.webContents.mainFrame},false);assert.equal(f.images,3);f.tick();assert.equal(f.images,3);f.window.emit('closed')
})


test('a renderer crash clears an active tray indicator',()=>{
 const f=fixture();f.ipc.emit('voice-speaking',{sender:f.window.webContents,senderFrame:f.window.webContents.mainFrame},true);assert.equal(f.images,1)
 f.window.webContents.emit('render-process-gone');assert.equal(f.images,2);f.tick();assert.equal(f.images,2);f.window.emit('closed')
})

test('shutdown does not access webContents through a destroyed native window',()=>{
 const f=fixture(),contents=f.window.webContents
 Object.defineProperty(f.window,'webContents',{get(){throw new Error('Object has been destroyed')}})
 assert.doesNotThrow(()=>f.window.emit('closed'))
 assert.equal(contents.listenerCount('render-process-gone'),0)
 assert.equal(contents.listenerCount('did-start-loading'),0)
 assert.equal(f.ipc.listenerCount('voice-speaking'),0)
})

test('right click offers microphone and output controls tied to acknowledged renderer state',()=>{
 const f=fixture();f.tray.emit('right-click');assert.equal(f.menu.find(item=>item.label==='Silenciar microfone').enabled,false)
 f.ipc.emit('tray-voice-state',{sender:{},senderFrame:{}},{connected:true,micMuted:false,deafened:false});f.tray.emit('right-click');assert.equal(f.menu.find(item=>item.label==='Silenciar microfone').enabled,false)
 f.ipc.emit('tray-voice-state',{sender:f.window.webContents,senderFrame:f.window.webContents.mainFrame},{connected:true,micMuted:false,deafened:true});f.tray.emit('right-click')
 const microphone=f.menu.find(item=>item.label==='Silenciar microfone'),output=f.menu.find(item=>item.label==='Silenciar saída de áudio')
 assert.equal(microphone.enabled,true);assert.equal(microphone.checked,false);assert.equal(output.checked,true)
 microphone.click();output.click();assert.deepEqual(f.sent,[['tray-action','toggle-microphone'],['tray-action','toggle-output']]);f.window.emit('closed')
})
