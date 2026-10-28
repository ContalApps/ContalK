import { useEffect, useState } from 'react'
import { useVoiceStore, type VoiceParticipant } from '../store/useVoiceStore'
import { Avatar } from './Avatar'
import { ControlIcon } from './ControlIcon'
import { useCallClock } from './RightPanel'
import { useSharedBrowserStore } from '../store/useSharedBrowserStore'
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
  const sharedBrowser = useSharedBrowserStore()
  const clock = useCallClock()
  const [error, setError] = useState('')
  const connected = voice.connectionStatus === 'connected'
  const micBlocked = voice.isServerMuted || voice.isServerDeafened || voice.currentRoom?.localParticipant.canPublishMicrophone === false
  const isRoomSharing = Boolean(sharedBrowser.activeSession && sharedBrowser.activeSession.roomId === channelId)
  const isSharingWeb = sharedBrowser.isSharing || isRoomSharing

  useEffect(() => {
    if (connected) {
      sharedBrowser.requestSync()
    }
  }, [connected])

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
            aria-label={
              sharedBrowser.isSharing
                ? 'Parar navegador compartilhado'
                : isRoomSharing
                ? `Navegador compartilhado por ${sharedBrowser.activeSession?.hostName || 'outro participante'}`
                : 'Compartilhar navegador web'
            }
            title={
              sharedBrowser.isSharing
                ? 'Parar navegador compartilhado'
                : isRoomSharing
                ? `Navegador compartilhado por ${sharedBrowser.activeSession?.hostName || 'outro participante'} (clique para abrir)`
                : 'Compartilhar navegador web em tempo real'
            }
            aria-pressed={isSharingWeb}
            disabled={!connected}
            onClick={() => {
              if (sharedBrowser.isSharing) {
                void sharedBrowser.stopSharing()
              } else if (isRoomSharing) {
                onOpenChannel(channelId)
              } else {
                void sharedBrowser.startSharing(channelId)
              }
            }}
          >
            <ControlIcon name="browser"/>
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

        <ul className="ct-rp-people">
          {voice.participants.map(p => (
            <li
              key={p.identity}
              onClick={() => onProfile?.(p.serverNickname || p.name, p.identity)}
              onContextMenu={e => {
                e.preventDefault()
                onParticipantContextMenu?.(p, e)
              }}
              style={{ cursor: 'pointer' }}
            >
              <Avatar name={p.serverNickname || p.name} identity={p.identity} live={p.isScreenShareEnabled}/>
              <span>
                <strong>{p.serverNickname || p.name}{p.isLocal ? ' (você)' : ''}</strong>
                <small className={p.isSpeaking ? 'ct-status-speaking' : 'ct-status-listening'}>
                  {p.serverMuted
                    ? 'Silenciado pelo servidor'
                    : !p.isAudioEnabled
                    ? 'Microfone desligado'
                    : p.isSpeaking
                    ? 'Falando agora'
                    : 'Ouvindo'}
                </small>
              </span>
              {p.isLocal ? (
                <div className="ct-rp-local-devices" onClick={e => e.stopPropagation()}>
                  <button
                    className="ct-rp-device-btn"
                    aria-label={voice.isMicMuted ? 'Ativar microfone' : 'Silenciar microfone'}
                    title={voice.isMicMuted ? 'Ativar microfone' : 'Silenciar microfone'}
                    aria-pressed={voice.isMicMuted || micBlocked}
                    disabled={!connected || micBlocked}
                    onClick={() => void run(voice.toggleMic)}
                  >
                    <ControlIcon name="mic" slashed={voice.isMicMuted || micBlocked} size={15}/>
                  </button>
                  <button
                    className="ct-rp-device-btn"
                    aria-label={voice.isDeafened ? 'Ativar áudio' : 'Silenciar áudio'}
                    title={voice.isDeafened ? 'Ativar áudio' : 'Silenciar áudio'}
                    aria-pressed={voice.isDeafened}
                    disabled={voice.isServerDeafened}
                    onClick={() => void run(voice.toggleDeafen)}
                  >
                    <ControlIcon name="audio" slashed={voice.isDeafened} size={15}/>
                  </button>
                </div>
              ) : (
                p.isSpeaking && p.isAudioEnabled && (
                  <span className="ct-rp-speaking"><ControlIcon name="voice" size={16}/></span>
                )
              )}
            </li>
          ))}
        </ul>

        {voice.currentRoom?.stage && <StageControls/>}
        {error && <p className="ct-dock-error" role="alert">{error}</p>}
      </div>
    </div>
  )
}
