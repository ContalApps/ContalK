import {useEffect,useState} from 'react'
import {aiProviders,aiProviderName,validAiEndpoint,type AiProviderId} from '../roles/ai'
import type {Channel} from '../store/useAppStore'

export function AiCredentialEditor({endpoints,onEndpoints}:{endpoints:NonNullable<Channel['aiEndpoints']>;onEndpoints:(value:NonNullable<Channel['aiEndpoints']>)=>void}){
  const [provider,setProvider]=useState<AiProviderId>('openai'),[key,setKey]=useState(''),[configured,setConfigured]=useState<AiProviderId[]>([]),[busy,setBusy]=useState(false),[status,setStatus]=useState('')
  const [limits,setLimits]=useState({contextTokens:8192,maxOutputTokens:2048})
  useEffect(()=>{void window.contalkDesktop?.communityAiStatus().then(value=>{setConfigured(value.providers);setLimits({contextTokens:value.contextTokens,maxOutputTokens:value.maxOutputTokens})}).catch(()=>setStatus('Não foi possível ler suas APIs.'))},[])
  const custom=provider==='compatible-chat'||provider==='compatible-responses'
  const endpoint=custom?endpoints[provider]||'':''
  const save=async()=>{
    if(!window.contalkDesktop)return
    setBusy(true);setStatus('')
    try{
      if(custom&&!validAiEndpoint(endpoint))throw new Error('Informe o endpoint HTTPS da API compatível.')
      const result=await window.contalkDesktop.communityAiConfigure({provider,...(key.trim()?{key:key.trim()}:{}),...limits})
      setConfigured(result.providers);setKey('')
      try{const list=await window.contalkDesktop.communityAiModels(provider,custom?endpoint:undefined);setStatus(`${aiProviderName[provider]} conectada: ${list.models.length} modelos encontrados. Escolha o modelo na conversa.`)}
      catch(error){setStatus('Chave salva. '+(error instanceof Error?error.message:'Não foi possível consultar modelos.'))}
    }catch(error){setStatus(error instanceof Error?error.message:'Não foi possível salvar a API.')}
    finally{setBusy(false)}
  }
  return <div className="ct-ai-credentials" onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();if(!busy&&(key.trim()||configured.includes(provider)))void save()}}}>
    <p>Conecte uma ou mais APIs pessoais. Cada participante usa suas próprias chaves.</p>
    <label>API<select aria-label="API de IA" value={provider} onChange={event=>{setProvider(event.target.value as AiProviderId);setKey('');setStatus('')}}>{aiProviders.map(item=><option key={item} value={item}>{aiProviderName[item]}{configured.includes(item)?' · conectada':''}</option>)}</select></label>
    {custom&&<label>Endpoint HTTPS<input aria-label="Endpoint da API compatível" placeholder="https://api.exemplo.com/v1" value={endpoint} onChange={event=>{const value={...endpoints};if(event.target.value)value[provider]=event.target.value;else delete value[provider];onEndpoints(value)}}/><small>O host precisa estar autorizado na VPS.</small></label>}
    <label>Chave pessoal<input type="password" autoComplete="off" aria-label="Chave pessoal da API" value={key} placeholder={configured.includes(provider)?'Chave já configurada':'Cole sua chave'} onChange={event=>setKey(event.target.value)}/></label>
    <button type="button" disabled={busy||!window.contalkDesktop||!key.trim()&&!configured.includes(provider)} onClick={()=>void save()}>{busy?'Conectando…':configured.includes(provider)&&!key.trim()?'Consultar modelos':'Salvar API e consultar modelos'}</button>
    <small role="status">{status||'Você pode repetir para outras APIs ou configurá-las depois.'}</small>
  </div>
}
