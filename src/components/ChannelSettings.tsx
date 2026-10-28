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
import { useDevStore } from '../store/useDevStore'

export function ChannelSettings({ channel, onClose }: { channel: Channel; onClose: () => void }) {
  const roles = useRoleStore()
  const devStore = useDevStore()
  const current = useAppStore(s => s.servers.find(server => server.id === channel.serverId)?.channels.find(c => c.id === channel.id))
  const [name, setName] = useState(current?.name || channel.name)
  const [tab, setTab] = useState<'general' | 'ai' | 'github' | 'permissions'>('general')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const panel = useRef<HTMLElement>(null)
  const previous = useRef(document.activeElement as HTMLElement | null)

  const boundRepo = devStore.getChannelRepo(channel.id)

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
            <button aria-current={tab === 'github' ? 'page' : undefined} onClick={() => setTab('github')}>
              GitHub & Repositório
            </button>
          )}
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

                {/* GitHub Repository Overview Card */}
                <div className="ct-ai-overview-card">
                  <div className="ct-ai-overview-info">
                    <div className="ct-ai-overview-title">
                      <ControlIcon name="git" size={15} />
                      <strong>Repositório GitHub</strong>
                      <span className={`ct-ai-status-pill ${boundRepo ? 'is-active' : ''}`}>
                        {boundRepo ? boundRepo.name : 'Nenhum'}
                      </span>
                    </div>
                    <p>{boundRepo ? `Conectado a ${boundRepo.fullName}. O chat e a IA trabalham neste projeto.` : 'Conecte um repositório para o chat e a IA deste canal.'}</p>
                  </div>
                  <button
                    type="button"
                    className="ct-secondary ct-ai-overview-btn"
                    onClick={() => setTab('github')}
                  >
                    {boundRepo ? 'Gerenciar Repositório →' : 'Conectar Repositório →'}
                  </button>
                </div>

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
              <button className="ct-danger" onClick={() => setConfirm(true)} disabled={busy || !manage}>
                Excluir canal…
              </button>
            </section>
          </>
        ) : tab === 'github' ? (
          <div className="ct-channel-github-settings">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--cx-hover)', display: 'grid', placeItems: 'center' }}>
                <ControlIcon name="git" size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Repositório do Canal</h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--cx-fg-3)' }}>
                  Vincule um repositório da sua conta do GitHub a este canal de texto para discussões e automações com IA.
                </p>
              </div>
            </div>

            {devStore.githubAccounts.length === 0 ? (
              <div style={{ padding: '16px', background: 'var(--cx-surface)', borderRadius: '10px', border: '1px solid var(--cx-border-light)', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: 'var(--cx-fg-2)', marginBottom: '12px' }}>
                  Nenhuma conta do GitHub conectada no momento.
                </p>
                {devStore.detectedLocalGitHub ? (
                  <button
                    type="button"
                    className="ct-primary"
                    onClick={() => void devStore.connectGitHubDirect()}
                  >
                    <ControlIcon name="git" size={14} />
                    <span>Conectar @{devStore.detectedLocalGitHub.username} (1-Clique)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ct-primary"
                    onClick={() => void devStore.connectGitHubDirect()}
                  >
                    <ControlIcon name="git" size={14} />
                    <span>Vincular Conta do GitHub</span>
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label htmlFor="select-channel-repo" style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
                    Repositório em que este chat trabalhará
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      id="select-channel-repo"
                      value={boundRepo?.id ? String(boundRepo.id) : ''}
                      disabled={busy || !manage}
                      style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', background: 'var(--cx-elevated)', border: '1px solid var(--cx-border-light)', color: 'var(--cx-fg)', fontSize: '13px' }}
                      onChange={(e) => {
                        const val = e.target.value
                        devStore.bindChannelRepo(channel.id, val || null)
                        setStatus(val ? 'Repositório vinculado ao canal.' : 'Repositório desvinculado.')
                      }}
                    >
                      <option value="">Nenhum repositório vinculado</option>
                      {devStore.repositories.map((repo) => (
                        <option key={repo.id} value={String(repo.id)}>
                          {repo.fullName} ({repo.isPrivate ? 'Privado' : 'Público'})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="ct-secondary"
                      onClick={() => void devStore.refreshRepositories()}
                      title="Atualizar lista de repositórios do GitHub"
                      style={{ padding: '0 12px', height: '36px' }}
                    >
                      <ControlIcon name="refresh" size={14} />
                    </button>
                  </div>
                </div>

                {boundRepo ? (
                  <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--cx-surface)', border: '1px solid var(--cx-border-light)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ControlIcon name={boundRepo.isPrivate ? 'lock' : 'git-branch'} size={15} />
                        <strong style={{ fontSize: '14px' }}>{boundRepo.fullName}</strong>
                        <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'var(--cx-hover)', color: 'var(--cx-fg-3)' }}>
                          {boundRepo.isPrivate ? 'Privado' : 'Público'}
                        </span>
                        {boundRepo.language && (
                          <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#1c2d42', color: '#58a6ff' }}>
                            {boundRepo.language}
                          </span>
                        )}
                      </div>
                      <a
                        href={boundRepo.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '12px', color: 'var(--cx-accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        Abrir no GitHub <ControlIcon name="arrow" size={12} />
                      </a>
                    </div>

                    {boundRepo.description && (
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--cx-fg-2)' }}>{boundRepo.description}</p>
                    )}

                    <div style={{ fontSize: '12px', color: 'var(--cx-fg-3)', display: 'flex', gap: '12px' }}>
                      <span>Branch padrão: <code style={{ color: 'var(--cx-fg)' }}>{boundRepo.defaultBranch || 'main'}</code></span>
                      {boundRepo.stars !== undefined && <span>⭐ {boundRepo.stars}</span>}
                    </div>

                    <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(35, 134, 54, 0.1)', border: '1px solid rgba(35, 134, 54, 0.3)', display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '4px' }}>
                      <ControlIcon name="ai" size={16} />
                      <div>
                        <strong style={{ fontSize: '12px', color: '#3fb950', display: 'block' }}>IA Conectada ao Repositório</strong>
                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--cx-fg-2)', lineHeight: '1.4' }}>
                          Neste chat, a inteligência artificial responderá contextualmente ciente deste repositório, pronta para auxiliar em arquitetura, código, testes e pull requests.
                        </p>
                      </div>
                    </div>

                    {manage && (
                      <button
                        type="button"
                        className="ct-danger"
                        style={{ alignSelf: 'flex-start', marginTop: '6px', fontSize: '12px' }}
                        onClick={() => {
                          devStore.bindChannelRepo(channel.id, null)
                          setStatus('Repositório desvinculado deste canal.')
                        }}
                      >
                        Desvincular repositório deste chat
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="ct-muted" style={{ margin: 0, fontSize: '12px' }}>
                    Escolha um repositório acima para conectar com este canal de texto.
                  </p>
                )}
              </div>
            )}
          </div>
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
