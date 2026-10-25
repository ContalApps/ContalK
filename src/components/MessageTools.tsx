import { useSpeechStore } from '../store/useSpeechStore'
import { useVoiceStore } from '../store/useVoiceStore'
import { ThreadCreate } from './ThreadCreate'
import { canMutateThread } from '../roles/threads'
import { useAppStore } from '../store/useAppStore'
import { useEffect, useRef, useState } from 'react'
import type { Message } from '../store/useAppStore'
import { useRoleStore } from '../store/useRoleStore'
import { can } from '../roles/permissions'
import { normalizeReaction, reactionChoices } from '../roles/chat'
import { ControlIcon } from './ControlIcon'

export function MessageTools({message,onOpenChannel}:{message:Message;onOpenChannel?:(id:string)=>void}){
  const state=useRoleStore(),snapshot=state.snapshot,speech=useSpeechStore(),audioBlocked=useVoiceStore(state=>state.isDeafened||state.isServerDeafened)
  const [open,setOpen]=useState(false),[emoji,setEmoji]=useState(''),[error,setError]=useState(''),[clear,setClear]=useState(false),[deleting,setDeleting]=useState(false)
  const [createThread,setCreateThread]=useState(false)
  const panel=useRef<HTMLDivElement>(null)
  useEffect(()=>{if(!open)return;panel.current?.querySelector<HTMLInputElement>('input')?.focus();const close=(event:MouseEvent)=>{if(!panel.current?.contains(event.target as Node)){setOpen(false);setClear(false);setDeleting(false)}};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close)},[open])
  if(!snapshot||message.once||!snapshot.channels.some(channel=>channel.id===message.channelId&&channel.type==='text'))return null
  const {policy,actor}=snapshot,ready=state.status==='connected'&&!state.busy,history=can(policy,actor,'READ_MESSAGE_HISTORY',message.channelId)&&can(policy,actor,'VIEW_CHANNEL',message.channelId)
  const participate=history&&!(policy.timeouts[actor]>Date.now()),add=participate&&can(policy,actor,'ADD_REACTIONS',message.channelId),pin=history&&can(policy,actor,'PIN_MESSAGES',message.channelId),manage=history&&can(policy,actor,'MANAGE_MESSAGES',message.channelId)
  const reactAllowed=canMutateThread(policy,actor,message.channelId,'react',snapshot.serverNow),pinAllowed=canMutateThread(policy,actor,message.channelId,'pin',snapshot.serverNow),deleteAllowed=canMutateThread(policy,actor,message.channelId,'delete',snapshot.serverNow)
  const parent=snapshot.channels.find(channel=>channel.id===message.channelId),sourceThread=snapshot.channels.find(channel=>policy.threads?.[channel.id]?.sourceMessageId===message.id)
  const threadAllowed=!parent?.parentId&&history&&can(policy,actor,'CREATE_PUBLIC_THREADS',message.channelId)
  const openChannel=(id:string)=>onOpenChannel?onOpenChannel(id):useAppStore.getState().setActiveChannel(id)
  const reactions=message.reactions||[]
  const react=async(value:string,enabled:boolean)=>{
    setError('');try{await state.command({type:'message-reaction',channel:message.channelId,id:message.id,emoji:normalizeReaction(value),enabled});setOpen(false);setEmoji('')}catch(error){setError(error instanceof Error?error.message:'Não foi possível reagir.')}
  }
  return <div className="ct-message-tools" ref={panel} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false);setClear(false)}}}>
    {message.tts&&<small className="ct-message-tts" title="Mensagem enviada com leitura em voz"><ControlIcon name="speaker"/> Leitura em voz</small>}
    {!!message.pinnedAt&&<small className="ct-message-pinned"><ControlIcon name="pin"/> Fixada</small>}
    <div className="ct-message-reactions">{reactions.map(reaction=>{const own=reaction.members.includes(actor);return <button key={reaction.emoji} title={reaction.members.map(member=>'@'+member).join(', ')} aria-label={`${reaction.emoji}: ${reaction.members.length} reações`} aria-pressed={own} disabled={!ready||!history||!own&&!participate||!reactAllowed} onClick={()=>void react(reaction.emoji,!own)}><span>{reaction.emoji}</span> {reaction.members.length}</button>})}
<span className="ct-message-toolbar">{message.content.trim()&&window.contalkDesktop?.synthesizeSpeech&&<button className="ct-message-tool" title={speech.messageId===message.id&&speech.status!=='error'?'Parar leitura':audioBlocked?'Áudio do aplicativo silenciado':'Ler mensagem em voz'} aria-label={speech.messageId===message.id&&speech.status!=='error'?'Parar leitura da mensagem':'Ler mensagem em voz'} disabled={!ready||audioBlocked} onClick={()=>speech.messageId===message.id&&speech.status!=='error'?speech.stop():speech.read(message)}><ControlIcon name="speaker"/></button>}{(add||manage&&reactions.length>0)&&reactAllowed&&<button className="ct-message-tool" title="Reações da mensagem" aria-label="Reações da mensagem" aria-expanded={open} disabled={!ready} onClick={()=>{setDeleting(false);setOpen(!open)}}><ControlIcon name="react"/></button>}
      {(sourceThread||threadAllowed)&&<button className="ct-message-tool" title={sourceThread?'Abrir tópico':'Criar tópico a partir da mensagem'} aria-label={sourceThread?'Abrir tópico da mensagem':'Criar tópico a partir da mensagem'} disabled={!ready} onClick={()=>sourceThread?openChannel(sourceThread.id):setCreateThread(true)}><ControlIcon name="thread"/></button>}
      {pin&&pinAllowed&&<button className="ct-message-tool" title={message.pinnedAt?'Desafixar mensagem':'Fixar mensagem'} aria-label={message.pinnedAt?'Desafixar mensagem':'Fixar mensagem'} disabled={!ready} onClick={()=>{setError('');void state.command({type:'message-pin',channel:message.channelId,id:message.id,enabled:!message.pinnedAt}).catch(error=>setError(error.message))}}><ControlIcon name="pin"/></button>}
      {manage&&deleteAllowed&&message.userId!==actor&&<button className="ct-message-tool" title="Apagar mensagem" aria-label="Apagar mensagem de outro membro" disabled={!ready} onClick={()=>{setDeleting(true);setOpen(true)}}><ControlIcon name="delete"/></button>}</span>
    </div>
    {open&&!deleting&&<div className="ct-reaction-picker" role="group" aria-label="Escolher reação">{add&&<><div>{reactionChoices.map(value=><button key={value} aria-label={'Reagir com '+value} disabled={!ready} onClick={()=>void react(value,true)}>{value}</button>)}</div><form onSubmit={event=>{event.preventDefault();if(ready&&add)void react(emoji,true)}}><input aria-label="Outro emoji" placeholder="Outro emoji…" maxLength={40} value={emoji} onChange={event=>setEmoji(event.target.value)}/><button disabled={!ready||!emoji}>Reagir</button></form></>}{manage&&reactions.length>0&&<details className="ct-reaction-members"><summary>Quem reagiu</summary>{reactions.flatMap(reaction=>reaction.members.map(member=><button key={reaction.emoji+member} disabled={!ready} onClick={()=>{setError('');void state.command({type:'message-reaction',channel:message.channelId,id:message.id,emoji:reaction.emoji,enabled:false,member}).catch(error=>setError(error.message))}}>Remover {reaction.emoji} de @{member}</button>))}</details>}{manage&&reactions.length>0&&(clear?<div role="alertdialog" aria-label="Confirmar remoção de reações"><p>Remover todas as reações desta mensagem?</p><button onClick={()=>setClear(false)}>Cancelar</button><button disabled={!ready} onClick={()=>{setError('');void state.command({type:'message-reactions-clear',channel:message.channelId,id:message.id}).then(()=>{setClear(false);setOpen(false)}).catch(error=>setError(error.message))}}>Confirmar remoção de reações</button></div>:<button onClick={()=>setClear(true)}>Remover todas as reações…</button>)}</div>}
    {open&&deleting&&<div className="ct-reaction-picker" role="alertdialog" aria-label="Confirmar exclusão da mensagem"><p>Apagar a mensagem de @{message.userId}? Ela será removida para todos.</p><div><button onClick={()=>{setDeleting(false);setOpen(false)}}>Cancelar</button><button disabled={!ready} onClick={()=>{setError('');void state.command({type:'message-delete',channel:message.channelId,id:message.id}).catch(error=>setError(error.message))}}>Confirmar exclusão da mensagem</button></div></div>}
    {createThread&&<ThreadCreate parentId={message.channelId} sourceMessageId={message.id} onCreated={openChannel} onClose={()=>setCreateThread(false)}/>}
    {speech.messageId===message.id&&speech.error&&<p role="alert">{speech.error}</p>}
    {error&&<p role="alert">{error}</p>}
  </div>
}
