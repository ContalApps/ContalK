import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EventEmitter, once } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { loadTypescript } from './load-typescript.mjs'
import { createStorageServer } from '../scripts/storage-server.mjs'

test('desktop storage binds selected files and completed uploads to the account that initiated the operation',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'contalk-storage-desktop-')),store=path.join(directory,'files'),profile=path.join(directory,'profile');fs.mkdirSync(profile)
 const file=path.join(directory,'selected.txt');fs.writeFileSync(file,'Test')
 const tokens={'alice-key':'alice','bob-key':'bob','wrong-case-key':'Alice'},publicUrl=new URL('http://127.0.0.1')
 let uploads=0,holdUpload,uploadStarted
 const server=createStorageServer({directory:store,key:Buffer.alloc(32,33),tokens,publicUrl,
  upload:async()=>{uploads++;uploadStarted?.();if(holdUpload)await holdUpload;return 1},download:async()=>Readable.from([Buffer.from('Test')]),
 })
 server.listen(0,'127.0.0.1');await once(server,'listening');publicUrl.port=String(server.address().port)
 let owner='alice',picker
 const handlers=new Map(),window=new EventEmitter();window.webContents={mainFrame:{}}
 const {setupStorage}=loadTypescript('electron/storage.ts',{electron:{app:{getPath:name=>name==='userData'?profile:directory},dialog:{showOpenDialog:async()=>{if(picker)await picker;return {canceled:false,filePaths:[file]}}},ipcMain:{handle:(name,handler)=>handlers.set(name,handler),removeHandler:name=>handlers.delete(name)},safeStorage:{isEncryptionAvailable:()=>true,encryptString:value=>Buffer.from('test-only:'+value),decryptString:value=>value.toString().slice(10)},nativeImage:{},shell:{}},'./community':{readCommunityConfig:name=>name?{url:publicUrl.origin,token:name+'-key'}:null}},{fetch,URL,Buffer,AbortSignal,process:{env:{}}})
 setupStorage(window,()=>owner)
 t.after(async()=>{window.emit('closed');server.closeAllConnections();await new Promise(resolve=>server.close(resolve));const resolved=fs.realpathSync(directory);assert.equal(path.dirname(resolved).toLowerCase(),fs.realpathSync(os.tmpdir()).toLowerCase());assert.ok(path.basename(resolved).startsWith('contalk-storage-desktop-'));fs.rmSync(resolved,{recursive:true,force:true})})
 const event={sender:window.webContents,senderFrame:window.webContents.mainFrame},call=(name,...args)=>Promise.resolve().then(()=>handlers.get(name)(event,...args))
 const selected=await call('storage-select')
 owner='bob'
 await assert.rejects(call('storage-upload',selected.id),/nesta conta/);assert.equal(uploads,0)
 let releasePicker;picker=new Promise(resolve=>{releasePicker=resolve});owner='alice'
 const stalePicker=call('storage-select');await new Promise(resolve=>setImmediate(resolve));owner='bob';releasePicker()
 await assert.rejects(stalePicker,/conta foi alterada/);picker=undefined
 owner='alice';const another=await call('storage-select')
 let releaseUpload;holdUpload=new Promise(resolve=>{releaseUpload=resolve});const started=new Promise(resolve=>{uploadStarted=resolve})
 const pending=call('storage-upload',another.id);await started;owner='bob';releaseUpload()
 await assert.rejects(pending,/conta foi alterada durante o upload/)
 assert.equal(uploads,1)
 const records=fs.readdirSync(store).filter(name=>/^[0-9a-f-]{36}\.json$/.test(name)).map(name=>JSON.parse(fs.readFileSync(path.join(store,name),'utf8')))
 assert.equal(records[0].owner,'alice')
 assert.equal(records[0].name,'selected.txt')
 const invalidEvent={sender:{},senderFrame:{}}
 await assert.rejects(Promise.resolve().then(()=>handlers.get('storage-share')(invalidEvent,randomUUID(),'bob')),/Origem inválida/)
})
