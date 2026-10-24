import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadTypescript } from './load-typescript.mjs'
test('tray follows local transmitted voice without any mounted React component',()=>{
 const {setupTraySpeaking}=loadTypescript('src/media/traySpeaking.ts')
 let state={connectionStatus:'connected',isMicMuted:false,isDeafened:false,participants:[{isLocal:true,isSpeaking:false,isAudioEnabled:true},{isLocal:false,isSpeaking:true,isAudioEnabled:true}]},listener,unsubscribed=false
 const sent=[],store={getState:()=>state,subscribe:fn=>{listener=fn;return()=>{unsubscribed=true}}}
 const stop=setupTraySpeaking(store,value=>sent.push(value))
 assert.deepEqual(sent,[true])
 state.participants[0].isSpeaking=true;listener(state);assert.deepEqual(sent,[true])
 listener(state);assert.equal(sent.length,1)
 state.participants[0].isAudioEnabled=false;listener(state);assert.equal(sent.at(-1),false)
 state.participants[0].isAudioEnabled=true;listener(state);assert.equal(sent.at(-1),true)
 state.isMicMuted=true;listener(state);assert.equal(sent.at(-1),false)
 state.isMicMuted=false;listener(state);assert.equal(sent.at(-1),true)
 state.connectionStatus='disconnected';listener(state);assert.equal(sent.at(-1),false)
 state.connectionStatus='connected';state.isDeafened=true;listener(state);assert.equal(sent.at(-1),false)
 stop();assert.equal(unsubscribed,true);assert.equal(sent.at(-1),false)
})
