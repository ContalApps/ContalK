import {test} from 'node:test'
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {initialPolicy,mask} from '../src/roles/permissions.ts'
import {buildCommunityInsights} from '../src/roles/insights.ts'
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
async function grant(f){await f.command('alice',{type:'role',command:{type:'create',id:'analyst',name:'Estatísticas'}});await f.command('alice',{type:'role',command:{type:'edit',id:'analyst',patch:{permissions:mask(['VIEW_GUILD_INSIGHTS']).toString()}}});await f.command('alice',{type:'role',command:{type:'assign',id:'analyst',member:'bob'}})}
test('insights require the dedicated permission and validate period/time zone without mutating revisions',async t=>{
 const f=await fixture(t);assert.equal((await f.request('bob','/servers/group/insights')).status,403);await grant(f)
 const before=(await f.request('bob','/servers/group')).data.revision,result=await f.request('bob','/servers/group/insights?days=7&timeZone=America%2FSao_Paulo')
 assert.equal(result.status,200);assert.equal(result.data.timeZone,'America/Sao_Paulo');assert.equal(result.data.daily.length,7);assert.equal(result.data.revision,before);assert.equal((await f.request('bob','/servers/group')).data.revision,before)
 for(const query of ['days=1','days=NaN','days=7&timeZone=invalid-zone'])assert.equal((await f.request('bob','/servers/group/insights?'+query)).status,400)
})
test('insights exclude hidden and unreadable channels, private threads, contents and identities from aggregates',async t=>{
 const initial=seed(),server=initial.servers.group,now=Date.now();server.messages.text=[{id:'public',channelId:'text',userId:'alice',content:'Public text must not be returned',timestamp:now-1,reactions:[{emoji:'👍',members:['alice','bob']}],pinnedAt:now,poll:{question:'Secret question',answers:[]}}]
 server.channels.push({id:'private',name:'Private name',type:'text',serverId:'group'});server.messages.private=[{id:'hidden',content:'Hidden content',userId:'carol',timestamp:now-1}];server.policy.overwrites.private=[{id:'bob',type:'member',allow:'0',deny:mask(['VIEW_CHANNEL']).toString()}]
 const f=await fixture(t,{initialState:initial});await grant(f);const result=(await f.request('bob','/servers/group/insights')).data
 assert.equal(result.messages,1);assert.equal(result.authors,1);assert.equal(result.reactions,2);assert.equal(result.polls,1);assert.equal(result.pins,1)
 for(const hidden of ['Private name','Hidden content','Secret question','Public text must not be returned'])assert.equal(JSON.stringify(result).includes(hidden),false)
 await f.rules('bob',[],['READ_MESSAGE_HISTORY']);const revoked=(await f.request('bob','/servers/group/insights')).data;assert.equal(revoked.messages,null);assert.equal(revoked.authors,null);assert.deepEqual(revoked.daily,[]);assert.deepEqual(revoked.channels,[])
})
test('local calendar dates handle time zones and repeated DST hours without duplicate day bins',()=>{
 const server=seed().servers.group;server.messages.text=[{id:'date',userId:'bob',channelId:'text',content:'',timestamp:Date.UTC(2026,9,25,0,30)}]
 const now=Date.UTC(2026,9,25,1),br=buildCommunityInsights(server,'alice',7,'America/Sao_Paulo',now),utc=buildCommunityInsights(server,'alice',7,'UTC',now)
 assert.equal(br.daily.at(-1).day,'2026-10-24');assert.equal(br.daily.at(-1).messages,1);assert.equal(utc.daily.at(-1).day,'2026-10-25')
 server.messages.text=[5,6].map((hour,index)=>({id:String(index),userId:'bob',channelId:'text',content:'',timestamp:Date.UTC(2026,10,1,hour,30)}))
 const dst=buildCommunityInsights(server,'alice',30,'America/New_York',Date.UTC(2026,10,1,12));assert.equal(dst.daily.length,30);assert.equal(new Set(dst.daily.map(item=>item.day)).size,30);assert.equal(dst.daily.at(-1).messages,2)
})
test('counts use currently stored messages and known invitations rather than inventing profile or account dates',()=>{
 const server=seed().servers.group,now=Date.now();server.messages.text=[{id:'old',userId:'alice',timestamp:now-60*86400000,channelId:'text',content:''},{id:'future',userId:'bob',timestamp:now+60000,channelId:'text',content:''},{id:'today',userId:'bob',timestamp:now-1,channelId:'text',content:''}];server.memberAdmissions={bob:{joinedAt:now-1},carol:{joinedAt:now-100*86400000}}
 const result=buildCommunityInsights(server,'alice',7,'UTC',now);assert.equal(result.messages,1);assert.equal(result.recordedInvitedMembers,1);assert.equal(result.unknownAdmissionMembers,2);assert.equal(JSON.stringify(result).includes('joinedAt'),false)
})
test('permission revocation and membership removal reject new insight queries; HQ co-ownership remains unchanged',async t=>{
 const f=await fixture(t);await grant(f);assert.equal((await f.request('bob','/servers/group/insights')).status,200)
 await f.command('alice',{type:'role',command:{type:'edit',id:'analyst',patch:{permissions:'0'}}});assert.equal((await f.request('bob','/servers/group/insights')).status,403)
 await f.command('alice',{type:'member-kick',member:'bob'});assert.equal((await f.request('bob','/servers/group/insights')).status,403)
 assert.equal((await f.request('carol','/servers/srv-1/insights')).status,200);assert.equal((await f.request('carol','/servers/srv-1')).data.policy.ownership,'all-members')
})
