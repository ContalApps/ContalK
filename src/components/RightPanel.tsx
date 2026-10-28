import { useEffect, useState, type ReactNode } from 'react'
import { useVoiceStore } from '../store/useVoiceStore'
import { useSharedBrowserStore } from '../store/useSharedBrowserStore'
import { useDevStore } from '../store/useDevStore'
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

export function RightPanel({ onOpenChannel, members, activeChannelId }: { onOpenChannel: (id: string) => void; members: ReactNode; activeChannelId?: string }) {
  const voice = useVoiceStore()
  const sharedBrowser = useSharedBrowserStore()
  const devStore = useDevStore()
  const boundRepo = activeChannelId ? devStore.getChannelRepo(activeChannelId) : null
  const currentRepo = boundRepo || devStore.repositories[0] || null
  const shares = voice.participants.filter(p => p.isScreenShareEnabled && p.screenTrack)
  return <aside className="ct-right-panel" aria-label="Painel da chamada e participantes">
    {shares.length > 0 && <section className="ct-rp-section">
      <h2><ControlIcon name="screen" size={14}/>Compartilhamento de tela</h2>
      <div className="ct-rp-shares">{shares.map(p => <button key={p.identity} onClick={() => onOpenChannel(voice.activeChannelId!)} title={`Abrir a tela de ${p.serverNickname || p.name}`}>
        <span className="ct-rp-thumb"><VideoTrackView track={p.screenTrack!} isLocal={p.isLocal} className="ct-rp-video"/><span className="ct-live-badge">LIVE</span></span>
        <strong>{p.isLocal ? 'Você' : p.serverNickname || p.name}</strong>
      </button>)}</div>
    </section>}
    {sharedBrowser.activeSession && <section className="ct-rp-section">
      <h2><ControlIcon name="globe" size={14}/>Navegador Compartilhado</h2>
      <div className="ct-rp-shares">
        <button onClick={() => onOpenChannel(sharedBrowser.activeSession!.roomId)} title={`Abrir navegador de ${sharedBrowser.activeSession.hostName}`}>
          <span className="ct-rp-thumb">
            {sharedBrowser.activeSession.screenshot ? (
              <img src={sharedBrowser.activeSession.screenshot} alt="" className="ct-rp-video" style={{ objectFit: 'cover' }} />
            ) : (
              <div className="ct-rp-video" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}><ControlIcon name="globe" size={16}/></div>
            )}
            <span className="ct-live-badge">WEB</span>
          </span>
          <strong>{sharedBrowser.activeSession.hostName}</strong>
        </button>
      </div>
    </section>}
    <section className="ct-rp-section ct-rp-members">{members}</section>
    <section className="ct-rp-section ct-rp-github-section">
      <div className="ct-rp-github-card">
        <header className="ct-rp-github-header">
          <div className="ct-rp-github-title">
            <ControlIcon name="git-branch" size={14}/>
            <span>{boundRepo ? 'Repositório do Canal' : 'GitHub'}</span>
          </div>
          {currentRepo && (
            <a href={currentRepo.htmlUrl} target="_blank" rel="noopener noreferrer" className="ct-rp-github-link">
              Abrir no GitHub
            </a>
          )}
        </header>
        <div className="ct-rp-github-repo">{currentRepo ? currentRepo.fullName : 'github.com/ContalApps/ContalK'}</div>
        {currentRepo && (
          <div className="ct-rp-github-branch">
            <small>Branch padrão</small>
            <div className="ct-rp-branch-pill">
              <ControlIcon name="git-branch" size={12}/>
              <span>{currentRepo.defaultBranch || 'main'}</span>
            </div>
          </div>
        )}
        <div className="ct-rp-github-commit">
          <div className="ct-rp-commit-header">
            <ControlIcon name={boundRepo ? 'ai' : 'git-commit'} size={12}/>
            <span>{boundRepo ? 'IA Conectada ao Repositório' : 'Central Colaborativa'}</span>
          </div>
          <p className="ct-rp-commit-msg">
            {boundRepo?.description || 'Trabalhe e converse diretamente sobre este repositório.'}
          </p>
          <div className="ct-rp-commit-meta">
            <small>{boundRepo ? (boundRepo.isPrivate ? 'Privado' : 'Público') : 'Branch dev/caliari'}</small>
            {currentRepo?.language && <code>{currentRepo.language}</code>}
          </div>
        </div>
      </div>
    </section>
  </aside>
}
