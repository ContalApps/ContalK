import { ControlIcon } from './ControlIcon'
import { useEffect, useRef, useState } from 'react'
import { useRoleStore } from '../store/useRoleStore'
import { can } from '../roles/permissions'
import type { Message } from '../store/useAppStore'
import { ChatMessage } from './MessageContent'
import { RoleName } from './RoleName'

export function PinnedMessages({channelId,onClose,onOpenChannel}:{channelId:string;onClose:()=>void;onOpenChannel?:(id:string)=>void}){
  const state=useRoleStore(),snapshot=state.snapshot,serverId=snapshot?.id,owner=state.owner,scope=JSON.stringify([owner,serverId,channelId])
  const [loaded,setLoaded]=useState<{scope:string;messages:Message[]}>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0)
  const previous=useRef(document.activeElement as HTMLElement|null)
  const allowed=!!snapshot&&state.status==='connected'&&snapshot.channels.some(channel=>channel.id===channelId)&&can(snapshot.policy,snapshot.actor,'VIEW_CHANNEL',channelId)&&can(snapshot.policy,snapshot.actor,'READ_MESSAGE_HISTORY',channelId)
  useEffect(()=>()=>previous.current?.focus(),[])
  useEffect(()=>{
    let active=true
    if(!allowed||!serverId){setLoaded(undefined);return}
    setBusy(true);setError('')
    const bridge=window.contalkDesktop
    if(!bridge?.communityPins){setError('Atualize o aplicativo para consultar as mensagens fixadas.');setBusy(false);return}
    void bridge.communityPins(serverId,channelId).then(result=>{if(active&&result.serverId===serverId&&result.channelId===channelId)setLoaded({scope,messages:result.messages})}).catch(error=>{if(active){setLoaded(undefined);setError(error.message)}}).finally(()=>{if(active)setBusy(false)})
    return()=>{active=false}
  },[scope,snapshot?.revision,allowed,retry])
  const messages=allowed&&loaded?.scope===scope?loaded.messages:[]
  return <div className="ct-modal-backdrop"><section className="ct-role-dialog ct-pinned-dialog" role="dialog" aria-modal="true" aria-labelledby="ct-pinned-title" onKeyDown={event=>{
    if(event.key==='Escape'){event.stopPropagation();onClose()}
    if(event.key==='Tab'){const controls=[...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled)')],first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}
  }}><header><h2 id="ct-pinned-title">Mensagens fixadas</h2><button autoFocus aria-label="Fechar mensagens fixadas" onClick={onClose}><ControlIcon name="close"/></button></header>{!allowed?<p>Você precisa de acesso ao canal e ao histórico para consultar as mensagens fixadas.</p>:<>{busy&&<p role="status">Atualizando…</p>}{!busy&&!messages.length&&!error&&<p>Nenhuma mensagem fixada neste canal.</p>}{messages.map(message=><article key={message.id} className="ct-pinned-message"><header><RoleName serverId={serverId} identity={message.userId} name={message.userName}/><time>{new Date(message.timestamp).toLocaleString('pt-BR')}</time></header><ChatMessage message={message} onOpenChannel={onOpenChannel}/></article>)}{error&&<p role="alert">{error} <button onClick={()=>setRetry(value=>value+1)}>Tentar novamente</button></p>}</>}</section></div>
}
