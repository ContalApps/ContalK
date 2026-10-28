import { useEffect, useState } from 'react'
import { aiProviderName, aiProviders, type AiProviderId } from '../roles/ai'
import type { Channel } from '../store/useAppStore'
import { ControlIcon } from './ControlIcon'

export function AiModelSelector({
  endpoints,
  provider,
  model,
  onChange
}: {
  endpoints: NonNullable<Channel['aiEndpoints']>
  provider: AiProviderId
  model: string
  onChange: (provider: AiProviderId, model: string) => void
}) {
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const custom = provider.startsWith('compatible-')
  const availableProviders = aiProviders.filter(
    item => !item.startsWith('compatible-') || !!endpoints[item as 'compatible-chat' | 'compatible-responses']
  )
  const endpoint = provider === 'compatible-chat' || provider === 'compatible-responses' ? endpoints[provider] : undefined

  useEffect(() => {
    let live = true
    setModels([])
    setError('')
    setLoading(true)
    window.contalkDesktop
      ?.communityAiModels(provider, custom ? endpoint : undefined)
      .then(result => {
        if (live) setModels(result.models)
      })
      .catch(reason => {
        if (live) setError(reason instanceof Error ? reason.message : 'Não foi possível consultar os modelos.')
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    if (!window.contalkDesktop) {
      setLoading(false)
      setError('Abra no aplicativo desktop para consultar modelos.')
    }
    return () => {
      live = false
    }
  }, [provider, custom, endpoint])

  const handleRefresh = () => {
    setLoading(true)
    setError('')
    window.contalkDesktop
      ?.communityAiModels(provider, custom ? endpoint : undefined)
      .then(result => setModels(result.models))
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Falha na consulta.'))
      .finally(() => setLoading(false))
  }

  const imagePresets: Record<string, Array<{ id: string; name: string }>> = {
    openai: [
      { id: 'dall-e-3', name: '🎨 DALL-E 3 (Geração de Imagens HD)' },
      { id: 'dall-e-2', name: '🎨 DALL-E 2 (Geração de Imagens Rápida)' },
    ],
    gemini: [
      { id: 'imagen-3.0-generate-002', name: '🎨 Imagen 3 (Geração de Imagens Google)' },
    ]
  }

  const combinedModels = [...models]
  const presets = imagePresets[provider] || []
  for (const preset of presets) {
    if (!combinedModels.some(m => m.id === preset.id)) {
      combinedModels.push(preset)
    }
  }

  // Pre-select saved model for this provider or default to first model and keep selection
  useEffect(() => {
    if (!combinedModels.length) return
    // If current model is already selected and valid in combinedModels, keep it
    if (model && combinedModels.some(m => m.id === model)) return

    // Try to restore saved model for this provider
    try {
      if (typeof localStorage !== 'undefined') {
        const savedForProvider = localStorage.getItem(`contalk:preferred-ai-model:${provider}`)
        if (savedForProvider && combinedModels.some(m => m.id === savedForProvider)) {
          onChange(provider, savedForProvider)
          return
        }
        const generalSaved = localStorage.getItem('contalk:preferred-ai-model')
        if (generalSaved && combinedModels.some(m => m.id === generalSaved)) {
          onChange(provider, generalSaved)
          return
        }
      }
    } catch {
      /* ignore storage error */
    }

    // Default to the first available model if none selected or if previous selection is invalid/not responding
    const isModelValid = model && combinedModels.some(m => m.id === model)
    if (!isModelValid && combinedModels.length > 0) {
      const firstChatModel = combinedModels.find(m => !m.id.includes('imagen') && !m.id.includes('dall-e')) || combinedModels[0]
      if (firstChatModel?.id) {
        onChange(provider, firstChatModel.id)
      }
    }
  }, [combinedModels.length, provider, model])

  return (
    <div className="ct-ai-model-picker">
      <div className="ct-ai-picker-fields">
        {/* Provider selector */}
        <div className="ct-ai-picker-item">
          <label htmlFor="ai-picker-provider" className="sr-only">Provedor</label>
          <select
            id="ai-picker-provider"
            className="ct-ai-picker-select"
            aria-label="Provedor de IA para este pedido"
            value={provider}
            onChange={event => {
              const nextProvider = event.target.value as AiProviderId
              let nextModel = ''
              try {
                if (typeof localStorage !== 'undefined') {
                  nextModel = localStorage.getItem(`contalk:preferred-ai-model:${nextProvider}`) || ''
                  localStorage.setItem('contalk:preferred-ai-provider', nextProvider)
                }
              } catch {
                /* ignore */
              }
              onChange(nextProvider, nextModel)
            }}
          >
            {availableProviders.map(item => (
              <option key={item} value={item}>
                {aiProviderName[item]}
              </option>
            ))}
          </select>
        </div>

        {/* Model selector */}
        {combinedModels.length > 0 ? (
          <div className="ct-ai-picker-item ct-flex-grow">
            <label htmlFor="ai-picker-model" className="sr-only">Modelo</label>
            <select
              id="ai-picker-model"
              className="ct-ai-picker-select"
              aria-label="Modelo de IA para este pedido"
              value={combinedModels.some(item => item.id === model) ? model : ''}
              onChange={event => {
                const val = event.target.value
                if (val) {
                  onChange(provider, val)
                  try {
                    if (typeof localStorage !== 'undefined') {
                      localStorage.setItem(`contalk:preferred-ai-model:${provider}`, val)
                      localStorage.setItem('contalk:preferred-ai-model', val)
                      localStorage.setItem('contalk:preferred-ai-provider', provider)
                    }
                  } catch {
                    /* ignore */
                  }
                }
              }}
              disabled={loading}
            >
              <option value="">
                {loading ? 'Verificando modelos que estão respondendo…' : combinedModels.length === 0 ? 'Nenhum modelo respondendo' : 'Selecione um modelo…'}
              </option>
              {combinedModels.map(item => {
                const cleanName = item.name.replace(/\s*\([^)]*\)$/, '').trim()
                const label = cleanName || item.id
                return (
                  <option key={item.id} value={item.id}>
                    {label}
                  </option>
                )
              })}
            </select>
          </div>
        ) : (
          /* Manual ID input fallback when API provides no models catalog */
          <div className="ct-ai-picker-item ct-ai-manual-id ct-flex-grow">
            <label htmlFor="ai-picker-manual-id" className="sr-only">ID do modelo</label>
            <input
              id="ai-picker-manual-id"
              className="ct-ai-picker-input"
              aria-label="Identificador do modelo"
              value={model}
              placeholder="Digite o ID do modelo (ex: gpt-4o, claude-3-5-sonnet)..."
              maxLength={100}
              onChange={event => {
                const val = event.target.value.trim()
                onChange(provider, val)
                if (val) {
                  try {
                    if (typeof localStorage !== 'undefined') {
                      localStorage.setItem(`contalk:preferred-ai-model:${provider}`, val)
                      localStorage.setItem('contalk:preferred-ai-model', val)
                      localStorage.setItem('contalk:preferred-ai-provider', provider)
                    }
                  } catch {
                    /* ignore */
                  }
                }
              }}
            />
          </div>
        )}

        {/* Refresh button */}
        <button
          type="button"
          className="ct-ai-picker-refresh-btn"
          title="Atualizar lista de modelos da API"
          aria-label="Atualizar lista de modelos"
          onClick={handleRefresh}
          disabled={loading}
        >
          <ControlIcon name="refresh" size={12} />
        </button>
      </div>

      {error ? (
        <span className="ct-ai-picker-status is-error" role="status">
          {error} Digite o ID do modelo se a API não fornecer catálogo público.
        </span>
      ) : models.length > 0 ? (
        <span className="ct-ai-picker-status">
          {models.length} modelos disponíveis pela API de {aiProviderName[provider]}.
        </span>
      ) : null}
    </div>
  )
}
