import { useState } from 'react'
import { useVoiceStore } from '../store/useVoiceStore'
import { useCallClock } from './RightPanel'
import { ControlIcon } from './ControlIcon'

// "Voz conectada" acima do card do usuário, como no Discord: canal atual, desconectar,
// câmera, tela e atalho para abrir a aba Chamada.
export function VoicePanel({ serverName, onOpen }: { serverName?: string; onOpen: () => void }) {
  const voice = useVoiceStore()
  const clock = useCallClock()
  const [error, setError] = useState('')
  const connected = voice.connectionStatus === 'connected'
  const streamBlocked = !connected || voice.currentRoom?.localParticipant.canStream === false
  const status = connected ? 'Voz conectada' : voice.connectionStatus === 'reconnecting' ? 'Reconectando…' : 'Conectando…'
  const run = async (action: () => Promise<unknown>) => {
    setError('')
    try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível realizar a ação.') }
  }
  return (
    <section className="ct-voice-panel" aria-label="Chamada atual" data-state={voice.connectionStatus}>
      <div className="ct-voice-panel-top">
        <button type="button" className="ct-voice-panel-info" onClick={onOpen} title="Abrir a chamada">
          <strong><ControlIcon name="signal" size={14} />{status}{connected && clock ? <small> · {clock}</small> : null}</strong>
          <small>{voice.activeChannelName || 'Chamada'}{serverName ? ` / ${serverName}` : ''}</small>
        </button>
        <button type="button" className="ct-voice-panel-leave" aria-label="Desconectar da chamada" title="Desconectar" onClick={() => void run(voice.leaveChannel)}>
          <ControlIcon name="disconnect" size={17} />
        </button>
      </div>
      <div className="ct-voice-panel-actions">
        <button type="button" aria-label={voice.isCameraOn ? 'Desligar câmera' : 'Ligar câmera'} title={voice.isCameraOn ? 'Desligar câmera' : 'Ligar câmera'} aria-pressed={voice.isCameraOn} data-on={voice.isCameraOn} disabled={streamBlocked} onClick={() => void run(voice.toggleCamera)}>
          <ControlIcon name="camera" slashed={!voice.isCameraOn} size={17} />
        </button>
        <button type="button" aria-label={voice.isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'} title={voice.isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'} aria-pressed={voice.isScreenSharing} data-on={voice.isScreenSharing} disabled={streamBlocked} onClick={() => void run(voice.toggleScreenShare)}>
          <ControlIcon name="screen" size={17} />
        </button>
        <button type="button" aria-label="Abrir a chamada" title="Abrir a chamada" onClick={onOpen}>
          <ControlIcon name="expand" size={17} />
        </button>
      </div>
      {error && <p className="ct-dock-error" role="alert">{error}</p>}
    </section>
  )
}
