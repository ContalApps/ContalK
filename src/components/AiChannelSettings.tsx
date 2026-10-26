import {useEffect,useState} from 'react'
import {can} from '../roles/permissions'
import {useRoleStore} from '../store/useRoleStore'
import {aiModelId,aiProviderName,aiProviders,parseAiModel,validAiEndpoint,validAiModel,type AiProviderId} from '../roles/ai'

export function AiChannelSettings({channelId}:{channelId:string}){
  const state=useRoleStore(),snapshot=state.snapshot,channel=snapshot?.channels.find(item=>item.id===channelId)
  const initial=parseAiModel(channel?.aiModel)
  const [provider,setProvider]=useState<AiProviderId>(initial?.provider||'openai'),[model,setModel]=useState(initial?.model||''),[endpoint,setEndpoint]=useState(channel?.aiEndpoint||''),[status,setStatus]=useState('')
  useEffect(()=>{const parsed=parseAiModel(channel?.aiModel);setProvider(parsed?.provider||'openai');setModel(parsed?.model||'');setEndpoint(channel?.aiEndpoint||'')},[channel?.aiModel,channel?.aiEndpoint,channelId])
  const manage=!!snapshot&&can(snapshot.policy,snapshot.actor,'MANAGE_CHANNELS',channelId),custom=provider.startsWith('compatible-')
  const id=aiModelId(provider,model.trim()),invalid=!!model.trim()&&(!validAiModel(id)||custom&&!validAiEndpoint(endpoint.trim()))
  return <section className="ct-settings-preferences"><div className="ct-settings-section-title"><h2>Inteligência artificial</h2><span>Escolha o provedor e o modelo do canal. Cada participante usa sua própria chave.</span></div>
    <form onSubmit={event=>{event.preventDefault();setStatus('');void state.command({type:'ai-channel-model',channelId,model:model.trim()?id:null,endpoint:custom?endpoint.trim():null}).then(()=>setStatus('IA do canal atualizada.')).catch(error=>setStatus(error.message))}}>
      <label>Provedor<select aria-label="Provedor de IA do canal" value={provider} onChange={event=>setProvider(event.target.value as AiProviderId)} disabled={!manage||state.busy}>{aiProviders.map(item=><option key={item} value={item}>{aiProviderName[item]}</option>)}</select></label>
      <label>Identificador do modelo<input aria-label="Modelo de IA do canal" placeholder="Modelo informado pelo provedor" value={model} onChange={event=>setModel(event.target.value)} disabled={!manage||state.busy}/></label>
      {custom&&<label>Endpoint HTTPS da API<input aria-label="Endpoint da API do canal" placeholder="https://api.exemplo.com/v1" value={endpoint} onChange={event=>setEndpoint(event.target.value)} disabled={!manage||state.busy}/></label>}
      <button className="ct-primary" disabled={!manage||state.busy||invalid}>{state.busy?'Salvando…':'Salvar IA'}</button>
    </form>
    <p role="status">{status||(custom?'O host do endpoint precisa ser autorizado na VPS. Deixe o modelo vazio para desativar a IA.':'Deixe o modelo vazio para desativar a IA neste canal.')}</p>
  </section>
}
