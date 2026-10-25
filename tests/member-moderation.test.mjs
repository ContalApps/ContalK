import assert from 'node:assert/strict'
import { test } from 'node:test'
import { once } from 'node:events'
import { WebSocket } from 'ws'
import { createCommunityService, createCommunityState } from '../scripts/community/service.mjs'
import { createCommunityVoice } from '../scripts/community/realtime.mjs'
import { initialPolicy, everyoneRole, mask } from '../src/roles/permissions.ts'

const keys={alice:'a'.repeat(40),bob:'b'.repeat(40),charlie:'c'.repeat(40)}
function seed(){
  const state=createCommunityState(Object.keys(keys)),policy=initialPolicy('group',Object.keys(keys));policy.ownerIds=['alice']
  policy.memberRoles.bob=['guest'];policy.roles.push({...everyoneRole('guest'),position:1,permissions:'0'})
  policy.overwrites.text=[{id:'bob',type:'member',allow:mask(['ATTACH_FILES']).toString(),deny:'0'}]
  state.servers.group={id:'group',name:'Grupo',revision:0,policy,channels:[{id:'text',name:'Texto',type:'text',serverId:'group'},{id:'voice',name:'Voz',type:'voice',serverId:'group'}],messages:{text:[{id:'old',content:'Histórico preservado',channelId:'text',userId:'bob'}]},audit:[]}
  return state
}
async function fixture(t,options={}){
  const voice=options.voice===true?createCommunityVoice({url:'ws://127.0.0.1/realtime'}):options.voice
  const service=createCommunityService({tokens:Object.fromEntries(Object.entries(keys).map(([member,key])=>[key,member])),initialState:seed(),...options,voice})
  service.server.listen(0,'127.0.0.1');await once(service.server,'listening')
  t.after(async()=>{voice?.close?.();service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve))})
  const base='http://127.0.0.1:'+service.server.address().port
  const request=async(actor,route,body)=>{const response=await fetch(base+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+keys[actor],...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()}}
  const command=async(actor,action,id='group')=>{const current=await request(actor,'/servers/'+id);return request(actor,'/servers/'+id+'/commands',{revision:current.data.revision,action})}
  return {...service,base,request,command,voice}
}

test('moderation enforces permission, hierarchy, self and co-owner protections on the real HTTP service',async t=>{
  const f=await fixture(t)
  for(const action of ['member-kick','member-ban']){
    assert.equal((await f.command('bob',{type:action,member:'charlie',actor:'alice'})).status,403)
    assert.equal((await f.command('alice',{type:action,member:'alice'})).status,403)
    assert.equal((await f.command('alice',{type:action,member:'bob'},'srv-1')).status,403)
  }
  await f.command('alice',{type:'role',command:{type:'create',id:'moderator',name:'Moderador'}})
  await f.command('alice',{type:'role',command:{type:'edit',id:'moderator',patch:{permissions:mask(['KICK_MEMBERS','BAN_MEMBERS']).toString()}}})
  await f.command('alice',{type:'role',command:{type:'move',id:'moderator',position:2}})
  for(const member of ['bob','charlie'])await f.command('alice',{type:'role',command:{type:'assign',id:'moderator',member}})
  assert.equal((await f.command('bob',{type:'member-ban',member:'charlie'})).status,403)
  assert.equal((await f.command('bob',{type:'member-kick',member:'alice'})).status,403)
  assert.equal((await f.command('alice',{type:'member-ban',member:'__proto__'})).status,400)
  assert.equal((await f.command('alice',{type:'member-ban',member:'charlie',reason:'x'.repeat(513)})).status,400)
})

test('kick revokes access, clears assignments and individual grants, preserves messages and records its actor',async t=>{
  const reconciled=[],f=await fixture(t,{voice:{reconcile:async(previous,current)=>reconciled.push(current.policy.members)}})
  const result=await f.command('alice',{type:'member-kick',member:'bob',reason:'  Regras da comunidade  '})
  assert.equal(result.status,200)
  assert.equal(result.data.policy.members.includes('bob'),false)
  assert.equal(result.data.policy.memberRoles.bob,undefined)
  assert.equal(result.data.policy.overwrites.text.some(item=>item.id==='bob'),false)
  assert.equal(result.data.messages.text[0].content,'Histórico preservado')
  assert.equal(result.data.bans.length,0)
  assert.equal(result.data.audit[0].event,'member-kick');assert.equal(result.data.audit[0].actor,'alice');assert.equal(result.data.audit[0].reason,'Regras da comunidade')
  assert.equal(reconciled.length,1);assert.equal(reconciled[0].includes('bob'),false)
  assert.equal((await f.request('bob','/servers/group')).status,403)
  assert.equal((await f.request('bob','/servers/group/history/text')).status,403)
  assert.equal((await f.request('bob','/identity')).data.serverIds.includes('group'),false)
  assert.equal((await f.request('bob','/identity')).data.username,'bob')
})

test('ban persists without re-enrollment; unban requires BAN_MEMBERS and restores neither membership nor old roles',async t=>{
  let saved;const storage={load:()=>saved||null,save:value=>{saved=structuredClone(value)}}
  const f=await fixture(t,{storage})
  assert.equal((await f.command('alice',{type:'member-ban',member:'bob',reason:'Incidente'})).status,200)
  const ordinary=(await f.request('charlie','/servers/group')).data
  assert.equal(ordinary.bans,undefined)
  assert.equal((await f.command('charlie',{type:'member-unban',member:'bob'})).status,403)
  const restarted=await fixture(t,{storage})
  assert.equal((await restarted.request('bob','/servers/group')).status,403)
  assert.equal((await restarted.request('alice','/servers/group')).data.bans[0].reason,'Incidente')
  assert.equal((await restarted.command('alice',{type:'member-unban',member:'bob'})).status,200)
  const next=(await restarted.request('alice','/servers/group')).data
  assert.equal(next.bans.length,0);assert.equal(next.policy.members.includes('bob'),false);assert.equal(next.policy.memberRoles.bob,undefined)
  assert.equal((await restarted.request('bob','/servers/group')).status,403)
  assert.equal((await restarted.request('bob','/identity')).status,200)
})

test('removal ends an existing event stream without leaking later snapshots or failing the committed command',async t=>{
  const f=await fixture(t,{voice:{reconcile:async()=>{}}}),controller=new AbortController();t.after(()=>controller.abort())
  const response=await fetch(f.base+'/servers/group/events',{headers:{Authorization:'Bearer '+keys.bob},signal:controller.signal}),reader=response.body.getReader(),decoder=new TextDecoder()
  assert.match(decoder.decode((await reader.read()).value),/Histórico preservado/)
  assert.equal((await f.command('alice',{type:'member-ban',member:'bob'})).status,200)
  const denied=decoder.decode((await reader.read()).value)
  assert.match(denied,/event: access-revoked/);assert.equal(denied.includes('Histórico preservado'),false)
  const empty=JSON.parse(denied.split('\n').find(line=>line.startsWith('data: ')).slice(6))
  assert.deepEqual(empty.messages,{});assert.deepEqual(empty.channels,[]);assert.deepEqual(empty.policy.members,[]);assert.equal(empty.serverPermissions,'0')
  assert.equal((await reader.read()).done,true)
  assert.equal((await f.command('alice',{type:'message-send',channel:'text',id:'after-removal',content:'Depois da remoção'})).status,200)
})

test('ban closes the actual media WebSocket and invalidates a previously issued unused ticket',async t=>{
  const f=await fixture(t,{voice:true})
  const current=await f.request('alice','/servers/group'),server={...current.data,policy:current.data.policy}
  const ticket=await f.voice.token(server,'bob','voice'),unused=await f.voice.token(server,'bob','voice')
  const address=f.base.replace('http:','ws:')+'/realtime'
  const socket=new WebSocket(address);t.after(()=>socket.terminate());await once(socket,'open')
  const accepted=once(socket,'message');socket.send(JSON.stringify({id:1,method:'auth',token:ticket.token}));assert.equal(JSON.parse((await accepted)[0].toString()).data.self.identity,'bob')
  const closed=once(socket,'close')
  assert.equal((await f.command('alice',{type:'member-ban',member:'bob'})).status,200)
  assert.equal((await closed)[0],4003)
  assert.equal((await f.request('bob','/servers/group/voice-token',{channelId:'voice'})).status,403)
  const retry=new WebSocket(address);t.after(()=>retry.terminate());await once(retry,'open')
  const rejected=once(retry,'close');retry.send(JSON.stringify({id:2,method:'auth',token:unused.token}));assert.equal((await rejected)[0],4003)
})
