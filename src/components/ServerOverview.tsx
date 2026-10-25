import { useEffect, useState } from 'react'
import { useRoleStore } from '../store/useRoleStore'
import { can } from '../roles/permissions'

export function ServerOverview(){
  const state=useRoleStore(),snapshot=state.snapshot!
  const current={name:snapshot.name,description:snapshot.description||''}
  const [draft,setDraft]=useState(current),[base,setBase]=useState(current),[error,setError]=useState(''),[message,setMessage]=useState('')
  const dirty=draft.name!==base.name||draft.description!==base.description,changed=current.name!==base.name||current.description!==base.description
  const conflict=dirty&&changed,allowed=can(snapshot.policy,snapshot.actor,'MANAGE_GUILD')
  useEffect(()=>{if(!dirty&&changed){setDraft(current);setBase(current)}},[dirty,changed,current.name,current.description])
  const valid=!!draft.name.trim()&&draft.name.trim().length<=100&&draft.description.trim().length<=300
  const save=async()=>{
    setError('');setMessage('')
    try{const patch={...(draft.name!==base.name?{name:draft.name}:{}),...(draft.description!==base.description?{description:draft.description}:{})};await state.command({type:'server-edit',patch});const saved=useRoleStore.getState().snapshot!;const next={name:saved.name,description:saved.description||''};setDraft(next);setBase(next);setMessage('Configurações do servidor salvas.')}catch(error){setError(error instanceof Error?error.message:'Não foi possível salvar o servidor.')}
  }
  return <section className="ct-server-overview" aria-label="Configurações gerais do servidor"><h3>Visão geral</h3><form onSubmit={event=>{event.preventDefault();if(allowed&&valid&&dirty&&!conflict&&!state.busy&&state.status==='connected')void save()}}><fieldset disabled={!allowed||state.busy||state.status!=='connected'}><label>Nome do servidor<input aria-label="Nome do servidor" maxLength={100} required value={draft.name} onChange={event=>{setDraft({...draft,name:event.target.value});setMessage('')}}/></label><label>Descrição<textarea aria-label="Descrição do servidor" maxLength={300} value={draft.description} onChange={event=>{setDraft({...draft,description:event.target.value});setMessage('')}}/></label><small>{draft.description.length}/300</small><button className="ct-primary" disabled={!dirty||!valid||conflict}>Salvar servidor</button></fieldset></form>{conflict&&<p role="alert">As configurações mudaram enquanto você editava. Seu rascunho foi preservado. <button onClick={()=>{setDraft(current);setBase(current)}}>Carregar configurações atuais</button></p>}{!allowed&&<p className="ct-muted">Você precisa de Gerenciar servidor para alterar estas configurações.</p>}{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}</section>
}
