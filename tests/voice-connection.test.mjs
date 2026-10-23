import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { loadTypescript } from './load-typescript.mjs'
const user={username:'real-user',display_name:'Real user'}
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}}
function fixture({metadataFailure=false,connectFailure=false,firstConnectGate}={}) {
 let state;const rooms=[];const container={innerHTML:'',appendChild(){},querySelectorAll:()=>[]}
 const create=init=>{const get=()=>state;const set=value=>{state={...state,...(typeof value==='function'?value(state):value)}};state=init(set,get);return {getState:get}}
 const events=new Proxy({},{get:(_,key)=>key})
 class Room extends EventEmitter {
  state='disconnected';remoteParticipants=new Map();disconnects=0
  localParticipant={identity:user.username,name:user.display_name,isSpeaking:false,isMicrophoneEnabled:false,isCameraEnabled:false,isScreenShareEnabled:false,getTrackPublication:()=>undefined,setMetadata:async()=>{if(metadataFailure)throw new Error('does not have permission to update own metadata')}}
  constructor(){super();rooms.push(this)}
  async connect(){if(connectFailure)throw new Error('connection refused');if(rooms[0]===this&&firstConnectGate)await firstConnectGate.promise;this.state='connected';this.emit('Connected')}
  async disconnect(){this.disconnects++;this.state='disconnected';this.emit('Disconnected')}
 }
 const store=loadTypescript('src/store/useVoiceStore.ts',{
  zustand:{create},'livekit-client':{Room,RoomEvent:events,Track:{Source:{Camera:'camera',ScreenShare:'screen'},Kind:{Audio:'audio'}}},
  '../../shared/livekit-grant.mjs':{roomGrant:()=>({})},
  '../media/microphone':{microphoneOptions:()=>({}),publishSafeMicrophone:async room=>{room.localParticipant.isMicrophoneEnabled=true;return 'test microphone'}},
  '../media/screenShare':{stopScreenShare:async()=>{},startScreenShare:async()=>{}},
 },{window:{contalkDesktop:{getLiveKitToken:async()=> 'test-token'}},localStorage:{getItem:()=>null,setItem(){}},document:{getElementById:()=>container},console:{error(){},warn(){}}}).useVoiceStore
 return {store,rooms}
}
test('profile permission failure cannot disconnect a working voice call',async()=>{
 const {store,rooms}=fixture({metadataFailure:true})
 assert.equal(await store.getState().joinChannel('one','One',user),true)
 assert.equal(store.getState().connectionStatus,'connected');assert.equal(store.getState().currentRoom,rooms[0]);assert.equal(rooms[0].disconnects,0)
 assert.ok(store.getState().profileError);assert.equal(store.getState().error,null)
 await store.getState().leaveChannel()
})
test('a rejected connection is disposed and leaves a retryable selected channel',async()=>{
 const {store,rooms}=fixture({connectFailure:true})
 assert.equal(await store.getState().joinChannel('one','One',user),false)
 assert.equal(store.getState().connectionStatus,'disconnected');assert.equal(store.getState().currentRoom,null);assert.equal(store.getState().activeChannelId,'one');assert.equal(rooms[0].disconnects,1)
 assert.equal(store.getState().participants.length,0)
})
test('switching during a pending connection cannot resurrect the previous room',async()=>{
 const gate=deferred();const {store,rooms}=fixture({firstConnectGate:gate})
 const first=store.getState().joinChannel('one','One',user)
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(await store.getState().joinChannel('two','Two',user),true)
 gate.resolve();assert.equal(await first,false)
 assert.equal(store.getState().activeChannelId,'two');assert.equal(store.getState().currentRoom,rooms[1]);assert.equal(store.getState().connectionStatus,'connected');assert.equal(rooms[0].state,'disconnected')
 rooms[0].emit('Disconnected');assert.equal(store.getState().currentRoom,rooms[1])
 await store.getState().leaveChannel()
})
test('repeated clicks on the same pending channel do not create duplicate rooms',async()=>{
 const gate=deferred();const {store,rooms}=fixture({firstConnectGate:gate})
 const first=store.getState().joinChannel('one','One',user)
 await new Promise(resolve=>setImmediate(resolve))
 await store.getState().joinChannel('one','One',user)
 assert.equal(rooms.length,1);gate.resolve();await first;await store.getState().leaveChannel()
})
test('leaving during connect cannot publish a live connection later',async()=>{
 const gate=deferred();const {store,rooms}=fixture({firstConnectGate:gate})
 const first=store.getState().joinChannel('one','One',user);await new Promise(resolve=>setImmediate(resolve))
 await store.getState().leaveChannel();gate.resolve();assert.equal(await first,false)
 assert.equal(store.getState().connectionStatus,'disconnected');assert.equal(store.getState().currentRoom,null);assert.equal(rooms[0].state,'disconnected')
})
