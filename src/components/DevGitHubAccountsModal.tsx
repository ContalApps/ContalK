import { useState, useId } from 'react'
import { useDevStore } from '../store/useDevStore'
import { ControlIcon } from './ControlIcon'

export function DevGitHubAccountsModal({ onClose }: { onClose: () => void }) {
  const {
    githubAccounts,
    activeAccountId,
    addGitHubAccount,
    removeGitHubAccount,
    setActiveGitHubAccount,
    repositories,
    refreshRepositories,
    loadingRepos,
    githubError
  } = useDevStore()

  const [inputVal, setInputVal] = useState('')
  const [authMode, setAuthMode] = useState<'token' | 'user'>('token')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const inputId = useId()

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputVal.trim()) return
    setLocalError(null)
    setIsSubmitting(true)
    try {
      await addGitHubAccount(inputVal.trim(), authMode)
      setInputVal('')
    } catch (err) {
      setLocalError((err as Error).message || 'Erro ao conectar conta GitHub.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="ct-modal-backdrop" onClick={onClose}>
      <section className="ct-dev-modal-panel ct-gh-accounts-dialog" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <header className="ct-dev-modal-header">
          <div>
            <h2><ControlIcon name="git" size={16}/> Contas GitHub — Gerenciamento Multi-Conta</h2>
            <p>Vincule múltiplas contas GitHub para gerenciar repositórios, sincronizar branches e trabalhar em equipe.</p>
          </div>
          <div className="ct-dev-header-actions">
            <button
              type="button"
              className="ct-refresh-btn"
              onClick={() => void refreshRepositories()}
              disabled={loadingRepos}
              title="Atualizar lista de repositórios"
            >
              <ControlIcon name="refresh" size={13}/>
              <span>{loadingRepos ? 'Sincronizando…' : 'Atualizar Repos'}</span>
            </button>
            <button type="button" className="ct-close-btn" onClick={onClose} aria-label="Fechar">
              <ControlIcon name="close" size={14}/>
            </button>
          </div>
        </header>

        <div className="ct-gh-accounts-body">
          {/* Add Account Section */}
          <div className="ct-gh-add-card">
            <h3>Vincular Nova Conta GitHub</h3>
            <p className="ct-gh-add-desc">
              Você pode vincular seu <strong>Personal Access Token (PAT)</strong> (recomendado para repositórios privados e públicos) ou apenas seu <strong>nome de usuário</strong>.
            </p>

            <div className="ct-gh-auth-tabs">
              <button
                type="button"
                className={authMode === 'token' ? 'active' : ''}
                onClick={() => setAuthMode('token')}
              >
                Personal Access Token (PAT)
              </button>
              <button
                type="button"
                className={authMode === 'user' ? 'active' : ''}
                onClick={() => setAuthMode('user')}
              >
                Apenas Usuário (Público)
              </button>
            </div>

            <form onSubmit={handleAdd} className="ct-gh-add-form">
              <div className="ct-gh-input-group">
                <label htmlFor={inputId}>
                  {authMode === 'token' ? 'GitHub Personal Access Token:' : 'Usuário ou Organização GitHub:'}
                </label>
                <div className="ct-gh-input-row">
                  <input
                    id={inputId}
                    type={authMode === 'token' ? 'password' : 'text'}
                    placeholder={authMode === 'token' ? 'ghp_xxxxxxxxxxxxxxxxxxxx' : 'Ex: ContalApps ou linus-torvalds'}
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    required
                    autoFocus
                  />
                  <button type="submit" className="ct-primary" disabled={isSubmitting || !inputVal.trim()}>
                    <ControlIcon name="plus" size={13}/>
                    <span>{isSubmitting ? 'Vinculando…' : 'Vincular Conta'}</span>
                  </button>
                </div>
              </div>
            </form>

            {(localError || githubError) && (
              <div className="ct-error-banner">
                <ControlIcon name="alert" size={14}/>
                <span>{localError || githubError}</span>
              </div>
            )}
          </div>

          {/* List of Connected Accounts */}
          <div className="ct-gh-connected-section">
            <div className="ct-gh-section-header">
              <h3>Contas Conectadas ({githubAccounts.length})</h3>
              <span className="ct-gh-count-pill">{repositories.length} repositório{repositories.length === 1 ? '' : 's'} carregados</span>
            </div>

            {githubAccounts.length === 0 ? (
              <div className="ct-empty-state">
                <p>Nenhuma conta GitHub vinculada ainda.</p>
                <p className="ct-empty-sub">Vincule sua conta acima para carregar seus repositórios no ConTALK Studio.</p>
              </div>
            ) : (
              <div className="ct-gh-accounts-list">
                {githubAccounts.map(acc => {
                  const isActive = acc.id === activeAccountId
                  const accRepos = repositories.filter(r => r.accountId === acc.id)

                  return (
                    <div key={acc.id} className={`ct-gh-account-card ${isActive ? 'is-active-account' : ''}`}>
                      <div className="ct-gh-acc-avatar-wrap">
                        {acc.avatarUrl ? (
                          <img src={acc.avatarUrl} alt={acc.username} className="ct-gh-avatar" />
                        ) : (
                          <div className="ct-gh-avatar-placeholder">
                            <ControlIcon name="git" size={20}/>
                          </div>
                        )}
                      </div>

                      <div className="ct-gh-acc-info">
                        <div className="ct-gh-acc-names">
                          <span className="ct-gh-acc-username">@{acc.username}</span>
                          {acc.name && <span className="ct-gh-acc-fullname">({acc.name})</span>}
                          {isActive && <span className="ct-gh-active-badge">Ativa no ConTALK</span>}
                        </div>
                        <div className="ct-gh-acc-subtext">
                          <span className="ct-gh-token-type">
                            {acc.token ? 'Autenticação PAT (Privados + Públicos)' : 'Modo Público'}
                          </span>
                          <span>•</span>
                          <span>{accRepos.length} repositórios sincronizados</span>
                        </div>
                      </div>

                      <div className="ct-gh-acc-actions">
                        {!isActive ? (
                          <button
                            type="button"
                            className="ct-secondary"
                            onClick={() => setActiveGitHubAccount(acc.id)}
                            title="Alternar para esta conta como ativa"
                          >
                            Tornar Ativa
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ct-refresh-btn-small"
                            onClick={() => void refreshRepositories()}
                            disabled={loadingRepos}
                            title="Recarregar repositórios desta conta"
                          >
                            <ControlIcon name="refresh" size={12}/>
                            <span>Recarregar</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="ct-gh-del-btn"
                          onClick={() => removeGitHubAccount(acc.id)}
                          title="Remover esta conta do ConTALK"
                          aria-label={`Remover conta ${acc.username}`}
                        >
                          <ControlIcon name="close" size={13}/>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
