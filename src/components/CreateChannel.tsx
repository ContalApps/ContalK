import {useState} from 'react'
import {useAppStore,type Channel} from '../store/useAppStore'
import {useCommunityStore} from '../store/useCommunityStore'
import {centralCommand,centralEnabled} from '../roles/transport'
import {AiCredentialEditor} from './AiCredentialEditor'

export function CreateChannel({type,serverId,onClose}:{type:'text'|'voice';serverId:string;onClose:()=>void}) {
  const [name,setName]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[aiEnabled,setAiEnabled]=useState(false)
  const [endpoints,setEndpoints]=useState<NonNullable<Channel['aiEndpoints']>>({})
  return <div className="ct-modal-backdrop"><form className="ct-edit-dialog" onSubmit={async event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');try{
    if(centralEnabled())await centralCommand({type:'channel-create',id:crypto.randomUUID(),name,channelType:type,...(aiEnabled?{aiEnabled:true,aiEndpoints:endpoints}:{})})
    else{if(aiEnabled)throw new Error('Conecte a comunidade para criar um canal com IA.');useAppStore.getState().addChannel(serverId,name,type);await useCommunityStore.getState().broadcastChannels()}
    onClose()
  }catch(failure){setError(failure instanceof Error?failure.message:'Não foi possível criar o canal.');setBusy(false)}}}>
    <h2>Criar canal de {type==='text'?'texto':'voz'}</h2>
    <label>Nome do canal<input autoFocus required maxLength={60} value={name} onChange={event=>setName(event.target.value)}/></label>
    {type==='text'&&<label className="ct-ai-enable"><input type="checkbox" checked={aiEnabled} onChange={event=>setAiEnabled(event.target.checked)}/> Ativar IA neste canal</label>}
    {type==='text'&&aiEnabled&&<AiCredentialEditor endpoints={endpoints} onEndpoints={setEndpoints}/>}
    {error&&<p role="alert">{error}</p>}
    <footer><button type="button" onClick={onClose}>Fechar</button><button className="ct-primary" disabled={busy||!name.trim()}>Criar canal</button></footer>
  </form></div>
}
