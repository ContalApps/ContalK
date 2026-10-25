import {test} from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {loadTypescript} from './load-typescript.mjs'
function fixture(){
 const ipc=new EventEmitter(),handlers=new Map(),window=new EventEmitter(),children=[]
 ipc.handle=(id,handler)=>handlers.set(id,handler);ipc.removeHandler=id=>handlers.delete(id)
 window.webContents=Object.assign(new EventEmitter(),{mainFrame:{}})
 const spawn=(file,args,options)=>{const child=Object.assign(new EventEmitter(),{stdout:new EventEmitter(),stderr:{resume(){}},stdin:Object.assign(new EventEmitter(),{write:value=>{child.input=value}}),kill(){this.killed=true;this.emit('exit',1)}});children.push({child,file,args,options});return child}
 const execFile=(_file,args,_options,callback)=>callback(null,JSON.stringify([{id:'Voice',label:'Voice',language:'pt-BR'}]))
 const {setupSpeech}=loadTypescript('electron/speech.ts',{electron:{app:{isPackaged:false},ipcMain:ipc},'node:child_process':{spawn,execFile},'node:fs':{existsSync:()=>true}},{process:{platform:'win32',env:{APP_ROOT:'fixture'}},Buffer})
 setupSpeech(window);return {ipc,handlers,window,children,event:{sender:window.webContents,senderFrame:window.webContents.mainFrame}}
}
test('speech IPC accepts only the main frame, sends text through stdin and validates WAV output',async()=>{
 const f=fixture(),synth=f.handlers.get('speech-synthesize');await assert.rejects(()=>synth({sender:{}},'Private text','default'),/Origem/);assert.equal(f.children.length,0)
 const voices=await f.handlers.get('speech-voices')(f.event);assert.equal(voices[0].language,'pt-BR')
 const result=synth(f.event,'Private text','Voice'),entry=f.children[0];assert.equal(entry.options.windowsHide,true);assert.equal(entry.args.includes('Private text'),false);assert.equal(Buffer.from(entry.child.input.trim(),'base64').toString(),'Private text')
 const data=Buffer.alloc(100);data.write('RIFF',0);data.write('WAVE',8);entry.child.stdout.emit('data',data);entry.child.emit('exit',0);assert.ok((await result).startsWith('data:audio/wav;base64,'));f.window.emit('closed')
})
test('cancel and reload terminate pending synthesis without an unhandled cancellation failure',async()=>{
 const f=fixture(),synth=f.handlers.get('speech-synthesize');let result=synth(f.event,'Reading','default');assert.doesNotThrow(()=>f.ipc.emit('speech-cancel',{sender:{},senderFrame:{}}));assert.equal(f.children[0].child.killed,undefined)
 f.ipc.emit('speech-cancel',f.event);assert.equal(await result,null);assert.equal(f.children[0].child.killed,true)
 result=synth(f.event,'Another reading','default');f.window.webContents.emit('did-start-loading');assert.equal(await result,null);f.window.emit('closed');assert.equal(f.handlers.size,0);assert.equal(f.ipc.listenerCount('speech-cancel'),0)
})
