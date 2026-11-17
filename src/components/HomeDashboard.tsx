import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Message, Server, Channel } from '../store/useAppStore'
import type { Member } from '../store/useCommunityStore'
import type { VoiceParticipant } from '../store/useVoiceStore'
import { Avatar } from './Avatar'
import { ControlIcon } from './ControlIcon'
import { ServerIcon } from './ServerIcon'

type WidgetId = 'live' | 'communities' | 'friends' | 'recent'
const WIDGETS: Array<{ id: WidgetId; title: string; icon: Parameters<typeof ControlIcon>[0]['name'] }> = [
  { id: 'live', title: 'Ao vivo agora', icon: 'voice' },
  { id: 'communities', title: 'Suas comunidades', icon: 'friends' },
  { id: 'friends', title: 'Amigos online', icon: 'user' },
  { id: 'recent', title: 'Conversas recentes', icon: 'chat' }
]
type Layout = { hidden: Partial<Record<WidgetId, boolean>>; collapsed: Partial<Record<WidgetId, boolean>> }
// Conversas recentes começam ocultas: aparecem só para quem pedir em "Personalizar início".
const DEFAULT_LAYOUT: Layout = { hidden: { recent: true }, collapsed: {} }

function useHomeLayout(owner: string) {
  const key = `contalk-home-v1:${owner}`
  const read = (): Layout => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null')
      if (saved && typeof saved === 'object' && saved.hidden && saved.collapsed) return { hidden: { ...saved.hidden }, collapsed: { ...saved.collapsed } }
    } catch { /* Usa o padrão. */ }
    return DEFAULT_LAYOUT
  }
  const [layout, setLayout] = useState<Layout>(read)
  useEffect(() => { setLayout(read()) }, [key])
  const update = (next: Layout) => {
    setLayout(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* Preferência só nesta sessão. */ }
  }
  return {
    layout,
    toggleHidden: (id: WidgetId) => update({ ...layout, hidden: { ...layout.hidden, [id]: !layout.hidden[id] } }),
    toggleCollapsed: (id: WidgetId) => update({ ...layout, collapsed: { ...layout.collapsed, [id]: !layout.collapsed[id] } })
  }
}

export type LiveChannel = { channel: Channel; server: Server; occupants: VoiceParticipant[]; connected: boolean }

export function HomeDashboard({ owner, displayName, servers, live, friends, recent, onJoin, onOpenCall, onOpenServer, onCreateServer, onMessage, onOpenMessage }: {
  owner: string
  displayName: string
  servers: Server[]
  live: LiveChannel[]
  friends: Member[]
  recent: Message[]
  onJoin: (channel: Channel) => void
  onOpenCall: () => void
  onOpenServer: (id: string) => void
  onCreateServer: () => void
  onMessage: (username: string) => void
  onOpenMessage: (message: Message) => void
}) {
  const { layout, toggleHidden, toggleCollapsed } = useHomeLayout(owner)
  const [customizing, setCustomizing] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!customizing) return
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) setCustomizing(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setCustomizing(false) } }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('keydown', escape, true)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape, true) }
  }, [customizing])

  const hour = new Date().getHours()
  const greeting = hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite'
  const hiddenWidgets = WIDGETS.filter(widget => layout.hidden[widget.id])
  const onlineFriends = friends.filter(friend => friend.online)
  const time = (value: number) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const widget = (id: WidgetId, body: ReactNode, wide = false) => {
    if (layout.hidden[id]) return null
    const meta = WIDGETS.find(item => item.id === id)!
    const collapsed = !!layout.collapsed[id]
    return (
      <section className={`ct-widget ${wide ? 'ct-widget-wide' : ''}`} aria-label={meta.title} data-collapsed={collapsed}>
        <header>
          <ControlIcon name={meta.icon} size={16} />
          <h2>{meta.title}</h2>
          <button type="button" className="ct-widget-action" aria-label={collapsed ? `Expandir ${meta.title}` : `Recolher ${meta.title}`} title={collapsed ? 'Expandir' : 'Recolher'} aria-expanded={!collapsed} onClick={() => toggleCollapsed(id)}>
            <ControlIcon name="chevron" size={15} />
          </button>
          <button type="button" className="ct-widget-action" aria-label={`Ocultar ${meta.title}`} title="Ocultar do Início" onClick={() => toggleHidden(id)}>
            <ControlIcon name="close" size={15} />
          </button>
        </header>
        {!collapsed && <div className="ct-widget-body">{body}</div>}
      </section>
    )
  }

  return (
    <div className="ct-home-dashboard">
      <header className="ct-home-top">
        <h1>{greeting}, {displayName}</h1>
        <div className="ct-home-customize" ref={menu}>
          <button type="button" className="ct-button-ghost" aria-haspopup="true" aria-expanded={customizing} onClick={() => setCustomizing(value => !value)}>
            <ControlIcon name="palette" size={15} />Personalizar início
          </button>
          {customizing && (
            <div className="ct-home-customize-menu" role="group" aria-label="Seções do Início">
              <strong>Mostrar no Início</strong>
              {WIDGETS.map(item => (
                <label key={item.id}>
                  <input type="checkbox" checked={!layout.hidden[item.id]} onChange={() => toggleHidden(item.id)} />
                  <ControlIcon name={item.icon} size={14} />{item.title}
                </label>
              ))}
            </div>
          )}
        </div>
      </header>

      {!servers.length && (
        <section className="ct-widget ct-widget-wide ct-home-start">
          <div>
            <h2>Comece por aqui</h2>
            <p>Você ainda não está em nenhuma comunidade. Crie a sua e chame os amigos, ou entre com um convite.</p>
          </div>
          <button type="button" className="ct-button-primary" onClick={onCreateServer}>Criar ou entrar em uma comunidade</button>
        </section>
      )}

      <div className="ct-widget-grid">
        {widget('live', live.length ? (
          <ul className="ct-live-list">
            {live.map(({ channel, server, occupants, connected }) => {
              const sharing = occupants.find(person => person.isScreenShareEnabled)
              return (
                <li key={channel.id}>
                  <span className="ct-live-icon"><ControlIcon name="voice" size={20} /></span>
                  <span className="ct-live-text">
                    <strong>{channel.name}</strong><small>{server.name}</small>
                    {sharing && <small className="ct-live-sharing"><ControlIcon name="screen" size={12} />{sharing.isLocal ? 'Você está' : `${sharing.serverNickname || sharing.name} está`} compartilhando a tela</small>}
                  </span>
                  <span className="ct-avatar-row" aria-label={`${occupants.length} ${occupants.length === 1 ? 'pessoa' : 'pessoas'}`}>
                    {occupants.slice(0, 4).map(person => <Avatar key={person.identity} name={person.name} identity={person.identity} />)}
                    {occupants.length > 4 && <span className="ct-avatar-more">+{occupants.length - 4}</span>}
                  </span>
                  {connected
                    ? <button type="button" className="ct-button-secondary" onClick={onOpenCall}>Abrir</button>
                    : <button type="button" className="ct-button-primary" onClick={() => onJoin(channel)}>Entrar</button>}
                </li>
              )
            })}
          </ul>
        ) : <p className="ct-widget-empty">Ninguém em chamada agora. Quando alguém entrar num canal de voz, aparece aqui.</p>, true)}

        {widget('communities', (
          <div className="ct-community-list">
            {servers.map(server => (
              <button type="button" key={server.id} onClick={() => onOpenServer(server.id)}>
                <span className="ct-community-icon"><ServerIcon name={server.name} icon={server.icon} /></span>
                <span><strong>{server.name}</strong><small>{server.channels.length} {server.channels.length === 1 ? 'canal' : 'canais'}</small></span>
              </button>
            ))}
            <button type="button" className="ct-community-add" onClick={onCreateServer}>
              <ControlIcon name="plus" size={16} />Criar ou entrar em comunidade
            </button>
          </div>
        ))}

        {widget('friends', onlineFriends.length ? (
          <ul className="ct-friend-list">
            {onlineFriends.slice(0, 8).map(friend => (
              <li key={friend.username}>
                <Avatar name={friend.display_name} identity={friend.username} />
                <span><strong>{friend.display_name}</strong><small><i className="ct-online-dot" aria-hidden="true" />Online</small></span>
                <button type="button" className="ct-icon-button" aria-label={`Mandar mensagem para ${friend.display_name}`} title="Mandar mensagem" onClick={() => onMessage(friend.username)}>
                  <ControlIcon name="chat" size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="ct-widget-empty">Nenhum amigo online agora.</p>)}

        {widget('recent', recent.length ? (
          <ul className="ct-recent-list">
            {recent.slice(0, 6).map(message => (
              <li key={message.id}>
                <button type="button" onClick={() => onOpenMessage(message)}>
                  <Avatar name={message.userName} identity={message.userId} />
                  <span><strong>{message.userName}</strong><small>{message.once ? 'Mensagem de visualização única' : message.content || message.attachment?.name || 'Anexo'}</small></span>
                  <time>{time(message.timestamp)}</time>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="ct-widget-empty">Nenhuma conversa recente.</p>, true)}
      </div>

      {hiddenWidgets.length > 0 && (
        <p className="ct-home-hidden">
          <ControlIcon name="info" size={14} />
          {hiddenWidgets.map(item => item.title).join(', ')} {hiddenWidgets.length === 1 ? 'oculta' : 'ocultas'} ·
          <button type="button" onClick={() => setCustomizing(true)}>Mostrar</button>
        </p>
      )}
    </div>
  )
}
