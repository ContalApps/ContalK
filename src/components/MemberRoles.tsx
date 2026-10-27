import { ControlIcon } from './ControlIcon'
import { MemberNickname } from './MemberNickname'
import { MemberVoiceModeration } from './MemberVoiceModeration'
import { useEffect, useRef, useState } from 'react'
import { useRoleStore } from '../store/useRoleStore'
import { can, canActOnMember, canAssignRole, canRemoveRole } from '../roles/permissions'

export function MemberRoles({member,onClose,initialSection}:{member:string;onClose:()=>void;initialSection?:'nickname'}){
  const state=useRoleStore()
  const [error,setError]=useState(''),[query,setQuery]=useState(''),[duration,setDuration]=useState(600000)
  const [confirmTimeout,setConfirmTimeout]=useState(false),[removal,setRemoval]=useState<'kick'|'ban'|null>(null),[reason,setReason]=useState('')
  const panel=useRef<HTMLElement>(null),previous=useRef(document.activeElement as HTMLElement|null)
  useEffect(()=>{panel.current?.querySelector<HTMLInputElement>(initialSection==='nickname'?'input[aria-label="Apelido no servidor"]':'input')?.focus();return()=>previous.current?.focus()},[])
  if(!state.snapshot)return null
  const {policy,actor}=state.snapshot
  const present=policy.members.includes(member)
  const moderate=canActOnMember(policy,actor,member,'MODERATE_MEMBERS')&&!can(policy,member,'ADMINISTRATOR')
  const kick=canActOnMember(policy,actor,member,'KICK_MEMBERS'),ban=canActOnMember(policy,actor,member,'BAN_MEMBERS')
  const ready=!state.busy&&state.status==='connected'
  const timeout=(policy.timeouts[member]||0)>Date.now()
  const restrict=async(until:number)=>{setError('');try{await state.command({type:'role',command:{type:'timeout',member,until}});setConfirmTimeout(false)}catch(error){setError(error instanceof Error?error.message:'Não foi possível alterar a restrição.')}}
  const remove=async()=>{if(!removal)return;setError('');try{await state.command({type:removal==='ban'?'member-ban':'member-kick',member,reason});setRemoval(null);setReason('')}catch(error){setError(error instanceof Error?error.message:'Não foi possível moderar este membro.')}}
  return <div className="ct-modal-backdrop"><section ref={panel} className="ct-role-dialog ct-member-roles-dialog" role="dialog" aria-modal="true" aria-labelledby="ct-member-role-title" onKeyDown={event=>{
    if(event.key==='Escape'){event.stopPropagation();if(removal)setRemoval(null);else if(confirmTimeout)setConfirmTimeout(false);else onClose()}
    if(event.key==='Tab'){const controls=[...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')];const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}
  }}><header><div><small>Membro</small><h2 id="ct-member-role-title">Cargos de @{member}</h2></div><button aria-label="Fechar cargos do membro" onClick={onClose}><ControlIcon name="close"/></button></header>
    {!present?<p role="status">@{member} não participa mais deste servidor.</p>:<>
      {state.snapshot.memberAdmissions?.[member]&&<p className="ct-muted">Entrou em {new Date(state.snapshot.memberAdmissions[member].joinedAt).toLocaleString('pt-BR')} por convite de @{state.snapshot.memberAdmissions[member].invitedBy}{state.snapshot.memberAdmissions[member].inviteId&&' · #'+state.snapshot.memberAdmissions[member].inviteId?.slice(0,12)}.</p>}
      <input type="search" aria-label="Buscar cargo do membro" placeholder="Buscar cargo…" value={query} onChange={event=>setQuery(event.target.value)}/>
      <p>Uma pessoa pode ter vários cargos. As alterações são salvas imediatamente.</p>
      {[...policy.roles].sort((a,b)=>b.position-a.position).filter(role=>role.name.toLowerCase().includes(query.toLowerCase())).map(role=>{const checked=role.id===policy.serverId||(policy.memberRoles[member]||[]).includes(role.id);return <label className="ct-role-member" key={role.id}><span>{role.name}{role.managed!=='none'&&<small> · Gerenciado por integração</small>}</span><input type="checkbox" aria-label={role.name+' para '+member} checked={checked} disabled={!ready||!(checked?canRemoveRole(policy,actor,member,role):canAssignRole(policy,actor,member,role))} onChange={async()=>{setError('');try{await state.command({type:'role',command:{type:checked?'remove':'assign',id:role.id,member}})}catch(error){setError(error instanceof Error?error.message:'Não foi possível alterar o cargo.')}}}/></label>})}
      <MemberNickname member={member}/>
      <MemberVoiceModeration member={member}/>
      {moderate&&<section className="ct-member-moderation"><h3>Restrição temporária</h3>{timeout&&<p>Restrito até {new Date(policy.timeouts[member]).toLocaleString('pt-BR')}.</p>}{confirmTimeout?<div role="alertdialog" aria-label="Confirmar restrição temporária"><p>Restringir @{member}? Ele não poderá enviar mensagens nem entrar na voz durante o período escolhido.</p><button onClick={()=>setConfirmTimeout(false)} disabled={!ready}>Cancelar</button><button disabled={!ready} onClick={()=>void restrict(Date.now()+duration)}>Confirmar restrição</button></div>:<><select aria-label="Duração da restrição" value={duration} onChange={event=>setDuration(Number(event.target.value))}>{[[60000,'1 minuto'],[300000,'5 minutos'],[600000,'10 minutos'],[3600000,'1 hora'],[86400000,'1 dia'],[604800000,'7 dias'],[2419200000,'28 dias']].map(([value,label])=><option value={value} key={value}>{label}</option>)}</select><button disabled={!ready} onClick={()=>{setRemoval(null);setConfirmTimeout(true)}}>Restringir…</button>{timeout&&<button disabled={!ready} onClick={()=>void restrict(0)}>Remover restrição</button>}</>}</section>}
      {(kick||ban)&&<section className="ct-member-moderation"><h3>Acesso ao servidor</h3>{removal?<div role="alertdialog" aria-label={removal==='ban'?'Confirmar banimento':'Confirmar expulsão'}><p>{removal==='ban'?'Banir @'+member+'? Ele perderá o acesso e não poderá retornar enquanto estiver banido.':'Expulsar @'+member+'? Ele perderá o acesso e os cargos deste servidor. A expulsão não cria um banimento.'}</p><label>Motivo opcional<textarea aria-label="Motivo da moderação" maxLength={512} value={reason} onChange={event=>setReason(event.target.value)}/></label><button autoFocus disabled={!ready} onClick={()=>setRemoval(null)}>Cancelar</button><button className="ct-role-danger" disabled={!ready||(removal==='ban'?!ban:!kick)} onClick={()=>void remove()}>{removal==='ban'?'Confirmar banimento':'Confirmar expulsão'}</button></div>:<>{kick&&<button disabled={!ready} onClick={()=>{setConfirmTimeout(false);setRemoval('kick');setError('')}}>Expulsar membro…</button>}{ban&&<button className="ct-role-danger" disabled={!ready} onClick={()=>{setConfirmTimeout(false);setRemoval('ban');setError('')}}>Banir membro…</button>}</>}</section>}
      {!kick&&!ban&&(can(policy,actor,'KICK_MEMBERS')||can(policy,actor,'BAN_MEMBERS'))&&<p className="ct-muted">A propriedade, a hierarquia ou sua própria identidade protegem este membro contra expulsão e banimento.</p>}
    </>}{error&&<p role="alert">{error}</p>}
  </section></div>
}
