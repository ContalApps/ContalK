import { useEffect, useState } from 'react'
import { aiProviders, aiProviderName, type AiProviderId, TOKEN_ECONOMY_CONFIG, getEconomyMode, type TokenEconomyMode } from '../roles/ai'
import { ControlIcon } from './ControlIcon'

export function AiSettings() {
  const [provider, setProvider] = useState<AiProviderId>('openai')
  const [key, setKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [configured, setConfigured] = useState<AiProviderId[]>([])
  const [economyMode, setEconomyMode] = useState<TokenEconomyMode>('moderate')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    void window.contalkDesktop?.communityAiStatus().then(value => {
      const provs = value.providers || []
      setConfigured(provs)
      setEconomyMode(getEconomyMode(value.contextTokens, value.maxOutputTokens))
      if (!provs.includes('openai') && provs.length > 0) {
        setProvider(provs[0])
      }
    }).catch(() => {
      setStatus('Não foi possível ler as configurações de IA.')
      setIsSuccess(false)
    })
  }, [])

  const saved = configured.includes(provider)

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setStatus('')
    setIsSuccess(false)
    const economy = TOKEN_ECONOMY_CONFIG[economyMode]
    void window.contalkDesktop!.communityAiConfigure({
      provider,
      ...(key.trim() ? { key: key.trim() } : {}),
      contextTokens: economy.contextTokens,
      maxOutputTokens: economy.maxOutputTokens
    }).then(value => {
      setConfigured(value.providers)
      setKey('')
      setIsSuccess(true)
      setStatus(`Chave de ${aiProviderName[provider]} salva com sucesso neste dispositivo.`)
    }).catch(error => {
      setIsSuccess(false)
      setStatus(error instanceof Error ? error.message : 'Falha ao salvar configuração.')
    }).finally(() => setBusy(false))
  }

  const handleRemove = () => {
    setBusy(true)
    setStatus('')
    setIsSuccess(false)
    void window.contalkDesktop!.communityAiRemove(provider).then(() => {
      setConfigured(current => current.filter(item => item !== provider))
      setKey('')
      setIsSuccess(true)
      setStatus(`Chave de ${aiProviderName[provider]} removida deste dispositivo.`)
    }).catch(error => {
      setIsSuccess(false)
      setStatus(error instanceof Error ? error.message : 'Falha ao remover chave.')
    }).finally(() => setBusy(false))
  }

  return (
    <section className="ct-ai-channel-section ct-ai-user-settings">
      <div className="ct-ai-channel-header">
        <div className="ct-ai-channel-header-text">
          <div className="ct-ai-channel-title-row">
            <ControlIcon name="ai" size={17} />
            <h2>APIs Pessoais de Inteligência Artificial</h2>
          </div>
          <p>
            Conecte suas próprias chaves de API. Cada chave é mantida cifrada localmente neste dispositivo e a cobrança de uso é feita diretamente pelo provedor correspondente.
          </p>
        </div>
      </div>

      <div className="ct-ai-credentials-card">
        <div className="ct-ai-card-section-title">
          <strong>Escolha o Provedor</strong>
          <span className="ct-ai-card-hint">Selecione para configurar ou gerenciar chaves</span>
        </div>

        {/* Chips */}
        <div className="ct-ai-provider-chips-grid">
          {aiProviders.map(item => {
            const isSelected = item === provider
            const isSaved = configured.includes(item)
            return (
              <button
                key={item}
                type="button"
                className={`ct-ai-provider-chip ${isSelected ? 'is-selected' : ''} ${isSaved ? 'is-configured' : ''}`}
                onClick={() => {
                  setProvider(item)
                  setKey('')
                  setStatus('')
                }}
              >
                <span className="ct-ai-chip-name">{aiProviderName[item]}</span>
                {isSaved ? (
                  <span className="ct-ai-chip-badge saved">● Conectada</span>
                ) : (
                  <span className="ct-ai-chip-badge unconfigured">Pendente</span>
                )}
              </button>
            )
          })}
        </div>

        <form onSubmit={handleSave} className="ct-ai-form-fields">
          <div className="ct-ai-field-group">
            <div className="ct-ai-field-label-row">
              <label htmlFor="user-ai-key">Chave de API ({aiProviderName[provider]}):</label>
              <span className={`ct-ai-key-status ${saved ? 'is-active' : ''}`}>
                {saved ? '✓ Chave configurada' : 'Não configurada'}
              </span>
            </div>
            <div className="ct-ai-input-with-button">
              <input
                id="user-ai-key"
                className="ct-ai-input ct-monospace"
                type={showKey ? 'text' : 'password'}
                value={key}
                onChange={event => setKey(event.target.value)}
                placeholder={saved ? '•••••••••••••••••••••••••••••••• (Chave salva · deixe vazio para manter)' : 'Cole sua chave de API pessoal'}
                autoComplete="off"
              />
              {key.trim() && (
                <button
                  type="button"
                  className="ct-ai-input-toggle-btn"
                  onClick={() => setShowKey(!showKey)}
                  title={showKey ? 'Ocultar chave' : 'Mostrar chave'}
                >
                  <ControlIcon name={showKey ? 'close' : 'ear'} size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="ct-ai-economy-section">
            <div className="ct-ai-card-section-title">
              <strong>Economia de Tokens</strong>
              <span className="ct-ai-card-hint">Otimize o consumo de tokens sem perder qualidade</span>
            </div>
            <div className="ct-ai-economy-options" role="radiogroup" aria-label="Economia de Tokens">
              {(['standard', 'moderate', 'aggressive'] as const).map(mode => {
                const option = TOKEN_ECONOMY_CONFIG[mode]
                const selected = economyMode === mode
                return (
                  <label
                    key={mode}
                    className={`ct-ai-economy-card ${selected ? 'is-selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="user-token-economy"
                      value={mode}
                      checked={selected}
                      onChange={() => setEconomyMode(mode)}
                    />
                    <div className="ct-ai-economy-card-header">
                      <strong>{option.label}</strong>
                      <span className="ct-radio-dot" aria-hidden="true">
                        {selected && <ControlIcon name="check" size={10} />}
                      </span>
                    </div>
                    <p>{option.description}</p>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="ct-ai-actions-footer">
            <button
              className="ct-primary ct-ai-channel-save-btn"
              type="submit"
              disabled={busy || !window.contalkDesktop?.communityAiConfigure || (!saved && !key.trim())}
            >
              <ControlIcon name="check" size={14} />
              <span>{busy ? 'Salvando…' : 'Salvar Configuração'}</span>
            </button>

            {saved && (
              <button
                type="button"
                className="ct-danger-btn"
                disabled={busy}
                onClick={handleRemove}
              >
                Remover Chave de {aiProviderName[provider]}
              </button>
            )}
          </div>
        </form>

        {status && (
          <div className={isSuccess ? 'ct-success-banner' : 'ct-error-banner'} role="status">
            <ControlIcon name={isSuccess ? 'check' : 'warning'} size={14} />
            <span>{status}</span>
          </div>
        )}
      </div>
    </section>
  )
}
