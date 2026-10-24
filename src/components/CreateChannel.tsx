import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useCommunityStore } from '../store/useCommunityStore'
import { centralCommand, centralEnabled } from '../roles/transport'
export function CreateChannel({type,serverId,onClose}:{type:'text'|'voice';serverId:string;onClose:()=>void}) {
  const [name,setName]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false)
  return <div className="ct-modal-backdrop"><form className="ct-edit-dialog" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{if(centralEnabled())await centralCommand({type:'channel-create',id:crypto.randomUUID(),name,channelType:type});else{useAppStore.getState().addChannel(serverId,name,type);await useCommunityStore.getState().broadcastChannels()}onClose()}catch(error){setError(centralEnabled()?(error instanceof Error?error.message:'Não foi possível criar o canal.'):'Canal salvo neste dispositivo. A sincronização será feita ao reconectar.');setBusy(false)}}}><h2>Criar canal de {type==='text'?'texto':'voz'}</h2><label>Nome do canal<input autoFocus required maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<footer><button type="button" onClick={onClose}>Fechar</button><button className="ct-primary" disabled={busy||!name.trim()}>Criar canal</button></footer></form></div>
}
