import { useState } from 'react'
import { useRoleStore } from '../store/useRoleStore'
import { can } from '../roles/permissions'

export function BanManager(){
  const state=useRoleStore(),[query,setQuery]=useState(''),[selected,setSelected]=useState<string|null>(null),[error,setError]=useState('')
  const snapshot=state.snapshot
  if(!snapshot||!can(snapshot.policy,snapshot.actor,'BAN_MEMBERS'))return null
  const bans=snapshot.bans||[],target=bans.find(item=>item.username===selected)
  const ready=!state.busy&&state.status==='connected'
  return <section aria-label="Banimentos do servidor"><h3>Banimentos</h3><p>Remover um banimento permite um futuro retorno. Não restaura a participação nem os cargos anteriores.</p><input type="search" aria-label="Buscar banimento" placeholder="Buscar pessoa…" value={query} onChange={event=>setQuery(event.target.value)}/>
    {target?<div role="alertdialog" aria-label="Confirmar remoção de banimento"><p>Remover o banimento de @{target.username}?</p><button autoFocus disabled={!ready} onClick={()=>setSelected(null)}>Cancelar</button><button disabled={!ready} onClick={async()=>{setError('');try{await state.command({type:'member-unban',member:target.username});setSelected(null)}catch(error){setError(error instanceof Error?error.message:'Não foi possível remover o banimento.')}}}>Confirmar remoção de banimento</button></div>:<>{bans.filter(item=>item.username.toLowerCase().includes(query.toLowerCase())).map(item=><div className="ct-role-member" key={item.username}><span><strong>@{item.username}</strong><small>{item.reason||'Sem motivo informado'} · {new Date(item.timestamp).toLocaleString('pt-BR')}</small></span><button disabled={!ready} onClick={()=>{setError('');setSelected(item.username)}} aria-label={'Remover banimento de '+item.username}>Remover banimento…</button></div>)}{!bans.length&&<p className="ct-muted">Nenhum banimento neste servidor.</p>}</>}{error&&<p role="alert">{error}</p>}
  </section>
}
