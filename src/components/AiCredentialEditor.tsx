import { useEffect, useState } from 'react'
import { aiProviders, aiProviderName, validAiEndpoint, type AiProviderId, TOKEN_ECONOMY_CONFIG, getEconomyMode } from '../roles/ai'
import type { Channel } from '../store/useAppStore'
import { ControlIcon } from './ControlIcon'

export function AiCredentialEditor({
  endpoints,
  onEndpoints
}: {
  endpoints: NonNullable<Channel['aiEndpoints']>
  onEndpoints: (value: NonNullable<Channel['aiEndpoints']>) => void
}) {
  const [provider, setProvider] = useState<AiProviderId>('openai')
  const [key, setKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [configured, setConfigured] = useState<AiProviderId[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [limits, setLimits] = useState({ contextTokens: 8192, maxOutputTokens: 2048 })

  useEffect(() => {
    void window.contalkDesktop?.communityAiStatus().then(value => {
      const provs = value.providers || []
      setConfigured(provs)
      setLimits({ contextTokens: value.contextTokens, maxOutputTokens: value.maxOutputTokens })
      if (!provs.includes('openai') && provs.length > 0) {
        setProvider(provs[0])
      }
    }).catch(() => {
      setStatus('Não foi possível ler as credenciais de IA deste dispositivo.')
      setIsSuccess(false)
    })
  }, [])

  const custom = provider === 'compatible-chat' || provider === 'compatible-responses'
  const endpoint = custom ? endpoints[provider] || '' : ''
  const isCurrentConfigured = configured.includes(provider)

  const save = async () => {
    if (!window.contalkDesktop) return
    setBusy(true)
    setStatus('')
    setIsSuccess(false)
    try {
      if (custom && !validAiEndpoint(endpoint)) {
        throw new Error('Informe um endpoint HTTPS válido da API compatível (ex: https://api.openai.com/v1).')
      }
      const result = await window.contalkDesktop.communityAiConfigure({
        provider,
        ...(key.trim() ? { key: key.trim() } : {}),
        ...limits
      })
      setConfigured(result.providers)
      setKey('')
      try {
        const list = await window.contalkDesktop.communityAiModels(provider, custom ? endpoint : undefined)
        setIsSuccess(true)
        if (list.models.length > 0) {
          setStatus(`${aiProviderName[provider]} conectada com sucesso! ${list.models.length} modelos ativos e respondendo sincronizados.`)
          try {
            if (typeof localStorage !== 'undefined') {
              const currentPreferred = localStorage.getItem(`contalk:preferred-ai-model:${provider}`)
              if (!currentPreferred || !list.models.some(m => m.id === currentPreferred)) {
                localStorage.setItem(`contalk:preferred-ai-model:${provider}`, list.models[0].id)
                localStorage.setItem('contalk:preferred-ai-model', list.models[0].id)
              }
            }
          } catch {}
        } else {
          setStatus(`${aiProviderName[provider]} conectada, mas nenhum modelo respondeu no teste. Verifique sua chave.`)
        }
      } catch (error) {
        setIsSuccess(true)
        setStatus(`Chave salva localmente. ${error instanceof Error ? error.message : ''}`)
      }
    } catch (error) {
      setIsSuccess(false)
      setStatus(error instanceof Error ? error.message : 'Falha ao salvar a API.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="ct-ai-credentials-card"
      onKeyDown={event => {
        if (event.key === 'Enter') {
          event.preventDefault()
          if (!busy && (key.trim() || isCurrentConfigured)) void save()
        }
      }}
    >
      <div className="ct-ai-card-section-title">
        <strong>Provedor e Chave de API</strong>
        <span className="ct-ai-card-hint">Armazenada com segurança na sua máquina</span>
      </div>

      {/* Provider Selector Chips */}
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
                <span className="ct-ai-chip-badge saved" title="Chave já configurada">
                  ● Conectada
                </span>
              ) : (
                <span className="ct-ai-chip-badge unconfigured">Pendente</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Form Details */}
      <div className="ct-ai-form-fields">
        {custom && (
          <div className="ct-ai-field-group">
            <div className="ct-ai-field-label-row">
              <label htmlFor="ai-endpoint-input">Endpoint HTTPS da API:</label>
              <span className="ct-ai-field-sub">Ex: https://api.openai.com/v1</span>
            </div>
            <input
              id="ai-endpoint-input"
              className="ct-ai-input ct-monospace"
              aria-label="Endpoint da API compatível"
              placeholder="https://api.exemplo.com/v1"
              value={endpoint}
              onChange={event => {
                const value = { ...endpoints }
                if (event.target.value) value[provider] = event.target.value
                else delete value[provider]
                onEndpoints(value)
              }}
            />
            <small className="ct-ai-field-note">O host precisa ser HTTPS e aceito pela VPS do ConTALK.</small>
          </div>
        )}

        <div className="ct-ai-field-group">
          <div className="ct-ai-field-label-row">
            <label htmlFor="ai-key-input">Chave de API ({aiProviderName[provider]}):</label>
            <span className={`ct-ai-key-status ${isCurrentConfigured ? 'is-active' : ''}`}>
              {isCurrentConfigured ? '✓ Chave configurada' : 'Chave não informada'}
            </span>
          </div>
          <div className="ct-ai-input-with-button">
            <input
              id="ai-key-input"
              className="ct-ai-input ct-monospace"
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              aria-label="Chave pessoal da API"
              value={key}
              placeholder={isCurrentConfigured ? '•••••••••••••••••••••••••••••••• (Salva)' : 'Cole sua chave de API aqui'}
              onChange={event => setKey(event.target.value)}
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

        {/* Economia de Tokens */}
        <div className="ct-ai-economy-section">
          <div className="ct-ai-card-section-title">
            <strong>Economia de Tokens</strong>
            <span className="ct-ai-card-hint">Otimize o consumo de tokens sem perder qualidade</span>
          </div>
          <div className="ct-ai-economy-options" role="radiogroup" aria-label="Economia de Tokens">
            {(['standard', 'moderate', 'aggressive'] as const).map(mode => {
              const option = TOKEN_ECONOMY_CONFIG[mode]
              const currentMode = getEconomyMode(limits.contextTokens, limits.maxOutputTokens)
              const selected = currentMode === mode
              return (
                <label
                  key={mode}
                  className={`ct-ai-economy-card ${selected ? 'is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="channel-token-economy"
                    value={mode}
                    checked={selected}
                    onChange={() => {
                      setLimits({
                        contextTokens: option.contextTokens,
                        maxOutputTokens: option.maxOutputTokens
                      })
                    }}
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

        {/* Action Button & Status */}
        <div className="ct-ai-test-row">
          <button
            type="button"
            className="ct-secondary ct-ai-connect-btn"
            disabled={busy || !window.contalkDesktop || (!key.trim() && !isCurrentConfigured)}
            onClick={() => void save()}
          >
            <ControlIcon name="refresh" size={13} />
            <span>
              {busy
                ? 'Conectando e verificando…'
                : isCurrentConfigured && !key.trim()
                ? 'Consultar Modelos Disponíveis'
                : 'Salvar Chave & Consultar Modelos'}
            </span>
          </button>

          {isCurrentConfigured && (
            <button
              type="button"
              className="ct-danger-btn"
              disabled={busy || !window.contalkDesktop}
              onClick={async () => {
                setBusy(true)
                setStatus('')
                setIsSuccess(false)
                try {
                  await window.contalkDesktop!.communityAiRemove(provider)
                  setConfigured(current => current.filter(item => item !== provider))
                  setKey('')
                  setIsSuccess(true)
                  setStatus(`Chave de ${aiProviderName[provider]} removida deste dispositivo.`)
                } catch (error) {
                  setIsSuccess(false)
                  setStatus(error instanceof Error ? error.message : 'Falha ao remover.')
                } finally {
                  setBusy(false)
                }
              }}
            >
              Remover Chave
            </button>
          )}
        </div>

        {status && (
          <div className={isSuccess ? 'ct-success-banner' : 'ct-error-banner'} role="status">
            <ControlIcon name={isSuccess ? 'check' : 'warning'} size={14} />
            <span>{status}</span>
          </div>
        )}
      </div>
    </div>
  )
}
