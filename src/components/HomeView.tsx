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
import { FriendsPage } from './FriendsPage'

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
      <FriendsPage
        filter={filter}
        onFilter={value => { setFilter(value); setAddFriendFeedback(null) }}
        people={shown}
        pendingCount={pending.filter(item => item.status === 'incoming').length}
        search={search}
        onSearch={setSearch}
        searching={isSearching}
        presenceOnline={status === 'online'}
        addInput={addFriendInput}
        onAddInput={value => { setAddFriendInput(value); if (addFriendFeedback) setAddFriendFeedback(null) }}
        onAdd={handleDirectAdd}
        addFeedback={addFriendFeedback}
        onConversation={onConversation}
        onProfile={onProfile}
        friends={friends}
      />
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
