import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTypescript } from './load-typescript.mjs'
test('tray actions update real voice controls, serialize pending actions and ignore actions while disconnected',async()=>{
 let sync,action,resolveMic;const sent=[],errors=[]
 const state={connectionStatus:'connected',isMicMuted:false,isDeafened:false,toggleMic:()=>new Promise(resolve=>{resolveMic=()=>{state.isMicMuted=true;sync(state);resolve()}}),toggleDeafen:async()=>{state.isDeafened=true;sync(state)}}
 const {setupTrayControls}=loadTypescript('src/media/trayControls.ts')
 const stop=setupTrayControls({getState:()=>state,subscribe:fn=>{sync=fn;return()=>{}}},{setTrayState:value=>sent.push(value),onTrayAction:fn=>{action=fn;return()=>{}}},error=>errors.push(error))
 assert.equal(sent[0].connected,true)
 action('toggle-microphone');action('toggle-output');assert.equal(state.isDeafened,false)
 resolveMic();await new Promise(resolve=>setImmediate(resolve));assert.equal(sent.at(-1).micMuted,true)
 action('toggle-output');await new Promise(resolve=>setImmediate(resolve));assert.equal(sent.at(-1).deafened,true)
 state.connectionStatus='disconnected';state.isDeafened=false;action('toggle-output');assert.equal(state.isDeafened,false)
 stop();assert.equal(sent.at(-1).connected,false);assert.equal(errors.length,0)
})
