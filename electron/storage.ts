import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell, nativeImage } from 'electron'
import { createReadStream, unlinkSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

export function setupStorage(window:BrowserWindow,getUsername:()=>string|null) {
  const selected=new Map<string,{file:string;owner:string}>()
  const configPath=()=>{
    const username=getUsername()
    if(!username)throw new Error('Entre no ConTALK antes de configurar o armazenamento.')
    return path.join(app.getPath('userData'),'storage-'+createHash('sha256').update(username).digest('hex')+'.enc')
  }
  let uploading=false
  const mime=(file:string)=>({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.txt':'text/plain','.pdf':'application/pdf','.webm':'audio/webm;codecs=opus'}[path.extname(file).toLowerCase()]||'application/octet-stream')
  const thumbnail=async(file:string)=>{if(!mime(file).startsWith('image/'))return undefined;try{return (await nativeImage.createThumbnailFromPath(file,{width:240,height:180})).toJPEG(60).toString('base64')}catch{return undefined}}
  const trusted=(event:Electron.IpcMainInvokeEvent)=>{if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)throw new Error('Origem inválida.')}
  const config=()=>{
    if(process.env.CONTALK_STORAGE_URL&&process.env.CONTALK_STORAGE_TOKEN)return {url:process.env.CONTALK_STORAGE_URL,token:process.env.CONTALK_STORAGE_TOKEN}
    if(!existsSync(configPath())||!safeStorage.isEncryptionAvailable())throw new Error('Configure o armazenamento central antes de anexar arquivos.')
    return JSON.parse(safeStorage.decryptString(readFileSync(configPath()))) as {url:string;token:string}
  }
  const handlers:Record<string,(event:Electron.IpcMainInvokeEvent,...args:any[])=>unknown>={
    'storage-status':()=>{try{config();return true}catch{return false}},
    'storage-configure':async(_event,value:{url:string;token:string})=>{
      const url=new URL(value.url)
      if((url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))||url.username||url.password||!/^https?:$/.test(url.protocol)||!value.token?.trim())throw new Error('Informe um endereço HTTPS e sua chave de acesso.')
      if(!safeStorage.isEncryptionAvailable())throw new Error('Proteção de credenciais do sistema indisponível.')
      const identity=await fetch(new URL('/identity',url),{headers:{Authorization:'Bearer '+value.token.trim()}})
      if(!identity.ok || (await identity.json()).username!==getUsername())throw new Error('A chave de armazenamento não corresponde ao seu usuário ConTALK.')
      writeFileSync(configPath(),safeStorage.encryptString(JSON.stringify({url:url.origin,token:value.token.trim()})))
    },
    'storage-select':async()=>{
      const owner=getUsername()!
      config()
      const result=await dialog.showOpenDialog(window,{properties:['openFile']})
      if(getUsername()!==owner)throw new Error('A conta foi alterada. Selecione novamente o arquivo.')
      if(result.canceled)return null
      const file=result.filePaths[0],stat=statSync(file)
      if(!stat.isFile()||stat.size>2*1024**3)throw new Error('Escolha um arquivo de até 2 GB.')
      if(selected.size>=20)selected.clear()
      const id=randomUUID();selected.set(id,{file,owner})
      return {id,name:path.basename(file),size:stat.size,type:mime(file),thumbnail:await thumbnail(file)}
    },
    'storage-upload':async(_event,id:string)=>{
      if(uploading)throw new Error('Aguarde o upload atual.')
      const entry=selected.get(id),owner=getUsername()
      if(!entry||entry.owner!==owner)throw new Error('Selecione novamente o arquivo nesta conta.')
      const file=entry.file
      const {url,token}=config(),size=statSync(file).size
      if(size>2*1024**3)throw new Error('Limite de 2 GB.')
      uploading=true
      try{
        const response=await fetch(new URL('/files',url),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Length':String(size),'X-File-Name':encodeURIComponent(path.basename(file)),'X-File-Type':mime(file)},body:createReadStream(file) as unknown as BodyInit,duplex:'half'} as RequestInit)
        if(!response.ok)throw new Error('Falha no upload ('+response.status+'). Confira o serviço central e a chave de acesso.')
        const result=await response.json();selected.delete(id)
        if(getUsername()!==owner)throw new Error('A conta foi alterada durante o upload.')
        return {name:result.name,size:result.size,type:result.type,data:'',storageId:result.id,thumbnail:await thumbnail(file)}
      }finally{uploading=false}
    },
    'storage-inline':async(event,attachment:{data:string;name:string})=>{
      if(typeof attachment.data!=='string'||attachment.data.length>1400000||!/^data:application\/octet-stream;base64,[A-Za-z0-9+/]*={0,2}$/.test(attachment.data))throw new Error('Imagem colada inválida ou grande demais.')
      const file=path.join(app.getPath('temp'),'contalk-'+randomUUID()+path.extname(path.basename(attachment.name)).slice(0,10))
      writeFileSync(file,Buffer.from(attachment.data.split(',')[1],'base64'),{flag:'wx'})
      const id=randomUUID();selected.set(id,{file,owner:getUsername()!})
      try{const result=await handlers['storage-upload'](event,id) as Record<string,unknown>;return {...result,name:attachment.name.slice(0,200)}}finally{selected.delete(id);unlinkSync(file)}
    },
    'storage-view':async(_event,id:string)=>{
      if(!/^[0-9a-f-]{36}$/.test(id))throw new Error('Mensagem inválida.')
      const {url,token}=config()
      const response=await fetch(new URL('/views/'+id,url),{method:'POST',headers:{Authorization:'Bearer '+token}})
      if(!response.ok)throw new Error('Não foi possível registrar a visualização.')
      return Boolean((await response.json()).allowed)
    },
    'storage-share':async(_event,id:string,recipient:string)=>{
      if(!/^[0-9a-f-]{36}$/.test(id)||typeof recipient!=='string'||!/^[\w:-]{1,100}$/.test(recipient)||['__proto__','constructor','prototype'].includes(recipient))throw new Error('Arquivo ou destinatário inválido.')
      const {url,token}=config()
      const response=await fetch(new URL('/files/'+id+'/share',url),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({recipient}),signal:AbortSignal.timeout(15000)})
      if(response.status===404){const identity=await fetch(new URL('/identity',url),{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});if(identity.ok&&(await identity.json()).version===undefined)return}
      if(!response.ok)throw new Error('Não foi possível autorizar o destinatário do arquivo.')
    },
    'storage-selected-audio':(_event,id:string)=>{
      const entry=selected.get(id)
      if(!entry||entry.owner!==getUsername()||mime(entry.file)!=='audio/webm;codecs=opus'||statSync(entry.file).size>1048576)throw new Error('Selecione um arquivo WebM de até 1 MB nesta conta.')
      const data=readFileSync(entry.file)
      if(data.length<4||data.length>1048576||data.readUInt32BE(0)!==0x1a45dfa3)throw new Error('Arquivo WebM inválido.')
      return 'data:audio/webm;codecs=opus;base64,'+data.toString('base64')
    },
    'storage-audio':async(_event,id:string)=>{
      if(typeof id!=='string'||!/^[-0-9a-f]{36}$/.test(id))throw new Error('Arquivo inválido.')
      const owner=getUsername(),{url,token}=config(),signal=AbortSignal.timeout(15000)
      const link=await fetch(new URL('/links/'+id,url),{headers:{Authorization:'Bearer '+token},signal})
      if(!link.ok)throw new Error('Não foi possível autorizar a mensagem de voz.')
      const result=await link.json(),target=new URL(result.url)
      if(target.origin!==new URL(url).origin||target.username||target.password)throw new Error('Endereço de áudio inválido.')
      const response=await fetch(target,{signal,redirect:'error'})
      if(!response.ok||!response.body||Number(response.headers.get('Content-Length'))>1048576)throw new Error('Mensagem de voz indisponível ou grande demais.')
      const reader=response.body.getReader(),chunks:Buffer[]=[];let size=0
      try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1048576)throw new Error('Mensagem de voz grande demais.');chunks.push(Buffer.from(value))}}finally{await reader.cancel().catch(()=>{})}
      if(getUsername()!==owner)throw new Error('A conta foi alterada durante a leitura.')
      const buffer=Buffer.concat(chunks)
      if(buffer.length<4||buffer.readUInt32BE(0)!==0x1a45dfa3)throw new Error('O arquivo não contém áudio WebM.')
      return 'data:audio/webm;codecs=opus;base64,'+buffer.toString('base64')
    },
    'storage-open':async(_event,id:string)=>{
      if(!/^[0-9a-f-]{36}$/.test(id))throw new Error('Arquivo inválido.')
      const {url,token}=config()
      const response=await fetch(new URL('/links/'+id,url),{headers:{Authorization:'Bearer '+token}})
      if(!response.ok)throw new Error('Não foi possível abrir o arquivo.')
      const result=await response.json();const target=new URL(result.url)
      if(target.origin!==new URL(url).origin)throw new Error('Endereço de download inválido.')
      await shell.openExternal(target.href)
    },
  }
  for(const [name,handler] of Object.entries(handlers))ipcMain.handle(name,(event,...args)=>{trusted(event);if(!getUsername())throw new Error('Entre no ConTALK.');return handler(event,...args)})
  window.once('closed',()=>{for(const name of Object.keys(handlers))ipcMain.removeHandler(name)})
}
