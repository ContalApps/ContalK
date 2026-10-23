import type { Channel } from '../store/useAppStore'
import { ControlIcon } from './ControlIcon'

export function ChannelRow({channel,active,count,connected=false,onOpen,onSettings}:{channel:Channel;active:boolean;count?:number;connected?:boolean;onOpen:()=>void;onSettings:()=>void}) {
  return <div className={`ct-channel-row ${active?'active':''}`} onContextMenu={e=>{e.preventDefault();onSettings()}}><button className={`ct-channel ${active?'active':''}`} onClick={onOpen}><span className="ct-icon" aria-hidden="true">{channel.type==='text'?'#':<ControlIcon name="mic"/>}</span><span>{channel.name}</span>{channel.type==='voice'&&connected?<small className="ct-call-badge">CALL</small>:!!count&&<small>{count}</small>}</button><button className="ct-channel-settings" title={`Configurações de ${channel.name}`} aria-label={`Configurações de ${channel.name}`} onClick={onSettings}><ControlIcon name="settings"/></button></div>
}
