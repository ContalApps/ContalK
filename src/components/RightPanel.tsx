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

export function RightPanel({ onOpenChannel, members }: { onOpenChannel: (id: string) => void; members: ReactNode }) {
  const voice = useVoiceStore()
  const shares = voice.participants.filter(p => p.isScreenShareEnabled && p.screenTrack)
  return <aside className="ct-right-panel" aria-label="Painel da chamada e participantes">
    {shares.length > 0 && <section className="ct-rp-section">
      <h2><ControlIcon name="screen" size={14}/>Compartilhamento de tela</h2>
      <div className="ct-rp-shares">{shares.map(p => <button key={p.identity} onClick={() => onOpenChannel(voice.activeChannelId!)} title={`Abrir a tela de ${p.serverNickname || p.name}`}>
        <span className="ct-rp-thumb"><VideoTrackView track={p.screenTrack!} isLocal={p.isLocal} className="ct-rp-video"/><span className="ct-live-badge">LIVE</span></span>
        <strong>{p.isLocal ? 'Você' : p.serverNickname || p.name}</strong>
      </button>)}</div>
    </section>}
    <section className="ct-rp-section ct-rp-members">{members}</section>
    <section className="ct-rp-section ct-rp-github-section">
      <div className="ct-rp-github-card">
        <header className="ct-rp-github-header">
          <div className="ct-rp-github-title">
            <ControlIcon name="git-branch" size={14}/>
            <span>GitHub</span>
          </div>
          <a href="https://github.com/ContalApps/ContalK" target="_blank" rel="noopener noreferrer" className="ct-rp-github-link">
            Abrir no GitHub
          </a>
        </header>
        <div className="ct-rp-github-repo">github.com/ContalApps/ContalK</div>
        <div className="ct-rp-github-branch">
          <small>Branch atual</small>
          <div className="ct-rp-branch-pill">
            <ControlIcon name="git-branch" size={12}/>
            <span>dev/caliari</span>
          </div>
        </div>
        <div className="ct-rp-github-commit">
          <div className="ct-rp-commit-header">
            <ControlIcon name="git-commit" size={12}/>
            <span>feature/collaborative-dev</span>
          </div>
          <p className="ct-rp-commit-msg">Central colaborativa de desenvolvimento</p>
          <div className="ct-rp-commit-meta">
            <small>Por Caliari · agora</small>
            <code>a3f9c2d</code>
          </div>
        </div>
      </div>
    </section>
  </aside>
}
