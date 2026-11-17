import { useEffect, useState, type ReactNode } from 'react'
import { useVoiceStore } from '../store/useVoiceStore'

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

// Lista de membros à direita da conversa. As transmissões ficam na aba Chamada e no mini-player.
export function RightPanel({ members }: { onOpenChannel?: (id: string) => void; members: ReactNode; activeChannelId?: string }) {
  return (
    <aside className="ct-right-panel" aria-label="Membros">
      <section className="ct-rp-section ct-rp-members">{members}</section>
    </aside>
  )
}
