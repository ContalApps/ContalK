import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ControlIcon } from './ControlIcon'
import { Avatar } from './Avatar'
import { FriendButton } from './FriendButton'
import { useFriendStore } from '../store/useFriendStore'
import { useVoiceStore } from '../store/useVoiceStore'
import { useAppStore } from '../store/useAppStore'

export type FriendFilter = 'online' | 'all' | 'pending' | 'add'
type Person = { username: string; display_name: string; online: boolean }

// Tela de Amigos no formato do Discord: barra de abas, busca, lista com divisórias e "Ativo agora".
export function FriendsPage({ filter, onFilter, people, pendingCount, search, onSearch, searching, presenceOnline, addInput, onAddInput, onAdd, addFeedback, onConversation, onProfile, friends }: {
  filter: FriendFilter
  onFilter: (filter: FriendFilter) => void
  people: Person[]
  pendingCount: number
  search: string
  onSearch: (value: string) => void
  searching: boolean
  presenceOnline: boolean
  addInput: string
  onAddInput: (value: string) => void
  onAdd: (event: FormEvent) => void
  addFeedback: { type: 'success' | 'error' | 'info'; message: string } | null
  onConversation: (username: string) => void
  onProfile: (name: string, username?: string) => void
  friends: Person[]
}) {
  const relations = useFriendStore(s => s.relations)
  const voice = useVoiceStore()
  const servers = useAppStore(s => s.servers)
  const [menu, setMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const outside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(null) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [menu])

  // Quem dos amigos está em algum canal de voz que este app conhece.
  const inVoice = friends.flatMap(friend => {
    const entries = Object.entries(voice.channelOccupants)
    if (voice.activeChannelId) entries.push([voice.activeChannelId, voice.participants])
    const found = entries.find(([, list]) => list.some(person => person.identity === friend.username))
    if (!found) return []
    const server = servers.find(item => item.channels.some(channel => channel.id === found[0]))
    const channel = server?.channels.find(item => item.id === found[0])
    const person = found[1].find(item => item.identity === friend.username)!
    return [{ friend, channel: channel?.name || 'Canal de voz', server: server?.name || '', count: found[1].length, sharing: person.isScreenShareEnabled }]
  })

  const tabs: Array<[FriendFilter, string]> = [['online', 'Disponível'], ['all', 'Todos'], ['pending', 'Pendente']]
  const heading = filter === 'online' ? 'Disponível' : filter === 'all' ? 'Todos os amigos' : filter === 'pending' ? 'Pendente' : 'Sugestões'
  const status = (person: Person) => relations[person.username]?.status === 'incoming' ? 'Pedido de amizade recebido'
    : relations[person.username]?.status === 'outgoing' ? 'Pedido de amizade enviado'
    : person.online ? 'Online' : presenceOnline ? 'Offline' : 'Status indisponível'

  return (
    <section className="ct-friends">
      <header className="ct-friends-bar">
        <span className="ct-friends-title"><ControlIcon name="friends" size={18} />Amigos</span>
        <i className="ct-friends-sep" aria-hidden="true" />
        <nav role="tablist" aria-label="Filtrar amigos">
          {tabs.map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => onFilter(value)}>
              {label}{value === 'pending' && pendingCount > 0 && <span className="ct-friends-badge">{pendingCount}</span>}
            </button>
          ))}
          <button type="button" role="tab" aria-selected={filter === 'add'} className="ct-friends-add-tab" onClick={() => onFilter('add')}>Adicionar amigo</button>
        </nav>
      </header>

      <div className="ct-friends-body">
        <div className="ct-friends-main">
          {filter === 'add' && (
            <form className="ct-friends-add" onSubmit={onAdd}>
              <h2>Adicionar amigo</h2>
              <p>Você pode adicionar amigos com o nome de usuário deles no ConTalk.</p>
              <div className="ct-friends-add-field" data-state={addFeedback?.type}>
                <input aria-label="Nome de usuário para adicionar" placeholder="Digite o nome de usuário, ex.: joao" value={addInput} onChange={event => onAddInput(event.target.value)} autoComplete="off" />
                <button type="submit" className="ct-button-primary" disabled={!addInput.trim()}>Enviar pedido de amizade</button>
              </div>
              {addFeedback && <p className={`ct-friends-feedback ct-friends-feedback-${addFeedback.type}`} role="alert">{addFeedback.message}</p>}
            </form>
          )}

          <label className="ct-friends-search">
            <ControlIcon name="search" size={16} />
            <input aria-label="Buscar amigos" placeholder={filter === 'add' ? 'Pesquisar pessoas no ConTalk' : 'Buscar'} value={search} onChange={event => onSearch(event.target.value)} />
            {search && <button type="button" aria-label="Limpar busca" onClick={() => onSearch('')}><ControlIcon name="close" size={14} /></button>}
          </label>

          <h3 className="ct-friends-count">{searching ? 'Pesquisando…' : `${heading} — ${people.length}`}</h3>

          {people.length > 0 ? (
            <ul className="ct-friends-list">
              {people.map(person => {
                const friend = relations[person.username]?.status === 'friend'
                return (
                  <li key={person.username}>
                    <button type="button" className="ct-friends-person" onClick={() => onProfile(person.display_name, person.username)}>
                      <Avatar name={person.display_name} identity={person.username} />
                      <span>
                        <strong>{person.display_name}<small> @{person.username}</small></strong>
                        <small>{status(person)}</small>
                      </span>
                    </button>
                    <div className="ct-friends-actions">
                      {friend ? (
                        <>
                          <button type="button" className="ct-friends-round" aria-label={`Mandar mensagem para ${person.display_name}`} title="Mensagem" onClick={() => onConversation(person.username)}>
                            <ControlIcon name="chat" size={17} />
                          </button>
                          <div className="ct-friends-more" ref={menu === person.username ? menuRef : undefined}>
                            <button type="button" className="ct-friends-round" aria-label={`Mais opções para ${person.display_name}`} title="Mais" aria-expanded={menu === person.username} onClick={() => setMenu(menu === person.username ? null : person.username)}>
                              <ControlIcon name="more" size={17} />
                            </button>
                            {menu === person.username && (
                              <div className="ct-friends-menu" role="menu">
                                <button type="button" role="menuitem" onClick={() => { setMenu(null); onProfile(person.display_name, person.username) }}>Ver perfil</button>
                                <button type="button" role="menuitem" className="ct-danger-item" onClick={() => { setMenu(null); useFriendStore.getState().remove(person.username) }}>Remover amizade</button>
                              </div>
                            )}
                          </div>
                        </>
                      ) : <FriendButton username={person.username} name={person.display_name} />}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="ct-friends-empty">
              <span aria-hidden="true"><ControlIcon name="friends" size={28} /></span>
              <p>
                {searching ? 'Buscando pessoas…'
                  : search ? 'Ninguém encontrado com esse nome.'
                  : filter === 'online' ? 'Nenhum amigo disponível agora.'
                  : filter === 'pending' ? 'Não há pedidos de amizade pendentes.'
                  : filter === 'add' ? 'Digite um nome de usuário para encontrar pessoas.'
                  : 'Sua lista de amigos ainda está vazia. Adicione alguém pelo nome de usuário.'}
              </p>
            </div>
          )}
        </div>

        <aside className="ct-friends-active" aria-label="Ativo agora">
          <h2>Ativo agora</h2>
          {inVoice.length ? inVoice.map(item => (
            <article className="ct-active-card" key={item.friend.username}>
              <header>
                <Avatar name={item.friend.display_name} identity={item.friend.username} />
                <span><strong>{item.friend.display_name}</strong><small>{item.sharing ? 'Compartilhando a tela' : 'Em um canal de voz'}</small></span>
              </header>
              <footer>
                <ControlIcon name="voice" size={16} />
                <span><strong>{item.channel}</strong><small>{item.server ? `${item.server} · ` : ''}{item.count} {item.count === 1 ? 'pessoa' : 'pessoas'}</small></span>
              </footer>
            </article>
          )) : (
            <div className="ct-active-empty">
              <strong>Está tranquilo por enquanto…</strong>
              <p>Quando um amigo entrar num canal de voz, ele aparece aqui.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
