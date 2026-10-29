import { useState } from 'react'
import { useVoiceStore, type VoiceParticipant } from '../store/useVoiceStore'
import { Avatar } from './Avatar'
import { ControlIcon } from './ControlIcon'
import { useCallClock } from './RightPanel'
import { StageControls } from './StageControls'

export function ActiveCallCard({
  channelId,
  channelName,
  onOpenChannel,
  onProfile,
  onParticipantContextMenu,
}: {
  channelId: string
  channelName: string
  onOpenChannel: (id: string) => void
  onProfile?: (name: string, identity: string) => void
  onParticipantContextMenu?: (participant: VoiceParticipant, event: React.MouseEvent) => void
}) {
  const voice = useVoiceStore()
  const clock = useCallClock()
  const [error, setError] = useState('')
  const connected = voice.connectionStatus === 'connected'

  const run = async (action: () => Promise<unknown>) => {
    setError('')
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível realizar a ação.')
    }
  }

  return (
    <div className="ct-sidebar-call-card">
      <div className="ct-rp-call">
        <button className="ct-rp-call-title" onClick={() => onOpenChannel(channelId)} title={`Abrir canal ${channelName}`}>
          <span>
            <strong>{channelName}</strong>
            <small>
              {connected
                ? `${voice.participants.length} ${voice.participants.length === 1 ? 'participante' : 'participantes'} · ${clock}`
                : voice.connectionStatus === 'reconnecting'
                ? 'Reconectando…'
                : 'Conectando…'}
            </small>
          </span>
        </button>

        <div className="ct-rp-controls">
          <button
            aria-label={voice.isCameraOn ? 'Desligar câmera' : 'Ligar câmera'}
            title={voice.isCameraOn ? 'Desligar câmera' : 'Ligar câmera'}
            aria-pressed={voice.isCameraOn}
            disabled={!connected || voice.currentRoom?.localParticipant.canStream === false}
            onClick={() => void run(voice.toggleCamera)}
          >
            <ControlIcon name="camera" slashed={!voice.isCameraOn}/>
          </button>
          <button
            aria-label={voice.isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'}
            title={voice.isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'}
            aria-pressed={voice.isScreenSharing}
            disabled={!connected || voice.currentRoom?.localParticipant.canStream === false}
            onClick={() => void run(voice.toggleScreenShare)}
          >
            <ControlIcon name="screen"/>
          </button>
          <button
            className="ct-rp-leave"
            aria-label="Desconectar da chamada"
            title="Desconectar da chamada"
            onClick={() => void run(voice.leaveChannel)}
          >
            <ControlIcon name="disconnect"/>
          </button>
        </div>
      </div>

      <div className="ct-rp-call-participants">
        {voice.participants.map(p => (
          <button
            key={p.identity}
            className={`ct-rp-participant ${p.isSpeaking ? 'is-speaking' : ''}`}
            onClick={() => onProfile?.(p.name, p.identity)}
            onContextMenu={e => {
              e.preventDefault()
              onParticipantContextMenu?.(p, e)
            }}
            title={`${p.serverNickname || p.name}${p.isLocal ? ' (você)' : ''}${p.isSpeaking ? ' · Falando' : ''}`}
          >
            <Avatar name={p.name} identity={p.identity}  />
            <span className="truncate">{p.serverNickname || p.name}</span>
            {!p.isAudioEnabled && <span className="ct-rp-p-muted"><ControlIcon name="mic" slashed size={10}/></span>}
          </button>
        ))}
      </div>

      <StageControls />
      {error && <p className="ct-dock-error" role="alert">{error}</p>}
    </div>
  )
}
