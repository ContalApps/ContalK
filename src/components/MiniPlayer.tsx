import { useVoiceStore } from '../store/useVoiceStore'
import { Avatar } from './Avatar'
import { CallControls } from './CallControls'
import { ControlIcon } from './ControlIcon'
import { VideoTrackView } from './VoiceStage'

// Chamada minimizada num cartão flutuante no canto inferior direito, por cima da conversa.
export function MiniPlayer({ onExpand, collapsed, onCollapse }: { onExpand: () => void; collapsed: boolean; onCollapse: (collapsed: boolean) => void }) {
  const voice = useVoiceStore()
  const people = voice.participants
  const sharing = people.find(p => p.isScreenShareEnabled && p.screenTrack)
  // As transmissões da grade abrem sob demanda (0.1.44): só mostra o vídeo se ele já estiver aberto.
  const watching = sharing && (!voice.gridScreenTracks || voice.gridScreenTracks.has(sharing.screenTrack!))
  const name = (p: typeof people[number]) => p.isLocal ? 'Você' : p.serverNickname || p.name
  const title = voice.activeChannelName || 'Chamada'

  if (collapsed) {
    return (
      <button type="button" className="ct-mini-player-pill" onClick={() => onCollapse(false)} title="Mostrar a chamada">
        <span className="ct-mini-live-dot" aria-hidden="true" />
        <span>{title}</span>
        <small>{people.length} {people.length === 1 ? 'pessoa' : 'pessoas'}</small>
      </button>
    )
  }

  return (
    <section className="ct-mini-player" aria-label={`Chamada em ${title}`}>
      <header>
        <ControlIcon name="voice" size={16} />
        <button type="button" className="ct-mini-title" onClick={onExpand} title="Abrir a chamada">
          <strong>{title}</strong><small>· {people.length} {people.length === 1 ? 'pessoa' : 'pessoas'}</small>
        </button>
        <button type="button" className="ct-mini-icon" aria-label="Abrir a chamada" title="Abrir a chamada" onClick={onExpand}>
          <ControlIcon name="expand" size={15} />
        </button>
        <button type="button" className="ct-mini-icon" aria-label="Minimizar" title="Minimizar" onClick={() => onCollapse(true)}>
          <ControlIcon name="down" size={15} />
        </button>
      </header>
      {sharing && (
        <button type="button" className="ct-mini-screen" onClick={onExpand} title="Assistir na aba Chamada">
          {watching ? <VideoTrackView track={sharing.screenTrack!} isLocal={sharing.isLocal} className="ct-mini-video" /> : <span className="ct-mini-screen-closed"><ControlIcon name="screen" size={22} /></span>}
          <span className="ct-mini-chip"><ControlIcon name="screen" size={12} />{sharing.isLocal ? 'Você está compartilhando' : `${name(sharing)} está compartilhando`}</span>
        </button>
      )}
      <ul className="ct-mini-people">
        {people.slice(0, 6).map(p => (
          <li key={p.identity} data-speaking={p.isSpeaking} title={name(p)}>
            <Avatar name={p.name} identity={p.identity} />
            {!p.isAudioEnabled && <span className="ct-mini-muted" aria-label="Microfone desligado"><ControlIcon name="mic" slashed size={10} /></span>}
            <small>{name(p)}</small>
          </li>
        ))}
        {people.length > 6 && <li className="ct-mini-more"><span>+{people.length - 6}</span></li>}
      </ul>
      <CallControls variant="mini" />
    </section>
  )
}
