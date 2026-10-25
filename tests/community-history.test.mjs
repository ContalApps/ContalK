import assert from 'node:assert/strict'
import { test } from 'node:test'
import { once } from 'node:events'
import { createCommunityService, createCommunityState } from '../scripts/community/service.mjs'
import { initialPolicy, mask } from '../src/roles/permissions.ts'
import { loadTypescript } from './load-typescript.mjs'

const api=loadTypescript('src/roles/permissions.ts'),{mergeHistory}=loadTypescript('src/roles/history.ts',{'./permissions':api})
const message=id=>({id:'message-'+id,content:'Mensagem '+id,timestamp:id})
const snapshot=list=>({id:'server',messages:{text:list},channelPermissions:{text:api.Permission.READ_MESSAGE_HISTORY.toString()}})
test('paging preserves rows leaving the live window, applies edits/deletes, and removes cached history after access loss',()=>{
 const before=snapshot([message(2),message(3),message(4)]),next=snapshot([message(3),message(4),message(5)])
 next.messageChanges=[{id:'message-0',channelId:'text',content:'Editada',deleted:false,roleMentions:[],mentionsEveryone:null},{id:'message-1',channelId:'text',deleted:true}]
 const result=mergeHistory(before,next,{text:[{...message(0),roleMentions:['team'],mentionsEveryone:'all'},message(1)]})
 assert.deepEqual(Array.from(result.text,item=>item.id),['message-0','message-2']);assert.equal(result.text[0].content,'Editada')
 assert.equal(result.text[0].roleMentions.length,0);assert.equal(result.text[0].mentionsEveryone,undefined)
 next.messageChanges.push({id:'message-2',channelId:'text',deleted:true})
 assert.deepEqual(Array.from(mergeHistory(before,next,{text:[message(0)]}).text,item=>item.id),['message-0'])
 assert.equal(Object.keys(mergeHistory(next,{...next,messages:{}},result)).length,0)
 assert.equal(Object.keys(mergeHistory(next,{...next,channelPermissions:{text:'0'}},result)).length,0)
})

test('reaction and pin deltas update cached older rows without erasing text, edit time or mention metadata',()=>{
 const before=snapshot([message(3)]),next=snapshot([message(3)]),old={...message(0),editedAt:123,roleMentions:['team'],mentionsEveryone:'all',pinnedAt:22,pinnedBy:'alice'}
 next.messageChanges=[{id:'message-0',channelId:'text',deleted:false,reactions:[{emoji:'👍',members:['bob']}],pinnedAt:null,pinnedBy:null}]
 const result=mergeHistory(before,next,{text:[old]}).text[0]
 assert.equal(result.content,old.content);assert.equal(result.editedAt,123);assert.equal(result.roleMentions[0],'team');assert.equal(result.mentionsEveryone,'all');assert.equal(result.reactions[0].members[0],'bob');assert.equal(result.pinnedAt,undefined);assert.equal(result.pinnedBy,undefined)
 assert.equal(old.pinnedAt,22);assert.equal(old.reactions,undefined)
})

test('poll ballot deltas reach cached older messages while preserving their author, question and pin',()=>{
 const before=snapshot([message(3)]),next=snapshot([message(3)]),old={...message(0),userId:'alice',pinnedAt:22,poll:{question:'Pergunta',answers:[{id:'a',text:'A',voters:[]},{id:'b',text:'B',voters:[]}],multiple:false,expiresAt:Date.now()+3600000}}
 next.messageChanges=[{id:'message-0',channelId:'text',deleted:false,poll:{...old.poll,answers:[{id:'a',text:'A',voters:['bob']},{id:'b',text:'B',voters:[]}]}}]
 const result=mergeHistory(before,next,{text:[old]}).text[0];assert.equal(result.poll.answers[0].voters[0],'bob');assert.equal(result.userId,'alice');assert.equal(result.content,old.content);assert.equal(result.pinnedAt,22);assert.equal(old.poll.answers[0].voters.length,0)
})
test('the central history retains older messages and returns bounded pages only to authorized members',async t=>{
 const state=createCommunityState(['alice','bob']),policy=initialPolicy('group',['alice','bob']);policy.ownerIds=['alice']
 state.servers.group={id:'group',name:'Grupo',revision:0,policy,channels:[{id:'text',name:'Texto',type:'text',serverId:'group'}],messages:{text:Array.from({length:350},(_,index)=>({...message(index),channelId:'text',userId:'alice',userName:'Alice'}))},audit:[]}
 let saved
 const keyA='a'.repeat(40),keyB='b'.repeat(40),service=createCommunityService({tokens:{[keyA]:'alice',[keyB]:'bob'},initialState:state,storage:{load:()=>null,save:value=>{saved=value}}})
 service.server.listen(0,'127.0.0.1');await once(service.server,'listening');t.after(async()=>{service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve))})
 const endpoint='http://127.0.0.1:'+service.server.address().port
 const get=async(route,key=keyB)=>{const response=await fetch(endpoint+route,{headers:{Authorization:'Bearer '+key}});return {status:response.status,data:await response.json()}}
 const initial=await get('/servers/group');assert.equal(initial.data.messages.text.length,100);assert.equal(initial.data.hasOlder.text,true)
 const page=await get('/servers/group/history/text?before=message-250');assert.equal(page.data.messages[0].id,'message-150');assert.equal(page.data.messages.length,100);assert.equal(page.data.hasMore,true)
 const first=await get('/servers/group/history/text?before=message-50');assert.equal(first.data.messages[0].id,'message-0');assert.equal(first.data.messages.length,50);assert.equal(first.data.hasMore,false)
 await service.commit('alice','group',0,{type:'message-send',channel:'text',id:'new',content:'Nova'})
 assert.equal(saved.servers.group.messages.text.length,351);assert.equal(saved.servers.group.messages.text[0].id,'message-0')
 await service.commit('alice','group',1,{type:'role',command:{type:'overwrite',channel:'text',targetId:'bob',targetType:'member',overwrite:{id:'bob',type:'member',allow:'0',deny:mask(['READ_MESSAGE_HISTORY']).toString()}}})
 assert.equal((await get('/servers/group/history/text')).status,403)
 assert.equal((await get('/servers/group')).data.messages.text,undefined)
})
