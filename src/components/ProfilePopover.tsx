import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '../store/useAuthStore'
import { useVoiceStore } from '../store/useVoiceStore'
import { usePresenceStatus, PRESENCE_STATUSES, statusHint, statusLabel, type PresenceStatus } from '../store/usePresenceStatus'
import { Avatar } from './Avatar'
import { ControlIcon } from './ControlIcon'

function StatusDot({ status }: { status: PresenceStatus }) {
  return <span className="ct-status-dot" data-status={status === 'invisible' ? 'offline' : status} aria-hidden="true" />
}

// Cartão do próprio perfil aberto pelo card do usuário, como no Discord: banner, foto, status,
// chamada atual e atalhos (editar perfil, status, copiar usuário, configurações e sair).
export function ProfilePopover({ onClose, onEditProfile, onSettings, onOpenCall, onSignOut, serverName }: {
  onClose: () => void
  onEditProfile: () => void
  onSettings: () => void
  onOpenCall: () => void
  onSignOut: () => void
  serverName?: string
}) {
  const user = useAuthStore(s => s.user)
  const voice = useVoiceStore()
  const { status, setStatus } = usePresenceStatus()
  const [statusOpen, setStatusOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node) && !(event.target as Element).closest?.('.ct-dock-profile')) onClose() }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); if (statusOpen) setStatusOpen(false); else onClose() } }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('keydown', escape, true)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape, true) }
  }, [onClose, statusOpen])
  if (!user) return null
  const inCall = !!voice.activeChannelId && ['connected', 'connecting', 'reconnecting'].includes(voice.connectionStatus)
  const copy = async () => {
    try { await navigator.clipboard.writeText(user.username); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { /* Sem área de transferência. */ }
  }

  // Fora da barra lateral: o desfoque dela (Vice City) prenderia e cortaria o cartão.
  return createPortal(
    <div className="ct-profile-popover" ref={root} role="dialog" aria-label="Seu perfil">
      <div className="ct-profile-popover-banner" />
      <div className="ct-profile-popover-head">
        <span className="ct-profile-popover-avatar"><Avatar name={user.display_name} identity={user.username} large /></span>
      </div>
      <div className="ct-profile-popover-body">
        <strong className="ct-profile-popover-name">{user.display_name}</strong>
        <small className="ct-profile-popover-user">{user.username}</small>
        {user.bio && <p className="ct-profile-popover-bio">{user.bio}</p>}

        {inCall && (
          <section className="ct-profile-popover-card" aria-label="Em voz">
            <span className="ct-profile-popover-label">Em voz</span>
            <div className="ct-profile-popover-voice">
              <span className="ct-profile-popover-voice-icon"><ControlIcon name="voice" size={18} /></span>
              <span><strong>{voice.activeChannelName}</strong>{serverName && <small>em {serverName}</small>}</span>
            </div>
            <button type="button" className="ct-button-secondary" onClick={() => { onOpenCall(); onClose() }}>Abrir chamada de voz</button>
          </section>
        )}

        <section className="ct-profile-popover-card ct-profile-popover-menu">
          <button type="button" onClick={() => { onEditProfile(); onClose() }}><ControlIcon name="edit" size={16} /><span>Editar perfil</span></button>
          <div className="ct-profile-popover-status">
            <button type="button" aria-haspopup="menu" aria-expanded={statusOpen} onClick={() => setStatusOpen(open => !open)}>
              <StatusDot status={status} /><span>{statusLabel[status]}</span><ControlIcon name="chevron-right" size={16} />
            </button>
            {statusOpen && (
              <div className="ct-status-menu" role="menu" aria-label="Status">
                {PRESENCE_STATUSES.map(option => (
                  <button type="button" role="menuitemradio" aria-checked={option === status} key={option} onClick={() => { setStatus(option); setStatusOpen(false) }}>
                    <StatusDot status={option} />
                    <span><strong>{statusLabel[option]}</strong>{statusHint[option] && <small>{statusHint[option]}</small>}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="ct-profile-popover-card ct-profile-popover-menu">
          <button type="button" onClick={() => void copy()}><ControlIcon name="copy" size={16} /><span>{copied ? 'Copiado!' : 'Copiar nome de usuário'}</span></button>
          <button type="button" onClick={() => { onSettings(); onClose() }}><ControlIcon name="settings" size={16} /><span>Configurações</span></button>
          <button type="button" className="ct-danger-item" onClick={() => { onClose(); onSignOut() }}><ControlIcon name="back" size={16} /><span>Sair da conta</span></button>
        </section>
      </div>
    </div>,
    document.querySelector('.ct-app') || document.body
  )
}
