import { useState } from 'react'
import { useVoiceStore } from '../store/useVoiceStore'
import { ControlIcon } from './ControlIcon'

// Controles da chamada (microfone, áudio, câmera, tela e desconectar). Aparecem na pílula do palco
// e no mini-player; o card do usuário mantém microfone e áudio para quando não há chamada aberta na tela.
export function CallControls({ variant = 'pill' }: { variant?: 'pill' | 'mini' }) {
  const voice = useVoiceStore()
  const [error, setError] = useState('')
  const connected = voice.connectionStatus === 'connected'
  const micBlocked = voice.isServerMuted || voice.isServerDeafened || voice.currentRoom?.localParticipant.canPublishMicrophone === false
  const outputBlocked = voice.isServerDeafened
  const streamBlocked = !connected || voice.currentRoom?.localParticipant.canStream === false
  const micLabel = micBlocked
    ? (voice.currentRoom?.stage?.audience ? 'Entre no palco para usar o microfone' : 'Microfone bloqueado pelo servidor')
    : voice.isMicMuted ? 'Ativar microfone' : 'Silenciar microfone'
  const outputLabel = outputBlocked ? 'Áudio bloqueado pelo servidor' : voice.isDeafened ? 'Ativar áudio' : 'Silenciar áudio'
  const run = async (action: () => Promise<unknown>) => {
    setError('')
    try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível realizar a ação.') }
  }
  return (
    <div className={`ct-call-controls ct-call-controls-${variant}`} role="toolbar" aria-label="Controles da chamada">
      <button type="button" aria-label={micLabel} title={micLabel} aria-pressed={voice.isMicMuted || micBlocked} data-off={voice.isMicMuted || micBlocked} disabled={!connected || micBlocked} onClick={() => void run(voice.toggleMic)}>
        <ControlIcon name="mic" slashed={voice.isMicMuted || micBlocked} />
      </button>
      <button type="button" aria-label={outputLabel} title={outputLabel} aria-pressed={voice.isDeafened || outputBlocked} data-off={voice.isDeafened || outputBlocked} disabled={outputBlocked} onClick={() => void run(voice.toggleDeafen)}>
        <ControlIcon name="audio" slashed={voice.isDeafened || outputBlocked} />
      </button>
      <button type="button" aria-label={voice.isCameraOn ? 'Desligar câmera' : 'Ligar câmera'} title={voice.isCameraOn ? 'Desligar câmera' : 'Ligar câmera'} aria-pressed={voice.isCameraOn} data-on={voice.isCameraOn} disabled={streamBlocked} onClick={() => void run(voice.toggleCamera)}>
        <ControlIcon name="camera" slashed={!voice.isCameraOn} />
      </button>
      <button type="button" aria-label={voice.isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'} title={voice.isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'} aria-pressed={voice.isScreenSharing} data-on={voice.isScreenSharing} disabled={streamBlocked} onClick={() => void run(voice.toggleScreenShare)}>
        <ControlIcon name="screen" />
      </button>
      <button type="button" className="ct-call-leave" aria-label="Desconectar da chamada" title="Desconectar da chamada" onClick={() => void run(voice.leaveChannel)}>
        <ControlIcon name="disconnect" />
      </button>
      {error && <p className="ct-call-controls-error" role="alert">{error}</p>}
    </div>
  )
}
