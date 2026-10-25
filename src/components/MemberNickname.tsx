import { useEffect, useState } from 'react'
import { useRoleStore } from '../store/useRoleStore'
import { canSetNickname, normalizeNickname } from '../roles/nicknames'

export function MemberNickname({member}:{member:string}){
  const state=useRoleStore(),snapshot=state.snapshot,current=snapshot?.nicknames?.[member]||''
  const [draft,setDraft]=useState(current),[base,setBase]=useState(current),[message,setMessage]=useState(''),[error,setError]=useState('')
  const dirty=draft!==base,conflict=current!==base&&dirty
  useEffect(()=>{if(!dirty&&current!==base){setDraft(current);setBase(current)}},[current,base,dirty])
  if(!snapshot||!canSetNickname(snapshot.policy,snapshot.actor,member))return null
  let valid=true;try{normalizeNickname(draft)}catch{valid=false}
  const save=async()=>{
    setError('');setMessage('')
    try{await state.command({type:'member-nickname',member,nickname:normalizeNickname(draft)});const saved=useRoleStore.getState().snapshot?.nicknames?.[member]||'';setBase(saved);setDraft(saved);setMessage('Apelido salvo neste servidor.')}catch(error){setError(error instanceof Error?error.message:'Não foi possível salvar o apelido.')}
  }
  return <section className="ct-member-moderation ct-member-nickname" aria-label="Apelido no servidor"><h3>Apelido no servidor</h3><p className="ct-muted">Apenas em {snapshot.name}. A conta @{member} e o nome nas mensagens diretas continuam os mesmos.</p><form onSubmit={event=>{event.preventDefault();if(valid&&dirty&&!conflict&&!state.busy&&state.status==='connected')void save()}}><label>Apelido<input aria-label="Apelido no servidor" autoComplete="off" maxLength={128} value={draft} onChange={event=>{setDraft(event.target.value);setMessage('')}} placeholder="Usar o nome do perfil"/></label><small>{[...draft.trim().normalize('NFC')].length}/32</small><button disabled={state.busy||state.status!=='connected'||!valid||!dirty||conflict}>Salvar apelido</button>{draft&&<button type="button" disabled={state.busy} onClick={()=>setDraft('')}>Remover apelido</button>}</form>{conflict&&<p role="alert">O apelido mudou enquanto você editava. Seu texto foi preservado. <button onClick={()=>{setBase(current);setDraft(current)}}>Carregar apelido atual</button></p>}{!valid&&<p role="alert">Use até 32 caracteres, sem controles ou quebras de linha.</p>}{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}</section>
}
