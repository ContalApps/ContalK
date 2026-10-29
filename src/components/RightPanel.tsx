import { useEffect, useState, type ReactNode } from 'react'
import { useVoiceStore } from '../store/useVoiceStore'
import { ControlIcon } from './ControlIcon'
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

export function RightPanel({ onOpenChannel, members }: { onOpenChannel: (id: string) => void; members: ReactNode; activeChannelId?: string }) {
  const voice = useVoiceStore()
  const shares = voice.participants.filter(p => p.isScreenShareEnabled && p.screenTrack)
  return (
    <aside className="ct-right-panel" aria-label="Painel da chamada e participantes">
      {shares.length > 0 && (
        <section className="ct-rp-section">
          <h2><ControlIcon name="screen" size={14}/>Transmissões ao vivo</h2>
          <div className="ct-rp-shares">
            {shares.map(p => (
              <button
                key={p.identity}
                onClick={() => onOpenChannel(voice.activeChannelId!)}
                title={`Abrir a tela de ${p.serverNickname || p.name}`}
              >
                <span className="ct-rp-thumb">
                  <VideoTrackView track={p.screenTrack!} isLocal={p.isLocal} className="ct-rp-video" />
                  <span className="ct-live-badge">AO VIVO</span>
                </span>
                <strong>{p.isLocal ? 'Você' : p.serverNickname || p.name}</strong>
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="ct-rp-section ct-rp-members">{members}</section>
    </aside>
  )
}
