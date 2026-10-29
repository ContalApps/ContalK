import { ControlIcon } from './ControlIcon'
import { VoiceModeSettings } from './VoiceModeSettings'
import { WebhookManager } from './WebhookManager'
import { VoiceStatusSettings } from './VoiceStatusSettings'
import { can, threadArchived } from '../roles/permissions'
import { ThreadSettings } from './ThreadSettings'
import { SlowmodeSettings } from './SlowmodeSettings'
import { useEffect, useRef, useState } from 'react'
import { useAppStore, type Channel } from '../store/useAppStore'
import { useCommunityStore } from '../store/useCommunityStore'
import { DeleteChannel } from './DeleteChannel'
import { ChannelPermissions } from './ChannelPermissions'
import { useRoleStore } from '../store/useRoleStore'

export function ChannelSettings({
  channel,
  initialTab = 'general',
  onClose,
  onOpenChannel,
  onCreateThread
}: {
  channel: Channel
  initialTab?: 'general' | 'threads' | 'permissions'
  onClose: () => void
  onOpenChannel?: (id: string) => void
  onCreateThread?: (parentId: string) => void
}) {
  const roles = useRoleStore()
  const current = useAppStore(s => s.servers.find(server => server.id === channel.serverId)?.channels.find(c => c.id === channel.id))
  const [name, setName] = useState(current?.name || channel.name)
  const [tab, setTab] = useState<'general' | 'threads' | 'permissions'>(initialTab)
  const [archivedThreads, setArchivedThreads] = useState(false)
  const [threadSearch, setThreadSearch] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const panel = useRef<HTMLElement>(null)
  const previous = useRef(document.activeElement as HTMLElement | null)

  useEffect(() => () => previous.current?.focus(), [])
  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])
  useEffect(() => {
    if (!confirm && tab === 'general') panel.current?.querySelector<HTMLInputElement>('input')?.focus()
  }, [confirm, tab])
  useEffect(() => {
    if (!current) onClose()
  }, [current, onClose])

  if (channel.parentId) return <ThreadSettings channel={current || channel} onClose={onClose} />

  const manage =
    (!roles.configured && roles.status === 'off') ||
    (roles.status === 'connected' &&
      roles.snapshot?.id === channel.serverId &&
      can(roles.snapshot.policy, roles.snapshot.actor, 'MANAGE_CHANNELS', channel.id))



  const channelThreads = roles.snapshot
    ? roles.snapshot.channels.filter(
        c =>
          c.parentId === channel.id &&
          !!roles.snapshot!.policy.threads?.[c.id] &&
          threadArchived(roles.snapshot!.policy.threads[c.id], roles.snapshot!.serverNow) === archivedThreads &&
          c.name.toLowerCase().includes(threadSearch.toLowerCase())
      )
    : (useAppStore.getState().servers.find(s => s.id === channel.serverId)?.channels || []).filter(
        c => c.parentId === channel.id && c.name.toLowerCase().includes(threadSearch.toLowerCase())
      )

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
            <button aria-current={tab === 'threads' ? 'page' : undefined} onClick={() => setTab('threads')}>
              Tópicos
            </button>
          )}
          <button aria-current={tab === 'permissions' ? 'page' : undefined} onClick={() => setTab('permissions')}>
            Permissões
          </button>
        </nav>

        {tab === 'threads' ? (
          <div className="ct-channel-threads">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                type="button"
                className={!archivedThreads ? 'ct-primary' : ''}
                aria-current={!archivedThreads ? 'page' : undefined}
                onClick={() => setArchivedThreads(false)}
              >
                Ativos
              </button>
              <button
                type="button"
                className={archivedThreads ? 'ct-primary' : ''}
                aria-current={archivedThreads ? 'page' : undefined}
                onClick={() => setArchivedThreads(true)}
              >
                Arquivados
              </button>
              {(!roles.snapshot ||
                ['CREATE_PUBLIC_THREADS', 'CREATE_PRIVATE_THREADS'].some(permission =>
                  can(
                    roles.snapshot!.policy,
                    roles.snapshot!.actor,
                    permission as 'CREATE_PUBLIC_THREADS' | 'CREATE_PRIVATE_THREADS',
                    channel.id
                  )
                )) && (
                <button
                  type="button"
                  onClick={() => {
                    onCreateThread?.(channel.id)
                    onClose()
                  }}
                >
                  Criar tópico…
                </button>
              )}
            </div>
            <input
              type="search"
              aria-label="Buscar tópico"
              placeholder="Buscar tópico…"
              value={threadSearch}
              onChange={e => setThreadSearch(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', marginBottom: '10px' }}
            />
            <div className="ct-thread-list">
              {channelThreads.map(c => {
                const threadInfo = roles.snapshot?.policy.threads?.[c.id]
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      onOpenChannel?.(c.id)
                      onClose()
                    }}
                  >
                    <strong>{c.name}</strong>
                    <small>
                      {threadInfo ? (threadInfo.private ? 'Privado' : 'Público') : 'Tópico'}
                      {threadInfo ? ` · ${threadInfo.members.length} participantes` : ''}
                    </small>
                  </button>
                )
              })}
            </div>
            {!channelThreads.length && (
              <p className="ct-muted" style={{ marginTop: '12px', fontSize: '13px' }}>
                Nenhum tópico {archivedThreads ? 'arquivado' : 'ativo'} disponível.
              </p>
            )}
          </div>
        ) : tab === 'general' ? (
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
                <WebhookManager channelId={channel.id} />
              </>
            )}

            <section className="ct-channel-danger">
              <div>
                <strong>Excluir canal</strong>
                <p>Remove o canal e seu histórico. Será necessário confirmar.</p>
              </div>
              <button className="ct-danger" onClick={() => setConfirm(true)} disabled={busy || !manage}>
                Excluir canal…
              </button>
            </section>
          </>
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

      {confirm && (
        <DeleteChannel
          channel={current || channel}
          onClose={() => {
            setConfirm(false)
            if (!useAppStore.getState().servers.some(s => s.channels.some(c => c.id === channel.id))) {
              onClose()
            }
          }}
        />
      )}
    </div>
  )
}
