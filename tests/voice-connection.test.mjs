import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { loadTypescript } from './load-typescript.mjs'
const user={username:'real-user',display_name:'Real user'}
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}}
function fixture({metadataFailure=false,connectFailure=false,firstConnectGate,authority={url:'wss://self-hosted.invalid',token:'test-token'},authorityError=false,speak=true,occupants=async()=>({})}={}) {
 const roleState={status:'connected',serverId:'group',owner:user.username}
 let state;const rooms=[];const container={innerHTML:'',appendChild(){},querySelectorAll:()=>[]}
 const create=init=>{const get=()=>state;const set=value=>{state={...state,...(typeof value==='function'?value(state):value)}};state=init(set,get);return {getState:get}}
 const events=new Proxy({},{get:(_,key)=>key})
 class Room extends EventEmitter {
  state='disconnected';remoteParticipants=new Map();disconnects=0
  localParticipant=Object.assign(new EventEmitter(),{identity:user.username,name:user.display_name,isSpeaking:false,isMicrophoneEnabled:false,isCameraEnabled:false,isScreenShareEnabled:false,getTrackPublication:()=>undefined,setName:async()=>{},setMetadata:async()=>{if(metadataFailure)throw new Error('does not have permission to update own metadata')}})
  constructor(){super();rooms.push(this)}
  async connect(url,token){this.endpoint=url;this.token=token;if(connectFailure)throw new Error('connection refused');if(rooms[0]===this&&firstConnectGate)await firstConnectGate.promise;this.state='connected';this.emit('Connected')}
  async disconnect(){this.disconnects++;this.state='disconnected';this.emit('Disconnected')}
 }
 const store=loadTypescript('src/store/useVoiceStore.ts',{
  '../media/priority-audio':loadTypescript('src/media/priority-audio.ts'),
  './useRoleStore':{useRoleStore:{getState:()=>roleState}},
  '../roles/transport':{centralEnabled:()=>!!authority,centralOccupants:occupants,centralAllows:()=>speak,centralVoiceToken:async()=>{if(authorityError)throw new Error('central denied');return authority}},
  zustand:{create},'../media/realtime':{Room,RoomEvent:events,ParticipantEvent:{IsSpeakingChanged:'IsSpeakingChanged'},Track:{Source:{Camera:'camera',ScreenShare:'screen',ScreenShareAudio:'screen-audio',Microphone:'microphone'},Kind:{Audio:'audio'}}},
  '../media/microphone':{microphoneOptions:()=>({}),setSafeMicrophoneEnabled:async(room,enabled)=>{room.localParticipant.isMicrophoneEnabled=enabled;return 'test microphone'},publishSafeMicrophone:async room=>{room.localParticipant.isMicrophoneEnabled=true;return 'test microphone'}},
  '../media/screenShare':{stopScreenShare:async()=>{},startScreenShare:async()=>{}},
 },{window:{},localStorage:{getItem:()=>null,setItem(){}},document:{getElementById:()=>container},console:{error(){},warn(){}}}).useVoiceStore
 return {store,rooms,roleState}
}
test('profile permission failure cannot disconnect a working voice call',async()=>{
 const {store,rooms}=fixture({metadataFailure:true})
 assert.equal(await store.getState().joinChannel('one','One',user),true)
 assert.equal(store.getState().connectionStatus,'connected');assert.equal(store.getState().currentRoom,rooms[0]);assert.equal(rooms[0].disconnects,0)
 assert.ok(store.getState().profileError);assert.equal(store.getState().error,null)
 await store.getState().leaveChannel()
})

test('a configured community uses its own SFU token and a listener without SPEAK never opens the microphone',async()=>{
 const f=fixture({authority:{url:'wss://central.invalid',token:'central-token'},speak:false})
 assert.equal(await f.store.getState().joinChannel('voice','Voice',user),true)
 assert.equal(f.rooms[0].endpoint,'wss://central.invalid');assert.equal(f.rooms[0].token,'central-token')
 assert.equal(f.rooms[0].localParticipant.isMicrophoneEnabled,false)
 await f.store.getState().leaveChannel()
})
test('a rejected central voice token cannot fall back to the legacy signer',async()=>{
 const f=fixture({authorityError:true})
 assert.equal(await f.store.getState().joinChannel('voice','Voice',user),false)
 assert.equal(f.rooms.length,0)
 assert.match(f.store.getState().error,/central denied/)
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

test('voice and stream gains are independent, persist on new subscriptions and both respect deafen',async()=>{
 const {store,rooms}=fixture();await store.getState().joinChannel('one','One',user)
 const track=source=>({kind:'audio',source,gain:1,setVolume(value){this.gain=value},attach:()=>({})})
 const mic=track('microphone'),screen=track('screen-audio'),other=track('screen-audio')
 const peer={identity:'peer',audioTrackPublications:new Map([['mic',{source:'microphone',audioTrack:mic}],['screen',{source:'screen-audio',audioTrack:screen}]]),getTrackPublication:()=>undefined}
 rooms[0].remoteParticipants.set('peer',peer);rooms[0].remoteParticipants.set('other',{identity:'other',audioTrackPublications:new Map([['screen',{source:'screen-audio',audioTrack:other}]]),getTrackPublication:()=>undefined})
 store.getState().setUserVolume('peer',40);store.getState().setStreamVolume('peer',175)
 assert.equal(mic.gain,.4);assert.equal(screen.gain,1.75);assert.equal(other.gain,1)
 store.getState().setStreamVolume('peer',0);assert.equal(mic.gain,.4);assert.equal(screen.gain,0)
 const replacement=track('screen-audio');rooms[0].emit('TrackSubscribed',replacement,{source:'screen-audio'},peer);assert.equal(replacement.gain,0)
 await store.getState().toggleDeafen();assert.equal(mic.gain,0);assert.equal(other.gain,0)
 store.getState().setStreamVolume('peer',150);store.getState().setUserVolume('peer',80);assert.equal(screen.gain,0);assert.equal(mic.gain,0)
 await store.getState().toggleDeafen();assert.equal(mic.gain,.8);assert.equal(screen.gain,1.5);assert.equal(other.gain,1)
 store.getState().setStreamVolume('peer',999);assert.equal(screen.gain,2)
 await store.getState().leaveChannel()
})


test('local speech updates without waiting for a room active-speakers event',async()=>{
 const {store,rooms}=fixture();await store.getState().joinChannel('one','One',user)
 const local=rooms[0].localParticipant
 local.isSpeaking=true;local.emit('IsSpeakingChanged',true)
 assert.equal(store.getState().participants.find(p=>p.isLocal).isSpeaking,true)
 local.isSpeaking=false;local.emit('IsSpeakingChanged',false)
 assert.equal(store.getState().participants.find(p=>p.isLocal).isSpeaking,false)
 await store.getState().leaveChannel()
 assert.equal(local.listenerCount('IsSpeakingChanged'),0)
 local.isSpeaking=true;local.emit('IsSpeakingChanged',true)
 assert.equal(store.getState().participants.length,0)
})

test('server audio restrictions cannot be undone by personal controls or microphone device changes',async()=>{
 const {store,rooms}=fixture();await store.getState().joinChannel('one','One',user)
 const room=rooms[0],audio={gain:1,setVolume(value){this.gain=value}}
 room.remoteParticipants.set('peer',{identity:'peer',audioTrackPublications:new Map([['audio',{source:'microphone',audioTrack:audio}]]),getTrackPublication:()=>undefined})
 Object.assign(room.localParticipant,{serverMuted:true,serverDeafened:true,isMicrophoneEnabled:false});room.emit('ServerModerationChanged')
 assert.equal(store.getState().isServerMuted,true);assert.equal(audio.gain,0)
 await store.getState().toggleMic();await store.getState().selectMicrophone('different-device');await store.getState().toggleDeafen()
 assert.equal(room.localParticipant.isMicrophoneEnabled,false);assert.equal(store.getState().isDeafened,false)
 store.getState().setUserVolume('peer',180);assert.equal(audio.gain,0)
 Object.assign(room.localParticipant,{serverMuted:false,serverDeafened:false});room.emit('ServerModerationChanged')
 assert.equal(audio.gain,1.8);assert.equal(room.localParticipant.isMicrophoneEnabled,false)
 await store.getState().leaveChannel();assert.equal(store.getState().isServerMuted,false)
})

test('moderated movement uses the supplied ticket and preserves personal mute and deafen without reopening capture',async()=>{
 const {store,rooms}=fixture();await store.getState().joinChannel('one','One',user)
 await store.getState().toggleDeafen();assert.equal(store.getState().isDeafened,true)
 rooms[0].emit('ServerMoved',{serverId:'group',channelId:'two',channelName:'Two',authority:{url:'wss://same-authority.invalid',token:'one-use-move-ticket'}})
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(store.getState().activeChannelId,'two');assert.equal(rooms[1].token,'one-use-move-ticket');assert.equal(store.getState().isDeafened,true);assert.equal(rooms[1].localParticipant.isMicrophoneEnabled,false)
 rooms[0].emit('Disconnected');assert.equal(store.getState().currentRoom,rooms[1])
 await store.getState().leaveChannel()
})

test('a moderator disconnect clears the active channel and reports the real reason',async()=>{
 const {store,rooms}=fixture();await store.getState().joinChannel('one','One',user)
 rooms[0].emit('ServerVoiceDisconnected');await rooms[0].disconnect()
 assert.equal(store.getState().activeChannelId,null);assert.equal(store.getState().currentRoom,null);assert.equal(store.getState().connectionStatus,'disconnected');assert.match(store.getState().error,/moderador/)
})

test('an old occupants request cannot restore private presence after a server switch or access revocation',async()=>{
 for(const change of ['server','revoked']){
  const gate=deferred(),{store,roleState}=fixture({occupants:()=>gate.promise})
  const request=store.getState().fetchChannelOccupants([])
  if(change==='server')roleState.serverId='other';else roleState.status='revoked'
  gate.resolve({'private-channel':[{identity:'private-member'}]});await request
  assert.equal(Object.keys(store.getState().channelOccupants).length,0)
 }
})

test('a failed shortcut request from an old call cannot mute or overwrite errors in the new call',async()=>{
 const {store,rooms}=fixture();await store.getState().joinChannel('one','One',user)
 const gate=deferred(),old=rooms[0];old.inputMode='push-to-talk';old.setPushToTalk=async pressed=>{if(pressed)throw Error('Old call failed');await gate.promise}
 const pending=store.getState().pushToTalk(true);await new Promise(resolve=>setImmediate(resolve))
 await store.getState().joinChannel('two','Two',user);gate.resolve();await pending
 assert.equal(store.getState().currentRoom,rooms[1]);assert.equal(store.getState().isMicMuted,false);assert.equal(store.getState().voiceInputError,null)
 await store.getState().leaveChannel()
})
