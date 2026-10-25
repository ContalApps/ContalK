import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { initialPolicy, mask, can, threadArchived } from '../src/roles/permissions.ts'
import { createCommunityService,createCommunityState } from '../scripts/community/service.mjs'
const names=['alice','bob','carol','dan'],keys=Object.fromEntries(names.map((name,index)=>[name,String(index).repeat(40)]))
function seed(){const state=createCommunityState(names),policy=initialPolicy('group',names);policy.ownerIds=['alice'];state.servers.group={id:'group',name:'Teste',revision:0,policy,channels:[{id:'text',type:'text',name:'Texto',serverId:'group'},{id:'voice',type:'voice',name:'Voz',serverId:'group'}],messages:{text:[{id:'source',userId:'alice',userName:'Alice',channelId:'text',content:'Mensagem de origem',timestamp:1},{id:'once',userId:'alice',channelId:'text',content:'Uma vez',timestamp:2,once:true}]},audit:[]};return state}
async function fixture(t,options={}){
 const service=createCommunityService({tokens:Object.fromEntries(names.map(name=>[keys[name],name])),initialState:seed(),...options});service.server.listen(0,'127.0.0.1');await once(service.server,'listening');t.after(async()=>{service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve))});const base='http://127.0.0.1:'+service.server.address().port
 const request=async(actor,route,body)=>{const response=await fetch(base+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+(keys[actor]||actor),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()}}
 const command=async(actor,action,server='group')=>{const revision=(await request(actor,'/servers/'+server)).data.revision;return request(actor,'/servers/'+server+'/commands',{revision,action})}
 const rules=(member,allow=[],deny=[])=>command('alice',{type:'role',command:{type:'overwrite',channel:'text',targetId:member,targetType:'member',overwrite:{id:member,type:'member',allow:mask(allow).toString(),deny:mask(deny).toString()}}})
 const stream=async actor=>{const controller=new AbortController();t.after(()=>controller.abort());const response=await fetch(base+'/servers/group/events',{headers:{Authorization:'Bearer '+keys[actor]},signal:controller.signal}),reader=response.body.getReader();const read=async()=>JSON.parse(new TextDecoder().decode((await reader.read()).value).split('\n').find(line=>line.startsWith('data: ')).slice(6));const initial=await read();return {controller,read,initial}}
 return {...service,base,request,command,rules,stream}
}
const create=(id='thread',extra={})=>({type:'thread-create',id,parentId:'text',name:'Discussão',private:false,invitable:true,autoArchiveMinutes:1440,...extra})
const send=(id='reply',channel='thread')=>({type:'message-send',id,channel,content:'Resposta no tópico'})

test('thread permissions inherit categories and individual rules while replying is independent of parent SEND_MESSAGES',()=>{
 const policy=initialPolicy('group',names);policy.ownerIds=['alice'];policy.overwrites.text=[{id:'bob',type:'member',allow:mask(['SEND_MESSAGES_IN_THREADS']).toString(),deny:mask(['SEND_MESSAGES']).toString()}]
 policy.threads={thread:{parentId:'text',ownerId:'bob',private:false,members:['bob'],archived:false,locked:false,invitable:true,autoArchiveMinutes:60,createdAt:1,lastActivityAt:Date.now()}}
 assert.equal(can(policy,'bob','SEND_MESSAGES','text'),false);assert.equal(can(policy,'bob','SEND_MESSAGES','thread'),true);assert.equal(can(policy,'bob','ATTACH_FILES','thread'),true);assert.equal(can(policy,'bob','EMBED_LINKS','thread'),true)
 policy.channelCategories.text={categoryId:'cat',synced:true};policy.overwrites.cat=[{id:'group',type:'role',allow:'0',deny:mask(['VIEW_CHANNEL']).toString()}]
 assert.equal(can(policy,'bob','VIEW_CHANNEL','thread'),false)
 policy.overwrites.cat=[];policy.threads.thread.private=true;assert.equal(can(policy,'carol','VIEW_CHANNEL','thread'),false);assert.equal(can(policy,'alice','VIEW_CHANNEL','thread'),true)
 policy.threads.thread.locked=true;assert.equal(can(policy,'bob','SEND_MESSAGES','thread'),false);assert.equal(can(policy,'alice','SEND_MESSAGES','thread'),true)
})

test('creation validates separate permissions, root channel, IDs, source visibility and duplicate source links',async t=>{
 const f=await fixture(t);assert.equal((await f.command('bob',create())).status,403)
 await f.rules('bob',['CREATE_PUBLIC_THREADS','CREATE_PRIVATE_THREADS'],['SEND_MESSAGES'])
 assert.equal((await f.command('bob',create())).status,200)
 for(const extra of [{id:'nested',parentId:'thread'},{id:'voice-child',parentId:'voice'},{id:'__proto__'},{id:'text'},{id:'empty',name:''},{id:'bad-auto',autoArchiveMinutes:1}])assert.notEqual((await f.command('bob',create('new',extra))).status,200)
 assert.equal((await f.command('bob',create('from-source',{sourceMessageId:'source'}))).status,200)
 assert.equal((await f.command('bob',create('duplicate-source',{sourceMessageId:'source'}))).status,400)
 assert.equal((await f.command('bob',create('from-once',{sourceMessageId:'once'}))).status,404)
 assert.equal((await f.command('bob',create('private-source',{private:true,sourceMessageId:'source'}))).status,400)
 assert.equal((await f.command('bob',send())).status,200);assert.equal((await f.command('bob',send('parent','text'))).status,403)
})

test('private topics disclose no metadata, messages, audit names, pins or history to nonmembers; managers and HQ co-owners retain documented access',async t=>{
 const f=await fixture(t);await f.rules('bob',['CREATE_PRIVATE_THREADS']);await f.command('alice',{type:'role',command:{type:'create',id:'auditor',name:'Auditor'}});await f.command('alice',{type:'role',command:{type:'edit',id:'auditor',patch:{permissions:mask(['VIEW_AUDIT_LOG']).toString()}}});await f.command('alice',{type:'role',command:{type:'assign',id:'auditor',member:'carol'}})
 const result=await f.command('bob',create('private-id',{name:'Nome confidencial',private:true}));assert.equal(result.status,200)
 await f.command('bob',send('private-message','private-id'))
 const snapshot=(await f.request('carol','/servers/group')).data,json=JSON.stringify(snapshot);assert.equal(json.includes('Nome confidencial'),false);assert.equal(json.includes('private-id'),false);assert.equal(snapshot.policy.threads['private-id'],undefined)
 assert.equal((await f.request('carol','/servers/group/history/private-id')).status,403);assert.equal((await f.request('carol','/servers/group/pins/private-id')).status,403)
 await f.rules('carol',['MANAGE_THREADS']);const manager=(await f.request('carol','/servers/group')).data;assert.equal(manager.channels.some(channel=>channel.id==='private-id'),true);assert.ok(manager.audit.some(entry=>entry.targetName==='Nome confidencial'))
 await f.rules('carol',['MANAGE_THREADS'],['VIEW_CHANNEL']);assert.equal((await f.request('carol','/servers/group')).data.channels.some(channel=>channel.id==='private-id'),false)
 assert.equal((await f.command('bob',create('hq-private',{parentId:'ch-general',private:true}),'srv-1')).status,200);const hq=(await f.request('dan','/servers/srv-1')).data;assert.equal(hq.policy.ownership,'all-members');assert.equal(hq.channels.some(channel=>channel.id==='hq-private'),true)
})

test('private membership changes are authenticated and respect invitable/parent access; removal stops future SSE and download access',async t=>{
 const fileId='12345678-1234-4234-9234-123456789012',internalToken='i'.repeat(40),f=await fixture(t,{files:{canReference:async()=>true},internalToken});await f.rules('bob',['CREATE_PRIVATE_THREADS'])
 await f.command('bob',create('thread',{private:true,invitable:false}));await f.command('bob',{type:'thread-member',id:'thread',member:'carol',enabled:true})
 const carol=await f.stream('carol');assert.ok(carol.initial.channels.some(channel=>channel.id==='thread'))
 assert.equal((await f.command('carol',{type:'thread-member',id:'thread',member:'dan',enabled:true})).status,403)
 await f.rules('dan',[],['VIEW_CHANNEL']);await carol.read();assert.equal((await f.command('bob',{type:'thread-member',id:'thread',member:'dan',enabled:true})).status,403)
 await f.command('bob',{...send(),attachment:{storageId:fileId,name:'file.txt',type:'text/plain',size:1}});await carol.read()
 assert.equal((await f.request(internalToken,'/internal/files/authorize',{username:'carol',storageId:fileId})).data.allowed,true)
 assert.equal((await f.command('bob',{type:'thread-member',id:'thread',member:'carol',enabled:false})).status,200);const removed=await carol.read();assert.equal(removed.channels.some(channel=>channel.id==='thread'),false);assert.equal(removed.messages.thread,undefined)
 assert.equal((await f.request(internalToken,'/internal/files/authorize',{username:'carol',storageId:fileId})).data.allowed,false)
 await f.command('bob',send('after-removal'));const next=await carol.read();assert.equal(next.liveMessages,undefined);assert.equal(JSON.stringify(next).includes('after-removal'),false)
 assert.equal((await f.command('carol',{type:'thread-member',id:'thread',member:'carol',enabled:true})).status,403);carol.controller.abort()
})

test('archive/unarchive, locking and moderation distinguish authors, members, MANAGE_CHANNELS and MANAGE_THREADS',async t=>{
 const f=await fixture(t);await f.rules('bob',['CREATE_PUBLIC_THREADS']);await f.command('bob',create());await f.command('bob',send())
 await f.rules('carol',['MANAGE_CHANNELS']);assert.equal((await f.command('carol',{type:'thread-delete',id:'thread'})).status,403);assert.equal((await f.command('carol',{type:'channel-delete',id:'thread'})).status,400)
 assert.equal((await f.command('bob',{type:'thread-edit',id:'thread',patch:{name:'Nome novo',archived:true}})).status,200)
 assert.equal((await f.command('bob',{type:'message-edit',channel:'thread',id:'reply',content:'Editar'})).status,403);assert.equal((await f.command('bob',{type:'message-reaction',channel:'thread',id:'reply',emoji:'👍',enabled:true})).status,403)
 assert.equal((await f.command('bob',send('auto-reopen'))).status,200);assert.equal((await f.request('bob','/servers/group')).data.policy.threads.thread.archived,false)
 assert.equal((await f.command('bob',{type:'thread-edit',id:'thread',patch:{locked:true}})).status,403)
 await f.command('alice',{type:'thread-edit',id:'thread',patch:{locked:true,archived:true}})
 assert.equal((await f.command('bob',send('locked'))).status,403);assert.equal((await f.command('bob',{type:'thread-edit',id:'thread',patch:{archived:false}})).status,403);assert.equal((await f.command('bob',{type:'message-delete',channel:'thread',id:'reply'})).status,403)
 await f.command('alice',{type:'thread-edit',id:'thread',patch:{archived:false}});assert.equal((await f.command('bob',send('still-locked'))).status,403)
 assert.equal((await f.command('bob',{type:'message-reaction',channel:'thread',id:'reply',emoji:'👍',enabled:true})).status,200)
 await f.command('alice',{type:'thread-edit',id:'thread',patch:{locked:false}});assert.equal((await f.command('bob',send('unlocked'))).status,200)
})

test('topics inherit rules instead of accepting overwrites, and self-following does not grant private access',async t=>{
 const f=await fixture(t);await f.command('alice',create());await f.command('alice',create('secret',{private:true}))
 assert.equal((await f.command('carol',{type:'thread-member',id:'thread',member:'carol',enabled:true})).status,200)
 assert.equal((await f.command('carol',{type:'thread-member',id:'secret',member:'carol',enabled:true})).status,403)
 const overwrite={type:'role',command:{type:'overwrite',channel:'thread',targetType:'member',targetId:'carol',overwrite:{id:'carol',type:'member',allow:mask(['ADMINISTRATOR']).toString(),deny:'0'}}};assert.equal((await f.command('alice',overwrite)).status,400)
 assert.equal((await f.command('alice',{type:'invite-create',channelId:'thread',maxAge:3600,maxUses:1})).status,404)
 await f.rules('carol',[],['SEND_MESSAGES_IN_THREADS']);assert.equal((await f.command('carol',send())).status,403);assert.equal((await f.command('carol',send('parent-allowed','text'))).status,200)
})

test('a creator cannot close an active poll inside a locked thread without management, while voting remains allowed there',async t=>{
 const f=await fixture(t);await f.rules('bob',['CREATE_PUBLIC_THREADS','SEND_POLLS']);await f.command('bob',create());await f.command('bob',{type:'message-send',channel:'thread',id:'poll',content:'',poll:{question:'Enquete',answers:[{text:'A'},{text:'B'}],multiple:false,durationHours:1}})
 await f.command('alice',{type:'thread-edit',id:'thread',patch:{locked:true}})
 assert.equal((await f.command('bob',{type:'poll-close',channel:'thread',id:'poll'})).status,403)
 const poll=(await f.request('bob','/servers/group')).data.messages.thread[0].poll;assert.equal((await f.command('bob',{type:'poll-vote',channel:'thread',id:'poll',answers:[poll.answers[0].id]})).status,200)
})

test('automatic archive wakes SSE clients and survives restart; a later message reopens and resets inactivity',async t=>{
 const initialState=seed(),lastActivityAt=Date.now()-3600000+1000;initialState.servers.group.channels.push({id:'thread',parentId:'text',serverId:'group',type:'text',name:'Auto'});initialState.servers.group.policy.threads={thread:{parentId:'text',ownerId:'bob',private:false,members:['bob'],locked:false,archived:false,invitable:true,autoArchiveMinutes:60,createdAt:lastActivityAt,lastActivityAt}}
 let saved;const storage={load:()=>saved||initialState,save:state=>{saved=structuredClone(state)}},f=await fixture(t,{storage}),stream=await f.stream('bob');assert.equal(stream.initial.policy.threads.thread.archived,false)
 const archived=await stream.read();assert.equal(archived.policy.threads.thread.archived,true)
 const restarted=await fixture(t,{storage});assert.equal((await restarted.request('bob','/servers/group')).data.policy.threads.thread.archived,true)
 assert.equal((await f.command('bob',send())).status,200);const reopened=await stream.read();assert.equal(reopened.policy.threads.thread.archived,false);assert.ok(reopened.policy.threads.thread.lastActivityAt>lastActivityAt);stream.controller.abort()
})

test('failed saves preserve membership and history; parent deletion cascades topics and kick clears thread membership',async t=>{
 let saved,fail=false;const storage={load:()=>saved||null,save:state=>{if(fail)throw Error('disk');saved=structuredClone(state)}},f=await fixture(t,{storage});await f.command('alice',create());await f.command('bob',send())
 fail=true;assert.equal((await f.command('alice',{type:'thread-delete',id:'thread'})).status,500);assert.equal((await f.request('bob','/servers/group/history/thread')).data.messages[0].id,'reply');fail=false
 await f.command('alice',{type:'member-kick',member:'bob'});assert.equal((await f.request('alice','/servers/group')).data.policy.threads.thread.members.includes('bob'),false)
 assert.equal((await f.command('alice',{type:'channel-delete',id:'text'})).status,200);const after=(await f.request('alice','/servers/group')).data;assert.equal(after.channels.some(channel=>channel.id==='thread'),false);assert.equal(after.messages.thread,undefined)
 assert.equal((await f.command('alice',create('thread',{parentId:'voice'}))).status,404)
 const restarted=await fixture(t,{storage});assert.equal((await restarted.request('alice','/servers/group/history/thread')).status,404)
})
