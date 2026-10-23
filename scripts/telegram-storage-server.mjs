// Central Telegram storage. Run login once in the administrator's terminal.
import { createServer } from 'node:http'
import { createWriteStream, existsSync, readFileSync, writeFileSync, mkdirSync, statSync, renameSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import { createHash, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createInterface } from 'node:readline/promises'
import path from 'node:path'
import { TelegramClient, Api, utils } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'
import { CustomFile } from 'telegram/client/uploads.js'

import { MAX_UPLOAD_SIZE, sealSession, openSession, signDownload, validDownload, storageOwner } from './storage-policy.mjs'
const maxSize=MAX_UPLOAD_SIZE
const directory=path.resolve(process.env.CONTALK_STORAGE_DATA||'.storage-data')
mkdirSync(directory,{recursive:true,mode:0o700})
const key=Buffer.from(process.env.TELEGRAM_VAULT_KEY||'','hex')
if(key.length!==32)throw new Error('Configure TELEGRAM_VAULT_KEY com 32 bytes em hexadecimal.')
const vault=path.join(directory,'telegram.enc')
const encrypt=value=>sealSession(value,key)
const decrypt=data=>openSession(data,key)
const client=new TelegramClient(new StringSession(existsSync(vault)?decrypt(readFileSync(vault)):''),Number(process.env.TELEGRAM_API_ID),process.env.TELEGRAM_API_HASH,{connectionRetries:5,deviceModel:'ContalK Storage'})
client.setLogLevel('error')
if(process.argv[2]==='login'){
 const terminal=createInterface({input:process.stdin,output:process.stdout})
 try{await client.start({phoneNumber:()=>terminal.question('Telefone com DDI: '),phoneCode:()=>terminal.question('Código recebido no Telegram: '),password:()=>terminal.question('Senha de duas etapas (entrada visível neste terminal privado): '),onError:error=>{throw error}});writeFileSync(vault,encrypt(client.session.save()),{mode:0o600});console.log('Sessão central salva com criptografia.')}finally{terminal.close();await client.disconnect()}
 process.exit(0)
}
const tokens=JSON.parse(process.env.CONTALK_STORAGE_TOKENS||'{}')
if(!Object.keys(tokens).length)throw new Error('Configure CONTALK_STORAGE_TOKENS: JSON de token para username.')
const publicUrl=new URL(process.env.CONTALK_STORAGE_PUBLIC_URL||'http://127.0.0.1:8788')
await client.connect()
if(!await client.checkAuthorization())throw new Error('Execute primeiro: node scripts/telegram-storage-server.mjs login')
let channel
const channelFile=path.join(directory,'channel.json')
if(existsSync(channelFile)){const saved=JSON.parse(readFileSync(channelFile,'utf8'));channel=await client.getEntity(new Api.InputPeerChannel({channelId:utils.parseID(saved.id),accessHash:utils.parseID(saved.accessHash)}))}
else{
 const existing=(await client.getDialogs({limit:200})).find(d=>d.title==='ContalK Storage'&&d.isChannel&&!d.entity?.username)
 channel=existing?.entity
 if(!channel){const result=await client.invoke(new Api.channels.CreateChannel({title:'ContalK Storage',about:'Arquivos compartilhados no ContalK',broadcast:true}));channel=result.chats[0]}
 writeFileSync(channelFile,JSON.stringify({id:String(channel.id),accessHash:String(channel.accessHash)}),{mode:0o600})
}
if(channel.username)throw new Error('O canal central deve ser privado.')
const signature=(id,expires)=>signDownload(key,id,expires)
let uploads=0,downloads=0
const server=createServer(async(req,res)=>{
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data))}
 const url=new URL(req.url,'http://localhost')
 const id=url.pathname.split('/')[2]
 try{
  if(req.method==='GET'&&/^\/files\/[0-9a-f-]{36}$/.test(url.pathname)){
   const expiry=Number(url.searchParams.get('expires')),provided=url.searchParams.get('signature')||''
   if(!validDownload(key,id,expiry,provided))return send(403,{error:'Link expirado ou inválido.'})
   if(downloads>=4)return send(429,{error:'Downloads ocupados. Tente novamente.'})
   downloads++
   try{
    const record=JSON.parse(readFileSync(path.join(directory,id+'.json'),'utf8'))
    const [message]=await client.getMessages(channel,{ids:[record.messageId]})
    if(!message?.media)return send(404,{error:'Arquivo não encontrado.'})
    res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(record.name),'Content-Length':record.size,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})
    for await(const chunk of client.iterDownload({file:message.media,requestSize:512*1024})) {if(res.destroyed)break;if(!res.write(chunk))await Promise.race([once(res,'drain'),once(res,'close')])}
    res.end()
   }finally{downloads--}
   return
  }
  const token=req.headers.authorization?.replace(/^Bearer /,'')
  const owner=storageOwner(tokens,token)
  if(!owner)return send(401,{error:'Acesso ao armazenamento não configurado.'})
  if(req.method==='GET'&&url.pathname==='/identity')return send(200,{username:owner})
  if(req.method==='POST'&&/^\/views\/[0-9a-f-]{36}$/.test(url.pathname)){
   const receipt=path.join(directory,'view-'+createHash('sha256').update(owner+':'+id).digest('hex')+'.json')
   try{writeFileSync(receipt,JSON.stringify({viewedAt:Date.now()}),{flag:'wx',mode:0o600});return send(200,{allowed:true})}catch(error){if(error.code==='EEXIST')return send(200,{allowed:false});throw error}
  }
  if(req.method==='GET'&&/^\/links\/[0-9a-f-]{36}$/.test(url.pathname)){
   if(!existsSync(path.join(directory,id+'.json')))return send(404,{error:'Arquivo não encontrado.'})
   const expires=Date.now()+15*60*1000
   return send(200,{url:new URL('/files/'+id+'?expires='+expires+'&signature='+signature(id,expires),publicUrl).href})
  }
  if(req.method!=='POST'||url.pathname!=='/files')return send(404,{error:'Não encontrado.'})
  const size=Number(req.headers['content-length'])
  if(!Number.isSafeInteger(size)||size<0||size>maxSize)return send(413,{error:'Limite de 2 GB por arquivo.'})
  if(uploads>=2)return send(429,{error:'Uploads ocupados. Tente novamente.'})
  uploads++
  const fileId=randomUUID(),temp=path.join(directory,fileId+'.part')
  try{
   let bytes=0
   await pipeline(req,new Transform({transform(chunk,_encoding,done){bytes+=chunk.length;done(bytes>maxSize?new Error('Arquivo grande demais'):null,chunk)}}),createWriteStream(temp,{flags:'wx',mode:0o600}))
   if(statSync(temp).size!==size)throw new Error('Upload incompleto.')
   const name=decodeURIComponent(String(req.headers['x-file-name']||'arquivo')).replace(/[\r\n]/g,'').slice(0,200)
   const message=await client.sendFile(channel,{file:new CustomFile(name,size,temp),forceDocument:true,workers:4,caption:'ContalK '+fileId})
   const record={owner,name,size,messageId:message.id}
   const metadata=path.join(directory,fileId+'.json')
   writeFileSync(metadata+'.tmp',JSON.stringify(record),{mode:0o600});renameSync(metadata+'.tmp',metadata)
   send(201,{id:fileId,name,size,type:String(req.headers['x-file-type']||'application/octet-stream').slice(0,100)})
  }finally{uploads--;await unlink(temp).catch(()=>{})}
 }catch(error){console.error(error.message);if(!res.headersSent)send(500,{error:'Falha no armazenamento. Tente novamente.'});else res.destroy()}
})
server.requestTimeout=0
server.listen(Number(process.env.CONTALK_STORAGE_PORT||8788),process.env.CONTALK_STORAGE_HOST||'127.0.0.1',()=>console.log('Armazenamento central pronto.'))
