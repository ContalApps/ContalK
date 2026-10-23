import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useVoiceStore } from '../store/useVoiceStore'
import { useAppStore } from '../store/useAppStore'

interface Friend {
  username: string
  name: string
  status: 'online' | 'idle' | 'dnd' | 'offline'
  activity?: string
  inVoice?: string
  customStatus?: string
}

const INITIAL_FRIENDS: Friend[] = [
  {
    username: 'alice',
    name: 'Alice Silva',
    status: 'online',
    inVoice: 'Sala Geral',
    activity: 'Em chamada de voz no ContalK HQ',
  },
  {
    username: 'carol',
    name: 'Carol Oliveira',
    status: 'online',
    activity: 'Jogando Rocket League • 42m',
    customStatus: 'Focada na ranked 🚀',
  },
  {
    username: 'dave',
    name: 'Dave Lima',
    status: 'idle',
    activity: 'Ouvindo Spotify • Synthwave Radio',
    customStatus: 'Coding Rust 🦀',
  },
  {
    username: 'lucas_dev',
    name: 'Lucas Ferreira',
    status: 'online',
    activity: 'Desenvolvendo no ContalK',
  },
  {
    username: 'mari_gamer',
    name: 'Mariana Costa',
    status: 'offline',
  },
]

export function HomeView() {
  const { user } = useAuthStore()
  const { joinChannel } = useVoiceStore()
  const { setActiveServer, setActiveChannel } = useAppStore()

  const [activeTab, setActiveTab] = useState<'disponivel' | 'todos' | 'pendente' | 'adicionar'>('disponivel')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFriendDM, setSelectedFriendDM] = useState<string | null>(null)
  const [dmMessages, setDmMessages] = useState<Record<string, { sender: string; text: string; time: string }[]>>({
    alice: [
      { sender: 'alice', text: 'Oi! Vi que você acabou de entrar no ContalK.', time: '22:15' },
      { sender: 'alice', text: 'Estou na Sala Geral se quiser testar a transmissão de tela!', time: '22:16' },
    ],
    carol: [
      { sender: 'carol', text: 'Bora jogar mais tarde?', time: '21:40' },
    ],
  })
  const [dmInput, setDmInput] = useState('')

  const handleSendDM = (e: React.FormEvent) => {
    e.preventDefault()
    if (!dmInput.trim() || !selectedFriendDM || !user) return

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setDmMessages((prev) => ({
      ...prev,
      [selectedFriendDM]: [
        ...(prev[selectedFriendDM] || []),
        { sender: user.username, text: dmInput.trim(), time: now },
      ],
    }))
    setDmInput('')
  }

  const handleJoinFriendVoice = async (friend: Friend) => {
    if (friend.inVoice && user) {
      setActiveServer('srv-1')
      setActiveChannel('vc-general')
      await joinChannel('vc-general', friend.inVoice, {
        username: user.username,
        display_name: user.display_name,
      })
    }
  }

  const filteredFriends = INITIAL_FRIENDS.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.username.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false

    if (activeTab === 'disponivel') return f.status === 'online' || f.status === 'idle'
    if (activeTab === 'todos') return true
    if (activeTab === 'pendente') return false
    return true
  })

  const activeFriend = INITIAL_FRIENDS.find((f) => f.username === selectedFriendDM)

  return (
    <div className="flex-1 flex h-full bg-[#161224] text-[#e2e1e9] select-none overflow-hidden">
      {/* 1. Sub-Sidebar de Mensagens Diretas e Amigos */}
      <aside className="w-60 flex-shrink-0 bg-[#13101f] border-r border-purple-900/30 flex flex-col z-10">
        <header className="h-12 px-3 flex items-center border-b border-purple-900/30 shadow-sm flex-shrink-0">
          <button
            onClick={() => setSelectedFriendDM(null)}
            className="w-full bg-[#0c0a14] hover:bg-purple-950/40 text-purple-300/70 hover:text-purple-200 text-xs px-3 py-1.5 rounded-lg border border-purple-900/30 text-left transition-colors flex items-center justify-between"
          >
            <span>Encontre uma conversa</span>
            <span className="text-[10px] bg-purple-950/60 px-1 py-0.5 rounded border border-purple-800/40">Ctrl+K</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          <div className="space-y-0.5">
            <button
              onClick={() => setSelectedFriendDM(null)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                selectedFriendDM === null
                  ? 'bg-purple-900/40 text-white border-l-2 border-purple-400 shadow-sm'
                  : 'text-[#a49fb5] hover:bg-purple-950/30 hover:text-white'
              }`}
            >
              <span className="text-base text-purple-400">👥</span>
              <span>Amigos</span>
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between px-2 mb-1.5 text-purple-400/70 text-[11px] font-bold uppercase tracking-wider">
              <span>Mensagens Diretas</span>
              <button
                onClick={() => {
                  setSelectedFriendDM(null)
                  setActiveTab('adicionar')
                }}
                className="text-xs hover:text-purple-300 cursor-pointer"
                title="Criar DM"
              >
                +
              </button>
            </div>

            <div className="space-y-0.5">
              {INITIAL_FRIENDS.map((f) => {
                const isSelected = selectedFriendDM === f.username
                return (
                  <button
                    key={f.username}
                    onClick={() => setSelectedFriendDM(f.username)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs transition-all text-left group ${
                      isSelected
                        ? 'bg-purple-900/40 text-white font-medium border-l-2 border-purple-400 shadow-sm'
                        : 'text-[#9c97ad] hover:bg-purple-950/30 hover:text-white'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow">
                        {f.name.charAt(0).toUpperCase()}
                      </div>
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#13101f] ${
                          f.status === 'online'
                            ? 'bg-green-500'
                            : f.status === 'idle'
                            ? 'bg-yellow-500'
                            : 'bg-gray-500'
                        }`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate text-[#e2e1e9] group-hover:text-white">
                        {f.name}
                      </div>
                      <div className="text-[10px] text-purple-400/60 truncate">
                        {f.inVoice ? `🔊 ${f.inVoice}` : f.activity || f.status}
                      </div>
                    </div>

                    {f.inVoice && (
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" title="Em chamada" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </aside>

      {/* 2. Área Central: Visualização de Amigos OU Conversa Direta (DM) */}
      {selectedFriendDM && activeFriend ? (
        /* CONVERSA DIRETA (DM) */
        <main className="flex-1 flex flex-col min-w-0 bg-[#161224] relative">
          <header className="h-12 px-4 flex items-center justify-between border-b border-purple-900/30 bg-[#141021] shadow-sm flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow">
                  {activeFriend.name.charAt(0).toUpperCase()}
                </div>
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#141021] ${
                    activeFriend.status === 'online' ? 'bg-green-500' : 'bg-gray-500'
                  }`}
                />
              </div>
              <h2 className="font-bold text-white text-sm tracking-wide">{activeFriend.name}</h2>
              <span className="text-[11px] text-purple-400/60">@{activeFriend.username}</span>
            </div>

            <div className="flex items-center gap-2">
              {activeFriend.inVoice && (
                <button
                  onClick={() => handleJoinFriendVoice(activeFriend)}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow"
                >
                  <span>🔊</span>
                  <span>Entrar na {activeFriend.inVoice}</span>
                </button>
              )}
              <button
                onClick={() => setSelectedFriendDM(null)}
                className="p-1.5 hover:bg-purple-900/30 text-purple-300 rounded-lg text-xs"
                title="Fechar DM"
              >
                ✕
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="my-6 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 mx-auto flex items-center justify-center text-3xl font-black text-white shadow-xl mb-3">
                {activeFriend.name.charAt(0).toUpperCase()}
              </div>
              <h3 className="text-xl font-bold text-white">{activeFriend.name}</h3>
              <p className="text-xs text-purple-400/70 mt-1">
                Este é o início da sua conversa direta com {activeFriend.name}.
              </p>
            </div>

            {/* Mensagens do chat direto */}
            {(dmMessages[selectedFriendDM] || []).map((msg, idx) => (
              <div
                key={idx}
                className="group flex gap-3 py-1.5 hover:bg-purple-950/20 px-3 -mx-3 rounded-xl transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow flex-shrink-0 mt-0.5">
                  {msg.sender === user?.username ? user.username.charAt(0).toUpperCase() : activeFriend.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm text-purple-200">
                      {msg.sender === user?.username ? user?.display_name || user?.username : activeFriend.name}
                    </span>
                    <span className="text-[10px] text-purple-400/50">{msg.time}</span>
                  </div>
                  <p className="text-[#e2e1e9] text-sm leading-relaxed">{msg.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 pb-6 pt-1 flex-shrink-0">
            <form
              onSubmit={handleSendDM}
              className="bg-[#1c172d] border border-purple-900/40 focus-within:border-purple-500/60 rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-lg"
            >
              <input
                type="text"
                value={dmInput}
                onChange={(e) => setDmInput(e.target.value)}
                placeholder={`Conversar com @${activeFriend.name}`}
                className="flex-1 bg-transparent border-none outline-none text-[#e2e1e9] placeholder-purple-400/40 text-sm"
              />
              <button
                type="submit"
                disabled={!dmInput.trim()}
                className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-purple-600/30"
              >
                Enviar
              </button>
            </form>
          </div>
        </main>
      ) : (
        /* PAINEL PRINCIPAL DE AMIGOS (TELA INICIAL DISCORD STYLE) */
        <main className="flex-1 flex flex-col min-w-0 bg-[#161224] relative">
          {/* Header Superior com Abas */}
          <header className="h-12 px-4 flex items-center justify-between border-b border-purple-900/30 bg-[#141021] shadow-sm flex-shrink-0">
            <div className="flex items-center gap-4 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-sm flex-shrink-0 pr-3 border-r border-purple-900/40">
                <span>👥</span>
                <span className="text-white">Amigos</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('disponivel')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    activeTab === 'disponivel'
                      ? 'bg-purple-900/50 text-white font-bold'
                      : 'text-[#9c97ad] hover:bg-purple-950/30 hover:text-white'
                  }`}
                >
                  Disponível
                </button>

                <button
                  onClick={() => setActiveTab('todos')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    activeTab === 'todos'
                      ? 'bg-purple-900/50 text-white font-bold'
                      : 'text-[#9c97ad] hover:bg-purple-950/30 hover:text-white'
                  }`}
                >
                  Todos
                </button>

                <button
                  onClick={() => setActiveTab('pendente')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    activeTab === 'pendente'
                      ? 'bg-purple-900/50 text-white font-bold'
                      : 'text-[#9c97ad] hover:bg-purple-950/30 hover:text-white'
                  }`}
                >
                  Pendente
                </button>

                <button
                  onClick={() => setActiveTab('adicionar')}
                  className={`px-3 py-1.5 rounded-lg transition-all ml-2 font-bold ${
                    activeTab === 'adicionar'
                      ? 'bg-green-600 text-white'
                      : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30'
                  }`}
                >
                  Adicionar amigo
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 flex min-h-0">
            {/* Lista de Contatos */}
            <div className="flex-1 flex flex-col min-w-0 p-6 overflow-y-auto">
              {activeTab === 'adicionar' ? (
                /* ABA ADICIONAR AMIGO */
                <div className="max-w-xl">
                  <h3 className="text-white font-bold text-base mb-1">ADICIONAR AMIGO</h3>
                  <p className="text-xs text-purple-300/70 mb-4">
                    Você pode adicionar amigos usando a tag do ContalK ou nome de usuário.
                  </p>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Você pode adicionar amigos com o nome ou usuário..."
                      className="w-full bg-[#0c0a14] border border-purple-900/50 focus:border-purple-500 rounded-xl px-4 py-3 text-white placeholder-purple-400/40 text-sm outline-none transition-colors"
                    />
                    <button className="absolute right-2 top-2 px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg shadow">
                      Enviar pedido
                    </button>
                  </div>
                </div>
              ) : (
                /* LISTAGEM DE AMIGOS */
                <div className="space-y-4">
                  {/* Campo de Busca */}
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar amigos..."
                      className="w-full bg-[#0c0a14] border border-purple-900/40 focus:border-purple-500/70 rounded-xl px-4 py-2.5 text-xs text-white placeholder-purple-400/40 outline-none transition-all"
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs text-purple-400/50">🔍</span>
                  </div>

                  <div className="text-[11px] font-bold text-purple-400/70 uppercase tracking-wider">
                    {activeTab === 'disponivel' ? 'Disponível' : 'Todos os Amigos'} — {filteredFriends.length}
                  </div>

                  <div className="space-y-1 divide-y divide-purple-950/40">
                    {filteredFriends.map((friend) => (
                      <div
                        key={friend.username}
                        className="flex items-center justify-between p-3 hover:bg-purple-950/30 rounded-xl transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative flex-shrink-0">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-white text-sm shadow-md">
                              {friend.name.charAt(0).toUpperCase()}
                            </div>
                            <div
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#161224] ${
                                friend.status === 'online'
                                  ? 'bg-green-500'
                                  : friend.status === 'idle'
                                  ? 'bg-yellow-500'
                                  : 'bg-gray-500'
                              }`}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm group-hover:text-purple-300 transition-colors">
                                {friend.name}
                              </span>
                              <span className="text-[11px] text-purple-400/50">@{friend.username}</span>
                            </div>
                            <div className="text-xs text-purple-300/70 truncate flex items-center gap-1.5 mt-0.5">
                              {friend.inVoice ? (
                                <span className="text-green-400 font-medium flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                  Em canal de voz: {friend.inVoice}
                                </span>
                              ) : (
                                friend.activity || friend.status
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Botões de Ação Rápida no Amigo */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedFriendDM(friend.username)}
                            title="Mensagem Direta"
                            className="w-9 h-9 rounded-full bg-[#0c0a14] hover:bg-purple-900/40 text-purple-300 hover:text-white flex items-center justify-center transition-colors border border-purple-900/40 shadow"
                          >
                            💬
                          </button>

                          {friend.inVoice && (
                            <button
                              onClick={() => handleJoinFriendVoice(friend)}
                              title={`Entrar na ${friend.inVoice}`}
                              className="px-3 py-1.5 rounded-xl bg-green-600/80 hover:bg-green-600 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow"
                            >
                              <span>🔊</span>
                              <span>Entrar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Coluna Direita: "Ativo Agora" (Discord style) */}
            <aside className="w-80 bg-[#13101f] border-l border-purple-900/30 p-5 overflow-y-auto hidden lg:block">
              <h3 className="text-white font-black text-sm tracking-wide mb-4">Ativo agora</h3>

              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-[#181329] border border-purple-900/40 shadow-lg hover:border-purple-500/40 transition-all">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow">
                      A
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white">Alice Silva</div>
                      <div className="text-[10px] text-green-400 font-medium">Em canal de voz</div>
                    </div>
                  </div>
                  <div className="p-2 bg-[#0c0a14] rounded-xl text-xs text-purple-300 flex items-center justify-between">
                    <span className="truncate">ContalK HQ / Sala Geral</span>
                    <button
                      onClick={() => handleJoinFriendVoice(INITIAL_FRIENDS[0])}
                      className="text-[10px] bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded font-bold transition-colors"
                    >
                      Ouvir
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#181329] border border-purple-900/40 shadow-lg hover:border-purple-500/40 transition-all">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-600 to-purple-600 flex items-center justify-center font-bold text-white text-xs shadow">
                      C
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white">Carol Oliveira</div>
                      <div className="text-[10px] text-purple-400 font-medium">Jogando Rocket League</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-purple-300/70 bg-[#0c0a14] p-2 rounded-xl">
                    Partida Competitiva • Há 42 minutos
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#181329] border border-purple-900/40 shadow-lg hover:border-purple-500/40 transition-all">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow">
                      D
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white">Dave Lima</div>
                      <div className="text-[10px] text-green-400 font-medium">Ouvindo Spotify</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-purple-300/70 bg-[#0c0a14] p-2 rounded-xl truncate">
                    🎵 Synthwave Boy - Neon Skyline
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </main>
      )}
    </div>
  )
}
