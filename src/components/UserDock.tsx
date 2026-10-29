import { useState } from 'react'
import { useVoiceStore } from '../store/useVoiceStore'
import { useAuthStore } from '../store/useAuthStore'
import { useCommunityStore } from '../store/useCommunityStore'
import { useCallClock } from './RightPanel'
import { Avatar } from './Avatar'
import { ControlIcon } from './ControlIcon'

export function UserDock({
  onProfile,
  onOpenChannel,
}: {
  onProfile: () => void
  onOpenChannel?: (id: string) => void
}) {
  const voice = useVoiceStore()
  const user = useAuthStore(s => s.user)
  const online = useCommunityStore(s => s.status === 'online')
  const clock = useCallClock()
  const [error, setError] = useState('')

  const activeId = voice.activeChannelId
  const connected = Boolean(activeId && ['connected', 'connecting', 'reconnecting'].includes(voice.connectionStatus))

  const micBlocked = voice.isServerMuted || voice.isServerDeafened || voice.currentRoom?.localParticipant.canPublishMicrophone === false
  const outputBlocked = voice.isServerDeafened
  const micLabel = micBlocked
    ? (voice.currentRoom?.stage?.audience ? 'Entre no palco para usar o microfone' : 'Microfone bloqueado pelo servidor')
    : voice.isMicMuted ? 'Ativar microfone' : 'Silenciar microfone'
  const outputLabel = outputBlocked ? 'Áudio bloqueado pelo servidor' : voice.isDeafened ? 'Ativar áudio' : 'Silenciar áudio'

  const localParticipant = voice.participants.find(p => p.isLocal)
  const localAudioEnabled = localParticipant ? localParticipant.isAudioEnabled : !voice.isMicMuted
  const isLocalSpeaking = localParticipant?.isSpeaking

  const run = async (action: () => Promise<unknown>) => {
    setError('')
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível realizar a ação.')
    }
  }

  return (
    <section className="ct-user-dock" aria-label="Seu perfil e controles de voz">
      {connected ? (
        <div className="ct-dock-call-card">
          <button
            className="ct-dock-call-title"
            onClick={() => activeId && onOpenChannel?.(activeId)}
            title={`Abrir canal ${voice.activeChannelName || ''}`}
          >
            <span>
              <strong>{voice.activeChannelName || 'Em chamada'}</strong>
              <small>
                {voice.connectionStatus === 'connected'
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
              disabled={voice.connectionStatus !== 'connected' || voice.currentRoom?.localParticipant.canStream === false}
              onClick={() => void run(voice.toggleCamera)}
            >
              <ControlIcon name="camera" slashed={!voice.isCameraOn} />
            </button>
            <button
              aria-label={voice.isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'}
              title={voice.isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'}
              aria-pressed={voice.isScreenSharing}
              disabled={voice.connectionStatus !== 'connected' || voice.currentRoom?.localParticipant.canStream === false}
              onClick={() => void run(voice.toggleScreenShare)}
            >
              <ControlIcon name="screen" />
            </button>
            
            <button
              className="ct-rp-leave"
              aria-label="Desconectar da chamada"
              title="Desconectar da chamada"
              onClick={() => void run(voice.leaveChannel)}
            >
              <ControlIcon name="disconnect" />
            </button>
          </div>

          <div className="ct-dock-account">
            <button
              className="ct-dock-profile"
              data-profile-identity={user?.username}
              data-profile-name={user?.display_name}
              onClick={onProfile}
              title="Perfil · clique para abrir perfil ou configurações"
            >
              <Avatar name={user?.display_name || 'Você'} identity={user?.username} live={voice.isScreenSharing} />
              <span>
                <strong>{user?.display_name} (você)</strong>
                <small className={isLocalSpeaking ? 'ct-status-speaking' : 'ct-status-listening'}>
                  {voice.isServerMuted
                    ? 'Silenciado pelo servidor'
                    : !localAudioEnabled
                    ? 'Microfone desligado'
                    : isLocalSpeaking
                    ? 'Falando agora'
                    : 'Ouvindo'}
                </small>
              </span>
            </button>

            <div className="ct-dock-devices">
              <div className="ct-dock-split">
                <button
                  className="ct-dock-icon"
                  aria-label={micLabel}
                  title={micLabel}
                  aria-pressed={voice.isMicMuted || micBlocked}
                  disabled={!connected || micBlocked}
                  onClick={() => void run(voice.toggleMic)}
                >
                  <ControlIcon name="mic" slashed={voice.isMicMuted || micBlocked} />
                </button>
              </div>
              <div className="ct-dock-split">
                <button
                  className="ct-dock-icon"
                  aria-label={outputLabel}
                  title={outputLabel}
                  aria-pressed={voice.isDeafened || outputBlocked}
                  disabled={outputBlocked}
                  onClick={() => void run(voice.toggleDeafen)}
                >
                  <ControlIcon name="audio" slashed={voice.isDeafened || outputBlocked} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="ct-dock-account">
          <button
            className="ct-dock-profile"
            data-profile-identity={user?.username}
            data-profile-name={user?.display_name}
            onClick={onProfile}
            title="Perfil · clique para abrir perfil ou configurações"
          >
            <Avatar name={user?.display_name || 'Você'} identity={user?.username} live={voice.isScreenSharing} />
            <span>
              <strong>{user?.display_name}</strong>
              <small>{online ? 'Online' : 'Offline'}</small>
            </span>
          </button>

          <div className="ct-dock-devices">
            <div className="ct-dock-split">
              <button
                className="ct-dock-icon"
                aria-label={micLabel}
                title={micLabel}
                aria-pressed={voice.isMicMuted || micBlocked}
                disabled={!connected || micBlocked}
                onClick={() => void run(voice.toggleMic)}
              >
                <ControlIcon name="mic" slashed={voice.isMicMuted || micBlocked} />
              </button>
            </div>
            <div className="ct-dock-split">
              <button
                className="ct-dock-icon"
                aria-label={outputLabel}
                title={outputLabel}
                aria-pressed={voice.isDeafened || outputBlocked}
                disabled={outputBlocked}
                onClick={() => void run(voice.toggleDeafen)}
              >
                <ControlIcon name="audio" slashed={voice.isDeafened || outputBlocked} />
              </button>
            </div>
          </div>
        </div>
      )}
      {(voice.isServerMuted || outputBlocked) && (
        <p className="ct-muted" role="status">
          {outputBlocked ? 'Áudio e microfone bloqueados pelo servidor' : 'Microfone bloqueado pelo servidor'}
        </p>
      )}
      {error && <p className="ct-dock-error" role="alert">{error}</p>}
    </section>
  )
}
