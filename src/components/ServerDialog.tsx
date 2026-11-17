import { ControlIcon } from './ControlIcon'
import { useEffect, useRef, useState } from 'react'
import { useRoleStore } from '../store/useRoleStore'
import { useAppStore } from '../store/useAppStore'
import { useVoiceStore } from '../store/useVoiceStore'
import { InviteJoin } from './InviteJoin'

// Criar uma comunidade ou entrar com convite, lado a lado.
export function ServerDialog({onClose,onDone}:{onClose:()=>void;onDone:()=>void}){
  const roles=useRoleStore(),panel=useRef<HTMLElement>(null),previous=useRef(document.activeElement as HTMLElement|null)
  const [name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  useEffect(()=>{(panel.current?.querySelector<HTMLElement>('input')||panel.current?.querySelector<HTMLElement>('button'))?.focus();return()=>previous.current?.focus()},[])
  const create=async(event:React.FormEvent)=>{
    event.preventDefault();setBusy(true);setError('')
    try{
      const snapshot=await roles.createServer(name)
      await useVoiceStore.getState().leaveChannel()
      const app=useAppStore.getState();app.addServer({id:snapshot.id,name:snapshot.name,channels:snapshot.channels});app.setActiveServer(snapshot.id);app.setActiveChannel(snapshot.channels.find(channel=>channel.type==='text')?.id||snapshot.channels[0]?.id||'')
      onDone()
    }catch(failure){setError(failure instanceof Error?failure.message:'Não foi possível criar a comunidade.');setBusy(false)}
  }
  const trapFocus=(event:React.KeyboardEvent<HTMLElement>)=>{
    if(event.key==='Escape'){event.stopPropagation();onClose();return}
    if(event.key!=='Tab')return
    const controls=[...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')],first=controls[0],last=controls[controls.length-1]
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
  }
  return <div className="ct-modal-backdrop ct-dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section ref={panel} className="ct-dialog ct-server-dialog" role="dialog" aria-modal="true" aria-labelledby="ct-server-title" onKeyDown={trapFocus}>
      <header className="ct-dialog-header">
        <div>
          <h2 id="ct-server-title">Criar ou entrar em uma comunidade</h2>
          <p>Uma comunidade reúne canais de texto e de voz para você e seus amigos.</p>
        </div>
        <button type="button" className="ct-dialog-close" aria-label="Fechar" title="Fechar (Esc)" onClick={onClose}><ControlIcon name="close"/></button>
      </header>
      {roles.configured?<div className="ct-server-options">
        <form className="ct-server-option" onSubmit={create}>
          <span className="ct-server-option-icon" aria-hidden="true"><ControlIcon name="plus" size={20}/></span>
          <h3>Criar minha comunidade</h3>
          <p>Começa com canais de texto e de voz. Depois é só mandar o convite.</p>
          <label className="ct-field"><span>Nome da comunidade</span><input aria-label="Nome da comunidade" placeholder="Ex.: Equipe de produto" value={name} maxLength={60} required autoComplete="off" onChange={event=>setName(event.target.value)}/></label>
          {error&&<p className="ct-field-error" role="alert">{error}</p>}
          <button className="ct-button-primary" disabled={busy||!name.trim()}>{busy?'Criando…':'Criar comunidade'}</button>
        </form>
        <div className="ct-server-option">
          <span className="ct-server-option-icon" aria-hidden="true"><ControlIcon name="link" size={20}/></span>
          <InviteJoin onJoined={onDone}/>
        </div>
      </div>:<p className="ct-dialog-status" role="status">{roles.error||'Conectando à comunidade…'}</p>}
    </section>
  </div>
}
