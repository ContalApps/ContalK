import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { WebSocket } from 'ws'
import { initialPolicy, everyoneRole, mask } from '../src/roles/permissions.ts'
import { canSetNickname, memberDisplayName, normalizeNickname } from '../src/roles/nicknames.ts'
import { createCommunityState, createCommunityService } from '../scripts/community/service.mjs'
import { createCommunityVoice } from '../scripts/community/realtime.mjs'

const keys={alice:'a'.repeat(40),bob:'b'.repeat(40),carol:'c'.repeat(40)}
function seed(){
 const state=createCommunityState(Object.keys(keys));for(const id of ['group','other']){const policy=initialPolicy(id,Object.keys(keys));policy.ownerIds=['alice'];state.servers[id]={id,name:id,revision:0,policy,channels:[{id:id+'-voice',serverId:id,name:'Voz',type:'voice'},{id:id+'-text',serverId:id,name:'Texto',type:'text'}],messages:{},audit:[]}}
 return state
}
async function fixture(t,options={}){
 const voice=createCommunityVoice({url:'ws://127.0.0.1/realtime'}),service=createCommunityService({initialState:seed(),tokens:Object.fromEntries(Object.entries(keys).map(([member,key])=>[key,member])),...options,voice})
 service.server.listen(0,'127.0.0.1');await once(service.server,'listening');const base='http://127.0.0.1:'+service.server.address().port,sockets=[]
 t.after(async()=>{voice.close();for(const socket of sockets)socket.terminate();service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve))})
 const request=async(actor,route,body)=>{const response=await fetch(base+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+keys[actor],'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()}}
 const command=async(actor,action,id='group')=>{const current=await request(actor,'/servers/'+id);return request(actor,'/servers/'+id+'/commands',{revision:current.data.revision,action})}
 const connect=async(actor,room='group-voice',presence=false)=>{const ticket=presence?await voice.presenceToken(actor,'Nome local'):await voice.token(service.snapshot(actor,'group'),actor,room);const socket=new WebSocket(base.replace('http:','ws:')+'/realtime');sockets.push(socket);await once(socket,'open');const accepted=once(socket,'message');socket.send(JSON.stringify({id:1,method:'auth',token:ticket.token}));const profile=JSON.parse((await accepted)[0]).data.self;return {socket,profile}}
 return {...service,request,command,connect}
}
const nickname=(member,value)=>({type:'member-nickname',member,nickname:value})

test('nickname validation supports normalized Unicode and emojis, rejects controls and remains scoped to the server',()=>{
 assert.equal(normalizeNickname(' Cafe\u0301 '),'Café');assert.equal(normalizeNickname('👩‍💻'),'👩‍💻');assert.equal(normalizeNickname('😀'.repeat(32)),'😀'.repeat(32));assert.equal(normalizeNickname(' '),null)
 for(const value of ['x'.repeat(33),'A\nB','a\u202Eb',{},['name'],undefined])assert.throws(()=>normalizeNickname(value))
 const snapshot={id:'group',policy:{members:['bob']},nicknames:{bob:'Apelido'}}
 assert.equal(memberDisplayName(snapshot,'group','bob','Nome local'),'Apelido')
 for(const [server,member]of [[undefined,'bob'],['other','bob'],['group','outsider']])assert.equal(memberDisplayName(snapshot,server,member,'Nome local'),'Nome local')
})

test('own nickname and managing other members require independent permissions and respect hierarchy and co-owners',()=>{
 const policy=initialPolicy('group',Object.keys(keys));policy.ownerIds=['alice']
 policy.roles.push({...everyoneRole('moderator'),position:1,permissions:mask(['MANAGE_NICKNAMES']).toString()});policy.memberRoles.bob=['moderator'];policy.memberRoles.carol=['moderator']
 assert.equal(canSetNickname(policy,'bob','bob'),true);assert.equal(canSetNickname(policy,'bob','carol'),false);assert.equal(canSetNickname(policy,'bob','alice'),false);assert.equal(canSetNickname(policy,'alice','bob'),true)
 policy.roles[0].permissions=mask(['VIEW_CHANNEL']).toString();assert.equal(canSetNickname(policy,'bob','bob'),false)
 policy.memberRoles.carol=[];assert.equal(canSetNickname(policy,'bob','carol'),true)
 const hq=initialPolicy('srv-1',['alice','bob']);assert.equal(canSetNickname(hq,'bob','alice'),false);assert.equal(canSetNickname(hq,'bob','bob'),true)
})

test('HTTP commands authenticate the real actor, validate names, protect hierarchy and persist across restart without changing identity',async t=>{
 let saved;const storage={load:()=>saved||null,save:state=>{saved=structuredClone(state)}},f=await fixture(t,{storage})
 assert.equal((await f.command('bob',nickname('alice','Impostor'))).status,403)
 assert.equal((await f.command('alice',nickname('bob','x'.repeat(33)))).status,400)
 assert.equal((await f.command('alice',nickname('__proto__','X'))).status,400)
 const result=await f.command('bob',{...nickname('bob','  Café  '),actor:'alice'});assert.equal(result.status,200);assert.equal(result.data.nicknames.bob,'Café');const audit=(await f.request('alice','/servers/group')).data.audit[0];assert.equal(audit.actor,'bob');assert.equal(audit.member,'bob');assert.equal(audit.event,'member-nickname');assert.equal(result.data.audit.length,0)
 const restarted=await fixture(t,{storage});assert.equal((await restarted.request('carol','/servers/group')).data.nicknames.bob,'Café');assert.deepEqual((await restarted.request('bob','/servers/other')).data.nicknames,{})
 assert.equal((await f.request('bob','/identity')).data.username,'bob')
 const sent=await f.command('bob',{type:'message-send',channel:'group-text',id:'new-message',content:'Olá'});assert.equal(sent.data.messages['group-text'][0].userId,'bob');assert.equal(sent.data.messages['group-text'][0].userName,'bob')
 assert.equal((await f.command('bob',nickname('bob',null))).data.nicknames.bob,undefined)
 assert.equal((await f.command('bob',nickname('alice','Outro'),'srv-1')).status,403)
})

test('failed persistence and stale revisions preserve the nickname; removal clears it and readmission never restores it',async t=>{
 let fail=false;const f=await fixture(t,{storage:{load:()=>null,save:()=>{if(fail)throw Error('disk')}}})
 await f.command('bob',nickname('bob','Original'));const previous=(await f.request('alice','/servers/group')).data
 await f.command('alice',nickname('bob','Atual'))
 const stale=await f.request('alice','/servers/group/commands',{revision:previous.revision,action:nickname('bob','Rascunho')});assert.equal(stale.status,409)
 fail=true;assert.equal((await f.command('alice',nickname('bob','Falha'))).status,500);assert.equal((await f.request('alice','/servers/group')).data.nicknames.bob,'Atual');fail=false
 await f.command('alice',{type:'member-kick',member:'bob'});assert.equal((await f.request('alice','/servers/group')).data.nicknames.bob,undefined)
 const invite=await f.command('alice',{type:'invite-create',channelId:'group-text',maxAge:3600,maxUses:1});const code=invite.data.invites[0].code
 assert.equal((await f.request('bob','/invites/'+code+'/accept',{})).status,200);assert.equal((await f.request('bob','/servers/group')).data.nicknames.bob,undefined)
})

test('live SSE and media profile updates carry the server nickname while global presence and media identity stay unchanged',async t=>{
 const f=await fixture(t),media=await f.connect('bob'),presence=await f.connect('bob','presence',true)
 assert.equal(media.profile.identity,'bob');assert.equal(presence.profile.name,'Nome local')
 const controller=new AbortController();t.after(()=>controller.abort())
 const response=await fetch('http://127.0.0.1:'+f.server.address().port+'/servers/group/events',{headers:{Authorization:'Bearer '+keys.carol},signal:controller.signal}),reader=response.body.getReader();await reader.read()
 const updated=new Promise(resolve=>{const listener=value=>{const data=JSON.parse(value);if(data.event==='profile'&&data.data.serverNickname==='Bób de teste'){media.socket.off('message',listener);resolve(data.data)}};media.socket.on('message',listener)})
 await f.command('alice',nickname('bob','Bób de teste'))
 const profile=await updated;assert.equal(profile.name,'bob');assert.equal(profile.identity,'bob');assert.equal(profile.serverNickname,'Bób de teste')
 const forgery=new Promise(resolve=>{const listener=value=>{const packet=JSON.parse(value);if(packet.event==='profile'&&packet.data.name==='Nome local atualizado'){media.socket.off('message',listener);resolve(packet.data)}};media.socket.on('message',listener)})
 media.socket.send(JSON.stringify({id:2,method:'profile',data:{name:'Nome local atualizado',serverNickname:'Forjado'}}))
 assert.equal((await forgery).serverNickname,'Bób de teste')
 assert.match(new TextDecoder().decode((await reader.read()).value),/Bób de teste/)
 const rejoined=await f.connect('bob');assert.equal(rejoined.profile.serverNickname,'Bób de teste')
 const global=await f.connect('bob','presence',true);assert.equal(global.profile.name,'Nome local');assert.equal(global.profile.serverNickname,null)
 controller.abort()
})
