import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import type { CommunitySnapshot, CommunityAction } from '../src/roles/types'
import { validInviteCode } from '../src/roles/invites'
import { aiFileMime,aiProviders,validAiEndpoint,validAiModel,aiModelId,type AiProviderId } from '../src/roles/ai'

const validId = (value:unknown):value is string => typeof value==='string' && /^[\w:-]{1,100}$/.test(value) && !['__proto__','constructor','prototype'].includes(value)
// The app always talks to the central ConTALK community; people only create an account or sign in.
// CONTALK_COMMUNITY_URL only exists for local development against a test backend.
const COMMUNITY_URL = (typeof process !== 'undefined' && process.env.CONTALK_COMMUNITY_URL) || 'https://comunidade.contalapps.com.br'
type CommunityConfig = { url: string; token: string }
const configFile = (owner: string) => path.join(app.getPath('userData'), 'community-' + createHash('sha256').update(owner).digest('hex') + '.enc')
export function readCommunityConfig(owner: string | null): CommunityConfig | null {
  if (!owner || !safeStorage.isEncryptionAvailable() || !fs.existsSync(configFile(owner))) return null
  try { return JSON.parse(safeStorage.decryptString(fs.readFileSync(configFile(owner)))) } catch { return null }
}
function storeSession(owner: string, token: string) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Proteção de credenciais do sistema indisponível.')
  fs.writeFileSync(configFile(owner), safeStorage.encryptString(JSON.stringify({ url: COMMUNITY_URL, token })))
}
async function accountRequest(route: 'login' | 'register', body: Record<string, unknown>) {
  let response: Response
  try { response = await fetch(new URL('/' + route, COMMUNITY_URL), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) }) }
  catch { throw new Error('Não foi possível falar com o servidor do ConTALK. Verifique sua conexão.') }
  const data = await response.json().catch(() => ({})) as { username?: string; email?: string; token?: string; error?: string }
  if (!response.ok || !data.token || !data.username) throw new Error(data.error || 'Não foi possível acessar sua conta.')
  storeSession(data.username, data.token)
  return { username: data.username, email: data.email || '' }
}
// Accounts exist only on the server: creating one and signing in always go there.
export const signUpCommunity = (username: string, email: string, password: string) => accountRequest('register', { username, email, password })
export const signInCommunity = (identifier: string, password: string) => accountRequest('login', { identifier, password })
export async function signOutCommunity(owner: string) {
  const saved = readCommunityConfig(owner)
  if (fs.existsSync(configFile(owner))) fs.unlinkSync(configFile(owner))
  if (saved) await fetch(new URL('/logout', saved.url), { method: 'POST', headers: { Authorization: 'Bearer ' + saved.token }, signal: AbortSignal.timeout(5000) }).catch(() => {})
}
export function setupCommunity(window:BrowserWindow,getUsername:()=>string|null) {
  const contents=window.webContents
  let stream:AbortController|undefined
  let aiStream:AbortController|undefined
  const selectedAiFiles=new Map<string,{file:string;owner:string;size:number;type:string}>()
  const config=():CommunityConfig=>{
    const owner=getUsername()
    if(!owner)throw new Error('Entre no ConTALK.')
    const saved=readCommunityConfig(owner)
    if(!saved)throw new Error('Sua sessão terminou. Saia e entre novamente.')
    return saved
  }
  const aiPath=()=>path.join(app.getPath('userData'),'ai-'+createHash('sha256').update(getUsername()||'').digest('hex')+'.enc')
  const aiConfig=():{keys:Partial<Record<AiProviderId,string>>;contextTokens:number;maxOutputTokens:number}|null=>{
    if(!getUsername()||!safeStorage.isEncryptionAvailable()||!fs.existsSync(aiPath()))return null
    const saved=JSON.parse(safeStorage.decryptString(fs.readFileSync(aiPath())))
    return {keys:saved.keys||{openai:saved.key},contextTokens:saved.contextTokens||8192,maxOutputTokens:saved.maxOutputTokens||2048}
  }
  const request=async(route:string,body?:unknown,timeout=15000)=>{
    const owner=getUsername()
    const {url,token}=config()
    const response=await fetch(new URL(route,url),{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(timeout)})
    const result=await response.json()
    if(getUsername()!==owner)throw new Error('A conta foi alterada durante a solicitação.')
    if(response.status===401)throw new Error('Sua sessão na comunidade expirou. Saia e entre novamente.')
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
    'community-status':()=>{const owner=getUsername();return owner&&readCommunityConfig(owner)?{configured:true,url:COMMUNITY_URL}:{configured:false,url:COMMUNITY_URL}},
    'community-servers':async()=>(await request('/identity')).servers as Array<{id:string;name:string}>,
    'community-create-server':async(name:string)=>{if(typeof name!=='string'||!name.trim()||name.trim().length>60)throw new Error('Use um nome de 1 a 60 caracteres.');return request('/servers',{name:name.trim()})},
    'community-ai-status':()=>{const value=aiConfig();return {configured:!!value?.keys.openai,providers:aiProviders.filter(provider=>!!value?.keys[provider]),contextTokens:value?.contextTokens||8192,maxOutputTokens:value?.maxOutputTokens||2048}},
    'community-ai-configure':(value:{provider?:AiProviderId;key?:string;contextTokens:number;maxOutputTokens:number})=>{
      if(!value||!Number.isInteger(value.contextTokens)||value.contextTokens<1024||value.contextTokens>32768||!Number.isInteger(value.maxOutputTokens)||value.maxOutputTokens<128||value.maxOutputTokens>8192)throw new Error('Defina limites válidos para o uso da IA.')
      const provider=value.provider||'openai';if(!aiProviders.includes(provider))throw new Error('Provedor de IA inválido.')
      const previous=aiConfig(),key=value.key?.trim()||previous?.keys[provider]
      if(!key||key.length<8||key.length>512)throw new Error('Informe uma chave pessoal deste provedor.')
      if(!safeStorage.isEncryptionAvailable())throw new Error('Proteção de credenciais indisponível.')
      const keys={...previous?.keys,[provider]:key}
      fs.writeFileSync(aiPath(),safeStorage.encryptString(JSON.stringify({keys,contextTokens:value.contextTokens,maxOutputTokens:value.maxOutputTokens})))
      return {configured:true,providers:aiProviders.filter(item=>!!keys[item]),contextTokens:value.contextTokens,maxOutputTokens:value.maxOutputTokens}
    },
    'community-ai-remove':(provider?:AiProviderId)=>{if(provider&&!aiProviders.includes(provider))throw new Error('Provedor inválido.');const file=aiPath(),saved=aiConfig();if(provider&&saved){delete saved.keys[provider];if(Object.values(saved.keys).some(Boolean))fs.writeFileSync(file,safeStorage.encryptString(JSON.stringify(saved)));else if(fs.existsSync(file))fs.unlinkSync(file)}else if(fs.existsSync(file))fs.unlinkSync(file);selectedAiFiles.clear()},
    'community-ai-models':async(provider:AiProviderId,endpoint?:string)=>{
      if(!aiProviders.includes(provider))throw new Error('Provedor de IA inválido.')
      if(provider.startsWith('compatible-')?!validAiEndpoint(endpoint):endpoint!==undefined)throw new Error('Endpoint de IA inválido.')
      const key=aiConfig()?.keys[provider];if(!key)throw new Error('Configure sua chave pessoal de '+provider+' nas Configurações.')
      return request('/ai-models',{provider,key,endpoint},25000)
    },
    'community-ai-select-files':async()=>{
      const owner=getUsername()!,result=await dialog.showOpenDialog(window,{title:'Anexar arquivos à solicitação de IA',properties:['openFile','multiSelections']})
      if(result.canceled)return []
      if(result.filePaths.length>20)throw new Error('Selecione até 20 arquivos.')
      for(const [id,item]of selectedAiFiles)if(item.owner===owner)selectedAiFiles.delete(id)
      let total=0;const items=[]
      for(const file of result.filePaths){const type=aiFileMime(path.basename(file)),size=fs.statSync(file).size;total+=size;if(!type)throw new Error('A IA não aceita '+path.basename(file)+'. Selecione um formato compatível.');if(!size||total>50*1024*1024)throw new Error('Os anexos devem somar no máximo 50 MB.');const id=randomUUID();selectedAiFiles.set(id,{file,owner,size,type});items.push({id,name:path.basename(file),size,type})}
      return items
    },
    'community-ai-start':async(serverId:string,channelId:string,text:string,fileIds:string[],limits?:{contextTokens:number;maxOutputTokens:number},provider:AiProviderId='openai',model?:string)=>{
      if(!validId(serverId)||!validId(channelId)||typeof text!=='string'||!Array.isArray(fileIds)||fileIds.length>20)throw new Error('Solicitação de IA inválida.')
      if(!aiProviders.includes(provider))throw new Error('Provedor de IA inválido.')
      if(model!==undefined&&(typeof model!=='string'||!validAiModel(aiModelId(provider,model))))throw new Error('Modelo de IA inválido.')
      const owner=getUsername(),settings=aiConfig(),key=settings?.keys[provider];if(!settings||!key)throw new Error('Configure sua chave pessoal de '+provider+' nas Configurações.')
      const contextTokens=limits?.contextTokens??settings.contextTokens,maxOutputTokens=limits?.maxOutputTokens??settings.maxOutputTokens
      if(!Number.isInteger(contextTokens)||contextTokens<1024||contextTokens>32768||!Number.isInteger(maxOutputTokens)||maxOutputTokens<128||maxOutputTokens>8192)throw new Error('Defina limites válidos para esta solicitação.')
      let total=0;const files=fileIds.map(id=>{const item=selectedAiFiles.get(id);if(!item||item.owner!==owner||!fs.existsSync(item.file))throw new Error('Selecione os arquivos novamente.');const data=fs.readFileSync(item.file);total+=data.length;if(total>50*1024*1024||data.length!==item.size)throw new Error('Os arquivos mudaram ou excedem 50 MB.');return {name:path.basename(item.file),type:item.type,size:data.length,data:data.toString('base64')}})
      const result=await request(`/servers/${serverId}/ai-runs`,{channelId,text,files,key,provider,model,contextTokens,maxOutputTokens},120000)
      for(const id of fileIds)selectedAiFiles.delete(id)
      return result
    },
    'community-ai-generate-image':async(prompt:string,provider:AiProviderId='openai',model?:string)=>{
      if(typeof prompt!=='string'||!prompt.trim())throw new Error('Informe a descrição para gerar a imagem.')
      const settings=aiConfig()
      if(!settings)throw new Error('Nenhuma chave de IA configurada nas Configurações.')
      const chosenProvider:AiProviderId=settings.keys[provider]?provider:settings.keys.openai?'openai':settings.keys.gemini?'gemini':(Object.keys(settings.keys).find(k=>!!settings.keys[k as AiProviderId]) as AiProviderId)
      const key=settings.keys[chosenProvider]
      if(!key)throw new Error(`Configure sua chave pessoal de ${chosenProvider} nas Configurações.`)
      if(chosenProvider==='openai'){
        const imgModel=model&&/dall-e-2/i.test(model)?'dall-e-2':'dall-e-3'
        const size=imgModel==='dall-e-2'?'512x512':'1024x1024'
        const res=await fetch('https://api.openai.com/v1/images/generations',{
          method:'POST',
          headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
          body:JSON.stringify({model:imgModel,prompt:prompt.trim(),n:1,size,response_format:'b64_json'})
        })
        if(!res.ok)throw new Error(`A OpenAI não gerou a imagem (HTTP ${res.status}).`)
        const data=await res.json()
        const item=data.data?.[0]
        const src=item?.b64_json?`data:image/png;base64,${item.b64_json}`:item?.url
        if(!src)throw new Error('A OpenAI não retornou imagem válida.')
        return {src,prompt:item?.revised_prompt||prompt.trim(),provider:'openai',model:imgModel}
      }else if(chosenProvider==='gemini'){
        const imgModel=model||'imagen-3.0-generate-002'
        const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(imgModel)}:predict`,{
          method:'POST',
          headers:{'x-goog-api-key':key,'Content-Type':'application/json'},
          body:JSON.stringify({instances:[{prompt:prompt.trim()}],parameters:{sampleCount:1,aspectRatio:'1:1',outputMimeType:'image/jpeg'}})
        })
        if(!res.ok)throw new Error(`O Gemini não gerou a imagem (HTTP ${res.status}).`)
        const data=await res.json()
        const pred=data.predictions?.[0]
        if(!pred?.bytesBase64Encoded)throw new Error('O Gemini não retornou imagem válida.')
        const mime=pred.mimeType||'image/jpeg'
        return {src:`data:${mime};base64,${pred.bytesBase64Encoded}`,prompt:prompt.trim(),provider:'gemini',model:imgModel}
      }
      throw new Error(`O provedor ${chosenProvider} não possui geração de imagens disponível.`)
    },
    'community-ai-stop':(serverId:string,channelId:string,runId?:string)=>{if(!validId(serverId)||!validId(channelId)||(runId&&!validId(runId)))throw new Error('Execução inválida.');return request(`/servers/${serverId}/ai-runs/${channelId}/stop`,runId?{runId}:{})},
    'community-ai-subscribe':(serverId:string,channelId:string)=>{if(!validId(serverId)||!validId(channelId))throw new Error('Conversa inválida.');config();aiStream?.abort();aiStream=new AbortController();void subscribeAi(serverId,channelId,getUsername()!,aiStream)},
    'community-ai-unsubscribe':()=>{aiStream?.abort();aiStream=undefined},
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
