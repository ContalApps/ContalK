import {test} from 'node:test'
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {initialPolicy,mask,can} from '../src/roles/permissions.ts'
import {canCreateEvent,canManageEvent,eventStatus,eventDeadline,normalizeEventDraft} from '../src/roles/events.ts'
import {createCommunityService,createCommunityState} from '../scripts/community/service.mjs'
const names=['alice','bob','carol','dan'],keys=Object.fromEntries(names.map((name,index)=>[name,String(index).repeat(40)]))
function seed(){const state=createCommunityState(names),policy=initialPolicy('group',names);policy.ownerIds=['alice'];state.servers.group={id:'group',name:'Teste',revision:0,policy,channels:[{id:'private-voice',type:'voice',name:'Privado',serverId:'group'},{id:'text',type:'text',name:'Texto',serverId:'group'},{id:'voice',type:'voice',name:'Voz',serverId:'group'}],messages:{text:[{id:'source',userId:'alice',userName:'Alice',channelId:'text',content:'Mensagem de origem',timestamp:1},{id:'once',userId:'alice',channelId:'text',content:'Uma vez',timestamp:2,once:true}]},audit:[]};return state}
async function fixture(t,options={}){
 const service=createCommunityService({tokens:Object.fromEntries(names.map(name=>[keys[name],name])),initialState:seed(),...options});service.server.listen(0,'127.0.0.1');await once(service.server,'listening');t.after(async()=>{service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve))});const base='http://127.0.0.1:'+service.server.address().port
 const request=async(actor,route,body)=>{const response=await fetch(base+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+(keys[actor]||actor),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()}}
 const command=async(actor,action,server='group')=>{const revision=(await request(actor,'/servers/'+server)).data.revision;return request(actor,'/servers/'+server+'/commands',{revision,action})}
 const rules=(member,allow=[],deny=[])=>command('alice',{type:'role',command:{type:'overwrite',channel:'text',targetId:member,targetType:'member',overwrite:{id:member,type:'member',allow:mask(allow).toString(),deny:mask(deny).toString()}}})
 const stream=async actor=>{const controller=new AbortController();t.after(()=>controller.abort());const response=await fetch(base+'/servers/group/events',{headers:{Authorization:'Bearer '+keys[actor]},signal:controller.signal}),reader=response.body.getReader();const read=async()=>JSON.parse(new TextDecoder().decode((await reader.read()).value).split('\n').find(line=>line.startsWith('data: ')).slice(6));const initial=await read();return {controller,read,initial}}
 return {...service,base,request,command,rules,stream}
}
const draft=(extra={})=>({name:'Encontro',description:'Planejamento',channelId:null,location:'Praça',startsAt:Date.now()+60000,endsAt:Date.now()+3600000,...extra})
const create=(id='event',extra={})=>({type:'event-create',id,draft:draft(extra)})
async function grant(f,member,permissions){await f.command('alice',{type:'role',command:{type:'create',id:member+'-role',name:'Eventos'}});await f.command('alice',{type:'role',command:{type:'edit',id:member+'-role',patch:{permissions:mask(permissions).toString()}}});await f.command('alice',{type:'role',command:{type:'assign',id:member+'-role',member}})}

test('event validation rejects forged fields, dates, locations and missing external end; lifecycle is deterministic across restart',()=>{
 for(const bad of [{name:''},{name:'x\ny'},{description:'x'.repeat(1001)},{startsAt:Date.now()-1},{endsAt:null},{endsAt:1},{startsAt:NaN},{creator:'bob'},{channelId:'voice',location:'Elsewhere'}])assert.throws(()=>normalizeEventDraft(draft(bad)))
 const event={...draft({startsAt:1000,endsAt:2000}),status:'scheduled'}
 assert.equal(eventStatus(event,999),'scheduled');assert.equal(eventStatus(event,1000),'active');assert.equal(eventStatus(event,2000),'completed')
 assert.equal(eventDeadline(event,999),1000);assert.equal(eventDeadline(event,1000),2000);assert.equal(eventDeadline(event,2000),0)
 assert.equal(eventStatus({...event,channelId:'voice'},3601000),'cancelled');assert.equal(eventStatus({...event,status:'cancelled'},1500),'cancelled')
})

test('CREATE_EVENTS controls own events and MANAGE_EVENTS controls others without kick/ban hierarchy',async t=>{
 const f=await fixture(t);assert.equal((await f.command('bob',create())).status,403)
 await grant(f,'bob',['CREATE_EVENTS']);assert.equal((await f.command('bob',create())).status,200)
 const original=(await f.request('bob','/servers/group')).data.events[0]
 assert.equal(original.creator,'bob');assert.equal(original.interested,true);assert.equal(original.interestedCount,1)
 assert.equal((await f.command('bob',{type:'event-edit',id:'event',draft:draft({name:'Renomeado'})})).status,200)
 assert.equal((await f.command('carol',{type:'event-edit',id:'event',draft:draft()})).status,403)
 await grant(f,'carol',['MANAGE_EVENTS']);assert.equal((await f.command('carol',{type:'event-edit',id:'event',draft:draft({name:'Moderação'})})).status,200)
 assert.equal((await f.command('carol',create('manager-create'))).status,403)
 assert.equal((await f.command('carol',{type:'event-status',id:'event',status:'cancelled'})).status,200)
 assert.equal((await f.command('bob',{type:'event-edit',id:'event',draft:draft()})).status,409)
 assert.equal((await f.command('carol',{type:'event-status',id:'event',status:'active'})).status,409)
 assert.equal((await f.command('bob',{type:'event-delete',id:'event'})).status,200)
 assert.equal((await f.command('bob',create())).status,400)
 assert.equal((await f.command('bob',create('hq'),'srv-1')).status,200);assert.equal((await f.command('carol',{type:'event-status',id:'hq',status:'cancelled'},'srv-1')).status,200)
})

test('voice events obey channel/category permissions, connect and VIEW filtering, including audit privacy',async t=>{
 const f=await fixture(t)
 const voiceRules=(member,allow=[],deny=[])=>f.command('alice',{type:'role',command:{type:'overwrite',channel:'private-voice',targetId:member,targetType:'member',overwrite:{id:member,type:'member',allow:mask(allow).toString(),deny:mask(deny).toString()}}})
 await grant(f,'carol',['VIEW_AUDIT_LOG']);await voiceRules('bob',['CREATE_EVENTS']);await voiceRules('carol',[],['VIEW_CHANNEL'])
 assert.equal((await f.command('bob',create('private-event',{channelId:'private-voice',location:''}))).status,200)
 const hidden=(await f.request('carol','/servers/group')).data;assert.equal(hidden.events.length,0);assert.equal(JSON.stringify(hidden.audit).includes('private-event'),false)
 assert.equal((await f.command('carol',{type:'event-interest',id:'private-event',enabled:true})).status,404)
 assert.equal((await f.command('carol',{type:'event-status',id:'private-event',status:'active'})).status,404)
 await voiceRules('bob',['CREATE_EVENTS'],['CONNECT']);assert.equal((await f.command('bob',{type:'event-edit',id:'private-event',draft:draft({channelId:'private-voice',location:''})})).status,403)
 await voiceRules('bob',['CREATE_EVENTS']);assert.equal((await f.command('bob',{type:'event-status',id:'private-event',status:'active'})).status,200)
 assert.equal((await f.command('bob',{type:'event-status',id:'private-event',status:'cancelled'})).status,400)
 assert.equal((await f.command('bob',{type:'event-status',id:'private-event',status:'completed'})).status,200)
 assert.equal((await f.command('bob',{type:'event-status',id:'private-event',status:'active'})).status,409)
 assert.equal((await f.command('alice',{type:'channel-delete',id:'private-voice'})).status,200);assert.equal((await f.request('bob','/servers/group')).data.events.length,0)
 assert.equal(JSON.stringify((await f.request('carol','/servers/group')).data.audit).includes('private-event'),false)
 const policy=initialPolicy('group',names);policy.roles[0].permissions=mask(['VIEW_CHANNEL','CONNECT']).toString();policy.categories=[{id:'cat',name:'Agenda'}];policy.channelCategories.voice={categoryId:'cat',synced:true};policy.overwrites.cat=[{id:'group',type:'role',allow:mask(['CREATE_EVENTS']).toString(),deny:'0'}]
 assert.equal(canCreateEvent(policy,'bob','voice'),true);assert.equal(can(policy,'bob','CREATE_EVENTS'),false)
})

test('interest is authenticated, idempotent, public count only and cleared on removal; timeout blocks new subscriptions',async t=>{
 const f=await fixture(t);await f.command('alice',create());await f.command('bob',{type:'event-interest',id:'event',enabled:true});await f.command('bob',{type:'event-interest',id:'event',enabled:true})
 let event=(await f.request('carol','/servers/group')).data.events[0];assert.equal(event.interestedCount,2);assert.equal(event.interested,false);assert.equal(Array.isArray(event.interested),false)
 await f.command('alice',{type:'role',command:{type:'timeout',member:'bob',until:Date.now()+60000}})
 assert.equal((await f.command('bob',{type:'event-interest',id:'event',enabled:true})).status,403)
 assert.equal((await f.command('bob',{type:'event-interest',id:'event',enabled:false})).status,200)
 await f.command('alice',{type:'member-kick',member:'bob'});event=(await f.request('alice','/servers/group')).data.events[0];assert.equal(event.interestedCount,1)
 assert.equal((await f.request('bob','/servers/group')).status,403)
})

test('external lifecycle emits SSE at both deadlines and remains terminal across restart; no early manual start',async t=>{
 const initial=seed(),now=Date.now();initial.servers.group.events={auto:{...draft({startsAt:now+350,endsAt:now+800}),id:'auto',creator:'alice',status:'scheduled',interested:['bob'],createdAt:now,updatedAt:now}}
 const f=await fixture(t,{initialState:initial}),stream=await f.stream('bob')
 assert.equal(stream.initial.events[0].status,'scheduled');assert.equal((await f.command('alice',{type:'event-status',id:'auto',status:'active'})).status,400)
 assert.equal((await stream.read()).events[0].status,'active');assert.equal((await stream.read()).events[0].status,'completed');stream.controller.abort()
 assert.equal((await f.command('alice',{type:'event-edit',id:'auto',draft:draft()})).status,409)
 const restart=await fixture(t,{initialState:initial});assert.equal((await restart.request('bob','/servers/group')).data.events[0].status,'completed')
})

test('failed storage never publishes event edits, RSVP or deletion, and stale revisions preserve existing state',async t=>{
 let fail=false,saved
 const f=await fixture(t,{storage:{load:()=>null,save:state=>{if(fail)throw Error('Synthetic disk failure');saved=structuredClone(state)}}})
 assert.equal((await f.command('alice',create())).status,200);const before=structuredClone(saved);fail=true
 for(const action of [{type:'event-edit',id:'event',draft:draft({name:'Lost'})},{type:'event-interest',id:'event',enabled:false},{type:'event-delete',id:'event'}])assert.equal((await f.command('alice',action)).status,500)
 const snapshot=(await f.request('alice','/servers/group')).data;assert.equal(snapshot.revision,before.servers.group.revision);assert.equal(snapshot.events[0].name,'Encontro');assert.equal(snapshot.events[0].interested,true)
 assert.equal((await f.request('alice','/servers/group/commands',{revision:0,action:{type:'event-delete',id:'event'}})).status,409)
 fail=false;assert.equal((await f.command('alice',{type:'event-delete',id:'event'})).status,200)
})

test('moving an event checks both locations and revoking creation removes creator administration without deleting data',async t=>{
 const f=await fixture(t);await grant(f,'bob',['CREATE_EVENTS']);await f.command('bob',create())
 await f.command('alice',{type:'role',command:{type:'overwrite',channel:'voice',targetId:'bob',targetType:'member',overwrite:{id:'bob',type:'member',allow:'0',deny:mask(['CREATE_EVENTS','MANAGE_EVENTS']).toString()}}})
 assert.equal((await f.command('bob',{type:'event-edit',id:'event',draft:draft({channelId:'voice',location:''})})).status,403)
 assert.equal((await f.request('bob','/servers/group')).data.events[0].channelId,null)
 await f.command('alice',{type:'role',command:{type:'edit',id:'bob-role',patch:{permissions:'0'}}})
 for(const action of [{type:'event-edit',id:'event',draft:draft()},{type:'event-status',id:'event',status:'cancelled'},{type:'event-delete',id:'event'}])assert.equal((await f.command('bob',action)).status,403)
 assert.equal((await f.request('bob','/servers/group')).data.events.length,1)
 assert.equal((await f.command('alice',{type:'event-edit',id:'event',draft:draft({channelId:'voice',location:''})})).status,200)
 assert.equal((await f.command('alice',{type:'event-status',id:'event',status:'active'})).status,200)
 const active=(await f.request('alice','/servers/group')).data.events[0]
 assert.equal((await f.command('alice',{type:'event-edit',id:'event',draft:draft({channelId:'voice',location:'',startsAt:active.startsAt+1})})).status,400)
})
