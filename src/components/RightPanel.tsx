import { useEffect, useState, type ReactNode } from 'react'
import { useVoiceStore } from '../store/useVoiceStore'
import { Avatar } from './Avatar'
import { ControlIcon } from './ControlIcon'
import { ScreenShareModal } from './ScreenShareModal'
import { VideoTrackView } from './VoiceStage'

// Shared by every clock so a panel opened mid-call shows the real call duration.
const callStart: { channel: string | null; at: number } = { channel: null, at: 0 }

export function useCallClock() {
  const { activeChannelId, connectionStatus } = useVoiceStore()
  const [now, setNow] = useState(Date.now())
  const live = !!activeChannelId && connectionStatus === 'connected'
  if (live && callStart.channel !== activeChannelId) Object.assign(callStart, { channel: activeChannelId, at: Date.now() })
  if (!live && callStart.channel) Object.assign(callStart, { channel: null, at: 0 })
  useEffect(() => { if (!live) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [live])
  if (!live) return ''
  const seconds = Math.max(0, Math.floor((now - callStart.at) / 1000))
  const h = Math.floor(seconds / 3600), m = Math.floor(seconds / 60) % 60, s = seconds % 60
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0')
}

export function RightPanel({ onOpenChannel, members }: { onOpenChannel: (id: string) => void; members: ReactNode }) {
  const voice = useVoiceStore()
  const clock = useCallClock()
  const [shareOpen, setShareOpen] = useState(false), [error, setError] = useState('')
  const connected = voice.connectionStatus === 'connected'
  const shares = voice.participants.filter(p => p.isScreenShareEnabled && p.screenTrack)
  const micBlocked = voice.isServerMuted || voice.isServerDeafened || voice.currentRoom?.localParticipant.canPublishMicrophone === false
  const run = async (action: () => Promise<unknown>) => { setError(''); try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível realizar a ação.') } }
  return <aside className="ct-right-panel" aria-label="Painel da chamada e participantes">
    {voice.activeChannelId && <section className="ct-rp-section">
      <h2><ControlIcon name="voice" size={14}/>Chamada de voz ativa</h2>
      <div className="ct-rp-call">
        <button className="ct-rp-call-title" onClick={() => onOpenChannel(voice.activeChannelId!)}>
          <span className="ct-home-tile"><ControlIcon name="audio"/></span>
          <span><strong>{voice.activeChannelName}</strong><small>{connected ? `${voice.participants.length} ${voice.participants.length === 1 ? 'participante' : 'participantes'} · ${clock}` : voice.connectionStatus === 'reconnecting' ? 'Reconectando…' : 'Conectando…'}</small></span>
        </button>
        <div className="ct-rp-controls">
          <button aria-label={voice.isMicMuted ? 'Ativar microfone' : 'Silenciar microfone'} title={voice.isMicMuted ? 'Ativar microfone' : 'Silenciar microfone'} aria-pressed={voice.isMicMuted || micBlocked} disabled={!connected || micBlocked} onClick={() => void run(voice.toggleMic)}><ControlIcon name="mic" slashed={voice.isMicMuted || micBlocked}/></button>
          <button aria-label={voice.isDeafened ? 'Ativar áudio' : 'Silenciar áudio'} title={voice.isDeafened ? 'Ativar áudio' : 'Silenciar áudio'} aria-pressed={voice.isDeafened} disabled={voice.isServerDeafened} onClick={() => void run(voice.toggleDeafen)}><ControlIcon name="audio" slashed={voice.isDeafened}/></button>
          <button aria-label={voice.isCameraOn ? 'Desligar câmera' : 'Ligar câmera'} title={voice.isCameraOn ? 'Desligar câmera' : 'Ligar câmera'} aria-pressed={voice.isCameraOn} disabled={!connected || voice.currentRoom?.localParticipant.canStream === false} onClick={() => void run(voice.toggleCamera)}><ControlIcon name="camera" slashed={!voice.isCameraOn}/></button>
          <button aria-label={voice.isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'} title={voice.isScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'} aria-pressed={voice.isScreenSharing} disabled={!connected || voice.currentRoom?.localParticipant.canStream === false} onClick={() => voice.isScreenSharing ? void run(voice.toggleScreenShare) : setShareOpen(true)}><ControlIcon name="screen"/></button>
          <button className="ct-rp-leave" aria-label="Desconectar da chamada" title="Desconectar da chamada" onClick={() => void run(voice.leaveChannel)}><ControlIcon name="disconnect"/></button>
        </div>
        <ul className="ct-rp-people">{voice.participants.map(p => <li key={p.identity}><Avatar name={p.serverNickname || p.name} identity={p.identity} live={p.isScreenShareEnabled}/><span><strong>{p.serverNickname || p.name}{p.isLocal ? ' (você)' : ''}</strong><small>{p.serverMuted ? 'Silenciado pelo servidor' : !p.isAudioEnabled ? 'Microfone desligado' : p.isSpeaking ? 'Falando agora' : 'Ouvindo'}</small></span>{p.isSpeaking && p.isAudioEnabled && <span className="ct-rp-speaking"><ControlIcon name="voice" size={16}/></span>}</li>)}</ul>
        {error && <p className="ct-dock-error" role="alert">{error}</p>}
      </div>
    </section>}
    {shares.length > 0 && <section className="ct-rp-section">
      <h2><ControlIcon name="screen" size={14}/>Compartilhamento de tela</h2>
      <div className="ct-rp-shares">{shares.map(p => <button key={p.identity} onClick={() => onOpenChannel(voice.activeChannelId!)} title={`Abrir a tela de ${p.serverNickname || p.name}`}>
        <span className="ct-rp-thumb"><VideoTrackView track={p.screenTrack!} isLocal={p.isLocal} className="ct-rp-video"/><span className="ct-live-badge">LIVE</span></span>
        <strong>{p.isLocal ? 'Você' : p.serverNickname || p.name}</strong>
      </button>)}</div>
    </section>}
    <section className="ct-rp-section ct-rp-members">{members}</section>
    <ScreenShareModal isOpen={shareOpen && connected} onClose={() => setShareOpen(false)} onStartShare={(source, options) => voice.startScreenShareWithOptions(source, options)}/>
  </aside>
}
