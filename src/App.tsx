import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from './store/useAuthStore'
import { useAppStore } from './store/useAppStore'
import { useVoiceStore } from './store/useVoiceStore'
import { AuthScreen } from './components/AuthScreen'
import { VoiceStage } from './components/VoiceStage'
import { HomeView } from './components/HomeView'
import { UpdateNotification } from './components/UpdateNotification'

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function AppLayout() {
  const { user, logout } = useAuthStore()
  const { servers, activeServerId, activeChannelId, setActiveServer, setActiveChannel, messages, addMessage } = useAppStore()
  const {
    activeChannelId: voiceChannelId,
    connectionStatus,
    participants,
    isMicMuted,
    isDeafened,
    isScreenSharing,
    joinChannel,
    leaveChannel,
    toggleMic,
    toggleDeafen,
    toggleScreenShare,
  } = useVoiceStore()

  const [currentView, setCurrentView] = useState<'server' | 'home'>('server')
  const [messageInput, setMessageInput] = useState('')
  const [showMemberList, setShowMemberList] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const currentServer = servers.find((s) => s.id === activeServerId) || servers[0]
  const currentChannel = currentServer.channels.find((c) => c.id === activeChannelId) || currentServer.channels[0]
  const currentMessages = messages[activeChannelId] || []

  const isVoiceViewActive = currentChannel?.type === 'voice'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentMessages.length, activeChannelId])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim() || !user) return

    addMessage(activeChannelId, messageInput, {
      username: user.username,
      display_name: user.display_name,
    })
    setMessageInput('')
  }

  const handleVoiceChannelClick = async (channelId: string, channelName: string) => {
    setCurrentView('server')
    setActiveChannel(channelId)
    if (!user) return

    if (voiceChannelId !== channelId || connectionStatus !== 'connected') {
      await joinChannel(channelId, channelName, {
        username: user.username,
        display_name: user.display_name,
      })
    }
  }

  const textChannels = currentServer.channels.filter((c) => c.type === 'text')
  const voiceChannels = currentServer.channels.filter((c) => c.type === 'voice')

  // Lista de membros do servidor agrupados estilo Discord
  const serverMembers = [
    {
      role: 'Dev / Founder — 2',
      users: [
        { username: user?.username || 'user', name: user?.display_name || 'Você', status: 'online', isSelf: true, roleColor: '#a78bfa' },
        { username: 'vgzera', name: 'vgzera ⚡ DEV', status: 'online', roleColor: '#a78bfa' },
      ],
    },
    {
      role: 'Disponível — 3',
      users: [
        { username: 'alice', name: 'Alice Silva', status: 'online', roleColor: '#34d399' },
        { username: 'carol', name: 'Carol Oliveira', status: 'online', roleColor: '#60a5fa' },
        { username: 'dave', name: 'Dave Lima', status: 'idle', roleColor: '#facc15' },
      ],
    },
    {
      role: 'Offline — 1',
      users: [
        { username: 'trevisz', name: 'Trevisz', status: 'offline', roleColor: '#9ca3af' },
      ],
    },
  ]

  return (
    <div className="flex h-screen bg-[#161224] text-[#e2e1e9] font-sans overflow-hidden select-none">
      {/* 1. Barra Lateral de Servidores (72px) */}
      <aside className="w-[72px] flex-shrink-0 bg-[#0c0a14] flex flex-col items-center py-3 gap-2 overflow-y-auto scrollbar-hide z-20 border-r border-purple-950/40">
        {/* Botão de Início / Home (Logo do Morcego ContalK) */}
        <div className="relative group flex items-center justify-center w-full">
          {currentView === 'home' && (
            <div className="absolute left-0 w-1 bg-white rounded-r transition-all duration-200 h-10 shadow-lg shadow-purple-500/50" />
          )}
          <button
            onClick={() => setCurrentView('home')}
            title="Início (Amigos & Mensagens Diretas)"
            className={`w-12 h-12 rounded-2xl transition-all duration-200 flex items-center justify-center shadow-lg overflow-hidden group-hover:scale-105 ${
              currentView === 'home'
                ? 'ring-2 ring-purple-400 bg-purple-600 shadow-purple-600/50'
                : 'hover:rounded-xl ring-1 ring-purple-900/40'
            }`}
          >
            <img src="/logo.jpg" alt="ContalK Início" className="w-full h-full object-cover" />
          </button>
        </div>

        <div className="w-8 h-[2px] bg-purple-900/40 rounded-full my-1" />

        {/* Servidor 1: ContalK HQ */}
        <div className="relative group flex items-center justify-center w-full">
          {currentView === 'server' && activeServerId === 'srv-1' && (
            <div className="absolute left-0 w-1 bg-purple-400 rounded-r transition-all duration-200 h-10 shadow-lg shadow-purple-500/50" />
          )}
          <button
            onClick={() => {
              setCurrentView('server')
              setActiveServer('srv-1')
            }}
            title="ContalK HQ"
            className={`w-12 h-12 rounded-2xl transition-all duration-200 flex items-center justify-center text-white font-black text-sm shadow-lg ${
              currentView === 'server' && activeServerId === 'srv-1'
                ? 'bg-gradient-to-br from-purple-600 to-indigo-600 ring-2 ring-purple-400/80 shadow-purple-600/40'
                : 'bg-[#181329] hover:bg-purple-600/60 hover:rounded-xl text-[#a49fb5] hover:text-white border border-purple-900/30'
            }`}
          >
            HQ
          </button>
        </div>

        {/* Servidor 2: Jogos */}
        <div className="relative group flex items-center justify-center w-full">
          <button
            onClick={() => {
              setCurrentView('server')
            }}
            title="Servidor de Jogos"
            className="w-12 h-12 rounded-[24px] hover:rounded-2xl bg-[#181329] hover:bg-purple-600/80 transition-all duration-200 flex items-center justify-center text-[#a49fb5] hover:text-white border border-purple-900/30"
          >
            🎮
          </button>
        </div>

        {/* Servidor 3: Dev */}
        <div className="relative group flex items-center justify-center w-full">
          <button
            onClick={() => {
              setCurrentView('server')
            }}
            title="Comunidade Dev"
            className="w-12 h-12 rounded-[24px] hover:rounded-2xl bg-[#181329] hover:bg-purple-600/80 transition-all duration-200 flex items-center justify-center text-[#a49fb5] hover:text-white border border-purple-900/30"
          >
            💻
          </button>
        </div>

        <div className="mt-auto relative group flex items-center justify-center w-full">
          <button
            title="Adicionar Servidor"
            className="w-12 h-12 rounded-[24px] hover:rounded-2xl bg-[#181329] hover:bg-green-600 transition-all duration-200 flex items-center justify-center text-green-400 hover:text-white border border-purple-900/30 shadow"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </aside>

      {/* ROTEAMENTO: TELA INICIAL (HOME) OU TELA DO SERVIDOR */}
      {currentView === 'home' ? (
        <HomeView />
      ) : (
        /* VISUALIZAÇÃO DO SERVIDOR */
        <div className="flex-1 flex min-w-0 h-full">
          {/* 2. Barra Lateral de Canais do Servidor (240px) */}
          <nav className="w-60 flex-shrink-0 bg-[#13101f] flex flex-col z-10 border-r border-purple-900/30">
            <header className="h-12 px-4 flex items-center justify-between border-b border-purple-900/30 shadow-sm cursor-pointer hover:bg-purple-950/30 transition-colors">
              <div className="flex items-center gap-2 truncate">
                <span className="text-sm">🦇</span>
                <h1 className="font-bold text-white truncate text-sm tracking-wide">{currentServer.name}</h1>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </header>

            <div className="flex-1 overflow-y-auto p-2 space-y-4">
              {/* Canais de Texto */}
              <div>
                <div className="flex items-center justify-between px-2 mb-1.5 text-purple-400/70 text-[11px] font-bold uppercase tracking-wider">
                  <span>Canais de Texto</span>
                  <span className="text-xs hover:text-purple-300 cursor-pointer">+</span>
                </div>
                <div className="space-y-0.5">
                  {textChannels.map((channel) => {
                    const isActive = activeChannelId === channel.id
                    return (
                      <button
                        key={channel.id}
                        onClick={() => setActiveChannel(channel.id)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-sm transition-all text-left ${
                          isActive
                            ? 'bg-purple-900/40 text-purple-200 font-semibold border-l-2 border-purple-500 shadow-sm'
                            : 'text-[#9c97ad] hover:bg-purple-950/40 hover:text-white'
                        }`}
                      >
                        <span className="text-base text-purple-400 font-bold">#</span>
                        <span className="truncate">{channel.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Canais de Voz */}
              <div>
                <div className="flex items-center justify-between px-2 mb-1.5 text-purple-400/70 text-[11px] font-bold uppercase tracking-wider">
                  <span>Canais de Voz (LiveKit)</span>
                  <span className="text-xs hover:text-purple-300 cursor-pointer">+</span>
                </div>
                <div className="space-y-1">
                  {voiceChannels.map((channel) => {
                    const isCurrentActive = activeChannelId === channel.id
                    const isVoiceConnectedHere = voiceChannelId === channel.id && connectionStatus === 'connected'

                    return (
                      <div key={channel.id} className="space-y-1">
                        <button
                          onClick={() => handleVoiceChannelClick(channel.id, channel.name)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-sm transition-all text-left group ${
                            isCurrentActive
                              ? 'bg-purple-900/40 text-white font-medium border-l-2 border-purple-400 shadow-sm'
                              : 'text-[#9c97ad] hover:bg-purple-950/40 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className={`text-sm ${isVoiceConnectedHere ? 'text-green-400' : 'text-purple-400'}`}>
                              🔊
                            </span>
                            <span className="truncate">{channel.name}</span>
                          </div>
                          {isVoiceConnectedHere && (
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" title="Conectado"></span>
                          )}
                        </button>

                        {/* Lista de participantes do canal de voz ativo com ÍCONE AO VIVO */}
                        {isVoiceConnectedHere && participants.length > 0 && (
                          <div className="pl-6 pr-2 space-y-1 py-1">
                            {participants.map((p) => (
                              <div
                                key={p.identity}
                                className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-purple-950/40 text-xs transition-colors"
                              >
                                <div
                                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 transition-all ${
                                    p.isSpeaking ? 'bg-green-600 ring-2 ring-green-400' : 'bg-gradient-to-br from-purple-600 to-indigo-600'
                                  }`}
                                >
                                  {p.name.charAt(0).toUpperCase()}
                                </div>

                                <span className={`truncate text-xs ${p.isSpeaking ? 'text-white font-semibold' : 'text-[#a49fb5]'}`}>
                                  {p.name}
                                </span>

                                {/* Ícone de Compartilhamento de Tela AO VIVO no nome do canal */}
                                {p.isScreenShareEnabled && (
                                  <span
                                    className="ml-auto flex items-center gap-1 bg-red-600 text-white text-[9px] font-black uppercase px-1.5 py-0.2 rounded shadow-sm flex-shrink-0 animate-pulse"
                                    title={`${p.name} está compartilhando a tela`}
                                  >
                                    <span>🖥️</span>
                                    <span>AO VIVO</span>
                                  </span>
                                )}

                                {!p.isAudioEnabled && !p.isScreenShareEnabled && (
                                  <span className="text-[10px] text-red-400 ml-auto flex-shrink-0">🔇</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Widget de Voz Conectada */}
            {connectionStatus === 'connected' && (
              <div className="bg-[#100d1c] p-2.5 border-t border-purple-900/30 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-green-500 text-sm">🟢</span>
                  <div className="truncate">
                    <div className="text-xs font-bold text-green-400 truncate leading-tight">Voz Conectada</div>
                    <div className="text-[11px] text-purple-300/70 truncate">LiveKit / 7880 SFU</div>
                  </div>
                </div>
                <button
                  onClick={leaveChannel}
                  title="Desconectar da voz"
                  className="p-1.5 hover:bg-red-500/20 text-purple-300/70 hover:text-red-400 rounded-lg transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.8 19.8 0 0 1-3.12-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
                    <line x1="23" y1="1" x2="1" y2="23"></line>
                  </svg>
                </button>
              </div>
            )}

            {/* User Panel (com indicador de transmissão de tela) */}
            <div className="h-[52px] bg-[#100d1c] px-2 flex items-center justify-between border-t border-purple-900/30">
              <div className="flex items-center gap-2 min-w-0 pr-1 hover:bg-purple-950/40 p-1 rounded-lg cursor-pointer transition-colors">
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow">
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-[#100d1c] rounded-full"></div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-xs font-bold text-white truncate">{user?.display_name || user?.username}</span>
                    {isScreenSharing && (
                      <span className="text-[9px] bg-red-600 text-white font-black px-1.5 py-0.2 rounded shadow animate-pulse flex-shrink-0">
                        AO VIVO
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-purple-300/70 truncate flex items-center gap-1">
                    {isScreenSharing ? (
                      <span className="text-purple-300 font-semibold flex items-center gap-1">
                        <span>🖥️</span> Transmitindo tela
                      </span>
                    ) : (
                      `#${user?.username}`
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  onClick={toggleMic}
                  title={isMicMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isMicMuted ? 'text-red-400 hover:bg-purple-950/40' : 'text-purple-300 hover:bg-purple-950/40 hover:text-white'
                  }`}
                >
                  {isMicMuted ? '🔇' : '🎙️'}
                </button>
                <button
                  onClick={toggleDeafen}
                  title={isDeafened ? 'Desativar Ensurdecer' : 'Ensurdecer'}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isDeafened ? 'text-red-400 hover:bg-purple-950/40' : 'text-purple-300 hover:bg-purple-950/40 hover:text-white'
                  }`}
                >
                  {isDeafened ? '🔕' : '🎧'}
                </button>
                <button
                  onClick={logout}
                  title="Encerrar Sessão"
                  className="p-1.5 rounded-lg text-purple-300 hover:bg-purple-950/40 hover:text-red-400 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                </button>
              </div>
            </div>
          </nav>

          {/* 3. Área Principal: Canal de Voz OU Canal de Texto + Painel de Membros à Direita */}
          <div className="flex-1 flex min-w-0 h-full overflow-hidden">
            {isVoiceViewActive ? (
              <VoiceStage
                showMemberList={showMemberList}
                onToggleMemberList={() => setShowMemberList(!showMemberList)}
              />
            ) : (
              <main className="flex-1 flex flex-col min-w-0 bg-[#161224] relative">
                {/* Header do Canal de Texto */}
                <header className="h-12 px-4 flex items-center justify-between border-b border-purple-900/30 bg-[#141021] shadow-sm flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400 text-xl font-bold">#</span>
                    <h2 className="font-bold text-white text-base">{currentChannel.name}</h2>
                    <div className="w-[1px] h-4 bg-purple-900/40 mx-2" />
                    <span className="text-xs text-purple-300/60 hidden sm:inline">
                      Canal oficial de #{currentChannel.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-purple-300">
                    <button
                      onClick={() => setShowMemberList(!showMemberList)}
                      title="Alternar lista de membros"
                      className={`p-1.5 rounded-lg border transition-all text-xs font-bold flex items-center gap-1.5 ${
                        showMemberList
                          ? 'bg-purple-600 border-purple-400 text-white shadow-md shadow-purple-600/30'
                          : 'bg-[#181329] border-purple-900/40 text-purple-300 hover:text-white hover:border-purple-500/40'
                      }`}
                    >
                      <span>👥</span>
                      <span className="hidden md:inline">Membros</span>
                    </button>
                  </div>
                </header>

                <div className="flex-1 flex min-h-0">
                  {/* Área de Mensagens */}
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {/* Banner de Boas-vindas do Canal */}
                      <div className="mt-4 mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-purple-900/40 border border-purple-500/30 flex items-center justify-center text-3xl mb-3 text-purple-300 shadow-lg">
                          #
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">
                          Bem-vindo a #{currentChannel.name}!
                        </h3>
                        <p className="text-[#a49fb5] text-sm">
                          Este é o início do canal #{currentChannel.name}. Fique à vontade para conversar!
                        </p>
                      </div>

                      {/* Lista de Mensagens */}
                      {currentMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className="group flex gap-4 py-1.5 hover:bg-purple-950/30 px-3 -mx-3 rounded-xl transition-colors"
                        >
                          <div
                            className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm shadow cursor-pointer mt-0.5"
                            style={{ backgroundColor: msg.userColor || '#7c3aed' }}
                          >
                            {msg.userName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span
                                className="font-semibold hover:underline cursor-pointer text-sm"
                                style={{ color: msg.userColor || '#a78bfa' }}
                              >
                                {msg.userName}
                              </span>
                              <span className="text-[11px] text-purple-400/60">{formatTime(msg.timestamp)}</span>
                            </div>
                            <p className="text-[#e2e1e9] text-sm leading-relaxed break-words">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input de Mensagem */}
                    <div className="px-4 pb-6 pt-1 flex-shrink-0">
                      <form
                        onSubmit={handleSendMessage}
                        className="bg-[#1c172d] border border-purple-900/40 focus-within:border-purple-500/60 rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-lg transition-all"
                      >
                        <button
                          type="button"
                          title="Adicionar anexo"
                          className="text-purple-400 hover:text-white transition-colors"
                        >
                          ➕
                        </button>
                        <input
                          type="text"
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          placeholder={`Conversar em #${currentChannel.name}`}
                          className="flex-1 bg-transparent border-none outline-none text-[#e2e1e9] placeholder-purple-400/40 text-sm"
                        />
                        <button
                          type="submit"
                          disabled={!messageInput.trim()}
                          className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-purple-600/30"
                        >
                          Enviar
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </main>
            )}

            {/* 4. Barra Lateral de Membros do Servidor (Visível tanto em Texto quanto em Voz se acionada) */}
            {showMemberList && (
              <aside className="w-60 bg-[#13101f] border-l border-purple-900/30 flex-shrink-0 p-3 overflow-y-auto hidden md:block select-none">
                <div className="space-y-4">
                  {serverMembers.map((group) => (
                    <div key={group.role} className="space-y-1">
                      <div className="text-purple-400/70 text-[11px] font-black uppercase tracking-wider px-2 mb-1">
                        {group.role}
                      </div>

                      {group.users.map((member) => (
                        <div
                          key={member.username}
                          className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-purple-950/40 cursor-pointer transition-colors group"
                        >
                          <div className="relative flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#13101f] ${
                                member.status === 'online'
                                  ? 'bg-green-500'
                                  : member.status === 'idle'
                                  ? 'bg-yellow-500'
                                  : 'bg-gray-500'
                              }`}
                            />
                          </div>

                          <div className="min-w-0">
                            <div
                              className="text-xs font-bold truncate group-hover:text-white"
                              style={{ color: member.roleColor }}
                            >
                              {member.name}
                            </div>
                            <div className="text-[10px] text-purple-400/60 truncate">
                              {member.isSelf ? 'Conectado agora' : member.status === 'online' ? 'Online' : 'Offline'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </aside>
            )}
          </div>
        </div>
      )}

      {/* Notificação Automática de Atualização (Estilo Discord) */}
      <UpdateNotification />
    </div>
  )
}

function App() {
  const { isAuthenticated, isLoading, checkSession } = useAuthStore()

  useEffect(() => {
    checkSession()
  }, [checkSession])

  if (isLoading && !isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0c0a14] relative overflow-hidden select-none">
        {/* Glow ambient background no tom roxo do morcego */}
        <div className="absolute w-[450px] h-[450px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />

        <div className="text-center z-10 flex flex-col items-center">
          <div className="relative w-28 h-28 mb-5 group">
            <div className="absolute inset-0 rounded-full bg-purple-600/40 blur-xl animate-pulse" />
            <img
              src="/logo.jpg"
              alt="ContalK Logo"
              className="relative w-28 h-28 rounded-full shadow-2xl border-2 border-purple-400/60 object-cover"
            />
          </div>
          <h1 className="text-white text-3xl font-black tracking-wider mb-1.5 flex items-center gap-1">
            Contal<span className="text-purple-400">K</span>
          </h1>
          <p className="text-purple-300/80 text-xs font-semibold tracking-widest uppercase mb-6">
            Comunicação de Alta Performance
          </p>
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-purple-950/50 border border-purple-800/40 text-xs text-purple-300 font-medium shadow-lg">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
            Iniciando ContalK...
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AuthScreen />
  }

  return <AppLayout />
}

export default App
