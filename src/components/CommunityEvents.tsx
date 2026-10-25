import { useEffect, useRef, useState } from 'react'
import { useRoleStore } from '../store/useRoleStore'
import { canCreateEvent, canManageEvent, eventStatusLabels, type EventDraft, type ScheduledEvent } from '../roles/events'
import type { CommunityAction } from '../roles/types'
import { RoleName } from './RoleName'

const localDate=(value:number)=>new Date(value-new Date(value).getTimezoneOffset()*60000).toISOString().slice(0,16)
const draftOf=(event:ScheduledEvent):EventDraft=>({name:event.name,description:event.description,channelId:event.channelId,location:event.location,startsAt:event.startsAt,endsAt:event.endsAt})
const signature=(event:ScheduledEvent)=>JSON.stringify({...draftOf(event),status:event.status})

function EventEditor({event,onClose}:{event?:ScheduledEvent;onClose:()=>void}){
  const state=useRoleStore(),snapshot=state.snapshot
  const [base]=useState(event?signature(event):''),[name,setName]=useState(event?.name||''),[description,setDescription]=useState(event?.description||''),[channelId,setChannelId]=useState(event?.channelId||(snapshot&&!canCreateEvent(snapshot.policy,snapshot.actor,null)?snapshot.channels.find(channel=>channel.type==='voice'&&canCreateEvent(snapshot.policy,snapshot.actor,channel.id))?.id:'')||''),[location,setLocation]=useState(event?.location||'')
  const [starts,setStarts]=useState(localDate(event?.startsAt||Date.now()+3600000)),[ends,setEnds]=useState(event?.endsAt===null?'':localDate(event?.endsAt||Date.now()+7200000)),[error,setError]=useState('')
  if(!snapshot)return <p role="alert">Reconecte a comunidade para continuar.</p>
  const current=event?snapshot.events?.find(item=>item.id===event.id):undefined
  const allowed=event?!!current&&canManageEvent(snapshot.policy,snapshot.actor,current)&&['scheduled','active'].includes(current.status):canCreateEvent(snapshot.policy,snapshot.actor,channelId||null)
  const conflict=!!current&&signature(current)!==base,ready=state.status==='connected'&&!state.busy&&allowed&&!conflict
  const active=current?.status==='active'
  const channels=snapshot.channels.filter(channel=>channel.type==='voice'&&(event?canManageEvent(snapshot.policy,snapshot.actor,{creator:event.creator,channelId:channel.id}):canCreateEvent(snapshot.policy,snapshot.actor,channel.id)))
  return <form className="ct-event-form" aria-label={event?'Editar evento':'Criar evento'} onSubmit={async submit=>{
    submit.preventDefault();setError('');if(!ready)return
    const draft:EventDraft={name,description,channelId:channelId||null,location:channelId?'':location,startsAt:active?current!.startsAt:new Date(starts).getTime(),endsAt:ends?new Date(ends).getTime():null}
    try{await state.command(event?{type:'event-edit',id:event.id,draft}:{type:'event-create',id:crypto.randomUUID(),draft});onClose()}catch(error){setError(error instanceof Error?error.message:'Não foi possível salvar o evento.')}
  }}>
    <h3>{event?'Editar evento':'Novo evento'}</h3>
    <fieldset disabled={!ready}><label>Nome<input autoFocus aria-label="Nome do evento" required maxLength={100} value={name} onChange={change=>setName(change.target.value)}/></label>
    <label>Descrição<textarea aria-label="Descrição do evento" maxLength={1000} rows={3} value={description} onChange={change=>setDescription(change.target.value)}/></label>
    <label>Onde<select aria-label="Local do evento" disabled={active} value={channelId} onChange={change=>setChannelId(change.target.value)}><option value="" disabled={event?!canManageEvent(snapshot.policy,snapshot.actor,{creator:event.creator,channelId:null}):!canCreateEvent(snapshot.policy,snapshot.actor,null)}>Outro local</option>{channels.map(channel=><option key={channel.id} value={channel.id}>{channel.name}</option>)}</select></label>
    {!channelId&&<label>Local ou link<input aria-label="Endereço do evento" required maxLength={100} value={location} onChange={change=>setLocation(change.target.value)}/></label>}
    <div className="ct-event-dates"><label>Início<input aria-label="Início do evento" type="datetime-local" required disabled={active} value={starts} onChange={change=>setStarts(change.target.value)}/></label><label>Término{channelId?' (opcional)':''}<input aria-label="Término do evento" type="datetime-local" required={!channelId} value={ends} onChange={change=>setEnds(change.target.value)}/></label></div>
    <button className="ct-primary" type="submit">{event?'Salvar evento':'Agendar evento'}</button></fieldset>
    <button type="button" onClick={onClose}>Voltar sem salvar</button>
    {!allowed&&<p role="alert">Este evento ou a permissão mudou. Seu rascunho foi mantido.</p>}
    {conflict&&<p role="alert">O evento mudou enquanto você editava. Seu rascunho foi mantido; volte à lista para conferir os dados atuais.</p>}
    {error&&<p role="alert">{error}</p>}
  </form>
}

export function CommunityEvents({onClose,onOpenChannel,initialEvent}:{onClose:()=>void;onOpenChannel:(channel:string)=>void;initialEvent?:string}){
  const state=useRoleStore(),snapshot=state.snapshot
  const [history,setHistory]=useState(false),[query,setQuery]=useState(''),[edit,setEdit]=useState<ScheduledEvent|'new'|null>(null),[error,setError]=useState(''),[confirm,setConfirm]=useState<{event:ScheduledEvent;action:CommunityAction;label:string}|null>(null)
  const previous=useRef(document.activeElement as HTMLElement|null),panel=useRef<HTMLElement>(null)
  useEffect(()=>()=>previous.current?.focus(),[])
  useEffect(()=>{const button=confirm?panel.current?.querySelector<HTMLButtonElement>('[data-event-cancel]'):null;button?.focus()},[confirm])
  useEffect(()=>{if(initialEvent){const event=snapshot?.events?.find(event=>event.id===initialEvent);if(event)setHistory(['completed','cancelled'].includes(event.status))}},[initialEvent])
  useEffect(()=>{if(initialEvent)panel.current?.querySelector<HTMLElement>('[data-event-id="'+CSS.escape(initialEvent)+'"]')?.scrollIntoView({block:'nearest'})},[initialEvent,history])
  const ready=state.status==='connected'&&!state.busy,canCreate=!!snapshot&&(canCreateEvent(snapshot.policy,snapshot.actor,null)||snapshot.channels.some(channel=>channel.type==='voice'&&canCreateEvent(snapshot.policy,snapshot.actor,channel.id)))
  const events=(snapshot?.events||[]).filter(event=>['completed','cancelled'].includes(event.status)===history&&event.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a,b)=>Number(b.status==='active')-Number(a.status==='active')||(history?b.startsAt-a.startsAt:a.startsAt-b.startsAt))
  const run=async(action:CommunityAction)=>{setError('');try{await state.command(action);setConfirm(null)}catch(error){setError(error instanceof Error?error.message:'Não foi possível alterar o evento.')}}
  return <div className="ct-modal-backdrop"><section ref={panel} className="ct-role-dialog ct-events-dialog" role={confirm?'alertdialog':'dialog'} aria-modal="true" aria-label="Eventos do servidor" onKeyDown={event=>{
    if(event.key==='Escape'){event.stopPropagation();if(confirm)setConfirm(null);else if(edit)setEdit(null);else onClose()}
    if(event.key==='Tab'){const controls=[...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')].filter(control=>!control.matches(':disabled')),first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}
  }}><header><h2>Eventos do servidor</h2><button autoFocus aria-label="Fechar eventos" onClick={onClose}>×</button></header>
    {confirm?<><p>{confirm.label} “{confirm.event.name}”?</p><p className="ct-muted">{confirm.action.type==='event-delete'?'Esta exclusão é definitiva.':'O evento não poderá voltar ao estado anterior.'}</p><button data-event-cancel disabled={!ready} onClick={()=>setConfirm(null)}>Voltar</button><button className="ct-role-danger" disabled={!ready} onClick={()=>void run(confirm.action)}>Confirmar {confirm.label.toLocaleLowerCase()}</button></>:edit?<EventEditor key={(snapshot?.actor||'')+':'+(edit==='new'?'new':edit.id)} event={edit==='new'?undefined:edit} onClose={()=>setEdit(null)}/>:<>
    <nav><button aria-current={!history?'page':undefined} onClick={()=>setHistory(false)}>Próximos</button><button aria-current={history?'page':undefined} onClick={()=>setHistory(true)}>Anteriores</button>{canCreate&&<button disabled={!ready} onClick={()=>setEdit('new')}>Criar evento…</button>}</nav>
    <input type="search" aria-label="Buscar evento" placeholder="Buscar evento…" value={query} onChange={event=>setQuery(event.target.value)}/>
    <div className="ct-event-list">{events.map(event=>{const manage=!!snapshot&&canManageEvent(snapshot.policy,snapshot.actor,event),ongoing=['scheduled','active'].includes(event.status),channel=snapshot?.channels.find(channel=>channel.id===event.channelId);return <article data-event-id={event.id} className={initialEvent===event.id?'ct-event-highlight':''} key={event.id} aria-label={'Evento '+event.name}>
      <div className="ct-event-heading"><h3>{event.name}</h3><span className={'ct-event-status ct-event-'+event.status}>{eventStatusLabels[event.status]}</span></div>
      <time dateTime={new Date(event.startsAt).toISOString()}>{new Date(event.startsAt).toLocaleString('pt-BR')}{event.endsAt?' — '+new Date(event.endsAt).toLocaleString('pt-BR'):''}</time>
      <p className="ct-event-location">{channel?'Canal de voz · '+channel.name:event.location}</p>{event.description&&<p className="ct-event-description">{event.description}</p>}
      <small>Criado por <RoleName name={event.creator} identity={event.creator} serverId={snapshot?.id}/> · {event.interestedCount} {event.interestedCount===1?'interessado':'interessados'}</small>
      <div className="ct-event-actions">{ongoing&&<button aria-pressed={event.interested} disabled={!ready||!event.interested&&!!snapshot&&(snapshot.policy.timeouts[snapshot.actor]||0)>(snapshot.serverNow||Date.now())} onClick={()=>void run({type:'event-interest',id:event.id,enabled:!event.interested})}>{event.interested?'Retirar interesse':'Tenho interesse'}</button>}
      {event.status==='active'&&channel&&<button onClick={()=>{onOpenChannel(channel.id);onClose()}}>Abrir canal</button>}
      {manage&&<>{ongoing&&<button disabled={!ready} onClick={()=>setEdit(event)}>Editar evento</button>}{event.status==='scheduled'&&event.channelId&&<button disabled={!ready} onClick={()=>setConfirm({event,action:{type:'event-status',id:event.id,status:'active'},label:'Iniciar evento'})}>Iniciar evento…</button>}{ongoing&&<button disabled={!ready} onClick={()=>setConfirm({event,action:{type:'event-status',id:event.id,status:event.status==='active'?'completed':'cancelled'},label:event.status==='active'?'Encerrar evento':'Cancelar evento'})}>{event.status==='active'?'Encerrar evento…':'Cancelar evento…'}</button>}<button className="ct-role-danger" disabled={!ready} onClick={()=>setConfirm({event,action:{type:'event-delete',id:event.id},label:'Excluir evento'})}>Excluir evento…</button></>}
      </div>
    </article>})}</div>{!events.length&&<p className="ct-muted">Nenhum evento {history?'anterior':'agendado'} disponível.</p>}
    <p className="ct-muted">Somente membros com acesso ao local podem ver o evento. Marque interesse para receber avisos de alterações e início. Eventos em outro local começam e terminam automaticamente no horário agendado.</p>
    </>}{error&&<p role="alert">{error}</p>}{state.status!=='connected'&&<p role="alert">Reconecte a comunidade para atualizar os eventos.</p>}
  </section></div>
}
