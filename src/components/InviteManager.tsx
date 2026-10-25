import { useEffect, useState } from 'react'
import { useRoleStore } from '../store/useRoleStore'
import { can } from '../roles/permissions'

export function InviteManager(){
  const state=useRoleStore(),snapshot=state.snapshot
  const [channel,setChannel]=useState(''),[maxAge,setMaxAge]=useState(86400),[maxUses,setMaxUses]=useState(1),[revoke,setRevoke]=useState<string|null>(null),[message,setMessage]=useState(''),[error,setError]=useState('')
  const channels=snapshot?.channels.filter(item=>!item.parentId&&can(snapshot.policy,snapshot.actor,'CREATE_INSTANT_INVITE',item.id))||[]
  const channelIds=channels.map(item=>item.id).join(',')
  useEffect(()=>{if(!channels.some(item=>item.id===channel))setChannel(channels[0]?.id||'')},[channelIds,channel])
  useEffect(()=>{setRevoke(null);setMessage('');setError('')},[snapshot?.id])
  if(!snapshot)return null
  const invites=snapshot.invites||[],target=invites.find(item=>item.code===revoke),ready=!state.busy&&state.status==='connected'
  return <section aria-label="Convites do servidor"><h3>Convites</h3><p>Convites autorizam a entrada no servidor. A pessoa também precisa da própria chave individual da comunidade.</p>
    {channels.length>0&&<form className="ct-community-connection ct-invite-create" onSubmit={async event=>{event.preventDefault();setMessage('');setError('');try{await state.command({type:'invite-create',channelId:channel,maxAge,maxUses});setMessage('Convite criado. Copie o link abaixo.')}catch(error){setError(error instanceof Error?error.message:'Não foi possível criar o convite.')}}}>
      <label>Canal<select aria-label="Canal do convite" value={channel} onChange={event=>setChannel(event.target.value)}>{channels.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <div className="ct-invite-options"><label>Expira em<select aria-label="Prazo do convite" value={maxAge} onChange={event=>setMaxAge(Number(event.target.value))}>{[[3600,'1 hora'],[86400,'1 dia'],[604800,'7 dias'],[0,'Sem expiração']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Limite de usos<select aria-label="Limite de usos do convite" value={maxUses} onChange={event=>setMaxUses(Number(event.target.value))}>{[[1,'1 pessoa'],[10,'10 pessoas'],[25,'25 pessoas'],[100,'100 pessoas'],[0,'Sem limite']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
      <button className="ct-primary" disabled={!ready||!channel}>Criar convite</button>
    </form>}
    {target?<div role="alertdialog" aria-label="Confirmar revogação de convite"><p>Revogar este convite? Ele não permitirá novas entradas. Quem já entrou continuará no servidor.</p><button autoFocus disabled={!ready} onClick={()=>setRevoke(null)}>Cancelar</button><button className="ct-role-danger" disabled={!ready} onClick={async()=>{setError('');try{await state.command({type:'invite-revoke',code:target.code});setRevoke(null);setMessage('Convite revogado.')}catch(error){setError(error instanceof Error?error.message:'Não foi possível revogar o convite.')}}}>Confirmar revogação</button></div>:invites.map(invite=>{const link=state.url+'/invite/'+invite.code;return <div className="ct-invite-row" key={invite.code}><label>Link do convite<input aria-label={'Link de convite '+invite.code.slice(0,8)} readOnly value={link} onFocus={event=>event.target.select()}/></label><small>{invite.expiresAt?'Expira em '+new Date(invite.expiresAt).toLocaleString('pt-BR'):'Sem expiração'} · {invite.uses}{invite.maxUses?'/'+invite.maxUses:''} usos · @{invite.createdBy}{invite.id&&' · #'+invite.id.slice(0,12)}</small><button onClick={async()=>{setError('');try{await navigator.clipboard.writeText(link);setMessage('Link copiado.')}catch{setError('Selecione o link e use Ctrl+C para copiar.')}}}>Copiar link</button><button className="ct-role-danger" disabled={!ready} aria-label={'Revogar convite '+invite.code.slice(0,8)} onClick={()=>setRevoke(invite.code)}>Revogar…</button></div>})}
    {!invites.length&&<p className="ct-muted">Nenhum convite disponível para administrar.</p>}{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
  </section>
}
