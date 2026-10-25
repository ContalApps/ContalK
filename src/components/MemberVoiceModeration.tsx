import { useEffect, useState } from 'react'
import { useRoleStore } from '../store/useRoleStore'
import { useVoiceStore } from '../store/useVoiceStore'
import { can } from '../roles/permissions'
import { canModerateVoice } from '../roles/voice-moderation'
import type { CommunityAction } from '../roles/types'

export function MemberVoiceModeration({member}:{member:string}){
  const state=useRoleStore(),voice=useVoiceStore()
  const [pending,setPending]=useState<CommunityAction|null>(null),[reason,setReason]=useState(''),[destination,setDestination]=useState(''),[error,setError]=useState('')
  const snapshot=state.snapshot
  useEffect(()=>{
    if(!snapshot)return
    const refresh=()=>void useVoiceStore.getState().fetchChannelOccupants(snapshot.channels.filter(channel=>channel.type==='voice'))
    refresh();const timer=setInterval(refresh,4000);return()=>clearInterval(timer)
  },[snapshot?.id])
  if(!snapshot)return null
  const {policy,actor}=snapshot
  const channel=snapshot.channels.find(channel=>channel.type==='voice'&&voice.channelOccupants[channel.id]?.some(person=>person.identity===member))
  if(!channel)return null
  const allowed=(permission:'MUTE_MEMBERS'|'DEAFEN_MEMBERS'|'MOVE_MEMBERS')=>canModerateVoice(policy,actor,member,permission,channel.id)
  if(!allowed('MUTE_MEMBERS')&&!allowed('DEAFEN_MEMBERS')&&!allowed('MOVE_MEMBERS'))return null
  const flags=policy.voiceRestrictions?.[member]||{muted:false,deafened:false}
  const destinations=snapshot.channels.filter(target=>target.type==='voice'&&target.id!==channel.id&&canModerateVoice(policy,actor,member,'MOVE_MEMBERS',target.id)&&can(policy,actor,'CONNECT',target.id)&&can(policy,member,'VIEW_CHANNEL',target.id)&&can(policy,member,'CONNECT',target.id))
  const ready=state.status==='connected'&&!state.busy
  const request=(action:CommunityAction)=>{setPending(action);setReason('');setError('')}
  const confirm=async()=>{
    if(!pending)return
    try{await state.command({...pending,reason} as CommunityAction);setPending(null)}catch(error){setError(error instanceof Error?error.message:'Não foi possível moderar a voz.')}
  }
  const label=pending?.type==='voice-move'?(pending.destinationId?'Mover para outro canal':'Desconectar da voz'):pending?.type==='voice-mute'?(pending.enabled?'Bloquear microfone no servidor':'Remover bloqueio do microfone'):pending?.type==='voice-deafen'?(pending.enabled?'Bloquear recepção de áudio':'Remover bloqueio da recepção'):''
  return <section className="ct-member-moderation" aria-label="Moderação de voz"><h3>Voz · {channel.name}</h3>
    <p className="ct-muted">{flags.deafened?'Recepção de áudio bloqueada. ':''}{flags.muted?'Microfone bloqueado. ':''}Remover um bloqueio não liga o microfone da pessoa.</p>
    {pending?<div role="alertdialog" aria-label="Confirmar moderação de voz"><p>{label} de @{member}?</p>{pending.type==='voice-move'&&pending.destinationId&&<p>A câmera e o compartilhamento serão encerrados ao trocar de sala.</p>}<label>Motivo opcional<textarea aria-label="Motivo da moderação de voz" maxLength={512} value={reason} onChange={event=>setReason(event.target.value)}/></label><button autoFocus disabled={!ready} onClick={()=>setPending(null)}>Cancelar</button><button disabled={!ready} onClick={()=>void confirm()}>Confirmar ação de voz</button></div>:<>
      {allowed('MUTE_MEMBERS')&&<button disabled={!ready} onClick={()=>request({type:'voice-mute',member,channelId:channel.id,enabled:!flags.muted})}>{flags.muted?'Remover bloqueio do microfone…':'Bloquear microfone no servidor…'}</button>}
      {allowed('DEAFEN_MEMBERS')&&<button disabled={!ready} onClick={()=>request({type:'voice-deafen',member,channelId:channel.id,enabled:!flags.deafened})}>{flags.deafened?'Remover bloqueio da recepção…':'Bloquear recepção de áudio…'}</button>}
      {allowed('MOVE_MEMBERS')&&<><select aria-label="Canal de destino" value={destination} onChange={event=>setDestination(event.target.value)}><option value="">Escolher destino…</option>{destinations.map(target=><option key={target.id} value={target.id}>{target.name}</option>)}</select><button disabled={!ready||!destinations.some(target=>target.id===destination)} onClick={()=>request({type:'voice-move',member,channelId:channel.id,destinationId:destination})}>Mover membro…</button><button disabled={!ready} onClick={()=>request({type:'voice-move',member,channelId:channel.id,destinationId:null})}>Desconectar da voz…</button></>}
    </>}{error&&<p role="alert">{error}</p>}
  </section>
}
