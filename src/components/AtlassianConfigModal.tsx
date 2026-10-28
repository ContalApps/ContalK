import { useState, useId } from 'react'
import { useDevStore } from '../store/useDevStore'
import { ControlIcon } from './ControlIcon'

export function AtlassianConfigModal({ onClose }: { onClose: () => void }) {
  const { atlassian, connectAtlassian, connectAtlassianDirect, disconnectAtlassian, syncAtlassianData, atlassianSyncing, atlassianError } = useDevStore()

  const [siteUrl, setSiteUrl] = useState(atlassian?.siteUrl || '')
  const [email, setEmail] = useState(atlassian?.email || '')
  const [apiToken, setApiToken] = useState(atlassian?.apiToken || '')
  const [isTesting, setIsTesting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const siteUrlId = useId()
  const emailId = useId()
  const apiTokenId = useId()

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!siteUrl.trim() || !email.trim() || !apiToken.trim()) return
    setIsTesting(true)
    setLocalError(null)
    setSuccessMsg(null)
    try {
      const ok = await connectAtlassian(siteUrl.trim(), email.trim(), apiToken.trim())
      if (ok) {
        setSuccessMsg('Conta Atlassian vinculada com sucesso! Sincronizando dados...')
        await syncAtlassianData()
        setSuccessMsg('Sincronização concluída! Dados do Jira e Confluence integrados.')
      } else {
        setLocalError('Falha ao conectar. Verifique as credenciais e tente novamente.')
      }
    } catch (err) {
      setLocalError((err as Error).message || 'Erro ao conectar à Atlassian.')
    } finally {
      setIsTesting(false)
    }
  }

  const handleManualSync = async () => {
    setLocalError(null)
    setSuccessMsg(null)
    try {
      await syncAtlassianData()
      setSuccessMsg('Dados do Jira e Confluence atualizados com sucesso!')
    } catch (err) {
      setLocalError((err as Error).message || 'Erro na sincronização.')
    }
  }

  const handleDisconnect = () => {
    disconnectAtlassian()
    setSiteUrl('')
    setEmail('')
    setApiToken('')
    setSuccessMsg(null)
    setLocalError(null)
  }

  return (
    <div className="ct-modal-backdrop" onClick={onClose}>
      <section className="ct-dev-modal-panel ct-atlassian-dialog" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <header className="ct-dev-modal-header">
          <div>
            <h2><ControlIcon name="settings" size={16}/> Integração Atlassian (Jira & Confluence)</h2>
            <p>Conecte seu Jira Cloud e Confluence para gerenciar sprints, tickets e páginas diretamente no ConTALK.</p>
          </div>
          <div className="ct-dev-header-actions">
            <button type="button" className="ct-close-btn" onClick={onClose} aria-label="Fechar">
              <ControlIcon name="close" size={14}/>
            </button>
          </div>
        </header>

        <div className="ct-atlassian-body">
          {/* Explanation Banner */}
          <div className="ct-atlassian-info-card">
            <div className="ct-atlassian-info-header">
              <span className="ct-atlassian-brand-badge">Atlassian Cloud</span>
              {atlassian?.connected ? (
                <span className="ct-badge-connected">Conectado e Ativo ✓</span>
              ) : (
                <span className="ct-badge-disconnected">Não Conectado</span>
              )}
            </div>
            <p className="ct-atlassian-features-desc">
              Esta integração importa automaticamente:
            </p>
            <ul className="ct-atlassian-features-list">
              <li><strong>Jira Software:</strong> Tickets, prioridades e status refletidos no <em>Quadro Kanban (Visão Geral)</em> e na lista de <em>Tarefas</em>.</li>
              <li><strong>Confluence:</strong> Documentação de projetos, manuais e especificações carregados na <em>Central de Documentação</em>.</li>
            </ul>
          </div>

          {/* Direct Login Card */}
          <div className="ct-direct-login-card">
            <div className="ct-direct-login-header">
              <div className="ct-direct-login-badge">
                <ControlIcon name="settings" size={15}/>
                <span>Login Direto Atlassian (OAuth Cloud)</span>
              </div>
              <span className="ct-direct-detect-pill">1-Clique</span>
            </div>
            <p className="ct-direct-login-desc">
              Conecte seu Jira e Confluence instantaneamente com autenticação direta Atlassian Cloud, sem precisar gerar ou copiar API tokens.
            </p>
            <div className="ct-direct-login-actions">
              <button
                type="button"
                className="ct-primary ct-direct-login-btn"
                onClick={async () => {
                  setIsTesting(true)
                  setLocalError(null)
                  setSuccessMsg(null)
                  try {
                    const ok = await connectAtlassianDirect(siteUrl || 'contalk.atlassian.net')
                    if (ok) {
                      setSuccessMsg('Conectado diretamente à Atlassian com sucesso! Sincronizando Jira e Confluence...')
                    } else {
                      setLocalError('Falha no login direto da Atlassian.')
                    }
                  } catch (err) {
                    setLocalError((err as Error).message || 'Erro ao conectar à Atlassian.')
                  } finally {
                    setIsTesting(false)
                  }
                }}
                disabled={isTesting}
              >
                <ControlIcon name="settings" size={14}/>
                <span>{isTesting ? 'Autenticando…' : 'Entrar Diretamente com Atlassian Cloud (1-Clique)'}</span>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleConnect} className="ct-atlassian-form">
            <div className="ct-form-row">
              <label htmlFor={siteUrlId}>URL do Site Atlassian:</label>
              <input
                id={siteUrlId}
                type="text"
                placeholder="Ex: https://sua-empresa.atlassian.net"
                value={siteUrl}
                onChange={e => setSiteUrl(e.target.value)}
                required
                disabled={isTesting}
              />
            </div>

            <div className="ct-form-row">
              <label htmlFor={emailId}>E-mail da Conta Atlassian:</label>
              <input
                id={emailId}
                type="email"
                placeholder="Ex: dev@empresa.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={isTesting}
              />
            </div>

            <div className="ct-form-row">
              <div className="ct-label-with-hint">
                <label htmlFor={apiTokenId}>API Token Atlassian:</label>
                <a
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="ct-external-hint"
                >
                  Gerar API Token ↗
                </a>
              </div>
              <input
                id={apiTokenId}
                type="password"
                placeholder="Cole o API token gerado na Atlassian"
                value={apiToken}
                onChange={e => setApiToken(e.target.value)}
                required
                disabled={isTesting}
              />
            </div>

            {(localError || atlassianError) && (
              <div className="ct-error-banner">
                <ControlIcon name="alert" size={14}/>
                <span>{localError || atlassianError}</span>
              </div>
            )}

            {successMsg && (
              <div className="ct-success-banner">
                <ControlIcon name="check" size={14}/>
                <span>{successMsg}</span>
              </div>
            )}

            <div className="ct-atlassian-form-actions">
              <button
                type="submit"
                className="ct-primary"
                disabled={isTesting || !siteUrl.trim() || !email.trim() || !apiToken.trim()}
              >
                <ControlIcon name="refresh" size={13}/>
                <span>{isTesting ? 'Verificando credenciais…' : atlassian?.connected ? 'Atualizar Conexão' : 'Conectar e Sincronizar'}</span>
              </button>

              {atlassian?.connected && (
                <>
                  <button
                    type="button"
                    className="ct-secondary"
                    onClick={handleManualSync}
                    disabled={atlassianSyncing || isTesting}
                  >
                    <span>{atlassianSyncing ? 'Sincronizando…' : 'Sincronizar Agora'}</span>
                  </button>
                  <button
                    type="button"
                    className="ct-danger-btn"
                    onClick={handleDisconnect}
                    disabled={isTesting}
                  >
                    Desconectar
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}
