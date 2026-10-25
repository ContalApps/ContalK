import {useEffect,useState} from 'react'
import {can} from '../roles/permissions'
import {useRoleStore} from '../store/useRoleStore'
import {validAiModel} from '../roles/ai'

export function AiChannelSettings({channelId}:{channelId:string}){
  const state=useRoleStore(),snapshot=state.snapshot,channel=snapshot?.channels.find(item=>item.id===channelId)
  const [model,setModel]=useState(channel?.aiModel||''),[status,setStatus]=useState('')
  useEffect(()=>setModel(channel?.aiModel||''),[channel?.aiModel,channelId])
  const manage=!!snapshot&&can(snapshot.policy,snapshot.actor,'MANAGE_CHANNELS',channelId)
  return <section className="ct-settings-preferences"><div className="ct-settings-section-title"><h2>Inteligência artificial</h2><span>Ative uma IA neste canal. Cada participante usa sua própria chave.</span></div><form onSubmit={event=>{event.preventDefault();setStatus('');void state.command({type:'ai-channel-model',channelId,model:model.trim()||null}).then(()=>setStatus('Modelo do canal atualizado.')).catch(error=>setStatus(error.message))}}><label>Identificador do modelo OpenAI<input aria-label="Modelo de IA do canal" placeholder="Informe um modelo compatível com Responses API" value={model} onChange={event=>setModel(event.target.value)} disabled={!manage||state.busy}/></label><button className="ct-primary" disabled={!manage||state.busy||!!model.trim()&&!validAiModel(model.trim())}>{state.busy?'Salvando…':'Salvar modelo'}</button></form><p role="status">{status||'Deixe vazio e salve para desativar a IA neste canal. Os projetos existentes ficam preservados.'}</p></section>
}
