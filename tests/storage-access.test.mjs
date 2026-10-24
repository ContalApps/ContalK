import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { createCommunityService, createCommunityState } from '../scripts/community/service.mjs'
import { createStorageServer } from '../scripts/storage-server.mjs'
import { createFileReferenceClient, createStorageAuthorizer } from '../scripts/community/files.mjs'
import { initialPolicy, mask } from '../src/roles/permissions.ts'

const keys={alice:'a'.repeat(40),bob:'b'.repeat(40),charlie:'c'.repeat(40)},internalToken='internal-'.repeat(8)
async function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'contalk-file-access-')),servers=[],binaries=new Map()
 let client,downloads=0,unavailable=false
 t.after(async()=>{for(const server of servers){server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}const resolved=fs.realpathSync(directory);assert.equal(path.dirname(resolved).toLowerCase(),fs.realpathSync(os.tmpdir()).toLowerCase());assert.ok(path.basename(resolved).startsWith('contalk-file-access-'));fs.rmSync(resolved,{recursive:true,force:true})})
 const state=createCommunityState(Object.keys(keys)),policy=initialPolicy('private-group',Object.keys(keys));policy.ownerIds=['alice']
 policy.overwrites.private=[{id:'private-group',type:'role',allow:'0',deny:mask(['VIEW_CHANNEL']).toString()},{id:'bob',type:'member',allow:mask(['VIEW_CHANNEL']).toString(),deny:'0'}]
 state.servers['private-group']={id:'private-group',name:'Grupo',revision:0,policy,channels:[{id:'private',name:'Privado',type:'text',serverId:'private-group'},{id:'public',name:'Público',type:'text',serverId:'private-group'}],messages:{},audit:[]}
 const tokens=Object.fromEntries(Object.entries(keys).map(([member,key])=>[key,member]))
 const community=createCommunityService({tokens,internalToken,initialState:state,files:{canReference:(...args)=>client.canReference(...args)}}).server
 servers.push(community);community.listen(0,'127.0.0.1');await once(community,'listening')
 const communityUrl='http://127.0.0.1:'+community.address().port,authorize=createStorageAuthorizer({url:communityUrl,token:internalToken}),publicUrl=new URL('http://127.0.0.1')
 const storage=createStorageServer({directory,key:Buffer.alloc(32,42),tokens,internalToken,publicUrl,
  authorize:(...args)=>{if(unavailable)throw new Error('Authorization is down');return authorize(...args)},
  upload:async({temporary})=>{const id=randomUUID();binaries.set(id,fs.readFileSync(temporary));return id},
  download:async record=>{downloads++;return Readable.from([binaries.get(record.messageId)])},
 })
 servers.push(storage);storage.listen(0,'127.0.0.1');await once(storage,'listening');publicUrl.port=String(storage.address().port)
 const storageUrl=publicUrl.origin;client=createFileReferenceClient({url:storageUrl,token:internalToken})
 const request=async(actor,url,body)=>{const response=await fetch(url,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+keys[actor],...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()}}
 const command=async(actor,action)=>{const current=await request(actor,communityUrl+'/servers/private-group');return request(actor,communityUrl+'/servers/private-group/commands',{revision:current.data.revision,action})}
 const upload=async(actor='alice')=>{const content=Buffer.from('Conteúdo de teste privado');const response=await fetch(storageUrl+'/files',{method:'POST',headers:{Authorization:'Bearer '+keys[actor],'Content-Length':String(content.length),'X-File-Name':'teste.txt','X-File-Type':'text/plain'},body:content});assert.equal(response.status,201);const file=await response.json();return {...file,storageId:file.id,data:''}}
 const link=(actor,id)=>request(actor,storageUrl+'/links/'+id)
 const post=(file,actor='alice',channel='private')=>command(actor,{type:'message-send',id:randomUUID(),channel,content:'Anexo',attachment:file})
 return {directory,communityUrl,storageUrl,request,command,upload,link,post,outage:()=>{unavailable=true},get downloads(){return downloads},legacy:()=>{const id=randomUUID(),messageId=randomUUID(),content=Buffer.from('Arquivo anterior');binaries.set(messageId,content);fs.writeFileSync(path.join(directory,id+'.json'),JSON.stringify({owner:'alice',name:'legacy.txt',size:content.length,messageId}));return id}}
}

test('private attachments enforce channel access and an already issued download link stops working after revocation',async t=>{
 const f=await fixture(t),file=await f.upload()
 assert.equal((await f.link('bob',file.id)).status,403,'knowing an unshared staging ID does not grant access')
 assert.equal((await f.post(file)).status,200)
 const bob=await f.link('bob',file.id);assert.equal(bob.status,200)
 const payload=await fetch(bob.data.url);assert.equal(payload.status,200);assert.equal(await payload.text(),'Conteúdo de teste privado')
 assert.equal((await f.link('charlie',file.id)).status,403)
 const forged=new URL(bob.data.url);forged.searchParams.set('viewer','alice');assert.equal((await fetch(forged)).status,403)
 await f.command('alice',{type:'role',command:{type:'overwrite',channel:'private',targetId:'bob',targetType:'member',overwrite:{id:'bob',type:'member',allow:'0',deny:mask(['VIEW_CHANNEL']).toString()}}})
 const before=f.downloads
 assert.equal((await fetch(bob.data.url)).status,403)
 assert.equal(f.downloads,before,'revoked requests do not reach the binary provider')
 assert.equal((await f.post(file,'bob','public')).status,403,'a former reader cannot launder a private file into a public channel')
 assert.equal((await f.post(file,'alice','public')).status,200)
 assert.equal((await f.link('charlie',file.id)).status,200,'an explicit share by the author can make the same file public')
})

test('direct recipient grants require current access and remain distinct from public channel access',async t=>{
 const f=await fixture(t),file=await f.upload()
 const share=(actor,recipient)=>f.request(actor,f.storageUrl+'/files/'+file.id+'/share',{recipient})
 assert.equal((await share('bob','charlie')).status,403)
 assert.equal((await share('alice','charlie')).status,200)
 assert.equal((await f.link('charlie',file.id)).status,200)
 assert.equal((await f.link('bob',file.id)).status,403)
 assert.equal((await share('alice','missing-user')).status,400)
 const forged=await fetch(f.storageUrl+'/internal/files/'+file.id+'/reference',{method:'POST',headers:{Authorization:'Bearer '+keys.alice,'Content-Type':'application/json'},body:JSON.stringify({username:'charlie'})})
 assert.equal(forged.status,401,'a personal key cannot impersonate the community service')
})

test('an unavailable authority blocks controlled downloads while legacy public files preserve their previous access',async t=>{
 const f=await fixture(t),file=await f.upload();await f.post(file)
 const bob=await f.link('bob',file.id);assert.equal(bob.status,200)
 f.outage();const before=f.downloads
 assert.equal((await f.link('bob',file.id)).status,503)
 assert.equal((await fetch(bob.data.url)).status,503)
 assert.equal(f.downloads,before)
 const legacy=await f.link('charlie',f.legacy());assert.equal(legacy.status,200)
 const original=await fetch(legacy.data.url);assert.equal(original.status,200);assert.equal(await original.text(),'Arquivo anterior')
})
