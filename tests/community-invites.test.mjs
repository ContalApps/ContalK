import assert from 'node:assert/strict'
import { test } from 'node:test'
import { once } from 'node:events'
import { createCommunityService, createCommunityState } from '../scripts/community/service.mjs'
import { initialPolicy, everyoneRole, mask } from '../src/roles/permissions.ts'
import { parseInvite } from '../src/roles/invites.ts'

const keys={alice:'a'.repeat(40),bob:'b'.repeat(40),charlie:'c'.repeat(40),dan:'d'.repeat(40)}
function seed(){
  const state=createCommunityState(Object.keys(keys)),policy=initialPolicy('group',['alice','bob']);policy.ownerIds=['alice']
  policy.roles.push({...everyoneRole('staff'),position:1,permissions:mask(['VIEW_AUDIT_LOG']).toString()});policy.memberRoles.bob=['staff']
  policy.overwrites.private=[{id:'group',type:'role',allow:'0',deny:mask(['VIEW_CHANNEL']).toString()}]
  policy.overwrites.private.push({id:'bob',type:'member',allow:mask(['VIEW_CHANNEL']).toString(),deny:'0'})
  state.servers.group={id:'group',name:'Grupo privado',revision:0,policy,channels:[{id:'text',serverId:'group',name:'Conversa',type:'text'},{id:'private',serverId:'group',name:'Segredo',type:'text'}],messages:{text:[{id:'message',channelId:'text',userId:'alice',content:'Histórico'}]},audit:[]}
  return state
}
async function fixture(t,options={}){
  const service=createCommunityService({tokens:Object.fromEntries(Object.entries(keys).map(([name,key])=>[key,name])),initialState:seed(),...options})
  service.server.listen(0,'127.0.0.1');await once(service.server,'listening')
  t.after(async()=>{service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve))})
  const base='http://127.0.0.1:'+service.server.address().port
  const request=async(actor,route,body)=>{const response=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+(keys[actor]||'invalid'),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json()}}
  const command=async(actor,action)=>{const current=(await request(actor,'/servers/group')).data;return request(actor,'/servers/group/commands',{revision:current.revision,action})}
  const create=async(options={})=>{const result=await command('alice',{type:'invite-create',channelId:'text',maxAge:86400,maxUses:1,...options});assert.equal(result.status,200);return result.data.invites.at(-1).code}
  return {...service,base,request,command,create}
}

test('invites require real channel permissions, reveal codes only to authorized managers and preview no private channels',async t=>{
  const f=await fixture(t)
  assert.equal((await f.command('bob',{type:'invite-create',channelId:'text',maxAge:86400,maxUses:1})).status,403)
  assert.equal((await f.command('alice',{type:'invite-create',channelId:'text',maxAge:-1,maxUses:1})).status,400)
  assert.equal((await f.command('alice',{type:'invite-create',channelId:'text',maxAge:3600,maxUses:101})).status,400)
  assert.equal((await f.command('alice',{type:'invite-create',channelId:'absent',maxAge:3600,maxUses:1})).status,404)
  const code=await f.create();assert.match(code,/^[a-f0-9]{48}$/)
  assert.equal((await f.request('bob','/servers/group')).data.invites.length,0)
  assert.equal((await f.command('bob',{type:'invite-revoke',code})).status,403)
  assert.equal((await f.request('invalid','/invites/'+code)).status,401)
  assert.equal((await f.request('charlie','/servers/group')).status,403)
  const preview=await f.request('charlie','/invites/'+code)
  assert.equal(preview.status,200);assert.equal(preview.data.name,'Grupo privado');assert.equal(preview.data.alreadyMember,false)
  assert.deepEqual(Object.keys(preview.data).sort(),['alreadyMember','code','expiresAt','name','serverId'])
  assert.equal(JSON.stringify(preview.data).includes('Segredo'),false)
})

test('the final use is atomic across two authenticated accounts and does not grant private channels or staff roles',async t=>{
  const f=await fixture(t),code=await f.create()
  const results=await Promise.all(['charlie','dan'].map(actor=>f.request(actor,'/invites/'+code+'/accept',{})))
  assert.deepEqual(results.map(result=>result.status).sort(),[200,404])
  const joined=results.find(result=>result.status===200).data
  assert.deepEqual(joined.policy.memberRoles[joined.actor],[])
  assert.equal(joined.channels.some(channel=>channel.id==='private'),false);assert.equal(joined.memberAdmissions,undefined)
  const owner=(await f.request('alice','/servers/group')).data
  assert.equal(owner.invites[0].uses,1);assert.equal(owner.policy.members.length,3)
  assert.equal(owner.memberAdmissions[joined.actor].method,'invite');assert.equal(owner.memberAdmissions[joined.actor].invitedBy,'alice')
  assert.equal(owner.memberAdmissions[joined.actor].inviteId,owner.invites[0].id)
  assert.notEqual(owner.memberAdmissions[joined.actor].inviteId,code)
  assert.equal(owner.audit[0].event,'member.join')
})

test('a creator can revoke their own invitation after losing create rights; a channel manager can revoke another creator’s invitation',async t=>{
  const f=await fixture(t)
  const overwrite=async(allow,deny='0')=>f.command('alice',{type:'role',command:{type:'overwrite',channel:'text',targetId:'bob',targetType:'member',overwrite:{id:'bob',type:'member',allow,deny}}})
  await overwrite(mask(['CREATE_INSTANT_INVITE']).toString())
  const created=await f.command('bob',{type:'invite-create',channelId:'text',maxAge:0,maxUses:1})
  assert.equal(created.status,200);const code=created.data.invites[0].code
  await overwrite('0',mask(['CREATE_INSTANT_INVITE']).toString())
  assert.equal((await f.command('bob',{type:'invite-revoke',code})).status,200)
  const other=await f.create()
  await overwrite(mask(['MANAGE_CHANNELS']).toString())
  assert.equal((await f.request('bob','/servers/group')).data.invites[0].code,other)
  assert.equal((await f.command('bob',{type:'invite-revoke',code:other})).status,200)
})

test('kick permits a new invited entry, ban blocks it, and unban plus entry restores no old roles or individual grants',async t=>{
  let saved;const storage={load:()=>saved||null,save:next=>{saved=structuredClone(next)}}
  const f=await fixture(t,{storage}),code=await f.create({maxUses:0,maxAge:0})
  await f.command('alice',{type:'member-kick',member:'bob'})
  const returned=await f.request('bob','/invites/'+code+'/accept',{})
  assert.equal(returned.status,200);assert.deepEqual(returned.data.policy.memberRoles.bob,[])
  assert.equal(BigInt(returned.data.serverPermissions)&mask(['VIEW_AUDIT_LOG']),0n)
  assert.equal(returned.data.channels.some(channel=>channel.id==='private'),false)
  await f.command('alice',{type:'member-ban',member:'bob'})
  assert.equal((await f.request('bob','/invites/'+code)).status,403)
  assert.equal((await f.request('bob','/invites/'+code+'/accept',{})).status,403)
  await f.command('alice',{type:'member-unban',member:'bob'})
  assert.equal((await f.request('bob','/servers/group')).status,403)
  const restarted=await fixture(t,{storage}),second=await restarted.request('bob','/invites/'+code+'/accept',{})
  assert.equal(second.status,200);assert.deepEqual(second.data.policy.memberRoles.bob,[])
  assert.equal((await restarted.request('alice','/servers/group')).data.invites[0].uses,2)
  assert.equal((await restarted.request('bob','/identity')).data.username,'bob')
})

test('expiration, revocation, deleted channels and removal of the inviter invalidate future acceptance',async t=>{
  t.mock.timers.enable({apis:['Date'],now:1000000})
  const f=await fixture(t),expired=await f.create({maxAge:1}),revoked=await f.create({maxAge:0})
  t.mock.timers.setTime(1001001)
  assert.equal((await f.request('charlie','/invites/'+expired+'/accept',{})).status,404)
  await f.command('alice',{type:'invite-revoke',code:revoked})
  assert.equal((await f.request('charlie','/invites/'+revoked+'/accept',{})).status,404)
  await f.command('alice',{type:'role',command:{type:'overwrite',channel:'text',targetId:'bob',targetType:'member',overwrite:{id:'bob',type:'member',allow:mask(['CREATE_INSTANT_INVITE']).toString(),deny:'0'}}})
  const created=await f.command('bob',{type:'invite-create',channelId:'text',maxAge:0,maxUses:0}),ownCode=created.data.invites[0].code
  await f.command('alice',{type:'member-kick',member:'bob'})
  assert.equal((await f.request('charlie','/invites/'+ownCode)).status,404)
  const deleted=await f.create({maxAge:0});await f.command('alice',{type:'channel-delete',id:'text'})
  assert.equal((await f.request('charlie','/invites/'+deleted)).status,404)
  assert.equal((await f.request('alice','/servers/group')).data.invites.length,0)
})

test('an existing member does not consume an available invite and failed persistence never grants membership',async t=>{
  const f=await fixture(t),code=await f.create()
  assert.equal((await f.request('bob','/invites/'+code)).data.alreadyMember,true)
  assert.equal((await f.request('bob','/invites/'+code+'/accept',{})).status,200)
  assert.equal((await f.request('alice','/servers/group')).data.invites[0].uses,0)
  const retries=await Promise.all([f.request('charlie','/invites/'+code+'/accept',{}),f.request('charlie','/invites/'+code+'/accept',{})])
  assert.ok(retries.every(result=>result.status===200))
  const consumed=(await f.request('alice','/servers/group')).data
  assert.equal(consumed.invites[0].uses,1);assert.equal(consumed.policy.members.filter(member=>member==='charlie').length,1)
  const state=seed(),blocked='1'.repeat(48)
  state.servers.group.invites={[blocked]:{code:blocked,createdBy:'alice',channelId:'text',createdAt:1,expiresAt:0,maxUses:1,uses:0}}
  const unavailable=await fixture(t,{initialState:state,storage:{load:()=>null,save:()=>{throw new Error('disk full')}}})
  assert.equal((await unavailable.request('charlie','/invites/'+blocked+'/accept',{})).status,500)
  const unchanged=(await unavailable.request('alice','/servers/group')).data
  assert.equal(unchanged.policy.members.includes('charlie'),false);assert.equal(unchanged.invites[0].uses,0);assert.equal(unchanged.revision,0)
})

test('public invite links provide an escaped landing page without revealing channels or accepting membership',async t=>{
  const state=seed();state.servers.group.name='<img src=x onerror=alert(1)>'
  const f=await fixture(t,{initialState:state}),code=await f.create()
  const page=await fetch(f.base+'/invite/'+code),html=await page.text()
  assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/default-src 'none'/)
  assert.equal(html.includes('<img src=x'),false);assert.equal(html.includes('&lt;img'),true)
  assert.equal(html.includes('Segredo'),false)
  assert.equal((await f.request('charlie','/servers/group')).status,403)
})

test('invite input accepts only a raw code or a link for the configured community, never another origin or credentials',()=>{
  const code='a'.repeat(48),origin='https://community.example.com'
  assert.equal(parseInvite(code,origin),code)
  assert.equal(parseInvite(origin+'/invite/'+code,origin),code)
  for(const value of ['https://other.example.com/invite/'+code,'https://alice:secret@community.example.com/invite/'+code,origin+'/invite/'+code+'?token=secret',origin+'/invite/'+code+'#other',origin+'/invites/'+code,'../identity'])assert.throws(()=>parseInvite(value,origin))
})
