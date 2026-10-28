import { useEffect, useState } from 'react'
import { can } from '../roles/permissions'
import { parseAiModel } from '../roles/ai'
import { useRoleStore } from '../store/useRoleStore'
import type { Channel } from '../store/useAppStore'
import { AiCredentialEditor } from './AiCredentialEditor'
import { ControlIcon } from './ControlIcon'

const initialEndpoints = (channel?: Channel): NonNullable<Channel['aiEndpoints']> => {
  const endpoints = { ...channel?.aiEndpoints }, provider = parseAiModel(channel?.aiModel)?.provider
  if ((provider === 'compatible-chat' || provider === 'compatible-responses') && channel?.aiEndpoint && !endpoints[provider]) {
    endpoints[provider] = channel.aiEndpoint
  }
  return endpoints
}

export function AiChannelSettings({ channelId }: { channelId: string }) {
  const state = useRoleStore()
  const snapshot = state.snapshot
  const channel = snapshot?.channels.find(item => item.id === channelId)
  const [enabled, setEnabled] = useState(channel?.aiEnabled ?? !!channel?.aiModel)
  const [endpoints, setEndpoints] = useState(initialEndpoints(channel))
  const [status, setStatus] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    setEnabled(channel?.aiEnabled ?? !!channel?.aiModel)
    setEndpoints(initialEndpoints(channel))
  }, [channelId, channel?.aiEnabled, channel?.aiModel, channel?.aiEndpoint, channel?.aiEndpoints])

  const manage = !!snapshot && can(snapshot.policy, snapshot.actor, 'MANAGE_CHANNELS', channelId)

  const handleSave = () => {
    setStatus('')
    setIsSuccess(false)
    void state.command({ type: 'ai-channel-settings', channelId, enabled, endpoints })
      .then(() => {
        setIsSuccess(true)
        setStatus('Configurações de IA salvas com sucesso para este canal.')
      })
      .catch(error => {
        setIsSuccess(false)
        setStatus(error instanceof Error ? error.message : 'Falha ao salvar configurações do canal.')
      })
  }

  return (
    <section className="ct-ai-channel-section">
      {/* Header Banner */}
      <div className="ct-ai-channel-header">
        <div className="ct-ai-channel-header-text">
          <div className="ct-ai-channel-title-row">
            <ControlIcon name="ai" size={17} />
            <h3>Inteligência Artificial no Canal</h3>
          </div>
          <p>Configure a assistência de IA e os provedores permitidos para as conversas deste canal.</p>
        </div>
      </div>

      {/* Main Activation Card */}
      <div className={`ct-ai-toggle-card ${enabled ? 'is-enabled' : ''}`}>
        <div className="ct-ai-toggle-info">
          <div className="ct-ai-toggle-title-row">
            <strong>Assistência por IA</strong>
            <span className={`ct-ai-status-pill ${enabled ? 'is-active' : ''}`}>
              {enabled ? 'Habilitada no canal' : 'Desativada'}
            </span>
          </div>
          <p>
            Permite aos membros invocar modelos de linguagem para tirar dúvidas, gerar código e analisar tópicos no chat.
          </p>
        </div>

        <label className="ct-switch-label" title={enabled ? 'Desativar IA' : 'Ativar IA'}>
          <input
            type="checkbox"
            checked={enabled}
            disabled={!manage || state.busy}
            onChange={e => setEnabled(e.target.checked)}
            className="ct-switch-input"
          />
          <span className="ct-switch-slider" />
        </label>
      </div>

      {/* When Enabled: Credentials and Endpoints */}
      {enabled ? (
        <div className="ct-ai-enabled-content">
          <div className="ct-ai-info-notice">
            <ControlIcon name="info" size={14} />
            <span>
              Cada participante conecta suas próprias chaves de API pessoais no aplicativo. As respostas geradas pela IA ficam visíveis para todos os membros no canal.
            </span>
          </div>

          <AiCredentialEditor endpoints={endpoints} onEndpoints={setEndpoints} />

          <div className="ct-ai-actions-footer">
            <button
              className="ct-primary ct-ai-channel-save-btn"
              type="button"
              disabled={!manage || state.busy}
              onClick={handleSave}
            >
              <ControlIcon name="check" size={14} />
              <span>{state.busy ? 'Salvando no servidor…' : 'Salvar IA do Canal'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="ct-ai-disabled-hint">
          <p>A IA está desativada para este canal. Ative o interruptor acima para liberar o uso de modelos e endpoints.</p>
        </div>
      )}

      {status && (
        <div className={isSuccess ? 'ct-success-banner' : 'ct-error-banner'} role="status">
          <ControlIcon name={isSuccess ? 'check' : 'warning'} size={14} />
          <span>{status}</span>
        </div>
      )}
    </section>
  )
}
