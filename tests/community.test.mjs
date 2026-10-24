import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EventEmitter } from 'node:events'
import { loadTypescript } from './load-typescript.mjs'
function createStore(initial) { if(initial) return createStore()(initial); return init => { let state; const set=patch=>{state={...state,...(typeof patch==='function'?patch(state):patch)}}; const get=()=>state;state=init(set,get);return {getState:get} } }
function appStore() { return loadTypescript('src/store/useAppStore.ts',{'zustand':{create:createStore},'zustand/middleware':{persist:init=>init}},{crypto:{randomUUID:()=> 'channel-new'}}).useAppStore }

test('brand migration preserves saved channels, messages and custom server names', () => {
 let merge
 const store = loadTypescript('src/store/useAppStore.ts', {'zustand':{create:createStore},'zustand/middleware':{persist:(init,options)=>{merge=options.merge;return init}}}).useAppStore
 const current = store.getState()
 const messages = { 'saved-channel': [{id:'saved-message',content:'Conversa preservada'}] }
 const saved = { servers:[{id:'srv-1',name:'ContalK HQ',channels:[{id:'saved-channel',name:'Sala personalizada'}]},{id:'custom',name:'Meu servidor',channels:[]}],messages }
 const result = merge(saved,current)
 assert.equal(result.servers[0].name,'ConTALK HQ')
 assert.equal(result.servers[0].channels[0].id,'saved-channel')
 assert.equal(result.messages,messages)
 assert.equal(result.servers[1].name,'Meu servidor')
 saved.servers[0].name='Meu nome personalizado'
 assert.equal(merge(saved,current).servers[0].name,'Meu nome personalizado')
})
test('starts without demo messages; creates bounded persistent-ready channel data without duplicates',()=>{
 const store=appStore();assert.equal(Object.keys(store.getState().messages).length,0)
 store.getState().addChannel('srv-1','  cinema  ','voice','new-1')
 store.getState().addChannel('srv-1','duplicate','voice','new-1')
 store.getState().addChannel('srv-1','   ','text','empty')
 const created=store.getState().servers[0].channels.filter(c=>c.id==='new-1');assert.equal(created.length,1);assert.equal(created[0].name,'cinema');assert.equal(created[0].type,'voice')
 assert.ok(!store.getState().servers[0].channels.some(c=>c.id==='empty'))
})
function fixture({metadataFailure=false}={}) {
 const app=appStore();const instances=[];const storage=new Map();const voice={activeChannelId:null,left:0,async leaveChannel(){this.left++;this.activeChannelId=null}}
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
 const store=loadTypescript('src/store/useCommunityStore.ts',{'../roles/transport':{centralEnabled:()=>false,centralPresenceToken:async()=>null},'zustand':{create:createStore},'livekit-client':{Room,RoomEvent:events},'./useFriendStore':{useFriendStore:friends},'./useAppStore':{useAppStore:app},'./useVoiceStore':{getLiveKitToken:async()=> 'test-token',useVoiceStore:{getState:()=>voice}}},{window:{},crypto:{randomUUID:()=> 'transfer-test'},TextEncoder,TextDecoder,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}}).useCommunityStore
 return {store,app,instances,friends,voice}
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

test('channel deletion removes history, picks a fallback and prevents resurrection from old snapshots',()=>{
 const app=appStore(),state=app.getState
 state().addMessage('ch-welcome','Hello',{username:'real',display_name:'Real'})
 state().removeChannel('srv-1','ch-welcome');assert.notEqual(state().activeChannelId,'ch-welcome');assert.equal(state().messages['ch-welcome'],undefined)
 state().addChannel('srv-1','resurrect','text','ch-welcome');state().addMessage('ch-welcome','late',{username:'real',display_name:'Real'})
 assert.ok(!state().servers[0].channels.some(c=>c.id==='ch-welcome'));assert.equal(state().messages['ch-welcome'],undefined)
 for(const c of [...state().servers[0].channels])state().removeChannel('srv-1',c.id)
 assert.equal(state().servers[0].channels.length,0);assert.equal(state().activeChannelId,'')
 state().addChannel('srv-1','new','text','fresh');assert.equal(state().servers[0].channels.length,1)
})

test('received deletions leave the affected voice room and survive a stale channel advertisement',async()=>{
 const f=fixture();await f.store.getState().connect({username:'real',display_name:'Real'});const room=f.instances[0]
 room.remoteParticipants.set('peer',{identity:'peer',name:'Peer'})
 f.voice.activeChannelId='vc-general'
 const payload=new TextEncoder().encode(JSON.stringify([{id:'vc-general',serverId:'srv-1'}]))
 room.emit('data',payload,{identity:'unknown'},null,'community-channel-deletions-v1');assert.equal(f.voice.left,0)
 room.emit('data',payload,{identity:'peer'},null,'community-channel-deletions-v1');assert.equal(f.voice.left,1)
 room.emit('data',new TextEncoder().encode(JSON.stringify([{id:'vc-general',name:'old room',type:'voice',serverId:'srv-1'}])),{identity:'peer'},null,'community-channels')
 assert.ok(!f.app.getState().servers[0].channels.some(c=>c.id==='vc-general'));f.store.getState().disconnect()
})

test('local deletion persists offline and closes the local call before queuing synchronization',async()=>{
 const f=fixture();f.voice.activeChannelId='vc-general'
 await assert.rejects(f.store.getState().deleteChannel('srv-1','vc-general'),/sincronização/)
 assert.equal(f.voice.left,1);assert.equal(f.app.getState().deletedChannels['vc-general'],'srv-1')
})

test('channel synchronization sends deletion records first and keeps reliable packets within the limit',async()=>{
 const f=fixture();await f.store.getState().connect({username:'real',display_name:'Real'});const sent=[]
 f.instances[0].localParticipant.publishData=async(data,options)=>sent.push({data,options})
 f.app.getState().removeChannel('srv-1','ch-welcome')
 for(let i=0;i<100;i++)f.app.getState().addChannel('srv-1','🌴'.repeat(30),'text','test-'+i)
 await f.store.getState().broadcastChannels();assert.equal(sent[0].options.topic,'community-channel-deletions-v1');assert.ok(sent.every(packet=>packet.data.byteLength<=10000));assert.ok(sent.filter(packet=>packet.options.topic==='community-channels').length>1)
 f.store.getState().disconnect()
})


test('attachment messages are chunked, reconstructed and retain their sender',async()=>{
 const f=fixture();await f.store.getState().connect({username:'real',display_name:'Real'})
 const room=f.instances[0];room.remoteParticipants.set('friend',{identity:'friend',name:'Friend'})
 const attachment={name:'photo.png',type:'image/png',size:18000,data:'data:application/octet-stream;base64,'+Buffer.alloc(18000,42).toString('base64')}
 const sent=[];room.localParticipant.publishData=async(data,options)=>sent.push({data,options})
 await f.store.getState().sendMessage('ch-welcome','Photo',undefined,attachment)
 const packets=sent.filter(p=>p.options.topic==='community-attachment-v1')
 assert.ok(packets.length>1)
 const receiver=fixture();await receiver.store.getState().connect({username:'real',display_name:'Real'});const receiverRoom=receiver.instances[0];receiverRoom.remoteParticipants.set('friend',{identity:'friend',name:'Friend'})
 for(const packet of packets){assert.ok(packet.data.byteLength<=12000);receiverRoom.emit('data',packet.data,{identity:'friend',name:'Friend'},null,packet.options.topic)}
 const received=receiver.app.getState().messages['ch-welcome'].at(-1)
 assert.equal(received.userId,'friend');assert.equal(received.attachment.data,attachment.data);receiver.store.getState().disconnect()
 f.store.getState().disconnect()
})

test('rejects malformed attachments and attachment packets addressed to another DM',async()=>{
 const f=fixture();await f.store.getState().connect({username:'real',display_name:'Real'})
 const room=f.instances[0];room.remoteParticipants.set('friend',{identity:'friend',name:'Friend'})
 for(const attachment of [{name:'bad',type:'image/png',size:1,data:'javascript:alert(1)'},{name:'bad',type:'image/png',size:1048577,data:''}]){
 room.emit('data',new TextEncoder().encode(JSON.stringify({channelId:'ch-welcome',content:'',attachment})),{identity:'friend'},null,'community-message')
 }
 const message=JSON.stringify({channelId:'dm:other:person',content:'',attachment:{name:'a.txt',type:'text/plain',size:1,data:'data:application/octet-stream;base64,YQ=='}})
 room.emit('data',new TextEncoder().encode(JSON.stringify({id:'x',index:0,total:1,chunk:message})),{identity:'friend'},null,'community-attachment-v1')
 assert.equal(Object.keys(f.app.getState().messages).length,0)
 f.store.getState().disconnect()
})


test('only the author can edit or delete; deleted messages cannot reappear on replay',()=>{
 const store=appStore(),get=store.getState,user={username:'author',display_name:'Author'}
 get().addMessage('ch-welcome','Original',user,undefined,{id:'stable-id',preview:false,once:true})
 assert.equal(get().messages['ch-welcome'][0].preview,false);assert.equal(get().messages['ch-welcome'][0].once,true)
 get().changeMessage('ch-welcome','stable-id','other','Forged');assert.equal(get().messages['ch-welcome'][0].content,'Original')
 get().changeMessage('ch-welcome','stable-id','author','Edited');assert.equal(get().messages['ch-welcome'][0].content,'Edited');assert.ok(get().messages['ch-welcome'][0].editedAt)
 get().changeMessage('ch-welcome','stable-id','other');assert.equal(get().messages['ch-welcome'].length,1)
 get().changeMessage('ch-welcome','stable-id','author');assert.equal(get().messages['ch-welcome'].length,0)
 get().addMessage('ch-welcome','Original',user,undefined,{id:'stable-id'});assert.equal(get().messages['ch-welcome'].length,0)
})

test('central storage descriptors accept 2 GB without sending the binary to peers',async()=>{
 const f=fixture();await f.store.getState().connect({username:'real',display_name:'Real'})
 const room=f.instances[0]
 const attachment={storageId:'e93684d1-2935-4989-9ea9-f73cc023b743',name:'large.zip',type:'application/zip',size:2147483648,data:''}
 await f.store.getState().sendMessage('ch-welcome','',undefined,attachment,{preview:false,once:true})
 assert.equal(f.app.getState().messages['ch-welcome'][0].attachment.size,2147483648)
 assert.equal(f.app.getState().messages['ch-welcome'][0].preview,false)
 assert.ok(room.last.data.byteLength<12000)
 f.store.getState().disconnect()
})

test('channel renames keep IDs and history, ignore stale names, and cannot restore deleted channels',()=>{
 const app=appStore(),get=app.getState
 get().addMessage('ch-general','History',{username:'real',display_name:'Real'})
 get().renameChannel('srv-1','ch-general','New name',100)
 assert.equal(get().servers[0].channels.find(c=>c.id==='ch-general').name,'New name')
 assert.equal(get().messages['ch-general'].length,1)
 get().renameChannel('srv-1','ch-general','Old name',99)
 assert.equal(get().servers[0].channels.find(c=>c.id==='ch-general').name,'New name')
 get().renameChannel('srv-1','ch-general','Z name',100)
 assert.equal(get().servers[0].channels.find(c=>c.id==='ch-general').name,'Z name')
 get().renameChannel('srv-1','ch-general','A name',100)
 assert.equal(get().servers[0].channels.find(c=>c.id==='ch-general').name,'Z name')
 get().removeChannel('srv-1','ch-general');get().renameChannel('srv-1','ch-general','Restore',101)
 assert.ok(!get().servers[0].channels.some(c=>c.id==='ch-general'))
})

test('channel sync receives revised names and ignores older snapshots',async()=>{
 const f=fixture();await f.store.getState().connect({username:'real',display_name:'Real'});const room=f.instances[0]
 const receive=(name,nameUpdatedAt)=>room.emit('data',new TextEncoder().encode(JSON.stringify([{id:'ch-general',serverId:'srv-1',type:'text',name,nameUpdatedAt}])),{identity:'friend'},null,'community-channels')
 receive('Renamed',100);assert.equal(f.app.getState().servers[0].channels.find(c=>c.id==='ch-general').name,'Renamed')
 receive('Older',90);assert.equal(f.app.getState().servers[0].channels.find(c=>c.id==='ch-general').name,'Renamed')
 f.store.getState().disconnect()
})
