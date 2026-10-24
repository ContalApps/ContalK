import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import { MAX_UPLOAD_SIZE, storageOwner, signDownload, validDownload, signScopedDownload, validScopedDownload } from './storage-policy.mjs'
import { validFileId, validInternalToken } from './community/files.mjs'

class StorageError extends Error{constructor(status,message){super(message);this.status=status}}
const requireValue=(condition,status,message)=>{if(!condition)throw new StorageError(status,message)}
const username=value=>typeof value==='string'&&/^[\w:-]{1,100}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value)
export function createStorageServer({directory,key,tokens,publicUrl,upload,download,authorize,internalToken}){
  directory=path.resolve(directory);fs.mkdirSync(directory,{recursive:true,mode:0o700})
  if(internalToken&&(!validInternalToken(internalToken,internalToken)||Object.hasOwn(tokens,internalToken)))throw new Error('Use uma chave interna diferente das chaves dos usuários.')
  if(authorize&&!internalToken)throw new Error('Configure a chave interna do armazenamento controlado.')
  let uploads=0,downloads=0
  const filePath=id=>path.join(directory,id+'.json')
  const read=id=>{requireValue(validFileId(id)&&fs.existsSync(filePath(id)),404,'Arquivo não encontrado.');return JSON.parse(fs.readFileSync(filePath(id),'utf8'))}
  const save=(id,record)=>{const temporary=filePath(id)+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(temporary,JSON.stringify(record),{flag:'wx',mode:0o600});fs.renameSync(temporary,filePath(id))}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary)}}
  const allowed=async(actor,id,record)=>{
    if(record.access!=='controlled'||record.owner===actor||record.recipients?.includes(actor))return true
    if(!authorize)throw new StorageError(503,'A autorização da comunidade não está configurada.')
    return authorize(actor,id)
  }
  const body=async request=>{let size=0;const chunks=[];for await(const chunk of request){size+=chunk.length;requireValue(size<=4096,413,'Solicitação grande demais.');chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks).toString())}catch{throw new StorageError(400,'JSON inválido.')}}
  const server=http.createServer({headersTimeout:10000,maxHeaderSize:8192},async(req,res)=>{
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))}
    try{
      const url=new URL(req.url,'http://localhost'),parts=url.pathname.split('/'),id=parts[2]
      const bearer=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):''
      if(req.method==='POST'&&/^\/internal\/files\/[^/]+\/reference$/.test(url.pathname)){
        requireValue(validInternalToken(bearer,internalToken),401,'Origem interna inválida.')
        const storageId=parts[3],{username:actor}=await body(req)
        requireValue(username(actor),400,'Usuário inválido.')
        let result=false
        if(Object.values(tokens).includes(actor)&&validFileId(storageId)&&fs.existsSync(filePath(storageId)))result=await allowed(actor,storageId,read(storageId))
        send(200,{allowed:result});return
      }
      if(req.method==='GET'&&parts.length===3&&parts[1]==='files'&&validFileId(id)){
        const expires=Number(url.searchParams.get('expires')),signature=url.searchParams.get('signature')||'',viewer=url.searchParams.get('viewer')
        requireValue(viewer?username(viewer)&&validScopedDownload(key,id,expires,viewer,signature):validDownload(key,id,expires,signature),403,'Link expirado ou inválido.')
        const record=read(id)
        if(record.access==='controlled')requireValue(viewer&&Object.values(tokens).includes(viewer)&&await allowed(viewer,id,record),403,'Você não tem mais acesso a este arquivo.')
        requireValue(downloads<4,429,'Downloads ocupados. Tente novamente.');downloads++
        try{
          const content=await download(record)
          requireValue(content,404,'Arquivo não encontrado.')
          res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(record.name),'Content-Length':record.size,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})
          for await(const chunk of content){
            if(res.destroyed)break
            if(!res.write(chunk))await new Promise(resolve=>{const done=()=>{res.removeListener('drain',done);res.removeListener('close',done);res.removeListener('error',done);resolve()};res.once('drain',done);res.once('close',done);res.once('error',done)})
          }
          res.end()
        }finally{downloads--}
        return
      }
      const actor=storageOwner(tokens,bearer)
      requireValue(actor,401,'Acesso ao armazenamento não configurado.')
      if(req.method==='GET'&&url.pathname==='/identity'){send(200,{username:actor,version:2,accessControl:authorize?'community':'legacy'});return}
      if(req.method==='POST'&&parts.length===3&&parts[1]==='views'&&validFileId(id)){
        const {createHash}=await import('node:crypto')
        const receipt=path.join(directory,'view-'+createHash('sha256').update(actor+':'+id).digest('hex')+'.json')
        try{fs.writeFileSync(receipt,JSON.stringify({viewedAt:Date.now()}),{flag:'wx',mode:0o600});send(200,{allowed:true})}catch(error){if(error.code==='EEXIST')send(200,{allowed:false});else throw error}
        return
      }
      if(req.method==='GET'&&parts.length===3&&parts[1]==='links'&&validFileId(id)){
        const record=read(id)
        requireValue(await allowed(actor,id,record),403,'Você não tem acesso a este arquivo.')
        const expires=Date.now()+15*60*1000,target=new URL('/files/'+id,publicUrl)
        target.searchParams.set('expires',String(expires))
        if(record.access==='controlled'){target.searchParams.set('viewer',actor);target.searchParams.set('signature',signScopedDownload(key,id,expires,actor))}
        else target.searchParams.set('signature',signDownload(key,id,expires))
        send(200,{url:target.href});return
      }
      if(req.method==='POST'&&parts.length===4&&parts[1]==='files'&&parts[3]==='share'&&validFileId(id)){
        const record=read(id),{recipient}=await body(req)
        requireValue(username(recipient)&&Object.values(tokens).includes(recipient),400,'Destinatário não encontrado.')
        requireValue(await allowed(actor,id,record),403,'Você não pode compartilhar este arquivo.')
        const current=read(id),recipients=new Set(current.recipients||[]);recipients.add(recipient)
        requireValue(recipients.size<=250,400,'Limite de destinatários diretos atingido.')
        save(id,{...current,recipients:[...recipients]});send(200,{shared:true});return
      }
      requireValue(req.method==='POST'&&url.pathname==='/files',404,'Não encontrado.')
      const size=Number(req.headers['content-length'])
      requireValue(Number.isSafeInteger(size)&&size>=0&&size<=MAX_UPLOAD_SIZE,413,'Limite de 2 GB por arquivo.')
      requireValue(uploads<2,429,'Uploads ocupados. Tente novamente.');uploads++
      const fileId=randomUUID(),temporary=path.join(directory,fileId+'.part')
      try{
        let bytes=0
        await pipeline(req,new Transform({transform(chunk,_encoding,done){bytes+=chunk.length;done(bytes>MAX_UPLOAD_SIZE?new Error('Arquivo grande demais.'):null,chunk)}}),fs.createWriteStream(temporary,{flags:'wx',mode:0o600}))
        requireValue(fs.statSync(temporary).size===size,400,'Upload incompleto.')
        const name=decodeURIComponent(String(req.headers['x-file-name']||'arquivo')).replace(/[\r\n]/g,'').slice(0,200)||'arquivo'
        const messageId=await upload({name,size,temporary,fileId})
        save(fileId,{owner:actor,name,size,messageId,access:authorize?'controlled':'legacy-public',recipients:[]})
        send(201,{id:fileId,name,size,type:String(req.headers['x-file-type']||'application/octet-stream').slice(0,100)})
      }finally{uploads--;if(fs.existsSync(temporary))fs.unlinkSync(temporary)}
    }catch(error){if(!res.headersSent)send(error instanceof StorageError?error.status:503,{error:error instanceof StorageError?error.message:'Armazenamento ou autorização indisponível. Tente novamente.'});else res.destroy()}
  })
  server.requestTimeout=0
  return server
}
