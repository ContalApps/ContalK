import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EventEmitter } from 'node:events'
import { loadTypescript } from './load-typescript.mjs'
function createStore(initial) { if(initial) return createStore()(initial); return init => { let state; const set=patch=>{state={...state,...(typeof patch==='function'?patch(state):patch)}}; const get=()=>state;state=init(set,get);return {getState:get} } }
function appStore() { return loadTypescript('src/store/useAppStore.ts',{'zustand':{create:createStore},'zustand/middleware':{persist:init=>init}},{crypto:{randomUUID:()=> 'channel-new'}}).useAppStore }
test('starts without demo messages; creates bounded persistent-ready channel data without duplicates',()=>{
 const store=appStore();assert.equal(Object.keys(store.getState().messages).length,0)
 store.getState().addChannel('srv-1','  cinema  ','voice','new-1')
 store.getState().addChannel('srv-1','duplicate','voice','new-1')
 store.getState().addChannel('srv-1','   ','text','empty')
 const created=store.getState().servers[0].channels.filter(c=>c.id==='new-1');assert.equal(created.length,1);assert.equal(created[0].name,'cinema');assert.equal(created[0].type,'voice')
 assert.ok(!store.getState().servers[0].channels.some(c=>c.id==='empty'))
})
function fixture({metadataFailure=false}={}) {
 const app=appStore();const instances=[];const storage=new Map()
 const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}
 const friends=loadTypescript('src/store/useFriendStore.ts',{'zustand':{create:createStore}},{localStorage,crypto:{randomUUID:()=>globalThis.crypto.randomUUID()}}).useFriendStore
 class Room extends EventEmitter {
  state='disconnected';remoteParticipants=new Map()
  localParticipant={identity:'real',name:'Real user',metadata:'',setMetadata:async metadata=>{if(metadataFailure)throw new Error('permission denied');this.localParticipant.metadata=metadata},setName:async name=>{this.localParticipant.name=name},publishData:async(data,options)=>{this.last={data,options}}}
  constructor(){super();instances.push(this)}
  async connect(){this.state='connected'}
  async disconnect(){this.state='disconnected';this.emit('disconnected')}
 }
 const events={ParticipantConnected:'joined',ParticipantDisconnected:'left',ParticipantMetadataChanged:'metadata',ParticipantNameChanged:'name',DataReceived:'data',Reconnecting:'reconnecting',Reconnected:'reconnected',Disconnected:'disconnected'}
 const store=loadTypescript('src/store/useCommunityStore.ts',{'zustand':{create:createStore},'livekit-client':{Room,RoomEvent:events},'./useFriendStore':{useFriendStore:friends},'./useAppStore':{useAppStore:app},'./useVoiceStore':{getLiveKitToken:async()=> 'test-token'}},{window:{},TextEncoder,TextDecoder,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}}).useCommunityStore
 return {store,app,instances,friends}
}
test('roster only reflects connected peers and clears online flags on connection loss',async()=>{
 const f=fixture();await f.store.getState().connect({username:'real',display_name:'Real user'})
 const room=f.instances[0];room.remoteParticipants.set('friend',{identity:'friend',name:'Friend',metadata:JSON.stringify({avatar:'javascript:bad',bio:'Hello'})});room.emit('joined')
 assert.equal(f.store.getState().members.filter(m=>m.online).length,2)
 assert.equal(f.store.getState().members.find(m=>m.username==='friend').avatar,undefined)
 room.emit('reconnecting');assert.ok(f.store.getState().members.every(m=>!m.online))
 f.store.getState().disconnect();assert.ok(f.store.getState().members.every(m=>!m.online))
})
test('sync validates channels and does not accept forged messages for unrelated DMs',async()=>{
 const f=fixture();await f.store.getState().connect({username:'real',display_name:'Real user'});const room=f.instances[0]
 room.emit('data',new TextEncoder().encode(JSON.stringify([{id:'shared',name:'cinema',type:'voice',serverId:'srv-1'},{id:'evil',name:'bad',type:'bad',serverId:'srv-1'}])),{identity:'friend'},null,'community-channels')
 assert.ok(f.app.getState().servers[0].channels.some(c=>c.id==='shared'));assert.ok(!f.app.getState().servers[0].channels.some(c=>c.id==='evil'))
 room.emit('data',new TextEncoder().encode(JSON.stringify({channelId:'dm:other:someone',content:'bad'})),{identity:'friend',name:'Friend'},null,'community-message')
 assert.equal(Object.keys(f.app.getState().messages).length,0)
 room.emit('data',new TextEncoder().encode(JSON.stringify({channelId:'dm:friend:real',content:'Hi'})),{identity:'friend',name:'Friend'},null,'community-message')
 assert.equal(f.app.getState().messages['dm:friend:real'][0].userId,'friend')
 f.store.getState().disconnect()
})
test('sending to offline contacts fails instead of pretending a message was delivered',async()=>{
 const f=fixture();await f.store.getState().connect({username:'real',display_name:'Real user'})
 await assert.rejects(f.store.getState().sendMessage('dm:friend:real','Hi','friend'),/offline/)
 assert.equal(Object.keys(f.app.getState().messages).length,0);f.store.getState().disconnect()
})


test('presence survives a profile synchronization failure',async()=>{
 const f=fixture({metadataFailure:true});await f.store.getState().connect({username:'real',display_name:'Real user'});assert.equal(f.store.getState().status,'online');assert.ok(f.store.getState().profileError);assert.equal(f.instances[0].state,'connected');f.store.getState().disconnect()
})
