import { ControlIcon } from './ControlIcon'
import { VoiceModeSettings } from './VoiceModeSettings'
import { WebhookManager } from './WebhookManager'
import { VoiceStatusSettings } from './VoiceStatusSettings'
import { can } from '../roles/permissions'
import { ThreadSettings } from './ThreadSettings'
import { AiChannelSettings } from './AiChannelSettings'
import { AiProjectSettings } from './AiProjectSettings'
import { SlowmodeSettings } from './SlowmodeSettings'
import { useEffect, useRef, useState } from 'react'
import { useAppStore, type Channel } from '../store/useAppStore'
import { useCommunityStore } from '../store/useCommunityStore'
import { DeleteChannel } from './DeleteChannel'
import { ChannelPermissions } from './ChannelPermissions'
import { useRoleStore } from '../store/useRoleStore'

export function ChannelSettings({ channel, onClose }: { channel: Channel; onClose: () => void }) {
  const roles = useRoleStore()
  const current = useAppStore(s => s.servers.find(server => server.id === channel.serverId)?.channels.find(c => c.id === channel.id))
  const [name, setName] = useState(current?.name || channel.name)
  const [tab, setTab] = useState<'general' | 'ai' | 'permissions'>('general')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const panel = useRef<HTMLElement>(null)
  const previous = useRef(document.activeElement as HTMLElement | null)

  useEffect(() => () => previous.current?.focus(), [])
  useEffect(() => {
    if (!confirm) panel.current?.querySelector<HTMLInputElement>('input')?.focus()
  }, [confirm])
  useEffect(() => {
    if (!current) onClose()
  }, [current, onClose])

  if (channel.project) return <AiProjectSettings id={channel.id} onClose={onClose} />
  if (channel.parentId) return <ThreadSettings channel={current || channel} onClose={onClose} />

  const manage =
    (!roles.configured && roles.status === 'off') ||
    (roles.status === 'connected' &&
      roles.snapshot?.id === channel.serverId &&
      can(roles.snapshot.policy, roles.snapshot.actor, 'MANAGE_CHANNELS', channel.id))

  if (confirm) {
    return (
      <DeleteChannel
        channel={current || channel}
        onClose={() => {
          if (useAppStore.getState().servers.some(s => s.channels.some(c => c.id === channel.id))) setConfirm(false)
          else onClose()
        }}
      />
    )
  }

  return (
    <div className="ct-modal-backdrop">
      <section
        ref={panel}
        className="ct-channel-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="channel-settings-title"
        onKeyDown={e => {
          if (e.key === 'Escape' && !busy) {
            e.stopPropagation()
            onClose()
          }
          if (e.key === 'Tab') {
            const controls = [
              ...e.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled),input:not(:disabled),select:not(:disabled)'
              )
            ]
            const first = controls[0]
            const last = controls[controls.length - 1]
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault()
              last?.focus()
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault()
              first?.focus()
            }
          }
        }}
      >
        <header>
          <div>
            <small>Canal de {channel.type === 'voice' ? 'voz' : 'texto'}</small>
            <h2 id="channel-settings-title">Configurações de {current?.name || channel.name}</h2>
          </div>
          <button aria-label="Fechar configurações do canal" onClick={onClose}>
            <ControlIcon name="close" />
          </button>
        </header>

        <nav aria-label="Seções do canal">
          <button aria-current={tab === 'general' ? 'page' : undefined} onClick={() => setTab('general')}>
            Visão geral
          </button>
          {channel.type === 'text' && (
            <button aria-current={tab === 'ai' ? 'page' : undefined} onClick={() => setTab('ai')}>
              Inteligência artificial
            </button>
          )}
          <button aria-current={tab === 'permissions' ? 'page' : undefined} onClick={() => setTab('permissions')}>
            Permissões
          </button>
        </nav>

        {tab === 'general' ? (
          <>
            <form
              onSubmit={async e => {
                e.preventDefault()
                setBusy(true)
                setStatus('')
                try {
                  await useCommunityStore.getState().renameChannel(channel.serverId, channel.id, name)
                  setStatus('Nome atualizado.')
                } catch {
                  setStatus(
                    useAppStore.getState().servers.some(s => s.channels.some(c => c.id === channel.id && c.name === name.trim()))
                      ? 'Nome salvo neste dispositivo. A sincronização será retomada ao conectar.'
                      : 'Não foi possível renomear o canal.'
                  )
                } finally {
                  setBusy(false)
                }
              }}
            >
              <label htmlFor="channel-name">Nome do canal</label>
              <input
                id="channel-name"
                value={name}
                disabled={busy || !manage}
                maxLength={60}
                required
                onChange={e => setName(e.target.value)}
              />
              <button
                className="ct-primary"
                disabled={busy || !manage || !name.trim() || name.trim() === current?.name}
              >
                {busy ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </form>

            {channel.type === 'voice' && (
              <>
                <VoiceModeSettings channelId={channel.id} />
                <VoiceStatusSettings channelId={channel.id} />
              </>
            )}

            {channel.type === 'text' && (
              <>
                <SlowmodeSettings channelId={channel.id} />

                {/* AI Overview Card linking to the dedicated tab */}
                <div className="ct-ai-overview-card">
                  <div className="ct-ai-overview-info">
                    <div className="ct-ai-overview-title">
                      <ControlIcon name="ai" size={15} />
                      <strong>Assistência por IA</strong>
                      <span className={`ct-ai-status-pill ${channel.aiEnabled ? 'is-active' : ''}`}>
                        {channel.aiEnabled ? 'Habilitada' : 'Desativada'}
                      </span>
                    </div>
                    <p>Modelos de linguagem, provedores de API e tokens para o chat.</p>
                  </div>
                  <button
                    type="button"
                    className="ct-secondary ct-ai-overview-btn"
                    onClick={() => setTab('ai')}
                  >
                    Configurar IA →
                  </button>
                </div>

                <WebhookManager channelId={channel.id} />
              </>
            )}

            <section className="ct-channel-danger">
              <div>
                <strong>Excluir canal</strong>
                <p>Remove o canal e seu histórico. Será necessário confirmar.</p>
              </div>
              <button onClick={() => setConfirm(true)} disabled={busy || !manage}>
                Excluir canal…
              </button>
            </section>
          </>
        ) : tab === 'ai' ? (
          <AiChannelSettings channelId={channel.id} />
        ) : roles.snapshot ? (
          <ChannelPermissions contextId={channel.id} />
        ) : (
          <div className="ct-channel-permissions">
            <h3>Acesso dos membros</h3>
            <p>Todos os membros podem usar os canais e gerenciar seus nomes e exclusões.</p>
            <p>O servidor ainda não possui cargos ou permissões individuais. As mesmas regras valem para todos os canais.</p>
          </div>
        )}

        {status && <p role="status" className="ct-channel-save-status">{status}</p>}
      </section>
    </div>
  )
}
