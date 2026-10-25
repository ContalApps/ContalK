import {test} from 'node:test'
import assert from 'node:assert/strict'
import {loadTypescript} from './load-typescript.mjs'
import {initialPolicy,mask} from '../src/roles/permissions.ts'
const tick=()=>new Promise(resolve=>setImmediate(resolve))
const observable=initial=>{let state=initial;const listeners=new Set();return {getState:()=>state,setState:patch=>{const previous=state;state={...state,...patch};for(const listener of listeners)listener(state,previous)},subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener)}}}
const message=(id='one',extra={})=>({id,channelId:'text',userId:'alice',userName:'Alice',content:'Mensagem para ler',timestamp:Date.now(),...extra})
function fixture(options={}){
 const policy=initialPolicy('group',['alice','bob']);policy.ownerIds=['alice']
 const roles=observable({owner:'bob',serverId:'group',status:'connected',snapshot:{id:'group',actor:'bob',policy,channels:[{id:'text',type:'text'}],messages:{text:[]}}}),preferences=observable({owner:'bob',speechAuto:false,speechVoice:'default',speechVolume:35}),voice=observable({isDeafened:false,isServerDeafened:false,outputDeviceId:'headset'}),notices=observable({visibleChannel:'text'}),players=[],events=[],spoken=[];let cancelled=0
 class Audio{style={};sinkId='';volume=1;constructor(data){this.data=data;players.push(this)}async setSinkId(id){this.sinkId=id;events.push('sink:'+id)}async play(){events.push('play');this.playing=true}pause(){this.playing=false}removeAttribute(){}load(){}remove(){this.removed=true}}
 const bridge={communityMessage:options.lookup||(async()=>message()),synthesizeSpeech:options.synthesize||(async text=>{spoken.push(text);return 'data:audio/wav;base64,fixture'}),cancelSpeech:()=>cancelled++}
 const {useSpeechStore,setupSpeechPlayback}=loadTypescript('src/store/useSpeechStore.ts',{zustand:{create:init=>{const store=observable({});store.setState(init(store.setState,store.getState));return store}},'./useRoleStore':{useRoleStore:roles},'./usePreferencesStore':{usePreferencesStore:preferences},'./useVoiceStore':{useVoiceStore:voice},'./useNotificationStore':{useNotificationStore:notices},'../roles/permissions':loadTypescript('src/roles/permissions.ts')},{window:{contalkDesktop:bridge},Audio,document:{body:{appendChild(){}}}})
 return {store:useSpeechStore,setup:setupSpeechPlayback,roles,preferences,voice,notices,players,events,spoken,cancelled:()=>cancelled}
}
test('speech uses current server text and chooses the output device before playback; global mute cancels it',async()=>{
 const f=fixture({lookup:async()=>message('one',{content:'Texto atualizado'})}),stop=f.setup();f.store.getState().read(message('one',{content:'Texto antigo'}));await tick();await tick()
 assert.equal(f.spoken[0],'Alice disse: Texto atualizado');assert.deepEqual(f.events,['sink:headset','play']);assert.equal(f.players[0].volume,.35)
 f.preferences.setState({speechVolume:60});await tick();assert.equal(f.players[0].volume,.6)
 f.voice.setState({isDeafened:true});assert.equal(f.players[0].playing,false);assert.equal(f.store.getState().status,'idle');stop()
})
test('history loss, channel change and account change discard pending audio before it can play',async()=>{
 for(const change of ['history','channel','account']){
  let resolve;const f=fixture({synthesize:()=>new Promise(done=>resolve=done)}),stop=f.setup();f.store.getState().read(message());await tick()
  if(change==='history'){const policy=structuredClone(f.roles.getState().snapshot.policy);policy.overwrites.text=[{id:'bob',type:'member',allow:'0',deny:mask(['READ_MESSAGE_HISTORY']).toString()}];f.roles.setState({snapshot:{...f.roles.getState().snapshot,policy}})}
  if(change==='channel')f.notices.setState({visibleChannel:'other'})
  if(change==='account')f.preferences.setState({owner:'carol'})
  resolve('data:audio/wav;base64,late');await tick();assert.equal(f.players.length,0);assert.equal(f.store.getState().status,'idle');assert.ok(f.cancelled()>0);stop()
 }
})
test('edited and deleted messages cancel current speech and do not replay automatically',async()=>{
 for(const delta of [{id:'one',deleted:true},{id:'one',content:'Novo texto',deleted:false}]){
  const f=fixture(),stop=f.setup();f.store.getState().read(message());await tick();await tick();assert.equal(f.store.getState().status,'speaking')
  f.roles.setState({snapshot:{...f.roles.getState().snapshot,messageChanges:[delta]}});assert.equal(f.store.getState().status,'idle');assert.equal(f.players[0].playing,false);stop()
 }
})
test('automatic reading is opt-in, live-only, deduplicated and never reads once messages',async()=>{
 const f=fixture({lookup:async()=>message('live',{tts:true})}),stop=f.setup()
 f.roles.setState({snapshot:{...f.roles.getState().snapshot,liveMessages:[message('off',{tts:true})]}});await tick();assert.equal(f.players.length,0)
 f.preferences.setState({speechAuto:true});f.roles.setState({snapshot:{...f.roles.getState().snapshot,liveMessages:undefined,messages:{text:[message('old',{tts:true})]}}});await tick();assert.equal(f.players.length,0)
 f.roles.setState({snapshot:{...f.roles.getState().snapshot,liveMessages:[message('once',{tts:true,once:true})]}});await tick();assert.equal(f.players.length,0)
 f.roles.setState({snapshot:{...f.roles.getState().snapshot,liveMessages:[message('live',{tts:true})]}});await tick();await tick();assert.equal(f.players.length,1);f.players[0].onended();f.roles.setState({snapshot:{...f.roles.getState().snapshot}});await tick();assert.equal(f.players.length,1);stop()
})
