import { useEffect, useState } from 'react'
import { useRoleStore } from '../store/useRoleStore'
import { useVoiceStore } from '../store/useVoiceStore'
import { canSetVoiceStatus } from '../roles/voice-status'

export function VoiceStatusSettings({channelId}:{channelId:string}){
  const roles=useRoleStore(),voice=useVoiceStore(),snapshot=roles.snapshot
  const channel=snapshot?.channels.find(channel=>channel.id===channelId&&channel.type==='voice')
  const [base,setBase]=useState({value:channel?.voiceStatus||'',updatedAt:channel?.voiceStatusUpdatedAt||0}),[value,setValue]=useState(channel?.voiceStatus||''),[error,setError]=useState(''),[status,setStatus]=useState('')
  useEffect(()=>{if(value===base.value){setValue(channel?.voiceStatus||'');setBase({value:channel?.voiceStatus||'',updatedAt:channel?.voiceStatusUpdatedAt||0})}},[channel?.voiceStatus,channel?.voiceStatusUpdatedAt])
  if(!snapshot||!channel)return null
  const connected=voice.connectionStatus==='connected'&&voice.activeChannelId===channelId&&voice.currentRoom?.localParticipant.identity===snapshot.actor
  const allowed=canSetVoiceStatus(snapshot.policy,snapshot.actor,channelId,connected)
  const conflict=(channel.voiceStatusUpdatedAt||0)!==base.updatedAt||(channel.voiceStatus||'')!==base.value,ready=allowed&&roles.status==='connected'&&!roles.busy&&!conflict
  return <section className="ct-voice-status-settings" aria-label="Status do canal de voz"><h3>Status do canal de voz</h3><p>Mostre o assunto da conversa sem alterar o nome da sala.</p>
    <form onSubmit={async event=>{event.preventDefault();if(!ready)return;setError('');setStatus('');try{await roles.command({type:'voice-status',channelId,status:value});const current=useRoleStore.getState().snapshot?.channels.find(item=>item.id===channelId);if(current){setValue(current.voiceStatus||'');setBase({value:current.voiceStatus||'',updatedAt:current.voiceStatusUpdatedAt||0});setStatus(current.voiceStatus?'Status atualizado.':'Status removido.')}}catch(error){setError(error instanceof Error?error.message:'Não foi possível salvar o status.')}}}>
      <label>Status<input aria-label="Status do canal de voz" value={value} disabled={!ready} maxLength={500} placeholder="Sobre o que estão conversando?" onChange={event=>{setValue(event.target.value);setStatus('')}}/></label><small>{value.length}/500</small>
      <button className="ct-primary ct-btn-prominent" disabled={!ready||value.trim()===base.value}>{value.trim()?'Salvar status':'Remover status'}</button>
    </form>
    {!allowed&&<p className="ct-muted">É necessário Definir status do canal de voz e estar conectado à sala. Para alterar de fora da chamada, também é necessário Gerenciar canais. Seu rascunho foi mantido.</p>}
    {conflict&&<p role="alert">O status mudou enquanto você editava. Seu rascunho foi mantido. <button onClick={()=>{setValue(channel.voiceStatus||'');setBase({value:channel.voiceStatus||'',updatedAt:channel.voiceStatusUpdatedAt||0});setError('');setStatus('')}}>Carregar status atual</button></p>}
    {status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}
  </section>
}
