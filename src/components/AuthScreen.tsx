import { useState } from 'react'
import { BrandMark } from './BrandMark'
import { useAuthStore, type SocialProvider } from '../store/useAuthStore'
import { GoogleLogo, LinkedInLogo, InstagramLogo } from './SocialAccountsManager'
import { ControlIcon } from './ControlIcon'

export function AuthScreen() {
  const [registering, setRegistering] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [socialModal, setSocialModal] = useState<{ provider: SocialProvider; name: string } | null>(null)
  const [socialInput, setSocialInput] = useState('')
  const [socialName, setSocialName] = useState('')
  const { login, register, loginWithSocial, isLoading, error, clearError } = useAuthStore()

  const handleSocialClick = async (provider: SocialProvider, name: string) => {
    clearError()
    // First try automatic 1-click login if an account is already linked locally
    const success = await loginWithSocial(provider)
    if (!success) {
      // If no local account matched yet, open the quick social sign-in dialog
      setSocialModal({ provider, name })
      setSocialInput('')
      setSocialName('')
    }
  }

  const handleConfirmSocialLogin = async () => {
    if (!socialModal) return
    const val = socialInput.trim()
    if (!val) return
    const isInstagram = socialModal.provider === 'instagram'
    const success = await loginWithSocial(socialModal.provider, {
      accountId: val,
      email: !isInstagram && val.includes('@') ? val : undefined,
      username: isInstagram ? val.replace(/^@/, '') : undefined,
      displayName: socialName.trim() || undefined
    })
    if (success) {
      setSocialModal(null)
    }
  }

  return (
    <div className="ct-app ct-auth">
      <form
        className="ct-edit-dialog"
        onSubmit={async e => {
          e.preventDefault()
          if (registering) await register(username, email, password)
          else await login(username, password)
        }}
      >
        <BrandMark className="ct-auth-logo" />
        <h1>{registering ? 'Criar conta' : 'Bem-vindo ao ConTALK'}</h1>

        <label>
          {registering ? 'Nome de usuário' : 'Usuário ou e-mail'}
          <input
            required
            autoComplete="username"
            {...(registering ? { pattern: '[A-Za-z0-9_\\-]{3,32}', title: 'De 3 a 32 letras, números, _ ou -' } : {})}
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
        </label>

        {registering && <small>De 3 a 32 letras, números, _ ou -. Senha com pelo menos 8 caracteres.</small>}
        {registering && (
          <label>
            E-mail
            <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
        )}

        <label>
          Senha
          <input
            type="password"
            required
            minLength={8}
            maxLength={200}
            autoComplete={registering ? 'new-password' : 'current-password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </label>

        {error && <p role="alert">{error}</p>}

        <button className="ct-primary" disabled={isLoading}>
          {isLoading ? 'Aguarde...' : registering ? 'Criar minha conta' : 'Entrar'}
        </button>

        {/* Divisor de Login Social */}
        <div className="ct-auth-divider">
          <span>ou continue com</span>
        </div>

        {/* Botões de Redes Sociais */}
        <div className="ct-auth-social-buttons">
          <button
            type="button"
            className="ct-social-btn ct-social-google"
            disabled={isLoading}
            onClick={() => void handleSocialClick('google', 'Google')}
            title="Entrar com conta Google"
          >
            <GoogleLogo size={18} />
            <span>Google</span>
          </button>

          <button
            type="button"
            className="ct-social-btn ct-social-linkedin"
            disabled={isLoading}
            onClick={() => void handleSocialClick('linkedin', 'LinkedIn')}
            title="Entrar com conta LinkedIn"
          >
            <LinkedInLogo size={18} />
            <span>LinkedIn</span>
          </button>

          <button
            type="button"
            className="ct-social-btn ct-social-instagram"
            disabled={isLoading}
            onClick={() => void handleSocialClick('instagram', 'Instagram')}
            title="Entrar com conta Instagram"
          >
            <InstagramLogo size={18} />
            <span>Instagram</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setRegistering(!registering)
            clearError()
          }}
        >
          {registering ? 'Já tenho conta' : 'Quero criar uma conta'}
        </button>
      </form>

      {/* Modal de Login Rápido com Rede Social */}
      {socialModal && (
        <div role="dialog" aria-modal="true" className="ct-modal-backdrop" onClick={() => setSocialModal(null)}>
          <div className="ct-social-modal" onClick={e => e.stopPropagation()}>
            <div className="ct-social-modal-header">
              <div className="ct-social-modal-title">
                {socialModal.provider === 'google' && <GoogleLogo size={20} />}
                {socialModal.provider === 'linkedin' && <LinkedInLogo size={20} />}
                {socialModal.provider === 'instagram' && <InstagramLogo size={20} />}
                <strong>Entrar com {socialModal.name}</strong>
              </div>
              <button
                type="button"
                className="ct-social-modal-close"
                aria-label="Fechar"
                onClick={() => setSocialModal(null)}
              >
                <ControlIcon name="close" size={14} />
              </button>
            </div>

            <div className="ct-social-modal-body">
              <p className="ct-social-modal-desc">
                Faça login ou crie sua conta instantaneamente usando seu perfil do {socialModal.name}.
              </p>

              <label className="ct-social-field">
                <span>
                  {socialModal.provider === 'instagram'
                    ? 'Seu @ no Instagram:'
                    : socialModal.provider === 'google'
                    ? 'Seu e-mail do Google:'
                    : 'E-mail ou perfil do LinkedIn:'}
                </span>
                <input
                  type="text"
                  className="ct-ai-input"
                  placeholder={
                    socialModal.provider === 'instagram'
                      ? '@seu_perfil'
                      : socialModal.provider === 'google'
                      ? 'usuario@gmail.com'
                      : 'seunome@linkedin'
                  }
                  value={socialInput}
                  autoFocus
                  onChange={e => setSocialInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleConfirmSocialLogin()
                    }
                  }}
                />
              </label>

              <label className="ct-social-field">
                <span>Nome de exibição (opcional):</span>
                <input
                  type="text"
                  className="ct-ai-input"
                  placeholder="Como quer ser chamado"
                  value={socialName}
                  onChange={e => setSocialName(e.target.value)}
                />
              </label>
            </div>

            <div className="ct-social-modal-footer">
              <button type="button" className="ct-btn-secondary" onClick={() => setSocialModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="ct-primary"
                disabled={isLoading || !socialInput.trim()}
                onClick={() => void handleConfirmSocialLogin()}
              >
                {isLoading ? 'Conectando…' : 'Continuar e Entrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
