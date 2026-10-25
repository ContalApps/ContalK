import {test} from 'node:test'
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {initialPolicy,mask} from '../src/roles/permissions.ts'
import {createCommunityService,createCommunityState} from '../scripts/community/service.mjs'
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
const send=(id='speech',extra={})=>({type:'message-send',id,channel:'text',content:'Mensagem com leitura',tts:true,...extra})
test('TTS publication requires its own permission, SEND and VIEW; persisted metadata cannot forge authorship',async t=>{
 const f=await fixture(t);assert.equal((await f.command('bob',send())).status,403);await f.rules('bob',['SEND_TTS_MESSAGES'])
 assert.equal((await f.command('bob',send('invalid',{tts:'true'}))).status,400)
 const sent=await f.command('bob',send('speech',{userId:'alice',userName:'Alice'}));assert.equal(sent.status,200);const message=sent.data.messages.text.at(-1);assert.equal(message.tts,true);assert.equal(message.userId,'bob');assert.equal(message.userName,'bob')
 await f.rules('bob',['SEND_TTS_MESSAGES'],['SEND_MESSAGES']);assert.equal((await f.command('bob',send('denied-send'))).status,403)
 await f.rules('bob',['SEND_TTS_MESSAGES'],['VIEW_CHANNEL']);assert.equal((await f.command('bob',send('denied-view'))).status,403)
})
test('TTS does not combine with once messages, files or polls and still obeys slowmode and timeout',async t=>{
 const f=await fixture(t);await f.rules('bob',['SEND_TTS_MESSAGES','SEND_POLLS'])
 for(const extra of [{once:true},{attachment:{storageId:'x'}},{poll:{question:'P?',answers:[{text:'A'},{text:'B'}],multiple:false,durationHours:1}}])assert.equal((await f.command('bob',send('mixed',extra))).status,400)
 await f.command('alice',{type:'channel-slowmode',channel:'text',seconds:10});assert.equal((await f.command('bob',send())).status,200);assert.equal((await f.command('bob',send('too-fast'))).status,429)
 await f.command('alice',{type:'role',command:{type:'timeout',member:'bob',until:Date.now()+60000}});assert.equal((await f.command('bob',send('timed-out'))).status,403)
})
test('single-message lookup returns current text, blocks once content and stops serving deleted or hidden messages',async t=>{
 const f=await fixture(t);await f.command('alice',send())
 const get=actor=>f.request(actor,'/servers/group/messages/text/speech');assert.equal((await get('bob')).data.tts,true)
 await f.command('alice',{type:'message-edit',channel:'text',id:'speech',content:'Texto novo'});assert.equal((await get('bob')).data.content,'Texto novo');assert.equal((await f.request('alice','/servers/group/messages/text/once')).status,404)
 await f.rules('bob',[],['VIEW_CHANNEL']);assert.equal((await get('bob')).status,403)
 await f.command('alice',{type:'message-delete',channel:'text',id:'speech'});assert.equal((await get('alice')).status,404)
})
test('a live-only recipient can request only actually delivered messages while an authorized SSE session exists',async t=>{
 const f=await fixture(t);await f.rules('bob',[],['READ_MESSAGE_HISTORY']);const live=await f.stream('bob')
 assert.equal((await f.request('bob','/servers/group/messages/text/source')).status,403)
 await f.command('alice',send());const event=await live.read();assert.equal(event.liveMessages[0].tts,true);assert.equal((await f.request('bob','/servers/group/messages/text/speech')).status,200)
 live.controller.abort();await new Promise(resolve=>setTimeout(resolve,40));assert.equal((await f.request('bob','/servers/group/messages/text/speech')).status,403)
})
