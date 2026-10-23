import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { loadTypescript } from './load-typescript.mjs'
function fixture(){
 const app=new EventEmitter(),ipc=new EventEmitter(),window=new EventEmitter();let hidden=0,shown=0,quits=0,menu,tick,images=0
 app.quit=()=>{quits++;app.emit('before-quit')}
 window.webContents=Object.assign(new EventEmitter(),{mainFrame:{}});window.hide=()=>hidden++;window.show=()=>shown++;window.focus=()=>{}
 const image={resize:()=>image};let tray
 class Tray extends EventEmitter{constructor(){super();tray=this}setToolTip(){}setImage(){images++}popUpContextMenu(value){menu=value}destroy(){}}
 const {setupTray}=loadTypescript('electron/tray.ts',{'./single-instance':{showMainWindow:w=>{w.show();w.focus()}},electron:{app,ipcMain:ipc,Tray,Menu:{buildFromTemplate:x=>x},nativeImage:{createFromPath:()=>image,createFromBitmap:()=>image}}},{process:{env:{VITE_PUBLIC:'.'}},Buffer,setInterval:fn=>{tick=fn;return 1},clearInterval(){}})
 setupTray(window)
 return {app,ipc,window,tray,tick:()=>tick(),get hidden(){return hidden},get shown(){return shown},get quits(){return quits},get menu(){return menu},get images(){return images}}
}
test('closing hides the app; left-click menu offers an explicit exit',()=>{
 const f=fixture();let prevented=false;f.window.emit('close',{preventDefault(){prevented=true}})
 assert.equal(prevented,true);assert.equal(f.hidden,1);assert.equal(f.quits,0)
 f.tray.emit('click');assert.equal(f.menu.at(-1).label,'Fechar ContalK');f.menu.at(-1).click()
 prevented=false;f.window.emit('close',{preventDefault(){prevented=true}});assert.equal(prevented,false);assert.equal(f.quits,1);f.window.emit('closed')
})
test('tray animation only accepts speaking state from the trusted renderer',()=>{
 const f=fixture();f.ipc.emit('voice-speaking',{sender:{},senderFrame:{}},true);f.tick();assert.equal(f.images,0)
 f.ipc.emit('voice-speaking',{sender:f.window.webContents,senderFrame:f.window.webContents.mainFrame},true);f.tick();assert.equal(f.images,1)
 f.ipc.emit('voice-speaking',{sender:f.window.webContents,senderFrame:f.window.webContents.mainFrame},false);f.tick();assert.equal(f.images,2);f.window.emit('closed')
})


test('a renderer crash clears an active tray indicator',()=>{
 const f=fixture();f.ipc.emit('voice-speaking',{sender:f.window.webContents,senderFrame:f.window.webContents.mainFrame},true);f.tick();assert.equal(f.images,1)
 f.window.webContents.emit('render-process-gone');assert.equal(f.images,2);f.tick();assert.equal(f.images,2);f.window.emit('closed')
})
