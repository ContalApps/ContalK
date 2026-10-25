import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { initialPolicy,mask } from '../src/roles/permissions.ts'
import { normalizePoll,pollOpen,pollVoters } from '../src/roles/polls.ts'
import { createCommunityState,createCommunityService } from '../scripts/community/service.mjs'
const keys={alice:'a'.repeat(40),bob:'b'.repeat(40),carol:'c'.repeat(40)}
const draft={question:'Qual jogo?',answers:[{text:'Xadrez',emoji:'♟️'},{text:'Corrida'}],multiple:false,durationHours:24}
const create=(id='poll',patch={})=>({type:'message-send',channel:'text',id,content:'',poll:{...draft,...patch}})
function seed(){const state=createCommunityState(Object.keys(keys)),policy=initialPolicy('group',Object.keys(keys));policy.ownerIds=['alice'];policy.overwrites.private=[{id:'group',type:'role',allow:'0',deny:mask(['VIEW_CHANNEL']).toString()}];state.servers.group={id:'group',name:'Teste',revision:0,policy,channels:['text','private'].map(id=>({id,serverId:'group',name:id,type:'text'})),messages:{},audit:[]};return state}
async function fixture(t,options={}){
 const service=createCommunityService({tokens:Object.fromEntries(Object.entries(keys).map(([member,key])=>[key,member])),initialState:seed(),...options});service.server.listen(0,'127.0.0.1');await once(service.server,'listening');t.after(async()=>{service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve))});const base='http://127.0.0.1:'+service.server.address().port
 const request=async(actor,route,body)=>{const response=await fetch(base+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+keys[actor],'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()}}
 const command=async(actor,action)=>{const current=(await request(actor,'/servers/group')).data;return request(actor,'/servers/group/commands',{revision:current.revision,action})}
 const rules=(member,allow=[],deny=[])=>command('alice',{type:'role',command:{type:'overwrite',channel:'text',targetId:member,targetType:'member',overwrite:{id:member,type:'member',allow:mask(allow).toString(),deny:mask(deny).toString()}}})
 const poll=async()=>{const snapshot=(await request('alice','/servers/group')).data;return snapshot.messages.text.find(message=>message.id==='poll').poll}
 const stream=async actor=>{const controller=new AbortController();t.after(()=>controller.abort());const response=await fetch(base+'/servers/group/events',{headers:{Authorization:'Bearer '+keys[actor]},signal:controller.signal}),reader=response.body.getReader();const read=async()=>JSON.parse(new TextDecoder().decode((await reader.read()).value).split('\n').find(line=>line.startsWith('data: ')).slice(6));await read();return {controller,read,reader}}
 return {...service,base,request,command,rules,poll,stream}
}

test('poll drafts validate question, distinct bounded answers, Unicode emoji, duration and booleans without accepting forged votes',()=>{
 const normalized=normalizePoll({...draft,answers:[{text:'  Xadrez  ',emoji:'♟️',voters:['forged']},{text:'Corrida'}]});assert.equal(normalized.answers[0].text,'Xadrez');assert.equal(normalized.answers[0].voters,undefined)
 for(const patch of [{question:''},{question:'x'.repeat(301)},{answers:[{text:'Só uma'}]},{answers:Array(11).fill({text:'A'})},{answers:[{text:'A'},{text:'a'}]},{answers:[{text:'x'.repeat(56)},{text:'B'}]},{answers:[{text:'A',emoji:'url'},{text:'B'}]},{durationHours:0},{durationHours:769},{durationHours:1.2},{multiple:'true'}])assert.throws(()=>normalizePoll({...draft,...patch}))
})

test('creation requires SEND_POLLS and SEND_MESSAGES, uses server IDs and expiry, consumes slowmode and creates an immutable message',async t=>{
 const f=await fixture(t)
 assert.equal((await f.command('bob',create())).status,403);await f.rules('bob',['SEND_POLLS'],['SEND_MESSAGES']);assert.equal((await f.command('bob',create())).status,403)
 await f.rules('bob',['SEND_POLLS']);await f.command('alice',{type:'channel-slowmode',channel:'text',seconds:60})
 const first=await f.command('bob',{...create(),poll:{...draft,expiresAt:1,closedAt:1,answers:[{id:'forged',text:'Xadrez',voters:['alice']},{text:'Corrida'}]}})
 assert.equal(first.status,200);const message=first.data.messages.text[0];assert.equal(message.content,draft.question);assert.equal(message.userId,'bob');assert.ok(message.poll.expiresAt>Date.now());assert.equal(message.poll.closedAt,undefined);assert.notEqual(message.poll.answers[0].id,'forged');assert.deepEqual(message.poll.answers[0].voters,[])
 assert.equal((await f.command('bob',create('next'))).status,429);assert.equal((await f.command('bob',{type:'message-edit',channel:'text',id:'poll',content:'Outra pergunta'})).status,400)
 for(const extra of [{once:true},{attachment:{storageId:'forged'}},{content:'Texto diferente'}])assert.equal((await f.command('alice',{...create('invalid'),...extra})).status,400)
})

test('the full answer and duration bounds work, and pinning a poll preserves its question and live results',async t=>{
 const f=await fixture(t),created=await f.command('alice',create('poll',{answers:Array.from({length:10},(_,index)=>({text:'Opção '+index})),durationHours:768}))
 assert.equal(created.status,200);const message=created.data.messages.text[0];assert.equal(message.poll.answers.length,10);assert.ok(message.poll.expiresAt-message.timestamp>=768*3600000-1000)
 await f.command('bob',{type:'poll-vote',channel:'text',id:'poll',answers:[message.poll.answers[9].id]});await f.command('alice',{type:'message-pin',channel:'text',id:'poll',enabled:true})
 const pinned=(await f.request('carol','/servers/group/pins/text')).data.messages[0];assert.equal(pinned.poll.question,draft.question);assert.deepEqual(pinned.poll.answers[9].voters,['bob'])
})

test('single-choice votes replace only the authenticated actor, support withdrawal and need no sending or creating permission',async t=>{
 const f=await fixture(t);await f.command('alice',create());const poll=await f.poll(),[a,b]=poll.answers
 await f.rules('bob',[],['SEND_MESSAGES','SEND_POLLS'])
 const vote=answers=>f.command('bob',{type:'poll-vote',channel:'text',id:'poll',answers,actor:'alice',member:'alice'})
 assert.equal((await vote([a.id])).status,200);await vote([a.id]);assert.deepEqual((await f.poll()).answers[0].voters,['bob'])
 assert.equal((await vote([a.id,b.id])).status,400);assert.equal((await vote(['unknown'])).status,400)
 assert.equal((await vote([b.id])).status,200);assert.deepEqual((await f.poll()).answers[0].voters,[]);assert.deepEqual((await f.poll()).answers[1].voters,['bob'])
 assert.equal((await vote([])).status,200);assert.deepEqual(pollVoters(await f.poll()),[])
})

test('multiselect tallies distinct voters and concurrent commands cannot overwrite another account’s ballot',async t=>{
 const f=await fixture(t);await f.command('alice',create('poll',{multiple:true}));const [a,b]=(await f.poll()).answers
 await f.command('bob',{type:'poll-vote',channel:'text',id:'poll',answers:[a.id,b.id]})
 const revision=(await f.request('alice','/servers/group')).data.revision,actions=[{type:'poll-vote',channel:'text',id:'poll',answers:[a.id]},{type:'poll-vote',channel:'text',id:'poll',answers:[b.id]}]
 const results=await Promise.all(actions.map(action=>f.request('carol','/servers/group/commands',{revision,action})));assert.deepEqual(results.map(result=>result.status).sort(),[200,409])
 assert.equal(pollVoters(await f.poll()).length,2);assert.ok((await f.poll()).answers.every(answer=>answer.voters.includes('bob')))
 assert.equal((await f.command('bob',{type:'poll-vote',channel:'text',id:'poll',answers:[a.id,a.id]})).status,400)
})

test('hidden channels, timeout, lost membership and missed historical polls deny participation without leaking their contents',async t=>{
 const f=await fixture(t);await f.command('alice',create());const [answer]=(await f.poll()).answers
 await f.command('alice',{type:'role',command:{type:'timeout',member:'bob',until:Date.now()+60000}});assert.equal((await f.command('bob',{type:'poll-vote',channel:'text',id:'poll',answers:[answer.id]})).status,403)
 await f.rules('carol',[],['VIEW_CHANNEL']);assert.equal((await f.command('carol',{type:'poll-vote',channel:'text',id:'poll',answers:[answer.id]})).status,403)
 await f.rules('carol',[],['READ_MESSAGE_HISTORY']);const stream=await f.stream('carol');assert.equal((await f.command('carol',{type:'poll-vote',channel:'text',id:'poll',answers:[answer.id]})).status,403)
 await f.command('alice',{type:'member-kick',member:'carol'});await stream.reader.read();assert.equal((await f.request('carol','/servers/group')).status,403)
})

test('a viewer without history can vote on a poll received live, but that authorization ends when the SSE closes',async t=>{
 const f=await fixture(t);await f.rules('bob',[],['READ_MESSAGE_HISTORY','SEND_MESSAGES','SEND_POLLS']);const stream=await f.stream('bob')
 await f.command('alice',create());const incoming=await stream.read();const answer=incoming.liveMessages[0].poll.answers[0]
 assert.equal((await f.command('bob',{type:'poll-vote',channel:'text',id:'poll',answers:[answer.id]})).status,200)
 const update=await stream.read();assert.deepEqual(update.messageChanges[0].poll.answers[0].voters,['bob']);stream.controller.abort();await new Promise(resolve=>setTimeout(resolve,30))
 assert.equal((await f.command('bob',{type:'poll-vote',channel:'text',id:'poll',answers:[]})).status,403)
})

test('only the creator can end a poll, final votes survive restart and deleted polls cannot be revived',async t=>{
 let saved;const storage={load:()=>saved||null,save:state=>{saved=structuredClone(state)}},f=await fixture(t,{storage});await f.rules('bob',['SEND_POLLS']);await f.command('bob',create());const [answer]=(await f.poll()).answers
 await f.command('carol',{type:'poll-vote',channel:'text',id:'poll',answers:[answer.id]});assert.equal((await f.command('alice',{type:'poll-close',channel:'text',id:'poll'})).status,403)
 assert.equal((await f.command('bob',{type:'poll-close',channel:'text',id:'poll'})).status,200);assert.equal(pollOpen(await f.poll()),false);assert.equal((await f.poll()).closedBy,'bob')
 assert.equal((await f.command('carol',{type:'poll-vote',channel:'text',id:'poll',answers:[]})).status,409)
 const restarted=await fixture(t,{storage});assert.deepEqual((await restarted.poll()).answers[0].voters,['carol']);assert.equal(pollOpen(await restarted.poll()),false)
 await f.command('alice',{type:'message-delete',channel:'text',id:'poll'});assert.equal((await f.command('bob',create())).status,400);assert.equal((await f.command('carol',{type:'poll-vote',channel:'text',id:'poll',answers:[answer.id]})).status,404)
})

test('natural expiry wakes connected viewers and rejects subsequent votes, including after service restart',async t=>{
 const initialState=seed(),expiresAt=Date.now()+1000;initialState.servers.group.messages.text=[{id:'poll',userId:'alice',userName:'Alice',channelId:'text',content:'Expira',timestamp:1,poll:{question:'Expira',answers:[{id:'a',text:'A',voters:['bob']},{id:'b',text:'B',voters:[]}],multiple:false,expiresAt}}]
 const f=await fixture(t,{initialState}),stream=await f.stream('bob'),woke=await stream.read();assert.ok(woke.serverNow>=expiresAt)
 assert.equal((await f.command('bob',{type:'poll-vote',channel:'text',id:'poll',answers:['b']})).status,409)
 const restarted=await fixture(t,{initialState});assert.equal(pollOpen(await restarted.poll()),false);assert.deepEqual((await restarted.poll()).answers[0].voters,['bob']);stream.controller.abort()
})

test('a failed save publishes neither a new poll nor a vote/closure and preserves the previous revision',async t=>{
 let fail=true;const f=await fixture(t,{storage:{load:()=>null,save:()=>{if(fail)throw Error('disk')}}})
 assert.equal((await f.command('alice',create())).status,500);assert.equal((await f.request('alice','/servers/group')).data.revision,0)
 fail=false;await f.command('alice',create());const [answer]=(await f.poll()).answers;fail=true
 assert.equal((await f.command('bob',{type:'poll-vote',channel:'text',id:'poll',answers:[answer.id]})).status,500);assert.deepEqual((await f.poll()).answers[0].voters,[])
 assert.equal((await f.command('alice',{type:'poll-close',channel:'text',id:'poll'})).status,500);assert.equal(pollOpen(await f.poll()),true)
})
