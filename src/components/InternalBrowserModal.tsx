import { useState, useEffect } from 'react'
import { ControlIcon } from './ControlIcon'

export interface BrowserStatus {
  isOpen: boolean
  url: string
  title: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  lastAction?: string
}

export function InternalBrowserModal({ onClose }: { onClose: () => void }) {
  const [urlInput, setUrlInput] = useState('https://www.google.com')
  const [currentUrl, setCurrentUrl] = useState('https://www.google.com')
  const [pageTitle, setPageTitle] = useState('Google')
  const [loading, setLoading] = useState(false)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [extractedContent, setExtractedContent] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>('Navegador pronto para navegação e automação por IA.')
  const [historyLog, setHistoryLog] = useState<string[]>([])

  const desktop = typeof window !== 'undefined' ? window.contalkDesktop : undefined

  useEffect(() => {
    if (!desktop?.browserGetStatus) return

    desktop.browserGetStatus().then((st: BrowserStatus) => {
      if (st) {
        if (st.url && st.url !== 'about:blank') {
          setCurrentUrl(st.url)
          setUrlInput(st.url)
        }
        if (st.title) setPageTitle(st.title)
        setLoading(st.isLoading)
      }
    }).catch(() => {})

    const unsub = desktop.onBrowserStatusChanged?.((st: BrowserStatus) => {
      if (st) {
        if (st.url && st.url !== 'about:blank') {
          setCurrentUrl(st.url)
          setUrlInput(st.url)
        }
        if (st.title) setPageTitle(st.title)
        setLoading(st.isLoading)
        if (st.lastAction) {
          setStatusMessage(st.lastAction)
          setHistoryLog(prev => [st.lastAction!, ...prev.slice(0, 19)])
        }
      }
    })

    return () => {
      unsub?.()
    }
  }, [desktop])

  const handleNavigate = async (targetUrl = urlInput) => {
    let finalUrl = targetUrl.trim()
    if (!finalUrl) return
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://') && !finalUrl.startsWith('about:')) {
      finalUrl = `https://${finalUrl}`
    }
    setUrlInput(finalUrl)
    setLoading(true)
    setStatusMessage(`Navegando para ${finalUrl}…`)
    try {
      if (desktop?.browserNavigate) {
        const res = await desktop.browserNavigate(finalUrl)
        setCurrentUrl(res.url)
        setPageTitle(res.title || 'Página Web')
      }
      // Capturar screenshot automaticamente
      if (desktop?.browserScreenshot) {
        const snap = await desktop.browserScreenshot()
        if (snap?.src) setScreenshot(snap.src)
      }
      setStatusMessage(`Página carregada: ${finalUrl}`)
      setHistoryLog(prev => [`Navegou para ${finalUrl}`, ...prev.slice(0, 19)])
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : 'Falha ao navegar.')
    } finally {
      setLoading(false)
    }
  }

  const handleScreenshot = async () => {
    try {
      if (desktop?.browserScreenshot) {
        const snap = await desktop.browserScreenshot()
        if (snap?.src) {
          setScreenshot(snap.src)
          setStatusMessage('Captura de tela atualizada.')
        }
      }
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : 'Falha ao capturar tela.')
    }
  }

  const handleReadContent = async () => {
    try {
      if (desktop?.browserReadContent) {
        const data = await desktop.browserReadContent()
        setExtractedContent(data.content)
        setStatusMessage(`Conteúdo lido (${data.links.length} links, ${data.forms.length} formulários).`)
      }
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : 'Falha ao ler conteúdo.')
    }
  }

  const handleOpenDesktopWindow = () => {
    desktop?.browserShow?.()
  }

  return (
    <div className="ct-modal-backdrop" onClick={onClose}>
      <div className="ct-edit-dialog ct-browser-modal" onClick={e => e.stopPropagation()}>
        <div className="ct-browser-header">
          <div className="ct-browser-title-bar">
            <div className="ct-browser-title-info">
              <ControlIcon name="globe" size={16} />
              <strong>{pageTitle || 'Navegador Web Interno'}</strong>
              <span className={`ct-browser-status-pill ${loading ? 'is-loading' : ''}`}>
                {loading ? 'Carregando…' : 'Pronto'}
              </span>
            </div>
            <div className="ct-browser-top-actions">
              <button
                type="button"
                className="ct-browser-btn-secondary"
                onClick={handleOpenDesktopWindow}
                title="Abrir navegador em janela dedicada separada"
              >
                <ControlIcon name="expand" size={13} />
                <span>Janela Dedicada</span>
              </button>
              <button
                type="button"
                className="ct-settings-close"
                onClick={onClose}
                aria-label="Fechar navegador"
              >
                <ControlIcon name="close" size={14} />
              </button>
            </div>
          </div>

          {/* Browser Address & Navigation Bar */}
          <div className="ct-browser-nav-bar">
            <button
              type="button"
              className="ct-browser-nav-btn"
              title="Voltar"
              onClick={async () => {
                if (desktop?.browserGoBack) {
                  await desktop.browserGoBack()
                } else {
                  void desktop?.browserNavigate?.('https://www.google.com')
                }
              }}
            >
              <ControlIcon name="back" size={13} />
            </button>
            <button
              type="button"
              className="ct-browser-nav-btn"
              title="Avançar"
              onClick={async () => {
                if (desktop?.browserGoForward) {
                  await desktop.browserGoForward()
                }
              }}
            >
              <ControlIcon name="forward" size={13} />
            </button>
            <button
              type="button"
              className="ct-browser-nav-btn"
              title="Recarregar página"
              onClick={async () => {
                if (desktop?.browserReload) {
                  await desktop.browserReload()
                } else {
                  void handleNavigate(currentUrl)
                }
              }}
            >
              <ControlIcon name="refresh" size={13} />
            </button>
            <button
              type="button"
              className="ct-browser-nav-btn"
              title="Página Inicial"
              onClick={() => void handleNavigate('https://www.google.com')}
            >
              <ControlIcon name="home" size={13} />
            </button>

            <form
              className="ct-browser-url-form"
              onSubmit={e => {
                e.preventDefault()
                void handleNavigate()
              }}
            >
              <div className="ct-browser-url-wrapper">
                <ControlIcon name="link" size={12} />
                <input
                  type="text"
                  className="ct-browser-url-input"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="Digite uma URL ou termo de busca..."
                />
              </div>
              <button type="submit" className="ct-browser-go-btn" disabled={loading}>
                Ir
              </button>
            </form>
          </div>
        </div>

        {/* Browser Body & Workspace */}
        <div className="ct-browser-body">
          <div className="ct-browser-viewport">
            {screenshot ? (
              <div className="ct-browser-screen-container">
                <img src={screenshot} alt="Navegador Interno" className="ct-browser-screen-image" />
                <div className="ct-browser-screen-overlay">
                  <span>URL ativa: {currentUrl}</span>
                  <button type="button" onClick={handleScreenshot} title="Atualizar captura">
                    <ControlIcon name="refresh" size={11} /> Atualizar
                  </button>
                </div>
              </div>
            ) : (
              <div className="ct-browser-placeholder">
                <ControlIcon name="globe" size={36} />
                <h3>Navegador Web Integrado ConTALK</h3>
                <p>
                  Acesse páginas web, visualize sites em tempo real e permita que os agentes de IA do chat naveguem, cliquem em botões e preencham formulários com automação completa.
                </p>
                <div className="ct-browser-quick-links">
                  <button type="button" onClick={() => void handleNavigate('https://github.com')}>
                    GitHub
                  </button>
                  <button type="button" onClick={() => void handleNavigate('https://google.com')}>
                    Google
                  </button>
                  <button type="button" onClick={() => void handleNavigate('https://news.ycombinator.com')}>
                    Hacker News
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Side Drawer: AI Automation & Extracted Info */}
          <div className="ct-browser-side-panel">
            <div className="ct-browser-side-section">
              <div className="ct-browser-side-title">
                <ControlIcon name="ai" size={13} />
                <strong>Automação com IA</strong>
              </div>
              <p className="ct-browser-side-desc">
                Peça para a IA no chat navegar, clicar em botões específicos, preencher campos ou resumir esta página.
              </p>
              <div className="ct-browser-ai-actions">
                <button
                  type="button"
                  className="ct-browser-ai-btn"
                  onClick={() => {
                    onClose()
                    window.dispatchEvent(new CustomEvent('contalk-ai-prompt', {
                      detail: {
                        prompt: `Por favor, acesse a página ${currentUrl} no navegador interno e faça um resumo dos principais conteúdos e links disponíveis.`
                      }
                    }))
                  }}
                >
                  <ControlIcon name="ai" size={12} />
                  <span>Resumir página no chat com IA</span>
                </button>
                <button
                  type="button"
                  className="ct-browser-ai-btn"
                  onClick={() => {
                    onClose()
                    window.dispatchEvent(new CustomEvent('contalk-ai-prompt', {
                      detail: {
                        prompt: `Por favor, no navegador interno aberto em ${currentUrl}, localize o formulário ou botões principais e execute a seguinte ação: `
                      }
                    }))
                  }}
                >
                  <ControlIcon name="link" size={12} />
                  <span>Automatizar cliques ou formulário</span>
                </button>
                <button
                  type="button"
                  className="ct-browser-side-action-btn"
                  onClick={handleReadContent}
                >
                  <ControlIcon name="file" size={12} />
                  <span>Ler texto da página</span>
                </button>
              </div>
            </div>

            {extractedContent && (
              <div className="ct-browser-extracted-box">
                <div className="ct-browser-extracted-label">Texto extraído:</div>
                <div className="ct-browser-extracted-text">{extractedContent}</div>
              </div>
            )}

            <div className="ct-browser-history-section">
              <div className="ct-browser-history-title">Histórico de Ações da IA:</div>
              <div className="ct-browser-history-list">
                {historyLog.length > 0 ? (
                  historyLog.map((item, idx) => (
                    <div key={idx} className="ct-browser-history-item">
                      <ControlIcon name="check" size={10} />
                      <span>{item}</span>
                    </div>
                  ))
                ) : (
                  <span className="ct-browser-history-empty">Nenhuma ação recente registrada.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer status */}
        <div className="ct-browser-footer">
          <span className="ct-browser-footer-status">{statusMessage}</span>
          <span className="ct-browser-footer-hint">ConTALK Automation Engine v1.0</span>
        </div>
      </div>
    </div>
  )
}
