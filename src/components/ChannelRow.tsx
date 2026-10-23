import type { Channel } from '../store/useAppStore'

export function ChannelRow({ channel, active, count, onOpen, onDelete }: { channel: Channel; active: boolean; count?: number; onOpen: () => void; onDelete: () => void }) {
  return <div className={`ct-channel-row ${active ? 'active' : ''}`} onContextMenu={e => { e.preventDefault(); onDelete() }}>
    <button className={`ct-channel ${active ? 'active' : ''}`} onClick={onOpen}><span className="ct-icon" aria-hidden="true">{channel.type === 'text' ? '#' : '≋'}</span><span>{channel.name}</span>{!!count && <small>{count}</small>}</button>
    <button className="ct-channel-delete" title={`Excluir canal ${channel.name}`} aria-label={`Excluir canal ${channel.name}`} onClick={onDelete}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg></button>
  </div>
}
