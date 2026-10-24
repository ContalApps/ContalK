import { useEffect, useRef, useState } from 'react'
import { useAppStore, type Channel } from '../store/useAppStore'
import { useCommunityStore } from '../store/useCommunityStore'
import { DeleteChannel } from './DeleteChannel'
import { ChannelPermissions } from './ChannelPermissions'
import { useRoleStore } from '../store/useRoleStore'

export function ChannelSettings({channel,onClose}:{channel:Channel;onClose:()=>void}) {
  const roles=useRoleStore()
  const current=useAppStore(s=>s.servers.find(server=>server.id===channel.serverId)?.channels.find(c=>c.id===channel.id))
  const [name,setName]=useState(current?.name||channel.name),[tab,setTab]=useState<'general'|'permissions'>('general'),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState('')
  const panel=useRef<HTMLElement>(null),previous=useRef(document.activeElement as HTMLElement|null)
  useEffect(()=>()=>previous.current?.focus(),[])
  useEffect(()=>{if(!confirm)panel.current?.querySelector<HTMLInputElement>('input')?.focus()},[confirm])
  useEffect(()=>{if(!current)onClose()},[current,onClose])
  if(confirm)return <DeleteChannel channel={current||channel} onClose={()=>{if(useAppStore.getState().servers.some(s=>s.channels.some(c=>c.id===channel.id)))setConfirm(false);else onClose()}}/>
  return <div className="ct-modal-backdrop"><section ref={panel} className="ct-channel-dialog" role="dialog" aria-modal="true" aria-labelledby="channel-settings-title" onKeyDown={e=>{
    if(e.key==='Escape'&&!busy){e.stopPropagation();onClose()}
    if(e.key==='Tab'){const controls=[...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)')];const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}
  }}><header><div><small>CANAL DE {channel.type==='voice'?'VOZ':'TEXTO'}</small><h2 id="channel-settings-title">Configurações de {current?.name||channel.name}</h2></div><button aria-label="Fechar configurações do canal" onClick={onClose}>×</button></header><nav aria-label="Seções do canal"><button aria-current={tab==='general'?'page':undefined} onClick={()=>setTab('general')}>Visão geral</button><button aria-current={tab==='permissions'?'page':undefined} onClick={()=>setTab('permissions')}>Permissões</button></nav>{tab==='general'?<><form onSubmit={async e=>{e.preventDefault();setBusy(true);setStatus('');try{await useCommunityStore.getState().renameChannel(channel.serverId,channel.id,name);setStatus('Nome atualizado.')}catch{setStatus(useAppStore.getState().servers.some(s=>s.channels.some(c=>c.id===channel.id&&c.name===name.trim()))?'Nome salvo neste dispositivo. A sincronização será retomada ao conectar.':'Não foi possível renomear o canal.')}finally{setBusy(false)}}}><label htmlFor="channel-name">Nome do canal</label><input id="channel-name" value={name} maxLength={60} required onChange={e=>setName(e.target.value)}/><button className="ct-primary" disabled={busy||!name.trim()||name.trim()===current?.name}>{busy?'Salvando…':'Salvar alterações'}</button></form><section className="ct-channel-danger"><div><strong>Excluir canal</strong><p>Remove o canal e seu histórico. Será necessário confirmar.</p></div><button onClick={()=>setConfirm(true)} disabled={busy}>Excluir canal…</button></section></>:roles.snapshot?<ChannelPermissions contextId={channel.id}/>:<div className="ct-channel-permissions"><h3>Acesso dos membros</h3><p>Todos os membros podem usar os canais e gerenciar seus nomes e exclusões.</p><p>O servidor ainda não possui cargos ou permissões individuais. As mesmas regras valem para todos os canais.</p></div>}{status&&<p role="status" className="ct-channel-save-status">{status}</p>}</section></div>
}
