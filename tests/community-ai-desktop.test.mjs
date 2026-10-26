import assert from 'node:assert/strict'
import {test} from 'node:test'
import {EventEmitter,once} from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {loadTypescript} from './load-typescript.mjs'
import {createCommunityService,createCommunityState} from '../scripts/community/service.mjs'

test('renderer bridge forwards personal limits and the queued run selected for cancellation',async()=>{
  const calls=[]
  let bridge
  loadTypescript('electron/preload.ts',{
    electron:{
      contextBridge:{exposeInMainWorld:(_name,value)=>{bridge=value}},
      ipcRenderer:{invoke:(...args)=>{calls.push(args);return Promise.resolve({})}},
      webFrame:{setZoomFactor:()=>{}},
    },
  })
  const limits={contextTokens:4096,maxOutputTokens:512}
  await bridge.communityAiStart('srv-1','project-1','Explique',[],limits,'anthropic')
  await bridge.communityAiStop('srv-1','project-1','run-2')
  assert.deepEqual(calls[0],['community-ai-start','srv-1','project-1','Explique',[],limits,'anthropic'])
  assert.deepEqual(calls[1],['community-ai-stop','srv-1','project-1','run-2'])
})

test('personal AI credentials and selected files remain bound to the local account',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'contalk-ai-desktop-'))
  const selected=path.join(directory,'notes.txt');fs.writeFileSync(selected,'Plan')
  const handlers=new Map(),window=new EventEmitter();window.webContents={mainFrame:{},isDestroyed:()=>false,send:()=>{}}
  let owner='alice'
  const {setupCommunity}=loadTypescript('electron/community.ts',{
    electron:{app:{getPath:()=>directory},dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[selected]})},ipcMain:{handle:(name,handler)=>handlers.set(name,handler),removeHandler:name=>handlers.delete(name)},safeStorage:{isEncryptionAvailable:()=>true,encryptString:value=>Buffer.from(value).reverse(),decryptString:value=>Buffer.from(value).reverse().toString()}},
    '../src/roles/invites':{validInviteCode:()=>false},
    '../src/roles/ai':{aiProviders:['openai','anthropic','gemini','xai','compatible-responses','compatible-chat'],aiFileMime:name=>name.endsWith('.txt')?'text/plain':null},
  },{Buffer,URL,AbortSignal,fetch})
  setupCommunity(window,()=>owner)
  t.after(()=>{window.emit('closed');const resolved=fs.realpathSync(directory);assert.equal(path.dirname(resolved).toLowerCase(),fs.realpathSync(os.tmpdir()).toLowerCase());fs.rmSync(resolved,{recursive:true,force:true})})
  const event={sender:window.webContents,senderFrame:window.webContents.mainFrame}
  const call=(name,...args)=>Promise.resolve().then(()=>handlers.get(name)(event,...args))
  await call('community-ai-configure',{key:'alice-personal-secret-value',contextTokens:4096,maxOutputTokens:512})
  assert.equal((await call('community-ai-status')).configured,true)
  await call('community-ai-configure',{provider:'anthropic',key:'alice-claude-secret-value',contextTokens:4096,maxOutputTokens:512})
  assert.deepEqual((await call('community-ai-status')).providers,['openai','anthropic'])
  assert.equal(fs.readdirSync(directory).filter(name=>name.startsWith('ai-')).length,1)
  assert.equal(fs.readFileSync(path.join(directory,fs.readdirSync(directory).find(name=>name.startsWith('ai-'))),'utf8').includes('alice-personal-secret-value'),false)
  const [file]=await call('community-ai-select-files')
  owner='bob'
  assert.equal((await call('community-ai-status')).configured,false)
  await assert.rejects(call('community-ai-start','srv-1','ch-general','Olá',[file.id]),/Configure sua chave/)
  await call('community-ai-configure',{key:'bob-personal-secret-value',contextTokens:8192,maxOutputTokens:1024})
  await assert.rejects(call('community-ai-start','srv-1','ch-general','Olá',[file.id]),/Selecione os arquivos novamente/)
  assert.equal(fs.readdirSync(directory).filter(name=>name.startsWith('ai-')).length,2)
  owner='alice';assert.equal((await call('community-ai-status')).contextTokens,4096)
  await call('community-ai-remove','openai');assert.equal((await call('community-ai-status')).configured,false)
  assert.deepEqual((await call('community-ai-status')).providers,['anthropic'])
  owner='bob';assert.equal((await call('community-ai-status')).configured,true)
})

test('Electron sends a personal request to the community service and receives a persisted answer',async t=>{
  const token='x'.repeat(40),directory=fs.mkdtempSync(path.join(os.tmpdir(),'contalk-ai-integration-'))
  const usedKeys=[]
  const service=createCommunityService({tokens:{[token]:'alice'},initialState:createCommunityState(['alice']),aiProvider:{count:async({key,provider})=>{usedKeys.push({key,provider});return 50},summarize:async()=>({text:'',usage:{}}),generate:async({onDelta})=>{onDelta('Olá');return {text:'Olá',usage:{input_tokens:50,output_tokens:2}}}}})
  service.server.listen(0,'127.0.0.1');await once(service.server,'listening')
  const endpoint='http://127.0.0.1:'+service.server.address().port
  t.after(async()=>{window.emit('closed');service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve));const resolved=fs.realpathSync(directory);assert.equal(path.dirname(resolved).toLowerCase(),fs.realpathSync(os.tmpdir()).toLowerCase());fs.rmSync(resolved,{recursive:true,force:true})})
  const handlers=new Map(),window=new EventEmitter();window.webContents={mainFrame:{},isDestroyed:()=>false,send:()=>{}}
  const {setupCommunity}=loadTypescript('electron/community.ts',{
    electron:{app:{getPath:()=>directory},dialog:{},ipcMain:{handle:(name,handler)=>handlers.set(name,handler),removeHandler:name=>handlers.delete(name)},safeStorage:{isEncryptionAvailable:()=>true,encryptString:value=>Buffer.from(value).reverse(),decryptString:value=>Buffer.from(value).reverse().toString()}},
    '../src/roles/invites':{validInviteCode:()=>false},'../src/roles/ai':{aiProviders:['openai','anthropic','gemini','xai','compatible-responses','compatible-chat'],aiFileMime:()=>null},
  },{Buffer,URL,AbortSignal,fetch})
  setupCommunity(window,()=>'alice')
  const event={sender:window.webContents,senderFrame:window.webContents.mainFrame},call=(name,...args)=>Promise.resolve().then(()=>handlers.get(name)(event,...args))
  await call('community-configure',{url:endpoint,token})
  await call('community-ai-configure',{key:'alice-secret-api-key',contextTokens:2048,maxOutputTokens:256})
  const snapshot=await call('community-snapshot','srv-1')
  await call('community-command','srv-1',snapshot.revision,{type:'ai-channel-model',channelId:'ch-general',model:'model-alpha'})
  const started=await call('community-ai-start','srv-1','ch-general','Oi',[],{contextTokens:1024,maxOutputTokens:128})
  assert.ok(started.runId)
  let answer
  for(let index=0;index<100&&!answer;index++){
    const current=await call('community-snapshot','srv-1')
    answer=current.messages['ch-general']?.find(item=>item.ai?.id===started.runId&&item.ai.status==='completed')
    if(!answer)await new Promise(resolve=>setTimeout(resolve,10))
  }
  assert.equal(answer?.content,'Olá')
  assert.equal(answer?.ai.inputTokens,50)
  await call('community-ai-configure',{provider:'anthropic',key:'alice-claude-secret-value',contextTokens:2048,maxOutputTokens:256})
  const next=await call('community-snapshot','srv-1')
  await call('community-command','srv-1',next.revision,{type:'ai-channel-model',channelId:'ch-general',model:'anthropic|claude-model'})
  const claude=await call('community-ai-start','srv-1','ch-general','Outra pergunta',[],undefined,'anthropic')
  assert.ok(claude.runId)
  for(let index=0;index<100&&!usedKeys.some(item=>item.provider==='anthropic');index++)await new Promise(resolve=>setTimeout(resolve,10))
  assert.deepEqual(usedKeys,[{key:'alice-secret-api-key',provider:'openai'},{key:'alice-claude-secret-value',provider:'anthropic'}])
})
