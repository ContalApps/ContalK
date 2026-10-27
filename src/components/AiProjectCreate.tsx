import { ControlIcon } from './ControlIcon'
import {useState} from 'react'
import {useRoleStore} from '../store/useRoleStore'

export function AiProjectCreate({parentId,onCreated,onClose}:{parentId:string;onCreated:(id:string)=>void;onClose:()=>void}){
  const state=useRoleStore(),[name,setName]=useState(''),[error,setError]=useState('')
  return <div className="ct-modal-backdrop"><section className="ct-role-dialog ct-thread-dialog" role="dialog" aria-modal="true" aria-label="Criar projeto de IA"><header><h2>Criar subchat de projeto</h2><button aria-label="Fechar criação de projeto" onClick={onClose}><ControlIcon name="close"/></button></header><p>O projeto será privado. Convide pessoas como leitoras ou colaboradoras depois de criá-lo.</p><form onSubmit={event=>{event.preventDefault();const id=crypto.randomUUID();setError('');void state.command({type:'project-create',id,parentId,name}).then(()=>{onCreated(id);onClose()}).catch(error=>setError(error.message))}}><label>Nome do projeto<input required maxLength={60} value={name} onChange={event=>setName(event.target.value)}/></label><button className="ct-primary" disabled={state.busy||!name.trim()}>Criar projeto</button></form>{error&&<p role="alert">{error}</p>}</section></div>
}
