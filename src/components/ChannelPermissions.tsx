import { useEffect, useState } from 'react'
import { useRoleStore } from '../store/useRoleStore'
import { can, permissionsFor, Permission, readMask, CHANNEL_PERMISSIONS, type PermissionName } from '../roles/permissions'
import { permissionCatalogue } from '../roles/catalogue'

export function ChannelPermissions({contextId,category=false}:{contextId:string;category?:boolean}){
  const state=useRoleStore(),snapshot=state.snapshot!
  const {policy,actor}=snapshot
  const [target,setTarget]=useState('role:'+policy.serverId),[allow,setAllow]=useState('0'),[deny,setDeny]=useState('0'),[base,setBase]=useState(''),[query,setQuery]=useState(''),[status,setStatus]=useState('')
  const targetType=target.startsWith('member:')?'member':'role',targetId=target.slice(target.indexOf(':')+1)
  const link=category?undefined:policy.channelCategories[contextId],source=link?.synced?link.categoryId:contextId
  const overwrite=policy.overwrites[source]?.find(item=>item.id===targetId&&item.type===targetType)
  const current=JSON.stringify({allow:overwrite?.allow||'0',deny:overwrite?.deny||'0'})
  const load=()=>{setAllow(overwrite?.allow||'0');setDeny(overwrite?.deny||'0');setBase(current);setStatus('')}
  useEffect(load,[target,contextId])
  const stale=base!==current,dirty=JSON.stringify({allow,deny})!==base
  const allowed=can(policy,actor,'MANAGE_ROLES',category?undefined:contextId)
  const change=(permission:PermissionName,value:'inherit'|'allow'|'deny')=>{
    const bit=Permission[permission]
    setAllow(((readMask(allow)&~bit)|(value==='allow'?bit:0n)).toString())
    setDeny(((readMask(deny)&~bit)|(value==='deny'?bit:0n)).toString())
  }
  return <section className="ct-channel-permissions"><h3>{category?'Permissões da categoria':'Acesso ao canal'}</h3>{link&&<p>{link.synced?'Sincronizado com':'Regras próprias; categoria'} <strong>{policy.categories.find(item=>item.id===link.categoryId)?.name}</strong>. {link.synced?'Salvar uma exceção neste canal preserva as regras atuais e desativa a sincronização.':''}</p>}
    <label>Configurar acesso de<select aria-label="Destino das permissões" value={target} onChange={event=>setTarget(event.target.value)}><optgroup label="Cargos">{[...policy.roles].sort((a,b)=>b.position-a.position).map(role=><option key={role.id} value={'role:'+role.id}>{role.name}</option>)}</optgroup><optgroup label="Membros">{policy.members.map(member=><option key={member} value={'member:'+member}>@{member}</option>)}</optgroup></select></label>
    {stale&&<p role="status">As regras mudaram. <button onClick={load}>Carregar regras atuais</button></p>}
    <input type="search" aria-label="Buscar permissão do canal" value={query} placeholder="Buscar permissão…" onChange={event=>setQuery(event.target.value)}/>
    <div className="ct-overwrite-list">{permissionCatalogue.filter(item=>(Permission[item.name]&CHANNEL_PERMISSIONS)!==0n&&item.label.toLowerCase().includes(query.toLowerCase())).map(item=>{
      const value=(readMask(allow)&Permission[item.name])!==0n?'allow':(readMask(deny)&Permission[item.name])!==0n?'deny':'inherit'
      const disabled=!allowed||state.busy||state.status!=='connected'||!item.available||(permissionsFor(policy,actor)&Permission[item.name])===0n
      return <div key={item.name}><span>{item.label}{!item.available&&<small>Em preparação</small>}</span><div role="group" aria-label={item.label}>{([['deny','Negar','−'],['inherit','Herdar','/'],['allow','Permitir','+']] as const).map(([id,label,symbol])=><button key={id} aria-label={`${item.label}: ${label}`} title={label} aria-pressed={value===id} className={value===id?'selected '+id:''} disabled={disabled} onClick={()=>change(item.name,id)}>{symbol}</button>)}</div></div>
    })}</div><footer><button className="ct-primary" disabled={!dirty||stale||!allowed||state.busy||state.status!=='connected'} onClick={async()=>{setStatus('');try{await state.command({type:'role',command:{type:'overwrite',channel:contextId,targetId,targetType,overwrite:allow==='0'&&deny==='0'?null:{id:targetId,type:targetType,allow,deny}}});setBase(JSON.stringify({allow,deny}));setStatus('Permissões salvas.')}catch(error){setStatus(error instanceof Error?error.message:'Não foi possível salvar.')}}}>Salvar permissões</button></footer>{status&&<p role="status">{status}</p>}
    {!category&&can(policy,actor,'MANAGE_CHANNELS')&&<label>Categoria<select aria-label="Categoria do canal" value={link?.categoryId||''} disabled={state.busy} onChange={event=>{const categoryId=event.target.value;void state.command({type:'role',command:{type:'category-link',channel:contextId,category:categoryId||null,sync:false}}).catch(error=>setStatus(error.message))}}><option value="">Sem categoria</option>{policy.categories.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>{link&&!link.synced&&<button disabled={state.busy} onClick={()=>void state.command({type:'role',command:{type:'category-link',channel:contextId,category:link.categoryId,sync:true}}).catch(error=>setStatus(error.message))}>Sincronizar com categoria</button>}</label>}
  </section>
}
