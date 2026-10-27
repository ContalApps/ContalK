import {useEffect,useState} from 'react'
import {can} from '../roles/permissions'
import {parseAiModel} from '../roles/ai'
import {useRoleStore} from '../store/useRoleStore'
import type {Channel} from '../store/useAppStore'
import {AiCredentialEditor} from './AiCredentialEditor'

const initialEndpoints=(channel?:Channel):NonNullable<Channel['aiEndpoints']>=>{
  const endpoints={...channel?.aiEndpoints},provider=parseAiModel(channel?.aiModel)?.provider
  if((provider==='compatible-chat'||provider==='compatible-responses')&&channel?.aiEndpoint&&!endpoints[provider])endpoints[provider]=channel.aiEndpoint
  return endpoints
}
export function AiChannelSettings({channelId}:{channelId:string}){
  const state=useRoleStore(),snapshot=state.snapshot,channel=snapshot?.channels.find(item=>item.id===channelId)
  const [enabled,setEnabled]=useState(channel?.aiEnabled??!!channel?.aiModel),[endpoints,setEndpoints]=useState(initialEndpoints(channel)),[status,setStatus]=useState('')
  useEffect(()=>{setEnabled(channel?.aiEnabled??!!channel?.aiModel);setEndpoints(initialEndpoints(channel))},[channelId,channel?.aiEnabled,channel?.aiModel,channel?.aiEndpoint,channel?.aiEndpoints])
  const manage=!!snapshot&&can(snapshot.policy,snapshot.actor,'MANAGE_CHANNELS',channelId)
  return <section className="ct-settings-preferences"><div className="ct-settings-section-title"><h2>Inteligência artificial</h2><span>Os modelos são escolhidos por cada pessoa na conversa.</span></div>
    <label className="ct-ai-enable"><input type="checkbox" checked={enabled} disabled={!manage||state.busy} onChange={event=>setEnabled(event.target.checked)}/> Ativar IA neste canal</label>
    {enabled&&<AiCredentialEditor endpoints={endpoints} onEndpoints={setEndpoints}/>}
    <button className="ct-primary" type="button" disabled={!manage||state.busy} onClick={()=>{setStatus('');void state.command({type:'ai-channel-settings',channelId,enabled,endpoints}).then(()=>setStatus('IA do canal atualizada.')).catch(error=>setStatus(error.message))}}>{state.busy?'Salvando…':'Salvar canal'}</button>
    <p role="status">{status}</p>
  </section>
}
