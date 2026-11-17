import { useState } from 'react'
import { useVoiceStore } from '../store/useVoiceStore'
import { useAuthStore } from '../store/useAuthStore'
import { useCommunityStore } from '../store/useCommunityStore'
import { Avatar } from './Avatar'
import { ControlIcon } from './ControlIcon'

// Card do usuário no rodapé da barra lateral: perfil, microfone, áudio e configurações.
// Os controles completos da chamada ficam na pílula do palco e no mini-player.
export function UserDock({ onProfile, onSettings }: { onProfile: () => void; onSettings: () => void }) {
  const voice = useVoiceStore()
  const user = useAuthStore(s => s.user)
  const online = useCommunityStore(s => s.status === 'online')
  const [error, setError] = useState('')

  const connected = Boolean(voice.activeChannelId && ['connected', 'connecting', 'reconnecting'].includes(voice.connectionStatus))
  const micBlocked = voice.isServerMuted || voice.isServerDeafened || voice.currentRoom?.localParticipant.canPublishMicrophone === false
  const outputBlocked = voice.isServerDeafened
  const micLabel = !connected
    ? 'Entre numa chamada para usar o microfone'
    : micBlocked
    ? (voice.currentRoom?.stage?.audience ? 'Entre no palco para usar o microfone' : 'Microfone bloqueado pelo servidor')
    : voice.isMicMuted ? 'Ativar microfone' : 'Silenciar microfone'
  const outputLabel = outputBlocked ? 'Áudio bloqueado pelo servidor' : voice.isDeafened ? 'Ativar áudio' : 'Silenciar áudio'
  const local = voice.participants.find(p => p.isLocal)
  const status = !connected
    ? (online ? 'Online' : 'Offline')
    : voice.isServerMuted ? 'Silenciado pelo servidor'
    : local && !local.isAudioEnabled ? 'Microfone desligado'
    : local?.isSpeaking ? 'Falando'
    : `Em ${voice.activeChannelName || 'chamada'}`

  const run = async (action: () => Promise<unknown>) => {
    setError('')
    try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível realizar a ação.') }
  }

  return (
    <section className="ct-user-dock" aria-label="Seu perfil e controles de voz">
      <div className="ct-dock-account">
        <button type="button" className="ct-dock-profile" data-profile-identity={user?.username} data-profile-name={user?.display_name} onClick={onProfile} title="Abrir seu perfil">
          <Avatar name={user?.display_name || 'Você'} identity={user?.username} live={voice.isScreenSharing} />
          <span>
            <strong>{user?.display_name}</strong>
            <small data-state={connected ? (local?.isSpeaking ? 'speaking' : 'call') : online ? 'online' : 'offline'}>{status}</small>
          </span>
        </button>
        <div className="ct-dock-devices">
          <button type="button" className="ct-dock-icon" aria-label={micLabel} title={micLabel} aria-pressed={connected && (voice.isMicMuted || micBlocked)} data-off={connected && (voice.isMicMuted || micBlocked)} disabled={!connected || micBlocked} onClick={() => void run(voice.toggleMic)}>
            <ControlIcon name="mic" slashed={connected && (voice.isMicMuted || micBlocked)} size={17} />
          </button>
          <button type="button" className="ct-dock-icon" aria-label={outputLabel} title={outputLabel} aria-pressed={voice.isDeafened || outputBlocked} data-off={voice.isDeafened || outputBlocked} disabled={outputBlocked} onClick={() => void run(voice.toggleDeafen)}>
            <ControlIcon name="audio" slashed={voice.isDeafened || outputBlocked} size={17} />
          </button>
          <button type="button" className="ct-dock-icon" aria-label="Configurações" title="Configurações (Ctrl+,)" onClick={onSettings}>
            <ControlIcon name="settings" size={17} />
          </button>
        </div>
      </div>
      {(voice.isServerMuted || outputBlocked) && (
        <p className="ct-muted" role="status">{outputBlocked ? 'Áudio e microfone bloqueados pelo servidor' : 'Microfone bloqueado pelo servidor'}</p>
      )}
      {error && <p className="ct-dock-error" role="alert">{error}</p>}
    </section>
  )
}
