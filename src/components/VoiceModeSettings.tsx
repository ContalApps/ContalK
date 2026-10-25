import {useState} from 'react'
import {useRoleStore} from '../store/useRoleStore'
import {can} from '../roles/permissions'

export function VoiceModeSettings({channelId}:{channelId:string}){
 const state=useRoleStore(),snapshot=state.snapshot,channel=snapshot?.channels.find(channel=>channel.id===channelId),mode=channel?.voiceMode||'conversation'
 const [draft,setDraft]=useState(mode),[base,setBase]=useState(mode),[confirm,setConfirm]=useState(false),[error,setError]=useState('')
 if(!snapshot||channel?.type!=='voice')return null
 const allowed=state.status==='connected'&&can(snapshot.policy,snapshot.actor,'MANAGE_CHANNELS',channelId),conflict=base!==mode
 const save=async()=>{setError('');try{await state.command({type:'channel-voice-mode',channelId,mode:draft});setBase(draft);setConfirm(false)}catch(error){setError(error instanceof Error?error.message:'Não foi possível alterar o modo.')}}
 return <section className="ct-voice-mode"><h3>Modo do canal</h3><label>Participação<select aria-label="Modo do canal de voz" disabled={!allowed||state.busy} value={draft} onChange={event=>{setDraft(event.target.value as typeof draft);setConfirm(false)}}><option value="conversation">Conversa livre</option><option value="stage">Palco e plateia</option></select></label><p>No palco, todos entram como plateia. Moderadores podem subir ou convidar pessoas; os demais podem pedir a fala.</p>{conflict&&<p role="status">O modo mudou em outro cliente. <button onClick={()=>{setBase(mode);setDraft(mode);setConfirm(false)}}>Carregar modo atual</button></p>}<button disabled={!allowed||state.busy||conflict||draft===mode} onClick={()=>setConfirm(true)}>Aplicar modo…</button>{confirm&&<div role="alertdialog" aria-label="Confirmar alteração do modo de voz"><p>Alterar o canal para {draft==='stage'?'palco e plateia':'conversa livre'}? Mudar para palco interrompe as publicações atuais; cada pessoa precisa subir ao palco antes de reativar seu microfone.</p><button disabled={state.busy} onClick={()=>setConfirm(false)}>Cancelar</button><button disabled={!allowed||state.busy||conflict} onClick={()=>void save()}>Alterar modo do canal</button></div>}{error&&<p role="alert">{error}</p>}</section>
}
