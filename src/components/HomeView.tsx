import { ControlIcon } from './ControlIcon'
import { ChatComposer, ChatMessage } from './MessageContent'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useCommunityStore } from '../store/useCommunityStore'
import { useFriendStore } from '../store/useFriendStore'
import { useAppStore, type Message } from '../store/useAppStore'
import { friendPeople } from '../social/people'
import { Avatar } from './Avatar'
import { FriendButton } from './FriendButton'

interface RemoteUser {
  username: string
  display_name: string
  avatar_url?: string | null
}

const EMPTY_MESSAGES: Message[] = []

export function HomeView({
  mode,
  selected,
  onConversation,
  onProfile,
  searchQuery = ''
}: {
  mode: 'friends' | 'messages'
  selected: string | null
  onConversation: (username: string) => void
  onProfile: (name: string, username?: string) => void
  searchQuery?: string
}) {
  const user = useAuthStore(s => s.user)!
  const { members, status, sendMessage } = useCommunityStore()
  const relations = useFriendStore(s => s.relations)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'online' | 'all' | 'pending' | 'add'>('online')
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [addFriendInput, setAddFriendInput] = useState('')
  const [addFriendFeedback, setAddFriendFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  const activeQuery = (search || searchQuery).trim()

  useEffect(() => {
    if (activeQuery.length < 2) {
      setRemoteUsers([])
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const results = await window.contalkDesktop?.communitySearchUsers?.(activeQuery)
        if (!cancelled && Array.isArray(results)) {
          setRemoteUsers(results.filter(r => r.username.toLowerCase() !== user.username.toLowerCase()))
        }
      } catch {
        if (!cancelled) setRemoteUsers([])
      } finally {
        if (!cancelled) setIsSearching(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [activeQuery, user.username])

  const handleDirectAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = addFriendInput.trim().replace(/^@/, '')
    if (!clean) return
    if (clean.toLowerCase() === user.username.toLowerCase()) {
      setAddFriendFeedback({ type: 'error', message: 'Você não pode adicionar a si mesmo.' })
      return
    }
    const rel = relations[clean]
    if (rel?.status === 'friend') {
      setAddFriendFeedback({ type: 'info', message: `Você e @${clean} já são amigos.` })
      return
    }
    if (rel?.status === 'outgoing') {
      setAddFriendFeedback({ type: 'info', message: `Você já enviou um pedido de amizade para @${clean}.` })
      return
    }
    if (rel?.status === 'incoming') {
      useFriendStore.getState().accept(clean)
      setAddFriendFeedback({ type: 'success', message: `Pedido de @${clean} aceito!` })
      setAddFriendInput('')
      return
    }
    const found = remoteUsers.find(u => u.username.toLowerCase() === clean.toLowerCase())
      || members.find(m => m.username.toLowerCase() === clean.toLowerCase())
    const name = found?.display_name || clean
    useFriendStore.getState().request(clean, name)
    setAddFriendFeedback({ type: 'success', message: `Pedido de amizade enviado para @${clean}!` })
    setAddFriendInput('')
  }

  const friends = friendPeople(members, relations, user.username)
  const pending = Object.values(relations).filter(r => r.status !== 'friend')

  let people: Array<{ username: string; display_name: string; online: boolean; bio?: string; avatar_url?: string | null }> = []
  if (filter === 'pending') {
    people = pending.map(r => members.find(m => m.username === r.username) || { ...r, online: false, bio: '' })
  } else if (filter === 'add') {
    if (activeQuery.length >= 2) {
      const map = new Map<string, { username: string; display_name: string; online: boolean; avatar_url?: string | null }>()
      for (const u of remoteUsers) {
        const isMem = members.find(m => m.username.toLowerCase() === u.username.toLowerCase())
        map.set(u.username.toLowerCase(), {
          username: u.username,
          display_name: u.display_name || u.username,
          online: isMem?.online ?? false,
          avatar_url: u.avatar_url
        })
      }
      for (const m of members) {
        if (m.username.toLowerCase() === user.username.toLowerCase()) continue
        if (`${m.display_name} ${m.username}`.toLowerCase().includes(activeQuery.toLowerCase())) {
          if (!map.has(m.username.toLowerCase())) {
            map.set(m.username.toLowerCase(), {
              username: m.username,
              display_name: m.display_name,
              online: m.online
            })
          }
        }
      }
      people = [...map.values()]
    } else {
      people = members.filter(m => m.username !== user.username && !relations[m.username])
    }
  } else {
    people = friends
  }

  const shown = filter === 'add' && activeQuery.length >= 2
    ? people
    : people.filter(m => (filter !== 'online' || m.online) && [search, searchQuery].every(term => `${m.display_name} ${m.username}`.toLowerCase().includes(term.toLowerCase())))

  const peer = members.find(m => m.username === selected) || friends.find(m => m.username === selected)
  const channel = 'dm:' + [user.username, selected || ''].sort().join(':')
  const messages = useAppStore(s => s.messages[channel] || EMPTY_MESSAGES)
  const visibleMessages = messages.filter(message => (message.content + ' ' + message.userName + ' ' + (message.attachment?.name || '')).toLowerCase().includes(searchQuery.toLowerCase()))
  const renderMessage = (message: Message) => (
    <article className="ct-message" key={message.id}>
      <Avatar name={message.userName} identity={message.userId} />
      <div>
        <header>
          <strong>{message.userName}</strong>
          <time>{new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
        </header>
        <ChatMessage message={message} />
      </div>
    </article>
  )

  if (mode === 'friends') {
    return (
      <section className="ct-people-page">
        <header className="ct-page-heading">
          <div>
            <h1>Amigos</h1>
            <p>Adicione amigos pelo nome de usuário ou convide alguém da chamada.</p>
          </div>
          <span className={`ct-presence-badge ${status === 'online' ? 'connected' : ''}`}>
            {status === 'online' ? `${friends.filter(m => m.online).length} ${friends.filter(m => m.online).length === 1 ? 'amigo online' : 'amigos online'}` : 'Presença indisponível'}
          </span>
        </header>

        <div className="ct-people-toolbar">
          <div role="group" aria-label="Filtrar amigos">
            {([['online', 'Online'], ['all', 'Todos'], ['pending', `Pendentes (${pending.length})`], ['add', 'Adicionar amigo']] as const).map(([value, label]) => (
              <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>
                {label}
              </button>
            ))}
          </div>
          <input
            aria-label="Buscar amigos"
            placeholder={filter === 'add' ? 'Pesquisar usuários no ConTALK...' : 'Buscar por nome ou usuário...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {filter === 'add' && (
          <div className="ct-add-friend-panel">
            <div className="ct-add-friend-header">
              <h3>Adicionar com nome de usuário</h3>
              <p>Envie um pedido de amizade digitando o @nome de usuário da pessoa.</p>
            </div>
            <form onSubmit={handleDirectAdd} className="ct-add-friend-form">
              <div className="ct-add-friend-input-wrapper">
                <input
                  type="text"
                  aria-label="Nome de usuário para adicionar"
                  placeholder="Digite o nome de usuário (ex: joao)..."
                  value={addFriendInput}
                  onChange={e => {
                    setAddFriendInput(e.target.value)
                    if (addFriendFeedback) setAddFriendFeedback(null)
                  }}
                  className="ct-add-friend-input"
                />
                <button
                  type="submit"
                  className="ct-primary"
                  disabled={!addFriendInput.trim()}
                >
                  Enviar pedido
                </button>
              </div>
              {addFriendFeedback && (
                <p className={`ct-add-friend-feedback ct-feedback-${addFriendFeedback.type}`} role="alert">
                  {addFriendFeedback.message}
                </p>
              )}
            </form>
          </div>
        )}

        {filter === 'add' && activeQuery.length >= 2 && (
          <div className="ct-friend-search-status">
            {isSearching ? 'Pesquisando usuários no ConTALK...' : `Pessoas encontradas (${shown.length}):`}
          </div>
        )}

        {filter === 'add' && !activeQuery && (
          <p className="ct-friend-hint">Sugestões de pessoas que compartilham servidores com você. Digite no campo de busca para pesquisar qualquer usuário no ConTALK.</p>
        )}

        <ul className="ct-people-list">
          {shown.map(m => (
            <li className="ct-person-row" key={m.username}>
              <button className="ct-member-profile" onClick={() => onProfile(m.display_name, m.username)}>
                <Avatar name={m.display_name} identity={m.username} />
                <span>
                  <strong>{m.display_name}</strong>
                  <small>@{m.username} · {m.online ? 'Online' : status === 'online' ? 'Offline' : 'Status indisponível'}</small>
                </span>
              </button>
              <div className="ct-person-actions">
                <FriendButton username={m.username} name={m.display_name} />
                {relations[m.username]?.status === 'friend' && (
                  <button className="ct-secondary" aria-label={`Conversar com ${m.display_name}`} title="Conversar" onClick={() => onConversation(m.username)}>
                    <ControlIcon name="chat" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {!shown.length && (
          <div className="ct-empty ct-people-empty">
            <span aria-hidden="true"><ControlIcon name="friends" size={22} /></span>
            <h2>
              {isSearching ? 'Buscando pessoas...' : (search || searchQuery) ? 'Nenhuma pessoa encontrada' : filter === 'pending' ? 'Nenhuma solicitação pendente' : filter === 'add' ? 'Nenhuma sugestão no momento' : filter === 'online' ? 'Nenhum amigo online agora' : 'Sua lista de amigos começa aqui'}
            </h2>
            <p>
              {filter === 'pending'
                ? 'Pedidos recebidos e enviados aparecem nesta aba.'
                : filter === 'add'
                ? 'Digite o nome de usuário acima para encontrar qualquer pessoa registrada no ConTALK.'
                : (search || searchQuery) && remoteUsers.length > 0
                ? 'Existem usuários com esse nome no ConTALK. Vá até a aba "Adicionar amigo" para encontrá-los.'
                : 'Adicione amigos pela chamada ou pelo perfil. Participar do mesmo servidor não cria uma amizade automaticamente.'}
            </p>
            {(search || searchQuery) && filter !== 'add' && remoteUsers.length > 0 && (
              <button className="ct-primary" style={{ marginTop: '12px' }} onClick={() => setFilter('add')}>
                Ver {remoteUsers.length} usuário(s) em Adicionar amigo
              </button>
            )}
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="ct-dm-page">
      {peer ? (
        <>
          <header className="ct-page-heading">
            <button className="ct-dm-peer" onClick={() => onProfile(peer.display_name, peer.username)}>
              <Avatar name={peer.display_name} identity={peer.username} />
              <span>
                <h2>{peer.display_name}</h2>
                <small>{peer.online ? 'Online' : status === 'online' ? 'Offline' : 'Presença indisponível'}</small>
              </span>
            </button>
            <FriendButton username={peer.username} name={peer.display_name} />
          </header>
          <div className="ct-dm-history">
            {visibleMessages.length ? (
              visibleMessages.map(renderMessage)
            ) : searchQuery ? (
              <p className="ct-empty">Nenhuma mensagem encontrada.</p>
            ) : (
              <div className="ct-empty">
                <Avatar name={peer.display_name} identity={peer.username} large />
                <h2>Converse com {peer.display_name}</h2>
                <p>Este é o início da conversa de vocês.</p>
              </div>
            )}
          </div>
          <ChatComposer
            key={channel}
            placeholder={`Conversar com ${peer.display_name}...`}
            disabled={!peer.online}
            onSend={(text, attachment, options) => sendMessage(channel, text, peer.username, attachment, options)}
          />
        </>
      ) : (
        <div className="ct-empty ct-people-empty">
          <span aria-hidden="true"><ControlIcon name="chat" size={22} /></span>
          <h2>Suas conversas, em um só lugar</h2>
          <p>Escolha um amigo ou uma conversa na lista à esquerda.</p>
        </div>
      )}
    </section>
  )
}
