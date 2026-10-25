import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import type { CommunitySnapshot, CommunityAction } from '../src/roles/types'
import { validInviteCode } from '../src/roles/invites'
import { aiFileMime } from '../src/roles/ai'

const validId = (value:unknown):value is string => typeof value==='string' && /^[\w:-]{1,100}$/.test(value) && !['__proto__','constructor','prototype'].includes(value)
export function setupCommunity(window:BrowserWindow,getUsername:()=>string|null) {
  const contents=window.webContents
  let stream:AbortController|undefined
  let aiStream:AbortController|undefined
  const selectedAiFiles=new Map<string,{file:string;owner:string;size:number;type:string}>()
  const configPath=()=>{
    const owner=getUsername()
    if(!owner)throw new Error('Entre no ConTALK.')
    return path.join(app.getPath('userData'),'community-'+createHash('sha256').update(owner).digest('hex')+'.enc')
  }
  const config=():{url:string;token:string}=>{
    if(!getUsername())throw new Error('Entre no ConTALK.')
    if(!safeStorage.isEncryptionAvailable()||!fs.existsSync(configPath()))throw new Error('Conecte o serviço da comunidade antes de administrar cargos.')
    return JSON.parse(safeStorage.decryptString(fs.readFileSync(configPath())))
  }
  const aiPath=()=>path.join(app.getPath('userData'),'ai-'+createHash('sha256').update(getUsername()||'').digest('hex')+'.enc')
  const aiConfig=():{key:string;contextTokens:number;maxOutputTokens:number}|null=>{
    if(!getUsername()||!safeStorage.isEncryptionAvailable()||!fs.existsSync(aiPath()))return null
    return JSON.parse(safeStorage.decryptString(fs.readFileSync(aiPath())))
  }
  const request=async(route:string,body?:unknown,timeout=15000)=>{
    const owner=getUsername()
    const {url,token}=config()
    const response=await fetch(new URL(route,url),{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(timeout)})
    const result=await response.json()
    if(getUsername()!==owner)throw new Error('A conta foi alterada durante a solicitação.')
    if(!response.ok)throw new Error(typeof result.error==='string'?result.error:'Não foi possível acessar a comunidade.')
    return result
  }
  const send=(serverId:string,value:{snapshot?:CommunitySnapshot;error?:string;accessRevoked?:boolean})=>{if(!window.isDestroyed()&&!contents.isDestroyed())contents.send('community-state',{serverId,...value})}
  const subscribe=async(serverId:string,owner:string,controller:AbortController)=>{
    let delay=1000
    while(!controller.signal.aborted&&getUsername()===owner){
      const attempt=new AbortController()
      const cancel=()=>attempt.abort()
      controller.signal.addEventListener('abort',cancel,{once:true})
      try{
        const {url,token}=config()
        const connectionTimer=setTimeout(()=>attempt.abort(),10000)
        let response:Response
        try{response=await fetch(new URL(`/servers/${serverId}/events`,url),{headers:{Authorization:'Bearer '+token},signal:attempt.signal})}finally{clearTimeout(connectionTimer)}
        if(response.status===403){send(serverId,{accessRevoked:true});controller.abort();return}
        if(!response.ok||!response.body)throw new Error('Não foi possível acompanhar a comunidade.')
        const reader=response.body.getReader(),decoder=new TextDecoder()
        let buffer=''
        delay=1000
        try{
          while(!controller.signal.aborted){
            const chunk=await reader.read()
            if(chunk.done)throw new Error('A conexão com a comunidade foi interrompida.')
            if(getUsername()!==owner){controller.abort();break}
            buffer+=decoder.decode(chunk.value,{stream:true})
            if(buffer.length>32*1024*1024)throw new Error('Resposta da comunidade grande demais.')
            let end:number
            while((end=buffer.indexOf('\n\n'))!==-1){
              const packet=buffer.slice(0,end);buffer=buffer.slice(end+2)
              const data=packet.split('\n').filter(line=>line.startsWith('data: ')).map(line=>line.slice(6)).join('\n')
              if(data){const snapshot=JSON.parse(data) as CommunitySnapshot;if(snapshot.actor!==owner||snapshot.id!==serverId)throw new Error('Identidade da comunidade inconsistente.');if(packet.split('\n').includes('event: access-revoked')){send(serverId,{accessRevoked:true});controller.abort();return}send(serverId,{snapshot})}
            }
          }
        }finally{await reader.cancel().catch(()=>{})}
      }catch(error){if(controller.signal.aborted||getUsername()!==owner)return;send(serverId,{error:error instanceof Error?error.message:'Falha na conexão com a comunidade.'})}
      finally{controller.signal.removeEventListener('abort',cancel);attempt.abort()}
      if(!controller.signal.aborted)await new Promise<void>(resolve=>{const done=()=>{clearTimeout(timer);controller.signal.removeEventListener('abort',done);resolve()};const timer=setTimeout(done,delay);controller.signal.addEventListener('abort',done,{once:true})})
      delay=Math.min(30000,delay*2)
    }
  }
  const subscribeAi=async(serverId:string,channelId:string,owner:string,controller:AbortController)=>{
    let delay=1000
    while(!controller.signal.aborted&&getUsername()===owner){
      try{
        const {url,token}=config()
        const response=await fetch(new URL(`/servers/${serverId}/ai-events/${channelId}`,url),{headers:{Authorization:'Bearer '+token},signal:controller.signal})
        if(!response.ok||!response.body)throw new Error('Não foi possível acompanhar a resposta da IA.')
        const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';delay=1000
        try{while(!controller.signal.aborted){const next=await reader.read();if(next.done)break;buffer+=decoder.decode(next.value,{stream:true});if(buffer.length>1024*1024)throw new Error('Fluxo da IA grande demais.');let end:number;while((end=buffer.indexOf('\n\n'))>=0){const packet=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=packet.split('\n').filter(line=>line.startsWith('data: ')).map(line=>line.slice(6)).join('\n');if(data&&getUsername()===owner&&!contents.isDestroyed())contents.send('community-ai-event',{serverId,channelId,...JSON.parse(data)})}}}finally{await reader.cancel().catch(()=>{})}
      }catch(error){if(controller.signal.aborted||getUsername()!==owner)return;if(!contents.isDestroyed())contents.send('community-ai-event',{serverId,channelId,type:'error',error:error instanceof Error?error.message:'Fluxo da IA interrompido.'})}
      if(!controller.signal.aborted)await new Promise<void>(resolve=>setTimeout(resolve,delay));delay=Math.min(delay*2,30000)
    }
  }
  const handlers:Record<string,(...args:any[])=>unknown>={
    'community-status':()=>{try{return {configured:true,url:config().url}}catch{return {configured:false}}},
    'community-ai-status':()=>{const value=aiConfig();return {configured:!!value,contextTokens:value?.contextTokens||8192,maxOutputTokens:value?.maxOutputTokens||2048}},
    'community-ai-configure':(value:{key?:string;contextTokens:number;maxOutputTokens:number})=>{
      if(!value||!Number.isInteger(value.contextTokens)||value.contextTokens<1024||value.contextTokens>32768||!Number.isInteger(value.maxOutputTokens)||value.maxOutputTokens<128||value.maxOutputTokens>8192)throw new Error('Defina limites válidos para o uso da IA.')
      const key=value.key?.trim()||aiConfig()?.key
      if(!key||key.length<20||key.length>512)throw new Error('Informe uma chave pessoal da OpenAI.')
      if(!safeStorage.isEncryptionAvailable())throw new Error('Proteção de credenciais indisponível.')
      fs.writeFileSync(aiPath(),safeStorage.encryptString(JSON.stringify({key,contextTokens:value.contextTokens,maxOutputTokens:value.maxOutputTokens})))
      return {configured:true,contextTokens:value.contextTokens,maxOutputTokens:value.maxOutputTokens}
    },
    'community-ai-remove':()=>{const file=aiPath();if(fs.existsSync(file))fs.unlinkSync(file);selectedAiFiles.clear()},
    'community-ai-select-files':async()=>{
      const owner=getUsername()!,result=await dialog.showOpenDialog(window,{title:'Anexar arquivos à solicitação de IA',properties:['openFile','multiSelections']})
      if(result.canceled)return []
      if(result.filePaths.length>20)throw new Error('Selecione até 20 arquivos.')
      for(const [id,item]of selectedAiFiles)if(item.owner===owner)selectedAiFiles.delete(id)
      let total=0;const items=[]
      for(const file of result.filePaths){const type=aiFileMime(path.basename(file)),size=fs.statSync(file).size;total+=size;if(!type)throw new Error('A IA não aceita '+path.basename(file)+'. Selecione um formato compatível.');if(!size||total>50*1024*1024)throw new Error('Os anexos devem somar no máximo 50 MB.');const id=randomUUID();selectedAiFiles.set(id,{file,owner,size,type});items.push({id,name:path.basename(file),size,type})}
      return items
    },
    'community-ai-start':async(serverId:string,channelId:string,text:string,fileIds:string[],limits?:{contextTokens:number;maxOutputTokens:number})=>{
      if(!validId(serverId)||!validId(channelId)||typeof text!=='string'||!Array.isArray(fileIds)||fileIds.length>20)throw new Error('Solicitação de IA inválida.')
      const owner=getUsername(),settings=aiConfig();if(!settings)throw new Error('Configure sua chave pessoal da OpenAI.')
      const contextTokens=limits?.contextTokens??settings.contextTokens,maxOutputTokens=limits?.maxOutputTokens??settings.maxOutputTokens
      if(!Number.isInteger(contextTokens)||contextTokens<1024||contextTokens>32768||!Number.isInteger(maxOutputTokens)||maxOutputTokens<128||maxOutputTokens>8192)throw new Error('Defina limites válidos para esta solicitação.')
      let total=0;const files=fileIds.map(id=>{const item=selectedAiFiles.get(id);if(!item||item.owner!==owner||!fs.existsSync(item.file))throw new Error('Selecione os arquivos novamente.');const data=fs.readFileSync(item.file);total+=data.length;if(total>50*1024*1024||data.length!==item.size)throw new Error('Os arquivos mudaram ou excedem 50 MB.');return {name:path.basename(item.file),type:item.type,size:data.length,data:data.toString('base64')}})
      const result=await request(`/servers/${serverId}/ai-runs`,{channelId,text,files,key:settings.key,contextTokens,maxOutputTokens},120000)
      for(const id of fileIds)selectedAiFiles.delete(id)
      return result
    },
    'community-ai-stop':(serverId:string,channelId:string)=>{if(!validId(serverId)||!validId(channelId))throw new Error('Conversa inválida.');return request(`/servers/${serverId}/ai-runs/${channelId}/stop`,{})},
    'community-ai-subscribe':(serverId:string,channelId:string)=>{if(!validId(serverId)||!validId(channelId))throw new Error('Conversa inválida.');config();aiStream?.abort();aiStream=new AbortController();void subscribeAi(serverId,channelId,getUsername()!,aiStream)},
    'community-ai-unsubscribe':()=>{aiStream?.abort();aiStream=undefined},
    'community-configure':async(value:{url:string;token:string})=>{
      if(!value||typeof value.url!=='string'||typeof value.token!=='string'||value.token.length<32||value.token.length>512)throw new Error('Informe o endereço e sua chave individual da comunidade.')
      const url=new URL(value.url)
      if(!['http:','https:'].includes(url.protocol)||(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))||url.username||url.password)throw new Error('Use HTTPS ou um serviço local neste computador.')
      if(!safeStorage.isEncryptionAvailable())throw new Error('Proteção de credenciais indisponível.')
      const owner=getUsername()
      const response=await fetch(new URL('/identity',url),{headers:{Authorization:'Bearer '+value.token},signal:AbortSignal.timeout(10000)})
      const identity=await response.json()
      if(!response.ok||identity.username!==owner||getUsername()!==owner)throw new Error('A chave da comunidade não corresponde à sua conta ConTALK.')
      stream?.abort()
      fs.writeFileSync(configPath(),safeStorage.encryptString(JSON.stringify({url:url.origin,token:value.token})))
    },
    'community-snapshot':async(serverId:string)=>{if(!validId(serverId))throw new Error('Servidor inválido.');return request(`/servers/${serverId}`)},
    'community-invite-preview':async(code:string)=>{if(!validInviteCode(code))throw new Error('Convite inválido.');return request(`/invites/${code}`)},
    'community-invite-accept':async(code:string)=>{if(!validInviteCode(code))throw new Error('Convite inválido.');return request(`/invites/${code}/accept`,{})},
    'community-presence-token':async(name:string)=>{if(typeof name!=='string'||!name.trim()||name.trim().length>40)throw new Error('Nome de exibição inválido.');return request('/presence-token',{name:name.trim()})},
    'community-expression-libraries':()=>request('/expression-libraries'),
    'community-expressions':(serverId:string)=>{if(!validId(serverId))throw new Error('Servidor inválido.');return request('/servers/'+serverId+'/expressions')},
    'community-webhook':async(serverId:string,revision:number,action:import('../src/roles/webhooks').WebhookCommand)=>{if(!validId(serverId)||!Number.isSafeInteger(revision)||revision<0||!action||JSON.stringify(action).length>2000)throw new Error('Operação de integração inválida.');return request('/servers/'+serverId+'/webhooks',{revision,action})},
    'community-message':async(serverId:string,channelId:string,messageId:string)=>{if(!validId(serverId)||!validId(channelId)||!validId(messageId))throw new Error('Mensagem inválida.');return request(`/servers/${serverId}/messages/${channelId}/${messageId}`)},
    'community-insights':async(serverId:string,days:number,timeZone:string)=>{if(!validId(serverId)||![7,30].includes(days)||typeof timeZone!=='string'||timeZone.length>100)throw new Error('Consulta de estatísticas inválida.');return request(`/servers/${serverId}/insights?days=${days}&timeZone=${encodeURIComponent(timeZone)}`)},
    'community-pins':async(serverId:string,channelId:string)=>{if(!validId(serverId)||!validId(channelId))throw new Error('Canal inválido.');return request(`/servers/${serverId}/pins/${channelId}`)},
    'community-history':async(serverId:string,channelId:string,before?:string)=>{if(!validId(serverId)||!validId(channelId)||(before!==undefined&&!validId(before)))throw new Error('Histórico inválido.');return request(`/servers/${serverId}/history/${channelId}${before?'?before='+encodeURIComponent(before):''}`)},
    'community-command':async(serverId:string,revision:number,action:CommunityAction)=>{if(!validId(serverId)||!Number.isSafeInteger(revision)||revision<0)throw new Error('Revisão da comunidade inválida.');const serialized=JSON.stringify(action);if(!serialized||serialized.length>100000)throw new Error('Comando inválido.');return request(`/servers/${serverId}/commands`,{revision,action})},
    'community-voice-token':async(serverId:string,channelId:string)=>{if(!validId(serverId)||!validId(channelId))throw new Error('Canal inválido.');return request(`/servers/${serverId}/voice-token`,{channelId})},
    'community-occupants':async(serverId:string)=>{if(!validId(serverId))throw new Error('Servidor inválido.');return request(`/servers/${serverId}/occupants`)},
    'community-subscribe':(serverId:string)=>{if(!validId(serverId))throw new Error('Servidor inválido.');config();stream?.abort();stream=new AbortController();void subscribe(serverId,getUsername()!,stream)},
    'community-unsubscribe':()=>{stream?.abort();stream=undefined},
  }
  for(const [channel,handler]of Object.entries(handlers))ipcMain.handle(channel,(event,...args)=>{if(event.sender!==contents||event.senderFrame!==contents.mainFrame)throw new Error('Origem inválida.');if(!getUsername())throw new Error('Entre no ConTALK.');return handler(...args)})
  window.once('closed',()=>{stream?.abort();aiStream?.abort();selectedAiFiles.clear();for(const channel of Object.keys(handlers))ipcMain.removeHandler(channel)})
}
