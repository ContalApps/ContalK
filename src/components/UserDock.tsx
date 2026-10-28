import { pushToTalkKeys } from '../media/voice-input'
import { usePreferencesStore } from '../store/usePreferencesStore'
import { useState } from 'react'
import { useVoiceStore } from '../store/useVoiceStore'
import { useAuthStore } from '../store/useAuthStore'
import { useCommunityStore } from '../store/useCommunityStore'
import { Avatar } from './Avatar'
import { ControlIcon } from './ControlIcon'

export function UserDock({
  onProfile,
}: {
  onProfile: () => void
  onOpenChannel?: (id: string) => void
}) {
  const inputKey = usePreferencesStore(state => state.pushToTalkKey)
  const voice = useVoiceStore()
  const user = useAuthStore(s => s.user)
  const online = useCommunityStore(s => s.status === 'online')
  const [error, setError] = useState('')
  const micBlocked = voice.isServerMuted || voice.isServerDeafened || voice.currentRoom?.localParticipant.canPublishMicrophone === false
  const outputBlocked = voice.isServerDeafened
  const micLabel = micBlocked
    ? (voice.currentRoom?.stage?.audience ? 'Entre no palco para usar o microfone' : 'Microfone bloqueado pelo servidor')
    : voice.isMicMuted ? 'Ativar microfone' : 'Silenciar microfone'
  const outputLabel = outputBlocked ? 'Áudio bloqueado pelo servidor' : voice.isDeafened ? 'Ativar áudio' : 'Silenciar áudio'
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
    <section className="ct-user-dock" aria-label="Seu perfil e controles de voz">
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
            <small>
              {connected
                ? (voice.currentRoom?.inputMode === 'push-to-talk' && !voice.isMicMuted
                    ? (voice.voiceInputState === 'starting' ? 'Preparando atalho…' : (pushToTalkKeys[inputKey]?.label || inputKey) + (voice.voiceInputState === 'focused' ? ' · janela ativa' : ' para falar'))
                    : 'Em voz')
                : online ? 'Online' : 'Offline'}
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
      {(voice.isServerMuted || outputBlocked) && (
        <p className="ct-muted" role="status">
          {outputBlocked ? 'Áudio e microfone bloqueados pelo servidor' : 'Microfone bloqueado pelo servidor'}
        </p>
      )}
      {error && <p className="ct-dock-error" role="alert">{error}</p>}
    </section>
  )
}
