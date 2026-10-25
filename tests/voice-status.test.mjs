import assert from 'node:assert/strict'
import { test } from 'node:test'
import { once } from 'node:events'
import { WebSocket } from 'ws'
import { createCommunityService,createCommunityState } from '../scripts/community/service.mjs'
import { createCommunityVoice,voicePermissions } from '../scripts/community/realtime.mjs'
import { initialPolicy,mask } from '../src/roles/permissions.ts'
import { canSetVoiceStatus,normalizeVoiceStatus } from '../src/roles/voice-status.ts'

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
const status=(value='Jogando juntos',channelId='one')=>({type:'voice-status',channelId,status:value})
const rule=(member,allow=[],deny=[],channel='one')=>({type:'role',command:{type:'overwrite',channel,targetId:member,targetType:'member',overwrite:{id:member,type:'member',allow:mask(allow).toString(),deny:mask(deny).toString()}}})

test('voice status supports emoji, normalization and clearing without accepting control characters or oversized values',()=>{
 assert.equal(normalizeVoiceStatus('  Cafe\u0301 🎮  '),'Café 🎮');assert.equal(normalizeVoiceStatus('   '),null);assert.equal(normalizeVoiceStatus(null),null)
 for(const bad of [1,false,{},'x'.repeat(501),'x\ny','x\ty','\u0000','x\u2028y'])assert.throws(()=>normalizeVoiceStatus(bad))
 const policy=initialPolicy('group',members);policy.ownerIds=['alice'];policy.overwrites.one=[{id:'bob',type:'member',allow:mask(['SET_VOICE_CHANNEL_STATUS']).toString(),deny:'0'}]
 assert.equal(canSetVoiceStatus(policy,'bob','one',true),true);assert.equal(canSetVoiceStatus(policy,'bob','one',false),false);assert.equal(canSetVoiceStatus(policy,'alice','one',false),true)
})

test('status authorizes actual WS membership, not claimed connection or unrelated channel; managers still need SET_STATUS',async t=>{
 const f=await fixture(t);await f.command('alice',rule('bob',['SET_VOICE_CHANNEL_STATUS']))
 assert.equal((await f.command('bob',status())).status,403);await f.connect('bob','two');assert.equal((await f.command('bob',status())).status,403)
 const connected=await f.connect('bob');assert.equal(connected.result.data.self.identity,'bob');assert.equal((await f.command('bob',status())).status,200)
 await f.command('alice',rule('carol',['MANAGE_CHANNELS']));assert.equal((await f.command('carol',status())).status,403)
 await f.command('alice',rule('carol',['MANAGE_CHANNELS','SET_VOICE_CHANNEL_STATUS']));assert.equal((await f.command('carol',status('Fora da chamada'))).status,200)
 connected.socket.close();await once(connected.socket,'close');assert.equal((await f.command('bob',status())).status,403)
})

test('status inherits category rules, obeys timeout/revocation, hides private data and audits the authorized context',async t=>{
 const initial=seed(),p=initial.servers.group.policy;p.categories=[{id:'cat',name:'Categoria'}];p.channelCategories.one={categoryId:'cat',synced:true};p.overwrites.cat=[{id:'bob',type:'member',allow:mask(['SET_VOICE_CHANNEL_STATUS']).toString(),deny:'0'},{id:'carol',type:'member',allow:mask(['VIEW_AUDIT_LOG']).toString(),deny:mask(['VIEW_CHANNEL']).toString()}]
 const f=await fixture(t,{initialState:initial});await f.connect('bob');assert.equal((await f.command('bob',status('Assunto reservado'))).status,200)
 const current=(await f.request('alice','/servers/group')).data;assert.equal(current.channels.find(c=>c.id==='one').voiceStatus,'Assunto reservado');assert.equal(current.audit[0].actor,'bob');assert.equal(current.audit[0].reason,'Status: Assunto reservado')
 assert.equal(JSON.stringify((await f.request('carol','/servers/group')).data).includes('Assunto reservado'),false)
 await f.command('alice',{type:'role',command:{type:'timeout',member:'bob',until:Date.now()+60000}});assert.equal((await f.command('bob',status())).status,403)
 await f.command('alice',{type:'role',command:{type:'timeout',member:'bob',until:0}});await f.command('alice',{type:'role',command:{type:'overwrite',channel:'cat',targetId:'bob',targetType:'member',overwrite:{id:'bob',type:'member',allow:'0',deny:mask(['SET_VOICE_CHANNEL_STATUS']).toString()}}});assert.equal((await f.command('bob',status())).status,403)
})

test('status persists through restart, clears explicitly and keeps HQ co-ownership unchanged',async t=>{
 let saved;const f=await fixture(t,{storage:{load:()=>null,save:state=>{saved=structuredClone(state)}}})
 assert.equal((await f.command('alice',status('🎙️ Papo aberto'))).status,200);const restart=await fixture(t,{initialState:saved});assert.equal((await restart.request('bob','/servers/group')).data.channels.find(c=>c.id==='one').voiceStatus,'🎙️ Papo aberto')
 assert.equal((await restart.command('alice',status(null))).status,200);assert.equal((await restart.request('bob','/servers/group')).data.channels.find(c=>c.id==='one').voiceStatus,null)
 assert.equal((await f.command('bob',status('HQ aberto','vc-general'),'srv-1')).status,200);assert.equal((await f.request('bob','/servers/srv-1')).data.policy.ownership,'all-members')
})

test('status rejects bad channels and values; persistence failure and concurrent revisions cannot report or publish success',async t=>{
 let fail=false;const f=await fixture(t,{storage:{load:()=>null,save:()=>{if(fail)throw Error('Synthetic disk failure')}}})
 for(const action of [status('bad','__proto__'),status('bad','missing'),status('x'.repeat(501)),status({forged:true})])assert.notEqual((await f.command('alice',action)).status,200)
 await f.command('alice',status('Original'));const before=(await f.request('alice','/servers/group')).data;fail=true
 assert.equal((await f.command('alice',status('Lost'))).status,500);const after=(await f.request('alice','/servers/group')).data;assert.equal(after.revision,before.revision);assert.equal(after.channels.find(c=>c.id==='one').voiceStatus,'Original')
 assert.equal((await f.request('alice','/servers/group/commands',{revision:before.revision-1,action:status('Stale')})).status,409)
})
