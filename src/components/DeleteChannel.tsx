import { useRoleStore } from '../store/useRoleStore'
import { useAppStore } from '../store/useAppStore'
import { can } from '../roles/permissions'
import { useEffect, useRef, useState } from 'react'
import type { Channel } from '../store/useAppStore'
import { useCommunityStore } from '../store/useCommunityStore'

export function DeleteChannel({ channel, onClose }: { channel: Channel; onClose: () => void }) {
  const roles=useRoleStore(),manage=!roles.configured&&roles.status==='off'||roles.status==='connected'&&roles.snapshot?.id===channel.serverId&&can(roles.snapshot.policy,roles.snapshot.actor,'MANAGE_CHANNELS',channel.id)
  const [busy, setBusy] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [error, setError] = useState('')
  const cancel = useRef<HTMLButtonElement>(null)
  const previous = useRef(document.activeElement as HTMLElement | null)
  useEffect(() => { cancel.current?.focus(); return () => previous.current?.focus() }, [])
  return <div className="ct-modal-backdrop"><section className="ct-edit-dialog ct-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-channel-title" aria-describedby="delete-channel-description" onKeyDown={e=>{
    if(e.key==='Escape'&&!busy){e.stopPropagation();onClose()}
    if(e.key==='Tab'){const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons[buttons.length-1]?.focus()}else if(!e.shiftKey&&document.activeElement===buttons[buttons.length-1]){e.preventDefault();buttons[0]?.focus()}}
  }}>
    <span className="ct-delete-symbol" aria-hidden="true">{channel.type==='text'?'#':'≋'}</span><h2 id="delete-channel-title">{deleted?'Canal excluído':`Excluir ${channel.name}?`}</h2>
    <p id="delete-channel-description">{deleted?'A exclusão ficou salva. A sincronização será tentada novamente enquanto o ConTALK estiver conectado.':`O canal de ${channel.type==='text'?'texto':'voz'} será removido da comunidade. O histórico salvo deste canal será apagado.${channel.type==='voice'?' Quem estiver conectado sairá da chamada ao receber a exclusão.':''}`}</p>
    {error&&<p role="status">{error}</p>}
    <footer><button ref={cancel} disabled={busy} onClick={onClose}>{deleted?'Fechar':'Cancelar'}</button>{!deleted&&<button className="ct-danger" disabled={busy||!manage} onClick={async()=>{setBusy(true);try{await useCommunityStore.getState().deleteChannel(channel.serverId,channel.id);onClose()}catch(error){const removed=!useAppStore.getState().servers.some(server=>server.channels.some(item=>item.id===channel.id));setDeleted(removed);setError(removed?'A remoção ficou salva neste dispositivo. A sincronização será retomada ao conectar.':error instanceof Error?error.message:'Não foi possível excluir o canal. Tente novamente.')}finally{setBusy(false)}}}>{busy?'Excluindo...':'Excluir canal'}</button>}</footer>
  </section></div>
}
