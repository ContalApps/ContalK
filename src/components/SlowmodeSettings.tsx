import { useEffect, useState } from 'react'
import { useRoleStore } from '../store/useRoleStore'
import { can } from '../roles/permissions'

export function SlowmodeSettings({channelId}:{channelId:string}){
  const state=useRoleStore(),snapshot=state.snapshot,current=snapshot?.channels.find(channel=>channel.id===channelId)?.slowmodeSeconds||0
  const [draft,setDraft]=useState(String(current)),[base,setBase]=useState(current),[error,setError]=useState(''),[message,setMessage]=useState('')
  const value=Number(draft),dirty=value!==base,conflict=dirty&&current!==base,valid=draft!==''&&Number.isInteger(value)&&value>=0&&value<=21600
  useEffect(()=>{if(!dirty&&current!==base){setDraft(String(current));setBase(current)}},[current,base,dirty])
  if(!snapshot?.channels.some(channel=>channel.id===channelId&&channel.type==='text'))return null
  const ready=state.status==='connected'&&!state.busy&&can(snapshot.policy,snapshot.actor,snapshot.channels.find(channel=>channel.id===channelId)?.parentId?'MANAGE_THREADS':'MANAGE_CHANNELS',channelId)
  const save=async()=>{setError('');setMessage('');try{await state.command({type:'channel-slowmode',channel:channelId,seconds:value});setBase(value);setMessage('Modo lento atualizado.')}catch(error){setError(error instanceof Error?error.message:'Não foi possível salvar o modo lento.')}}
  return <section className="ct-slowmode-settings" aria-label="Modo lento"><h3>Modo lento</h3><p>Intervalo entre mensagens de cada pessoa. Use 0 para desativar. Quem tem Ignorar modo lento pode enviar sem esperar.</p><form onSubmit={event=>{event.preventDefault();if(ready&&dirty&&valid&&!conflict)void save()}}><label>Intervalo em segundos<input aria-label="Intervalo do modo lento" type="number" min={0} max={21600} step={1} value={draft} disabled={!ready} onChange={event=>setDraft(event.target.value)}/></label><button className="ct-primary" disabled={!ready||!dirty||!valid||conflict}>Salvar modo lento</button></form>{conflict&&<p role="alert">O intervalo foi alterado enquanto você editava. <button onClick={()=>{setBase(current);setDraft(String(current))}}>Carregar intervalo atual</button></p>}{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}</section>
}
