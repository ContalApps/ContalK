import { ControlIcon } from './ControlIcon'
import { useEffect, useRef, useState } from 'react'
import { useRoleStore } from '../store/useRoleStore'
import { useAppStore } from '../store/useAppStore'
import { useVoiceStore } from '../store/useVoiceStore'
import { InviteJoin } from './InviteJoin'

export function ServerDialog({onClose,onDone}:{onClose:()=>void;onDone:()=>void}){
  const roles=useRoleStore(),panel=useRef<HTMLElement>(null),previous=useRef(document.activeElement as HTMLElement|null)
  const [name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  useEffect(()=>{(panel.current?.querySelector<HTMLElement>('input')||panel.current?.querySelector<HTMLElement>('button'))?.focus();return()=>previous.current?.focus()},[])
  const create=async(event:React.FormEvent)=>{
    event.preventDefault();setBusy(true);setError('')
    try{
      const snapshot=await roles.createServer(name)
      await useVoiceStore.getState().leaveChannel()
      const app=useAppStore.getState();app.addServer({id:snapshot.id,name:snapshot.name,channels:snapshot.channels});app.setActiveServer(snapshot.id);app.setActiveChannel(snapshot.channels[0]?.id||'')
      onDone()
    }catch(failure){setError(failure instanceof Error?failure.message:'Não foi possível criar o servidor.');setBusy(false)}
  }
  return <div className="ct-modal-backdrop"><section ref={panel} className="ct-role-dialog ct-member-roles-dialog" role="dialog" aria-modal="true" aria-labelledby="ct-server-title" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();onClose()}if(event.key==='Tab'){const controls=[...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')],first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}}}>
    <header><h2 id="ct-server-title">Criar ou entrar em um servidor</h2><button aria-label="Fechar" onClick={onClose}><ControlIcon name="close"/></button></header>
    {roles.configured?<>
      <form className="ct-community-connection" onSubmit={create}><h3>Criar meu servidor</h3><p>Seu espaço, com canais de texto e voz. Depois é só convidar os amigos.</p><label>Nome do servidor<input aria-label="Nome do servidor" value={name} maxLength={60} required autoComplete="off" onChange={event=>setName(event.target.value)}/></label><button className="ct-primary" disabled={busy||!name.trim()}>{busy?'Criando…':'Criar servidor'}</button>{error&&<p role="alert">{error}</p>}</form>
      <InviteJoin onJoined={onDone}/>
    </>:<p role="alert">{roles.error||'Conectando à comunidade…'}</p>}
  </section></div>
}
