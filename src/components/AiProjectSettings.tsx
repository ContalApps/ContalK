import {useState} from 'react'
import {useRoleStore} from '../store/useRoleStore'
import type {ProjectAccess} from '../roles/ai'

export function AiProjectSettings({id,onClose}:{id:string;onClose:()=>void}){
  const state=useRoleStore(),snapshot=state.snapshot,project=snapshot?.policy.projects?.[id],channel=snapshot?.channels.find(item=>item.id===id)
  const [member,setMember]=useState(''),[access,setAccess]=useState<ProjectAccess>('reader')
  const [name,setName]=useState(channel?.name||''),[error,setError]=useState(''),[confirm,setConfirm]=useState(false)
  if(!project||!channel||!snapshot)return null
  const manage=project.members[snapshot.actor]==='manager',canManage=manage&&!project.archived,available=snapshot.policy.members.filter(person=>!project.members[person])
  const run=async(action:Parameters<typeof state.command>[0])=>{setError('');try{await state.command(action);return true}catch(failure){setError(failure instanceof Error?failure.message:'Não foi possível salvar.');return false}}
  return <div className="ct-modal-backdrop"><section className="ct-role-dialog ct-thread-dialog" role="dialog" aria-modal="true" aria-label="Configurações do projeto">
    <header><h2>{channel.name}</h2><button aria-label="Fechar configurações do projeto" onClick={onClose}>×</button></header>
    <p>Projeto privado · {Object.keys(project.members).length} participantes{project.archived?' · Arquivado':''}</p>
    {manage&&project.archived&&<button className="ct-primary" disabled={state.busy} onClick={()=>void run({type:'project-restore',id})}>Restaurar projeto</button>}
    {canManage&&<>
      <form onSubmit={event=>{event.preventDefault();void run({type:'project-rename',id,name})}}><label>Nome<input value={name} maxLength={60} onChange={event=>setName(event.target.value)}/></label><button disabled={state.busy||!name.trim()}>Renomear</button></form>
      <form onSubmit={event=>{event.preventDefault();if(!member)return;void run({type:'project-member',id,member,access}).then(saved=>{if(saved)setMember('')})}}>
        <label>Convidar membro<select value={member} onChange={event=>setMember(event.target.value)}><option value="">Selecione uma pessoa</option>{available.map(person=><option key={person} value={person}>{person}</option>)}</select></label>
        <select aria-label="Acesso do convidado" value={access} onChange={event=>setAccess(event.target.value as ProjectAccess)}><option value="reader">Leitor</option><option value="collaborator">Colaborador</option><option value="manager">Delegado gestor</option></select><button disabled={!member||state.busy}>Convidar</button>
      </form>
    </>}
    <div className="ct-thread-list">{Object.entries(project.members).map(([person,level])=><div key={person} className="ct-setting-row"><span><strong>{person}</strong><small>{person===project.ownerId?'Criador':level==='manager'?'Delegado':level==='collaborator'?'Colaborador':'Leitor'}</small></span>{canManage&&person!==project.ownerId&&<><select aria-label={'Acesso de '+person} value={level} onChange={event=>void run({type:'project-member',id,member:person,access:event.target.value as ProjectAccess})}><option value="reader">Leitor</option><option value="collaborator">Colaborador</option><option value="manager">Delegado</option></select><button onClick={()=>void run({type:'project-member',id,member:person,access:null})}>Remover</button></>}</div>)}</div>
    {canManage&&<section className="ct-channel-danger"><strong>Excluir projeto</strong>{confirm?<div><p>Excluir o projeto e todo o seu histórico?</p><button onClick={()=>void run({type:'project-delete',id}).then(saved=>{if(saved)onClose()})}>Confirmar exclusão</button><button onClick={()=>setConfirm(false)}>Cancelar</button></div>:<button onClick={()=>setConfirm(true)}>Excluir projeto…</button>}</section>}
    {error&&<p role="alert">{error}</p>}
  </section></div>
}
