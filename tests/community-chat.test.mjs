import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createCommunityService,createCommunityState } from '../scripts/community/service.mjs'
import { initialPolicy,mask } from '../src/roles/permissions.ts'
import { normalizeReaction,MAX_PINS } from '../src/roles/chat.ts'
const keys={alice:'a'.repeat(40),bob:'b'.repeat(40),carol:'c'.repeat(40)}
function seed(){const state=createCommunityState(Object.keys(keys)),policy=initialPolicy('group',Object.keys(keys));policy.ownerIds=['alice'];policy.overwrites.private=[{id:'group',type:'role',allow:'0',deny:mask(['VIEW_CHANNEL']).toString()}];state.servers.group={id:'group',name:'Teste',revision:0,policy,channels:['text','private'].map(id=>({id,serverId:'group',name:id,type:'text'})),messages:{text:Array.from({length:105},(_,i)=>({id:'m'+i,channelId:'text',userId:'bob',userName:'Bob',content:'Mensagem '+i,timestamp:i+1,...(i===2?{once:true}:{})})),private:[{id:'secret',channelId:'private',userId:'alice',userName:'Alice',content:'Segredo',timestamp:1}]},audit:[]};return state}
async function fixture(t,options={}){
 const service=createCommunityService({tokens:Object.fromEntries(Object.entries(keys).map(([member,key])=>[key,member])),initialState:seed(),...options});service.server.listen(0,'127.0.0.1');await once(service.server,'listening');t.after(async()=>{service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve))});const base='http://127.0.0.1:'+service.server.address().port
 const request=async(actor,route,body)=>{const response=await fetch(base+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+(keys[actor]||actor),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()}}
 const command=async(actor,action)=>{const current=(await request(actor,'/servers/group')).data;return request(actor,'/servers/group/commands',{revision:current.revision,action})}
 const overwrite=(member,allow=[],deny=[])=>command('alice',{type:'role',command:{type:'overwrite',channel:'text',targetId:member,targetType:'member',overwrite:{id:member,type:'member',allow:mask(allow).toString(),deny:mask(deny).toString()}}})
 return {...service,base,request,command,overwrite}
}
const react=(emoji='👍',extra={})=>({type:'message-reaction',channel:'text',id:'m0',emoji,enabled:true,...extra})
const pin=(id='m0',enabled=true)=>({type:'message-pin',channel:'text',id,enabled})
const send=id=>({type:'message-send',channel:'text',id,content:'Nova mensagem'})

test('Unicode reactions normalize variation selectors, accept compound emoji and reject text or multiple emoji',()=>{
 assert.equal(normalizeReaction('❤️'),'❤');for(const emoji of ['👍','👍🏽','👨‍👩‍👧','🇧🇷','1️⃣'])assert.ok(normalizeReaction(emoji))
 for(const emoji of ['abc','https://example.com','👍👍','<img>','a\n','',{},'x'.repeat(41)])assert.throws(()=>normalizeReaction(emoji))
})

test('reactions are idempotent and authenticated; existing emoji need no ADD_REACTIONS but new ones do',async t=>{
 const f=await fixture(t)
 assert.equal((await f.command('bob',react())).status,200);await f.command('bob',react())
 await f.overwrite('carol',[],['ADD_REACTIONS'])
 assert.equal((await f.command('carol',react('👍',{actor:'alice'}))).status,200)
 assert.equal((await f.command('carol',react('🔥'))).status,403)
 assert.equal((await f.command('carol',react('abc'))).status,400)
 assert.equal((await f.command('carol',react('👍',{member:'alice'}))).status,403)
 const pins=await f.request('bob','/servers/group/history/text?before=m1');assert.deepEqual(pins.data.messages[0].reactions,[{emoji:'👍',members:['bob','carol']}])
 assert.equal((await f.command('carol',react('👍',{enabled:false,member:'bob'}))).status,403)
 assert.equal((await f.command('alice',react('👍',{enabled:false,member:'bob'}))).status,200)
 const audit=(await f.request('alice','/servers/group')).data.audit[0];assert.equal(audit.event,'message-reaction-remove');assert.equal(audit.member,'bob')
 assert.equal((await f.command('carol',{type:'message-reactions-clear',channel:'text',id:'m0'})).status,403)
 assert.equal((await f.command('alice',{type:'message-reactions-clear',channel:'text',id:'m0'})).status,200)
 assert.deepEqual((await f.request('bob','/servers/group/history/text?before=m1')).data.messages[0].reactions,[])
})

test('the distinct reaction limit does not prevent joining an existing emoji and removing an empty group frees a slot',async t=>{
 const initialState=seed(),reactions=Array.from({length:20},(_,i)=>({emoji:String.fromCodePoint(0x1f600+i),members:['bob']}));initialState.servers.group.messages.text[0].reactions=reactions
 const f=await fixture(t,{initialState})
 assert.equal((await f.command('bob',react('🔥'))).status,400)
 assert.equal((await f.command('carol',react(reactions[0].emoji))).status,200)
 assert.equal((await f.command('bob',react(reactions[1].emoji,{enabled:false}))).status,200)
 assert.equal((await f.command('bob',react('🔥'))).status,200)
})

test('timeouts, hidden channels, denied history and one-view messages cannot be bypassed with reaction or pin commands',async t=>{
 const f=await fixture(t);await f.command('bob',react());await f.command('alice',{type:'role',command:{type:'timeout',member:'carol',until:Date.now()+60000}})
 assert.equal((await f.command('carol',react())).status,403)
 assert.equal((await f.command('bob',react('👍',{channel:'private',id:'secret'}))).status,403)
 await f.overwrite('bob',['ADD_REACTIONS','PIN_MESSAGES'],['READ_MESSAGE_HISTORY'])
 assert.equal((await f.command('bob',react())).status,403);assert.equal((await f.command('bob',pin())).status,403);assert.equal((await f.request('bob','/servers/group/pins/text')).status,403)
 assert.equal((await f.command('alice',react('👍',{id:'m2'}))).status,400);assert.equal((await f.command('alice',pin('m2'))).status,400)
})

test('pins include older messages outside the live window, persist, obey PIN_MESSAGES and disappear after deletion',async t=>{
 let saved;const storage={load:()=>saved||null,save:state=>{saved=structuredClone(state)}},f=await fixture(t,{storage})
 assert.equal((await f.command('bob',pin())).status,403);await f.overwrite('bob',['PIN_MESSAGES'])
 const result=await f.command('bob',pin());assert.equal(result.status,200);assert.equal(result.data.messages.text.some(message=>message.id==='m0'),false)
 const first=await f.request('carol','/servers/group/pins/text');assert.equal(first.data.messages[0].id,'m0');assert.equal(first.data.messages[0].pinnedBy,'bob')
 const same=await f.command('alice',pin());assert.equal(same.status,200);assert.equal((await f.request('alice','/servers/group/pins/text')).data.messages[0].pinnedBy,'bob')
 const restarted=await fixture(t,{storage});assert.equal((await restarted.request('bob','/servers/group/pins/text')).data.messages[0].content,'Mensagem 0')
 assert.equal((await f.request('invalid','/servers/group/pins/text')).status,401);assert.equal((await f.request('bob','/servers/group/pins/private')).status,403)
 await f.command('bob',pin('m0',false));assert.equal((await f.request('carol','/servers/group/pins/text')).data.messages.length,0)
 await f.command('bob',pin());await f.command('bob',{type:'message-delete',channel:'text',id:'m0'});assert.equal((await f.request('carol','/servers/group/pins/text')).data.messages.length,0)
})

test('pin bounds and failed persistence publish neither a pin nor a reaction',async t=>{
 const initialState=seed();initialState.servers.group.messages.text=Array.from({length:MAX_PINS+1},(_,i)=>({id:'p'+i,channelId:'text',userId:'bob',userName:'Bob',content:'Pin',timestamp:1,...(i<MAX_PINS?{pinnedAt:i+1,pinnedBy:'alice'}:{})}))
 const full=await fixture(t,{initialState});assert.equal((await full.command('alice',pin('p'+MAX_PINS))).status,400);assert.equal((await full.request('bob','/servers/group/pins/text')).data.messages.length,MAX_PINS)
 const f=await fixture(t,{storage:{load:()=>null,save:()=>{throw Error('disk')}}})
 assert.equal((await f.command('alice',pin())).status,500);assert.equal((await f.command('bob',react())).status,500)
 assert.equal((await f.request('bob','/servers/group/pins/text')).data.messages.length,0);assert.equal((await f.request('bob','/servers/group/history/text?before=m1')).data.messages[0].reactions,undefined)
})

test('slow mode is persisted per actor/channel, survives deletion and restart, and only BYPASS_SLOWMODE bypasses it',async t=>{
 let saved;const storage={load:()=>saved||null,save:state=>{saved=structuredClone(state)}},f=await fixture(t,{storage})
 assert.equal((await f.command('bob',{type:'channel-slowmode',channel:'text',seconds:60})).status,403)
 for(const seconds of [-1,21601,1.5,'5'])assert.equal((await f.command('alice',{type:'channel-slowmode',channel:'text',seconds})).status,400)
 assert.equal((await f.command('alice',{type:'channel-slowmode',channel:'text',seconds:60})).status,200)
 const first=await f.command('bob',send('one'));assert.equal(first.status,200);assert.ok(first.data.sendAfter.text>Date.now());assert.equal((await f.request('carol','/servers/group')).data.sendAfter.text,0)
 assert.equal((await f.command('bob',send('two'))).status,429)
 await f.command('bob',{type:'message-delete',channel:'text',id:'one'});assert.equal((await f.command('bob',send('three'))).status,429)
 const restarted=await fixture(t,{storage});assert.equal((await restarted.command('bob',send('after-restart'))).status,429)
 await f.overwrite('bob',['MANAGE_MESSAGES','MANAGE_CHANNELS']);assert.equal((await f.command('bob',send('manager-not-exempt'))).status,429)
 await f.overwrite('bob',['BYPASS_SLOWMODE']);assert.equal((await f.command('bob',send('bypass-one'))).status,200);assert.equal((await f.command('bob',send('bypass-two'))).status,200)
 await f.command('alice',{type:'channel-slowmode',channel:'text',seconds:0});await f.overwrite('bob');assert.equal((await f.command('bob',send('disabled'))).status,200)
})

test('concurrent sends cannot consume the same slowmode slot; failed saves do not consume the next slot',async t=>{
 let fail=false;const f=await fixture(t,{storage:{load:()=>null,save:()=>{if(fail)throw Error('disk')}}})
 await f.command('alice',{type:'channel-slowmode',channel:'text',seconds:60})
 fail=true;assert.equal((await f.command('bob',send('failed'))).status,500);fail=false
 const revision=(await f.request('bob','/servers/group')).data.revision
 const results=await Promise.all(['first','second'].map(id=>f.request('bob','/servers/group/commands',{revision,action:send(id)})))
 assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);assert.equal((await f.command('bob',send('third'))).status,429)
})

test('SSE sends no old content or metadata to a member without history, but continues updating messages received live',async t=>{
 const f=await fixture(t);await f.overwrite('carol',[],['READ_MESSAGE_HISTORY'])
 const controller=new AbortController();t.after(()=>controller.abort())
 const stream=await fetch(f.base+'/servers/group/events',{headers:{Authorization:'Bearer '+keys.carol},signal:controller.signal}),reader=stream.body.getReader(),decode=chunk=>JSON.parse(new TextDecoder().decode(chunk.value).split('\n').find(line=>line.startsWith('data: ')).slice(6))
 await reader.read();await f.command('bob',{type:'message-edit',channel:'text',id:'m0',content:'Não pode vazar'});assert.equal(decode(await reader.read()).messageChanges,undefined)
 await f.command('alice',pin());assert.equal(decode(await reader.read()).messageChanges,undefined)
 await f.command('alice',send('live'));assert.equal(decode(await reader.read()).liveMessages[0].id,'live')
 await f.command('alice',pin('live'));assert.ok(decode(await reader.read()).messageChanges[0].pinnedAt)
 await f.overwrite('carol');await reader.read();await f.overwrite('carol',[],['READ_MESSAGE_HISTORY']);await reader.read()
 await f.command('alice',{type:'message-edit',channel:'text',id:'live',content:'Não pode voltar após perder histórico'});assert.equal(decode(await reader.read()).messageChanges,undefined)
 controller.abort()
})
