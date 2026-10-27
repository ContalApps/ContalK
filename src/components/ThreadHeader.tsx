import { ControlIcon } from './ControlIcon'
import { useRoleStore } from '../store/useRoleStore'
import { can, threadArchived } from '../roles/permissions'
import { useState } from 'react'

export function ThreadHeader({id,onParent}:{id:string;onParent:()=>void}){
  const state=useRoleStore(),snapshot=state.snapshot,[error,setError]=useState('')
  const thread=snapshot?.policy.threads?.[id]
  if(!snapshot||!thread)return null
  const archived=threadArchived(thread,snapshot.serverNow),member=thread.members.includes(snapshot.actor),manage=can(snapshot.policy,snapshot.actor,'MANAGE_THREADS',id),ready=!state.busy&&state.status==='connected'
  const reopen=manage||!thread.locked&&(member||thread.ownerId===snapshot.actor)
  return <div className="ct-thread-header"><button onClick={onParent}><ControlIcon name="back"/> Canal principal</button><span>{thread.private?'Privado':'Público'} · {thread.members.length} participantes{thread.locked?' · Bloqueado':''}{archived?' · Arquivado':''}</span>{archived?reopen&&<button disabled={!ready} onClick={()=>void state.command({type:'thread-edit',id,patch:{archived:false}}).catch(error=>setError(error.message))}>Reabrir tópico</button>:<button disabled={!ready} onClick={()=>void state.command({type:'thread-member',id,member:snapshot.actor,enabled:!member}).catch(error=>setError(error.message))}>{member?'Deixar de acompanhar':'Acompanhar tópico'}</button>}{archived&&!thread.locked&&can(snapshot.policy,snapshot.actor,'SEND_MESSAGES',id)&&<small>Enviar uma mensagem reabre este tópico.</small>}{error&&<p role="alert">{error}</p>}</div>
}
