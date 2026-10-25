import {test} from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {loadTypescript} from './load-typescript.mjs'
import {pushToTalkKeys,validInputMode,validPushToTalkKey} from '../src/media/voice-input.ts'
import {createCommunityService,createCommunityState} from '../scripts/community/service.mjs'

const tick=()=>new Promise(resolve=>setImmediate(resolve))
const observable=initial=>{let state=initial;const listeners=new Set();const api={getState:()=>state,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener)},setState:patch=>{state={...state,...patch};for(const listener of listeners)listener(state)}};return api}
test('input options accept only known modes and a selected non-typing key',()=>{
 assert.equal(validInputMode('push-to-talk'),true);assert.equal(validInputMode('voice-activity'),true);assert.equal(validInputMode('always-send'),false)
 assert.equal(validPushToTalkKey('__proto__'),false);assert.equal(validPushToTalkKey('KeyA'),false);assert.equal(validPushToTalkKey('F24'),true);assert.equal(pushToTalkKeys.F24.virtualKey,0x87)
})

test('the voice authority checks current membership without copying or exposing chat history on every key renewal',()=>{
 const state=createCommunityState(['alice']),server=state.servers['srv-1'];let reads=0,authority
 Object.defineProperty(server,'messages',{get(){reads++;return {}},enumerable:true,configurable:true})
 const service=createCommunityService({tokens:{['a'.repeat(40)]:'alice'},initialState:state,voice:{attach:(_server,callback)=>{authority=callback}}})
 reads=0
 for(let i=0;i<100;i++){const grant=authority('alice','srv-1');assert.deepEqual(Object.keys(grant).sort(),['channels','nicknames','policy']);assert.equal(grant.policy.ownership,'all-members')}
 assert.equal(reads,0);assert.throws(()=>authority('unknown','srv-1'),/pertence/);service.server.close()
})

function roomFixture(){
 const {Room,Track}=loadTypescript('src/media/realtime.ts',{'mediasoup-client':{Device:class{}}})
 const room=new Room(),media={enabled:true,kind:'audio',stop(){}},track=new Track(media),pub={source:'microphone',producerId:'mic',isMuted:false,track}
 room.localParticipant.trackPublications.set('mic',pub);room.inputMode='push-to-talk';room.producers.set('mic',{pause(){},resume(){}})
 return {room,track,media,pub}
}
test('releasing a key disables capture before network acknowledgment; stale press response cannot reopen it',async()=>{
 const f=roomFixture(),pending=[];f.room.request=()=>new Promise(resolve=>pending.push(resolve))
 const held=f.room.setPushToTalk(true);const release=f.room.setPushToTalk(false)
 assert.equal(f.media.enabled,false);assert.equal(f.pub.isMuted,true)
 pending[0]({pressed:true});await held;assert.equal(f.media.enabled,false)
 pending[1]({pressed:false});await release;assert.equal(f.media.enabled,false)
})
test('server PTT lease expiration disables the local source; a blocked microphone cannot be reopened by a press response',async()=>{
 const f=roomFixture();f.room.request=async()=>({});f.room.localParticipant.serverMuted=true
 await f.room.setPushToTalk(false);await f.room.setPushToTalk(true);assert.equal(f.media.enabled,false)
 f.room.localParticipant.serverMuted=false;await f.room.setPushToTalk(true);assert.equal(f.media.enabled,true)
 await f.room.handle('producerPaused',{producerId:'mic',paused:true});assert.equal(f.media.enabled,false);assert.equal(f.track.isMuted,true)
})
test('ordinary microphone mute cuts the local track even if the server never acknowledges',()=>{
 const f=roomFixture();f.track.onMute=()=>new Promise(()=>{});void f.track.mute();assert.equal(f.media.enabled,false);assert.equal(f.track.isMuted,true)
})

test('native shortcut IPC accepts only main-frame keys, hides the helper and releases on reload or helper failure',async()=>{
 const handlers=new Map(),ipc={handle:(id,fn)=>handlers.set(id,fn),removeHandler:id=>handlers.delete(id)},window=new EventEmitter(),children=[],sent=[]
 window.webContents=Object.assign(new EventEmitter(),{mainFrame:{},isDestroyed:()=>false,send:(...args)=>sent.push(args)});window.isDestroyed=()=>false
 const spawn=(file,args,options)=>{const child=Object.assign(new EventEmitter(),{stdout:new EventEmitter(),stderr:{resume(){}},kill(){this.killed=true;this.emit('exit',0)}});children.push({child,file,args,options});return child}
 const {setupPushToTalk}=loadTypescript('electron/push-to-talk.ts',{electron:{app:{isPackaged:false},ipcMain:ipc},'node:child_process':{spawn},'node:fs':{existsSync:()=>true},'../src/media/voice-input':{pushToTalkKeys,validPushToTalkKey}},{process:{platform:'win32',env:{APP_ROOT:'fixture'}},setTimeout,clearTimeout})
 setupPushToTalk(window);const configure=handlers.get('voice-input-configure'),event={sender:window.webContents,senderFrame:window.webContents.mainFrame},id='a'.repeat(36)
 await assert.rejects(()=>configure({sender:{}},{key:'F8',id}),/Origem/);await assert.rejects(()=>configure(event,{key:'KeyA',id}),/Atalho/)
 const started=configure(event,{key:'F24',id});assert.equal(children[0].options.windowsHide,true);children[0].child.stdout.emit('data',Buffer.from('{"ready":true}\n{"pressed":true}\n'));await started;assert.equal(sent.at(-1)[1].pressed,true);assert.equal(sent.at(-1)[1].id,id)
 window.webContents.emit('did-start-loading');assert.equal(children[0].child.killed,true);assert.equal(sent.at(-1)[1].pressed,false)
 const next=configure(event,{key:'F8',id});children[1].child.stdout.emit('data',Buffer.from('{"ready":true}\n'));await next;children[1].child.emit('exit',1);assert.match(sent.at(-1)[1].error,/interrompido/);assert.equal(sent.at(-1)[1].pressed,false)
 window.emit('closed');assert.equal(handlers.size,0)
})

test('global shortcut continues while hidden but stops on mute/deafen, rejects old events and releases when disposed',async()=>{
 const pressed=[],released=[],configuration=[];let listener
 const room={inputMode:'push-to-talk',setPushToTalk:async value=>released.push(value)},voice=observable({inputMode:'push-to-talk',currentRoom:room,connectionStatus:'connected',isMicMuted:false,isDeafened:false,pushToTalk:async value=>pressed.push(value)}),preferences=observable({voiceInputMode:'push-to-talk',pushToTalkKey:'F8'})
 const {setupVoiceInput}=loadTypescript('src/media/push-to-talk.ts',{'../store/useVoiceStore':{useVoiceStore:voice},'../store/usePreferencesStore':{usePreferencesStore:preferences}},{crypto:globalThis.crypto,window:{contalkDesktop:{configureVoiceInput:async value=>configuration.push(value),onVoiceInputKey:callback=>{listener=callback;return()=>listener=null}}}})
 const stop=setupVoiceInput(),first=configuration.at(-1);assert.equal(first.key,'F8');listener({id:'stale',pressed:true});assert.equal(pressed.length,0)
 listener({id:first.id,pressed:true});assert.equal(pressed.at(-1),true)
 voice.setState({isMicMuted:true});listener({id:first.id,pressed:true});assert.equal(configuration.at(-1),null);assert.equal(pressed.length,1);assert.equal(released.at(-1),false)
 voice.setState({isMicMuted:false});const next=configuration.at(-1);assert.notEqual(next.id,first.id)
 preferences.setState({pushToTalkKey:'F24'});assert.equal(configuration.at(-1).key,'F24');listener({id:next.id,pressed:true});assert.equal(pressed.length,1)
 voice.setState({isDeafened:true});assert.equal(configuration.at(-1),null);stop();assert.equal(listener,null)
})

test('focused fallback never stays pressed after blur and requires release before another transmission',async()=>{
 const target=new EventEmitter(),pressed=[],room={inputMode:'push-to-talk',setPushToTalk:async()=>{}},voice=observable({inputMode:'push-to-talk',currentRoom:room,connectionStatus:'connected',isMicMuted:false,isDeafened:false,pushToTalk:async value=>pressed.push(value)}),preferences=observable({voiceInputMode:'push-to-talk',pushToTalkKey:'F8'})
 const window={addEventListener:(event,handler)=>target.on(event,handler),removeEventListener:(event,handler)=>target.off(event,handler)}
 const {setupVoiceInput}=loadTypescript('src/media/push-to-talk.ts',{'../store/useVoiceStore':{useVoiceStore:voice},'../store/usePreferencesStore':{usePreferencesStore:preferences}},{crypto:globalThis.crypto,window})
 const stop=setupVoiceInput(),key={code:'F8',repeat:false,preventDefault(){}}
 target.emit('keydown',key);assert.equal(pressed.at(-1),true);target.emit('blur');assert.equal(pressed.at(-1),false)
 const count=pressed.length;target.emit('keydown',key);assert.equal(pressed.length,count);target.emit('keyup',key);target.emit('keydown',key);assert.equal(pressed.at(-1),true)
 stop();assert.equal(pressed.at(-1),false);assert.equal(target.listenerCount('keydown'),0);await tick()
})
