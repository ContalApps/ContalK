import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import { createCommunityService, createCommunityState, jsonCommunityStorage } from '../scripts/community/service.mjs'
import { ALL_PERMISSIONS, initialPolicy, mask } from '../src/roles/permissions.ts'

const keys = { alice: 'a'.repeat(40), bob: 'b'.repeat(40), charlie: 'c'.repeat(40) }
function seed() {
 const state = createCommunityState(Object.keys(keys))
 const policy = initialPolicy('group', Object.keys(keys)); policy.ownerIds = ['alice']
 policy.overwrites.private = [{ id:'group', type:'role', deny:mask(['VIEW_CHANNEL']).toString(), allow:'0' }]
 state.servers.group = { id:'group', name:'Grupo', revision:0, policy, channels:[{id:'public',name:'Público',type:'text',serverId:'group'},{id:'private',name:'Segredo',type:'text',serverId:'group'},{id:'voice',name:'Voz',type:'voice',serverId:'group'}], messages:{ private:[{id:'secret',content:'Conteúdo privado'}] }, audit:[] }
 return state
}
async function fixture(t, options = {}) {
 const service = createCommunityService({ tokens:Object.fromEntries(Object.entries(keys).map(([member,key])=>[key,member])), initialState:seed(), ...options })
 service.server.listen(0,'127.0.0.1'); await once(service.server,'listening')
 t.after(async()=>{service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve))})
 const base = 'http://127.0.0.1:'+service.server.address().port
 const request = async(actor,route,body)=>{
  const response = await fetch(base+route,{ method:body?'POST':'GET', headers:{Authorization:'Bearer '+(keys[actor]||actor),...(body?{'Content-Type':'application/json'}:{})}, ...(body?{body:JSON.stringify(body)}:{}) })
  return { status:response.status, data:await response.json() }
 }
 const command = async(actor,action,server='group',revision)=>{
  const current = revision??(await request(actor,'/servers/'+server)).data.revision
  return request(actor,'/servers/'+server+'/commands',{revision:current,action})
 }
 return {...service,base,request,command}
}

test('central service authenticates identity and never delivers private channel metadata or history to unauthorized clients',async t=>{
 const f=await fixture(t)
 assert.equal((await f.request('invalid','/identity')).status,401)
 assert.equal((await f.request('bob','/identity')).data.username,'bob')
 const bob=(await f.request('bob','/servers/group')).data
 assert.equal(bob.channels.some(channel=>channel.id==='private'),false)
 assert.equal(bob.messages.private,undefined);assert.equal(bob.policy.overwrites.private,undefined)
 assert.equal(bob.audit.length,0)
 const forged=await f.command('bob',{type:'message-send',channel:'private',id:'forged',content:'Ataque',actor:'alice',userId:'alice'})
 assert.equal(forged.status,403)
 const sent=await f.command('bob',{type:'message-send',channel:'public',id:'one',content:'Olá',userId:'alice'})
 assert.equal(sent.status,200);assert.equal(sent.data.messages.public[0].userId,'bob')
 assert.equal((await f.command('charlie',{type:'message-edit',channel:'public',id:'one',content:'Outro autor'})).status,403)
 assert.equal((await f.command('bob',{type:'channel-delete',id:'public'})).status,403)
 assert.equal((await f.command('alice',{type:'message-delete',channel:'public',id:'one'})).status,200)
})

test('server settings require MANAGE_GUILD independently of role/channel management and preserve ownership, IDs and messages',async t=>{
 let saved;const storage={load:()=>saved||null,save:state=>{saved=structuredClone(state)}}
 const f=await fixture(t,{storage})
 assert.equal((await f.command('bob',{type:'server-edit',patch:{name:'Forged'},actor:'alice'})).status,403)
 await f.command('alice',{type:'role',command:{type:'create',id:'manager',name:'Gerente'}})
 await f.command('alice',{type:'role',command:{type:'edit',id:'manager',patch:{permissions:mask(['MANAGE_GUILD']).toString()}}})
 await f.command('alice',{type:'role',command:{type:'assign',id:'manager',member:'bob'}})
 const before=(await f.request('alice','/servers/group')).data
 const edited=await f.command('bob',{type:'server-edit',patch:{name:'  Novo nome  ',description:'  Um servidor de teste.  '}})
 assert.equal(edited.status,200);assert.equal(edited.data.name,'Novo nome');assert.equal(edited.data.description,'Um servidor de teste.');assert.equal(edited.data.id,'group')
 assert.equal(edited.data.audit.length,0)
 const current=(await f.request('alice','/servers/group')).data;assert.deepEqual(current.policy,before.policy);assert.deepEqual(current.messages,before.messages);assert.equal(current.audit[0].event,'server-edit');assert.equal(current.audit[0].actor,'bob');assert.equal(current.audit[0].targetName,'Novo nome')
 assert.equal((await f.command('bob',{type:'role',command:{type:'create',id:'elevated',name:'Elevação'}})).status,403)
 assert.equal((await f.command('bob',{type:'channel-delete',id:'public'})).status,403)
 for(const patch of [{},{name:''},{name:'x'.repeat(101)},{name:'Linha\nDois'},{description:'x'.repeat(301)},{description:{}},{ownerIds:['bob']},{roles:[]},{name:'X',ownership:'all-members'}])assert.equal((await f.command('bob',{type:'server-edit',patch})).status,400)
 const stale=await f.command('alice',{type:'server-edit',patch:{name:'Obsoleto'}},'group',before.revision);assert.equal(stale.status,409)
 const restarted=await fixture(t,{storage});assert.equal((await restarted.request('charlie','/servers/group')).data.name,'Novo nome');assert.equal((await restarted.request('charlie','/servers/group')).data.description,'Um servidor de teste.')
 const hq=(await restarted.command('bob',{type:'server-edit',patch:{description:'HQ colaborativo'}},'srv-1')).data;assert.equal(hq.policy.ownership,'all-members');assert.deepEqual(hq.policy.ownerIds,[])
})

test('server settings reach a second authenticated client over SSE and failed persistence publishes no change',async t=>{
 let fail=false;const f=await fixture(t,{storage:{load:()=>null,save:()=>{if(fail)throw Error('disk unavailable')}}}),controller=new AbortController();t.after(()=>controller.abort())
 const response=await fetch(f.base+'/servers/group/events',{headers:{Authorization:'Bearer '+keys.charlie},signal:controller.signal}),reader=response.body.getReader();await reader.read()
 const result=await f.command('alice',{type:'server-edit',patch:{description:'Nova descrição'}});assert.equal(result.status,200)
 assert.match(new TextDecoder().decode((await reader.read()).value),/Nova descrição/)
 fail=true
 assert.equal((await f.command('alice',{type:'server-edit',patch:{name:'Não persistiu'}})).status,500)
 const after=(await f.request('alice','/servers/group')).data;assert.equal(after.name,'Grupo');assert.equal(after.description,'Nova descrição');assert.equal(after.revision,result.data.revision)
 controller.abort()
})

test('all provisioned HQ members start as co-owners and role revisions reach another authenticated client over SSE',async t=>{
 const f=await fixture(t)
 const controller=new AbortController();t.after(()=>controller.abort())
 const stream=await fetch(f.base+'/servers/srv-1/events',{headers:{Authorization:'Bearer '+keys.bob},signal:controller.signal})
 const reader=stream.body.getReader(),decoder=new TextDecoder()
 assert.match(decoder.decode((await reader.read()).value),/"ownership":"all-members"/)
 assert.equal((await f.request('charlie','/servers/srv-1')).data.serverPermissions,ALL_PERMISSIONS.toString())
 const created=await f.command('alice',{type:'role',command:{type:'create',id:'team',name:'Equipe central'}},'srv-1')
 assert.equal(created.status,200)
 const update=decoder.decode((await reader.read()).value)
 assert.match(update,/Equipe central/);assert.match(update,/"revision":1/)
 assert.equal((await f.command('bob',{type:'role',command:{type:'assign',id:'team',member:'charlie'}},'srv-1')).status,200)
 assert.deepEqual((await f.request('charlie','/servers/srv-1')).data.policy.memberRoles.charlie,['team'])
 await reader.cancel()
})

test('role changes are serialized, reject stale revisions and persist with their audit records across restart',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'contalk-community-test-')),filename=path.join(directory,'state.json')
 t.after(()=>{const resolved=fs.realpathSync(directory);assert.equal(path.dirname(resolved).toLowerCase(),fs.realpathSync(os.tmpdir()).toLowerCase());assert.ok(path.basename(resolved).startsWith('contalk-community-test-'));fs.rmSync(resolved,{recursive:true,force:true})})
 const storage=jsonCommunityStorage(filename),f=await fixture(t,{storage})
 const results=await Promise.all(['one','two'].map(id=>f.command('alice',{type:'role',command:{type:'create',id,name:id}},'group',0)))
 assert.deepEqual(results.map(result=>result.status).sort(),[200,409])
 const recovered=storage.load().servers.group
 assert.equal(recovered.revision,1);assert.equal(recovered.roles,undefined);assert.equal(recovered.policy.roles.length,2)
 assert.equal(recovered.audit.length,1);assert.equal(recovered.audit[0].actor,'alice')
 const restarted=await fixture(t,{storage})
 assert.equal((await restarted.request('bob','/servers/group')).data.revision,1)
 assert.equal((await restarted.request('alice','/servers/group')).data.audit[0].event,'role.create')
})

test('failed persistence publishes no new revision; role overwrites require real channel or category IDs',async t=>{
 const f=await fixture(t,{storage:{load:()=>null,save:()=>{throw new Error('disk full')}}})
 assert.equal((await f.command('alice',{type:'role',command:{type:'create',id:'lost',name:'Não persistido'}})).status,500)
 assert.equal((await f.request('alice','/servers/group')).data.revision,0)
 assert.equal((await f.request('alice','/servers/group')).data.policy.roles.length,1)
 assert.equal((await f.command('alice',{type:'role',command:{type:'overwrite',channel:'missing',targetId:'group',targetType:'role',overwrite:null}})).status,404)
})

test('voice token requests are checked on the service and permission changes reconcile active participants',async t=>{
 const issued=[],reconciled=[]
 const f=await fixture(t,{voice:{token:async(server,actor,channel)=>{issued.push({actor,channel});return {token:'fixture-token',url:'wss://example.invalid'}},reconcile:async(previous,next)=>reconciled.push({previous:previous.revision,next:next.revision})}})
 assert.equal((await f.request('bob','/servers/group/voice-token',{channelId:'voice'})).status,200)
 assert.equal(issued[0].actor,'bob')
 await f.command('alice',{type:'role',command:{type:'overwrite',channel:'voice',targetId:'bob',targetType:'member',overwrite:{id:'bob',type:'member',deny:mask(['CONNECT']).toString(),allow:'0'}}})
 assert.deepEqual(reconciled,[{previous:0,next:1}])
 assert.equal((await f.request('bob','/servers/group/voice-token',{channelId:'voice',identity:'alice'})).status,403)
 assert.equal(issued.length,1)
})

test('failed voice reconciliation remains visible and blocks new tokens until enforcement succeeds',async t=>{
 const f=await fixture(t,{voice:{token:async()=>({token:'must-not-be-issued'}),reconcile:async()=>{throw new Error('Unavailable control plane')}}})
 const result=await f.command('alice',{type:'role',command:{type:'create',id:'team',name:'Equipe'}})
 assert.equal(result.status,200);assert.equal(result.data.voiceSync,'pending')
 assert.equal((await f.request('alice','/servers/group')).data.policy.roles.length,2)
 assert.equal((await f.request('bob','/servers/group/voice-token',{channelId:'voice'})).status,503)
})

test('a member without history can receive new messages and their edits over SSE without downloading older messages',async t=>{
 const f=await fixture(t)
 await f.command('alice',{type:'message-send',channel:'public',id:'old',content:'Histórico'})
 await f.command('alice',{type:'role',command:{type:'overwrite',channel:'public',targetId:'bob',targetType:'member',overwrite:{id:'bob',type:'member',allow:'0',deny:mask(['READ_MESSAGE_HISTORY']).toString()}}})
 const controller=new AbortController();t.after(()=>controller.abort())
 const response=await fetch(f.base+'/servers/group/events',{headers:{Authorization:'Bearer '+keys.bob},signal:controller.signal})
 const reader=response.body.getReader(),decoder=new TextDecoder()
 const initial=decoder.decode((await reader.read()).value)
 assert.equal(initial.includes('Histórico'),false)
 await f.command('alice',{type:'message-send',channel:'public',id:'new',content:'Ao vivo'})
 const live=decoder.decode((await reader.read()).value)
 assert.match(live,/"liveMessages":\[\{"id":"new"/);assert.equal(live.includes('Histórico'),false)
 await f.command('alice',{type:'message-edit',channel:'public',id:'new',content:'Editada'})
 assert.match(decoder.decode((await reader.read()).value),/"messageChanges":\[\{"id":"new".*"content":"Editada"/)
 await f.command('alice',{type:'message-delete',channel:'public',id:'new'})
 assert.match(decoder.decode((await reader.read()).value),/"deleted":true/)
 await reader.cancel()
})

test('only mentionable roles or authorized broad mentions produce trusted mention metadata',async t=>{
 const f=await fixture(t)
 await f.command('alice',{type:'role',command:{type:'create',id:'team',name:'Equipe'}})
 const protectedRole=await f.command('bob',{type:'message-send',channel:'public',id:'protected',content:'<@&team> @everyone'})
 assert.deepEqual(protectedRole.data.messages.public.at(-1).roleMentions,[])
 assert.equal(protectedRole.data.messages.public.at(-1).mentionsEveryone,undefined)
 await f.command('alice',{type:'role',command:{type:'edit',id:'team',patch:{mentionable:true}}})
 const allowed=await f.command('bob',{type:'message-send',channel:'public',id:'allowed',content:'<@&team>'})
 assert.deepEqual(allowed.data.messages.public.at(-1).roleMentions,['team'])
 const everyone=await f.command('alice',{type:'message-send',channel:'public',id:'everyone',content:'@everyone'})
 assert.equal(everyone.data.messages.public.at(-1).mentionsEveryone,'all')
 const edited=await f.command('alice',{type:'message-edit',channel:'public',id:'everyone',content:'Sem menção'})
 assert.equal(edited.data.messages.public.at(-1).mentionsEveryone,undefined)
 assert.equal(edited.data.messageChanges[0].mentionsEveryone,null)
 await f.command('alice',{type:'role',command:{type:'edit',id:'team',patch:{mentionable:false}}})
 const deniedEdit=await f.command('bob',{type:'message-edit',channel:'public',id:'allowed',content:'<@&team> @here'})
 assert.deepEqual(deniedEdit.data.messageChanges[0].roleMentions,[])
 assert.equal(deniedEdit.data.messageChanges[0].mentionsEveryone,null)
 assert.deepEqual(deniedEdit.data.messages.public.find(message=>message.id==='allowed').roleMentions,[])
})

test('a text-only community automatically notifies clients when a timeout expires',async t=>{
 t.mock.timers.enable({apis:['Date'],now:1000000})
 const initialState=seed();initialState.servers.group.policy.timeouts.bob=1000100
 const f=await fixture(t,{initialState})
 const controller=new AbortController();t.after(()=>controller.abort())
 const response=await fetch(f.base+'/servers/group/events',{headers:{Authorization:'Bearer '+keys.bob},signal:controller.signal})
 const reader=response.body.getReader(),decoder=new TextDecoder()
 const first=decoder.decode((await reader.read()).value).split('\n').find(line=>line.startsWith('data: '))
 assert.equal(BigInt(JSON.parse(first.slice(6)).channelPermissions.public)&mask(['SEND_MESSAGES']),0n)
 t.mock.timers.setTime(1000101)
 const deadline=setTimeout(()=>controller.abort(),2000)
 try{
  let allowed=false,buffer=''
  while(!allowed){const chunk=await reader.read();assert.equal(chunk.done,false);buffer+=decoder.decode(chunk.value);let end;while((end=buffer.indexOf('\n\n'))!==-1){const event=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=event.split('\n').find(line=>line.startsWith('data: '));if(data)allowed=(BigInt(JSON.parse(data.slice(6)).channelPermissions.public)&mask(['SEND_MESSAGES']))!==0n}}
  assert.equal(allowed,true)
 }finally{clearTimeout(deadline);await reader.cancel()}
})
