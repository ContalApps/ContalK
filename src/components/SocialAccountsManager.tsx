import { useState, type ReactNode } from 'react'
import { useAuthStore, type SocialProvider } from '../store/useAuthStore'
import { ControlIcon } from './ControlIcon'

export function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
    </svg>
  )
}

export function LinkedInLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="#0A66C2">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
    </svg>
  )
}

export function InstagramLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <radialGradient id="ig-grad" cx="20%" cy="100%" r="130%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="5%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="22" height="22" x="1" y="1" rx="6" fill="url(#ig-grad)" />
      <rect width="16" height="16" x="4" y="4" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.8" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="16.5" cy="7.5" r="1.1" fill="#fff" />
    </svg>
  )
}

interface SocialAccountInfo {
  provider: SocialProvider
  name: string
  description: string
  icon: ReactNode
  placeholder: string
  example: string
}

const PROVIDERS: SocialAccountInfo[] = [
  {
    provider: 'google',
    name: 'Google',
    description: 'Login direto de 1 clique, sincronização de perfil e e-mail Gmail.',
    icon: <GoogleLogo size={20} />,
    placeholder: 'seu.email@gmail.com',
    example: 'ex: usuario@gmail.com'
  },
  {
    provider: 'linkedin',
    name: 'LinkedIn',
    description: 'Login profissional, exibição de cargo e sincronização de networking.',
    icon: <LinkedInLogo size={20} />,
    placeholder: 'nome ou url do perfil',
    example: 'ex: linkedin.com/in/seunome'
  },
  {
    provider: 'instagram',
    name: 'Instagram',
    description: 'Login social e exibição do seu @ de criador na comunidade.',
    icon: <InstagramLogo size={20} />,
    placeholder: '@seu_usuario',
    example: 'ex: @meu_instagram'
  }
]

export function SocialAccountsManager() {
  const user = useAuthStore(s => s.user)
  const { linkSocialAccount, unlinkSocialAccount } = useAuthStore()
  const [modalProvider, setModalProvider] = useState<SocialAccountInfo | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [displayNameInput, setDisplayNameInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  if (!user) return null

  const linkedAccounts = user.linkedAccounts || {}

  const handleOpenLinkModal = (info: SocialAccountInfo) => {
    setModalProvider(info)
    setInputValue(user.email || '')
    setDisplayNameInput(user.display_name || user.username)
    setError('')
  }

  const handleConfirmLink = async () => {
    if (!modalProvider) return
    const val = inputValue.trim()
    if (!val) {
      setError(`Informe seu ${modalProvider.provider === 'instagram' ? 'usuário (@)' : 'e-mail ou identificador'}.`)
      return
    }

    setBusy(true)
    setError('')
    try {
      const isInstagram = modalProvider.provider === 'instagram'
      const cleanHandle = isInstagram ? val.replace(/^@/, '') : val
      const email = !isInstagram && val.includes('@') ? val : undefined

      await linkSocialAccount(modalProvider.provider, {
        accountId: val,
        email,
        username: isInstagram ? cleanHandle : undefined,
        displayName: displayNameInput.trim() || user.display_name,
        linkedAt: new Date().toISOString()
      })

      setSuccessMessage(`Conta do ${modalProvider.name} vinculada com sucesso!`)
      setTimeout(() => setSuccessMessage(''), 4000)
      setModalProvider(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao vincular conta.')
    } finally {
      setBusy(false)
    }
  }

  const handleUnlink = async (provider: SocialProvider, name: string) => {
    if (!confirm(`Deseja realmente desvincular sua conta do ${name}?`)) return
    setBusy(true)
    try {
      await unlinkSocialAccount(provider)
      setSuccessMessage(`Conta do ${name} desvinculada.`)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao desvincular conta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ct-social-accounts-manager">
      <div className="ct-settings-section-title">
        <h2>Contas Vinculadas e Redes Sociais</h2>
        <span>Vincule suas redes sociais para entrar no ConTALK com 1 clique (login social federado) sem precisar digitar senha.</span>
      </div>

      {successMessage && (
        <div className="ct-social-alert is-success" role="status">
          <ControlIcon name="check" size={14} />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="ct-social-alert is-error" role="alert">
          <ControlIcon name="close" size={14} />
          <span>{error}</span>
        </div>
      )}

      <div className="ct-social-cards-list">
        {PROVIDERS.map(p => {
          const linked = linkedAccounts[p.provider]
          const isConnected = !!linked

          return (
            <div key={p.provider} className={`ct-social-card ${isConnected ? 'is-connected' : ''}`}>
              <div className="ct-social-card-left">
                <div className="ct-social-card-icon">
                  {p.icon}
                </div>
                <div className="ct-social-card-details">
                  <div className="ct-social-card-title-row">
                    <strong>{p.name}</strong>
                    <span className={`ct-social-badge ${isConnected ? 'is-linked' : 'is-unlinked'}`}>
                      {isConnected ? 'Vinculado ✓' : 'Não vinculado'}
                    </span>
                  </div>
                  <p className="ct-social-card-status">
                    {isConnected ? (
                      <span className="ct-social-linked-info">
                        Conectado como: <code>{linked.email || (linked.username ? `@${linked.username}` : linked.displayName || linked.accountId)}</code>
                      </span>
                    ) : (
                      p.description
                    )}
                  </p>
                </div>
              </div>

              <div className="ct-social-card-actions">
                {isConnected ? (
                  <button
                    type="button"
                    className="ct-btn-secondary ct-social-unlink-btn"
                    disabled={busy}
                    onClick={() => void handleUnlink(p.provider, p.name)}
                    title={`Desvincular sua conta ${p.name}`}
                  >
                    <ControlIcon name="close" size={12} />
                    <span>Desvincular</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ct-primary ct-social-link-btn"
                    disabled={busy}
                    onClick={() => handleOpenLinkModal(p)}
                    title={`Vincular sua conta ${p.name}`}
                  >
                    <span>Vincular {p.name}</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {modalProvider && (
        <div role="dialog" aria-modal="true" className="ct-modal-backdrop" onClick={() => setModalProvider(null)}>
          <div className="ct-social-modal" onClick={e => e.stopPropagation()}>
            <div className="ct-social-modal-header">
              <div className="ct-social-modal-title">
                {modalProvider.icon}
                <strong>Vincular conta do {modalProvider.name}</strong>
              </div>
              <button
                type="button"
                className="ct-social-modal-close"
                aria-label="Fechar"
                onClick={() => setModalProvider(null)}
              >
                <ControlIcon name="close" size={14} />
              </button>
            </div>

            <div className="ct-social-modal-body">
              <p className="ct-social-modal-desc">
                Conecte seu perfil do {modalProvider.name} para ativar o login direto de 1 clique no ConTALK.
              </p>

              <label className="ct-social-field">
                <span>{modalProvider.provider === 'instagram' ? 'Nome de usuário (@ do Instagram):' : 'E-mail ou perfil da conta:'}</span>
                <input
                  type="text"
                  className="ct-ai-input"
                  placeholder={modalProvider.placeholder}
                  value={inputValue}
                  autoFocus
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleConfirmLink()
                    }
                  }}
                />
                <small>{modalProvider.example}</small>
              </label>

              <label className="ct-social-field">
                <span>Nome de exibição (opcional):</span>
                <input
                  type="text"
                  className="ct-ai-input"
                  placeholder="Seu nome completo"
                  value={displayNameInput}
                  onChange={e => setDisplayNameInput(e.target.value)}
                />
              </label>

              {error && (
                <div className="ct-social-alert is-error" role="alert">
                  <ControlIcon name="close" size={13} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="ct-social-modal-footer">
              <button
                type="button"
                className="ct-btn-secondary"
                disabled={busy}
                onClick={() => setModalProvider(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="ct-primary"
                disabled={busy || !inputValue.trim()}
                onClick={() => void handleConfirmLink()}
              >
                {busy ? 'Vinculando…' : 'Confirmar e Vincular'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
