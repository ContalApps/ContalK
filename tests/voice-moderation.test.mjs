import assert from 'node:assert/strict'
import { test } from 'node:test'
import { once } from 'node:events'
import { WebSocket } from 'ws'
import { createCommunityService,createCommunityState } from '../scripts/community/service.mjs'
import { createCommunityVoice,voicePermissions } from '../scripts/community/realtime.mjs'
import { initialPolicy,mask } from '../src/roles/permissions.ts'
import { canModerateVoice } from '../src/roles/voice-moderation.ts'

const members=['alice','bob','carol','dan','eve','frank'],keys=Object.fromEntries(members.map((name,index)=>[name,String(index).repeat(40)]))
function seed(){const state=createCommunityState(members),policy=initialPolicy('group',members);policy.ownerIds=['alice'];state.servers.group={id:'group',name:'Voice',revision:0,policy,channels:['one','two'].map(id=>({id,serverId:'group',name:id,type:'voice'})),messages:{},audit:[]};return state}
async function fixture(t,options={}){
  const voice=createCommunityVoice({url:'ws://127.0.0.1/realtime'}),service=createCommunityService({tokens:Object.fromEntries(members.map(member=>[keys[member],member])),initialState:seed(),...options,voice})
  service.server.listen(0,'127.0.0.1');await once(service.server,'listening')
  const base='http://127.0.0.1:'+service.server.address().port,sockets=[]
  t.after(async()=>{voice.close();for(const socket of sockets)socket.terminate();service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve))})
  const request=async(actor,route,body)=>{const response=await fetch(base+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+keys[actor],'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()}}
  const command=async(actor,action,id='group')=>{const current=await request(actor,'/servers/'+id);return request(actor,'/servers/'+id+'/commands',{revision:current.data.revision,action})}
  const connect=async(actor,channel='one',{features=['voice-move-v1'],token,serverId='group'}={})=>{
    if(!token){const ticket=await request(actor,'/servers/'+serverId+'/voice-token',{channelId:channel});assert.equal(ticket.status,200);token=ticket.data.token}
    const socket=new WebSocket(base.replace('http:','ws:')+'/realtime');sockets.push(socket);await once(socket,'open')
    const response=once(socket,'message'),closed=once(socket,'close');socket.send(JSON.stringify({id:1,method:'auth',token,features}))
    const result=await Promise.race([response.then(([value])=>JSON.parse(value)),closed.then(([code])=>({closed:code}))]);return {socket,result}
  }
  return {voice,request,command,connect}
}
const action=(type='voice-mute',extra={})=>({type,member:'bob',channelId:'one',enabled:true,...extra})
const packet=(socket,event)=>new Promise(resolve=>{const listener=value=>{const data=JSON.parse(value);if(data.event===event){socket.off('message',listener);resolve(data.data)}};socket.on('message',listener)})

test('voice permissions use the channel rather than role position, and never change HQ co-ownership',()=>{
  const policy=initialPolicy('group',members);policy.ownerIds=['alice'];policy.overwrites.one=[{id:'bob',type:'member',allow:mask(['MUTE_MEMBERS']).toString(),deny:'0'}]
  assert.equal(canModerateVoice(policy,'bob','alice','MUTE_MEMBERS','one'),true)
  assert.equal(canModerateVoice(policy,'bob','alice','MUTE_MEMBERS','two'),false)
  const hq=initialPolicy('srv-1',members);assert.equal(canModerateVoice(hq,'bob','alice','MUTE_MEMBERS','vc-general'),true);assert.equal(hq.ownership,'all-members')
  hq.voiceRestrictions={alice:{muted:true,deafened:true}};const grant=voicePermissions(hq,'alice','vc-general')
  assert.equal(grant.canSubscribe,true);assert.equal(grant.canReceiveAudio,false);assert.equal(grant.canPublishSources.includes('microphone'),false);assert.equal(grant.canPublishSources.includes('screen_share'),true)
})

test('real HTTP moderation rejects unprivileged, disconnected, invalid and stale targets',async t=>{
  const f=await fixture(t)
  assert.equal((await f.command('carol',action())).status,403)
  assert.equal((await f.command('alice',action())).status,409)
  await f.connect('bob')
  assert.equal((await f.command('alice',action('voice-mute',{enabled:'true'}))).status,400)
  assert.equal((await f.command('alice',action('voice-mute',{channelId:'__proto__'}))).status,400)
  assert.equal((await f.command('alice',action('voice-mute',{channelId:'two'}))).status,409)
  assert.equal((await f.command('alice',action('voice-mute',{reason:'x'.repeat(513)}))).status,400)
  assert.equal((await f.command('alice',action('voice-move',{destinationId:'one'}))).status,400)
  assert.equal((await f.command('alice',action('voice-move',{destinationId:'missing'}))).status,404)
})

test('mute and deafen are persisted, audited and present in a fresh media session; unmute never creates a producer',async t=>{
  let saved;const f=await fixture(t,{storage:{load:()=>null,save:state=>{saved=structuredClone(state)}}}),bob=await f.connect('bob')
  const changed=packet(bob.socket,'moderation');assert.equal((await f.command('alice',action('voice-mute',{reason:'Teste'}))).status,200)
  assert.equal((await changed).serverMuted,true)
  assert.equal(saved.servers.group.policy.voiceRestrictions.bob.muted,true)
  assert.equal((await f.command('alice',action('voice-deafen'))).status,200)
  const rejoined=await f.connect('bob');assert.equal(rejoined.result.data.self.serverDeafened,true);assert.equal(rejoined.result.data.self.canPublishMicrophone,false)
  const current=await f.request('alice','/servers/group');assert.equal(current.data.audit[0].event,'voice-deafen');assert.equal(current.data.audit[0].member,'bob')
  await f.command('alice',action('voice-mute',{enabled:false}));await f.command('alice',action('voice-deafen',{enabled:false}))
  assert.equal((await f.request('alice','/servers/group')).data.policy.voiceRestrictions.bob,undefined)
})

test('moving uses a single-use destination ticket, closes the original session, and checks destination access',async t=>{
  const f=await fixture(t),bob=await f.connect('bob')
  await f.command('alice',{type:'role',command:{type:'overwrite',channel:'two',targetId:'bob',targetType:'member',overwrite:{id:'bob',type:'member',allow:'0',deny:mask(['CONNECT']).toString()}}})
  assert.equal((await f.command('alice',action('voice-move',{destinationId:'two'}))).status,403)
  await f.command('alice',{type:'role',command:{type:'overwrite',channel:'two',targetId:'bob',targetType:'member',overwrite:null}})
  const moved=packet(bob.socket,'moved'),closed=once(bob.socket,'close')
  assert.equal((await f.command('alice',action('voice-move',{destinationId:'two'}))).status,200)
  const data=await moved;assert.equal(data.channelId,'two');assert.equal(data.serverId,'group');assert.match(data.authority.token,/^[a-f0-9]{64}$/);assert.equal((await closed)[0],4009)
  assert.equal(f.voice.hasParticipant('group','bob','one'),false)
  assert.equal((await f.connect('bob','two',{token:data.authority.token})).result.data.self.identity,'bob')
  assert.equal(f.voice.hasParticipant('group','bob','two'),true)
  assert.equal((await f.connect('bob','two',{token:data.authority.token})).result.closed,4003)
})

test('legacy media clients can be disconnected but cannot be moved into an incompatible reconnect loop',async t=>{
  const f=await fixture(t),bob=await f.connect('bob','one',{features:[]})
  assert.equal((await f.command('alice',action('voice-move',{destinationId:'two'}))).status,409)
  assert.equal(f.voice.hasParticipant('group','bob','one'),true)
  const event=packet(bob.socket,'moderatorDisconnected'),closed=once(bob.socket,'close')
  assert.equal((await f.command('alice',action('voice-move',{destinationId:null}))).status,200)
  await event;assert.equal((await closed)[0],4003)
})

test('full rooms reject movement without dropping the source call; failed persistence rolls back a reserved ticket',async t=>{
  let fail=false;const f=await fixture(t,{storage:{load:()=>null,save:()=>{if(fail)throw Error('disk unavailable')}}}),bob=await f.connect('bob')
  for(const member of ['carol','dan','eve','frank'])await f.connect(member,'two')
  assert.equal((await f.command('alice',action('voice-move',{destinationId:'two'}))).status,409)
  assert.equal(f.voice.hasParticipant('group','bob','one'),true)
  const destination=await f.connect('carol','two');destination.socket.close();await once(destination.socket,'close')
  fail=true
  assert.equal((await f.command('alice',action('voice-move',{destinationId:'two'}))).status,500)
  assert.equal(f.voice.hasParticipant('group','bob','one'),true)
  assert.equal((await f.connect('alice','two')).result.data.self.identity,'alice') // Cancel released the destination reservation.
  assert.equal((await f.command('alice',action())).status,500)
  assert.equal((await f.request('alice','/servers/group')).data.policy.voiceRestrictions,undefined)
  assert.equal(bob.socket.readyState,1)
})

test('a move reserves its destination before saving so a racing connection cannot take the final slot',async t=>{
 let entered,release
 const saving=new Promise(resolve=>{entered=resolve}),gate=new Promise(resolve=>{release=resolve})
 let pause=false
 const f=await fixture(t,{storage:{load:()=>null,save:async()=>{if(pause){entered();await gate}}}})
 t.after(()=>release())
 const bob=await f.connect('bob');for(const member of ['carol','dan','eve'])await f.connect(member,'two')
 pause=true
 const moving=packet(bob.socket,'moved'),command=f.command('alice',action('voice-move',{destinationId:'two'}))
 await saving
 assert.equal((await f.connect('frank','two')).result.closed,4003)
 assert.equal(f.voice.hasParticipant('group','bob','one'),true)
 release();assert.equal((await command).status,200)
 const event=await moving
 assert.equal((await f.connect('bob','two',{token:event.authority.token})).result.data.self.identity,'bob')
})
