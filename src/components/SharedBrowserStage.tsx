import React, { useState, useRef, useEffect } from 'react'
import { useSharedBrowserStore } from '../store/useSharedBrowserStore'
import { useAuthStore } from '../store/useAuthStore'
import { ControlIcon } from './ControlIcon'

export function SharedBrowserStage({
  onMinimize,
  onFullscreen,
  isSpotlight = false
}: {
  onMinimize?: () => void
  onFullscreen?: () => void
  isSpotlight?: boolean
}) {
  const {
    activeSession,
    isHost,
    isDetached,
    toggleDetach,
    collaborators,
    setAllowCollaboration,
    navigate,
    sendClick,
    sendType,
    sendKey,
    sendCursor,
    goBack,
    goForward,
    reload,
    stopSharing
  } = useSharedBrowserStore()

  const currentUser = useAuthStore((s) => s.user)
  const currentUsername = currentUser?.username || 'user'

  const [urlInput, setUrlInput] = useState('')
  const [clickNotice, setClickNotice] = useState('')
  const [typingInput, setTypingInput] = useState('')
  const [showAiDrawer, setShowAiDrawer] = useState(false)
  const [aiPromptInput, setAiPromptInput] = useState('')
  const [extractedContent, setExtractedContent] = useState<string | null>(null)
  const [aiStatus, setAiStatus] = useState<string>('Pronto para automação por IA.')
  const [historyLog, setHistoryLog] = useState<string[]>([])
  const [browserAudioMuted, setBrowserAudioMuted] = useState(false)

  const handleToggleBrowserAudio = async () => {
    const desktop = window.contalkDesktop
    if (!desktop?.browserSetAudioMuted) return
    const next = !browserAudioMuted
    await desktop.browserSetAudioMuted(next)
    setBrowserAudioMuted(next)
  }

  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeSession?.url) {
      setUrlInput(activeSession.url)
    }
  }, [activeSession?.url])

  if (!activeSession) return null

  const canInteract = isHost || activeSession.allowCollaboration

  const handleViewportClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    if (!canInteract) {
      setClickNotice('Modo apenas visualização. Peça ao anfitrião para ativar a colaboração.')
      setTimeout(() => setClickNotice(''), 3000)
      return
    }

    void sendClick(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)))
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    sendCursor(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)))
  }

  const handleNavigateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!urlInput.trim()) return
    if (canInteract) {
      void navigate(urlInput.trim())
    }
  }

  const handleSendType = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!typingInput.trim() || !canInteract) return
    void sendType(typingInput)
    setTypingInput('')
  }

  const handleReadContent = async () => {
    setAiStatus('Extraindo conteúdo da página…')
    try {
      const desktop = window.contalkDesktop
      if (desktop?.browserReadContent) {
        const data = await desktop.browserReadContent()
        setExtractedContent(data.content)
        setAiStatus(`Conteúdo lido com sucesso (${data.links.length} links, ${data.forms.length} formulários).`)
        setHistoryLog(prev => [`Extraiu texto de ${data.url}`, ...prev.slice(0, 19)])
      } else {
        setAiStatus('Leitura de conteúdo direta disponível no Electron.')
      }
    } catch (e) {
      setAiStatus(e instanceof Error ? e.message : 'Falha ao ler conteúdo.')
    }
  }

  const handleTriggerAiPrompt = (promptText: string) => {
    setAiStatus(`Ação enviada ao assistente de IA: "${promptText.slice(0, 40)}…"`)
    setHistoryLog(prev => [`IA: ${promptText.slice(0, 50)}…`, ...prev.slice(0, 19)])
    window.dispatchEvent(
      new CustomEvent('contalk-ai-prompt', {
        detail: {
          prompt: promptText
        }
      })
    )
  }

  const otherCollaborators = Object.values(collaborators).filter(
    (c) => c.id !== currentUsername && Date.now() - c.lastSeen < 10000
  )

  return (
    <div className="ct-shared-browser-stage flex-1 flex flex-col min-h-0 w-full h-full bg-[#121212] rounded-2xl border border-neutral-800/80 overflow-hidden shadow-2xl relative select-none">
      {/* Barra de Ferramentas / Header do Navegador Compartilhado */}
      <div className="ct-sb-toolbar flex items-center justify-between px-3 py-2 bg-[#181818] border-b border-neutral-800 gap-2 flex-wrap z-20">
        {/* Esquerda: Identificação do Host e Status de Senha Protegida */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-sky-600 text-white shadow-sm">
            <ControlIcon name="globe" size={12} />
            <span>Navegador Web</span>
          </span>

          <span className="text-xs text-neutral-300 font-medium">
            {isHost ? 'Compartilhado por você' : `Compartilhado por ${activeSession.hostName}`}
          </span>

          {/* Badge de Proteção de Senhas Contra Vazamento */}
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
              activeSession.hasPasswordField
                ? 'bg-amber-950/80 border-amber-600/70 text-amber-200 animate-pulse'
                : 'bg-emerald-950/60 border-emerald-600/40 text-emerald-300'
            }`}
            title="Campos de senha e dados sensíveis são mascarados e protegidos contra vazamento para todos os espectadores."
          >
            <ControlIcon name="lock" size={11} />
            <span>{activeSession.hasPasswordField ? 'Senha Ocultada 🔒' : 'Privacidade Ativa 🛡️'}</span>
          </div>
        </div>

        {/* Centro: Barra de Navegação de URL */}
        <form onSubmit={handleNavigateSubmit} className="flex-1 max-w-xl flex items-center gap-1 min-w-[240px]">
          <button
            type="button"
            onClick={() => void goBack()}
            disabled={!canInteract}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Voltar"
          >
            <ControlIcon name="back" size={14} />
          </button>
          <button
            type="button"
            onClick={() => void goForward()}
            disabled={!canInteract}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Avançar"
          >
            <ControlIcon name="forward" size={14} />
          </button>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={!canInteract}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Recarregar"
          >
            <ControlIcon name="refresh" size={14} />
          </button>

          <div className="flex-1 relative flex items-center">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              disabled={!canInteract}
              placeholder="Digite uma URL ou termo de busca..."
              className="w-full bg-[#0a0a0a] text-neutral-200 text-xs px-3 py-1.5 rounded-xl border border-neutral-700/60 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-70 disabled:cursor-not-allowed"
            />
          </div>
        </form>

        {/* Direita: Controles de Colaboração, IA e Parar */}
        <div className="flex items-center gap-2">
          {/* Botão de Automação com IA */}
          <button
            type="button"
            onClick={() => setShowAiDrawer(!showAiDrawer)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition ${
              showAiDrawer
                ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-sm'
                : 'bg-neutral-800/90 border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-700'
            }`}
            title="Abrir painel de Automação com IA para navegar, resumir, clicar ou preencher formulários nesta página"
          >
            <ControlIcon name="ai" size={13} />
            <span>Automação com IA</span>
          </button>

          {/* Controle de Colaboração */}
          {isHost ? (
            <button
              onClick={() => setAllowCollaboration(!activeSession.allowCollaboration)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition ${
                activeSession.allowCollaboration
                  ? 'bg-emerald-600/20 border-emerald-500/80 text-emerald-300 hover:bg-emerald-600/30'
                  : 'bg-neutral-800/80 border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-700'
              }`}
              title={
                activeSession.allowCollaboration
                  ? 'Colaboração ativada: integrantes podem clicar e interagir. Clique para desativar.'
                  : 'Permitir que os outros integrantes cliquem nos links e participem da navegação.'
              }
            >
              <ControlIcon name="friends" size={13} />
              <span>{activeSession.allowCollaboration ? 'Interação Permitida' : 'Permitir Interação'}</span>
            </button>
          ) : (
            <span
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border ${
                activeSession.allowCollaboration
                  ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400'
              }`}
              title={
                activeSession.allowCollaboration
                  ? 'Você pode clicar nos links e navegar com o anfitrião!'
                  : 'Apenas visualização no momento.'
              }
            >
              <ControlIcon name={activeSession.allowCollaboration ? 'friends' : 'info'} size={12} />
              <span>{activeSession.allowCollaboration ? 'Colaboração Ativa' : 'Apenas Visualização'}</span>
            </span>
          )}

          {/* Botão de Silenciar/Ativar Áudio do Navegador */}
          {isHost && (
            <button
              type="button"
              onClick={handleToggleBrowserAudio}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition ${
                browserAudioMuted
                  ? 'bg-amber-950/40 border-amber-600/60 text-amber-300 hover:bg-amber-900/50'
                  : 'bg-neutral-800/90 border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-700'
              }`}
              title={browserAudioMuted ? 'Áudio do navegador silenciado. Clique para ativar som.' : 'Silenciar áudio do navegador interno.'}
            >
              <ControlIcon name="audio" slashed={browserAudioMuted} size={13} />
              <span>{browserAudioMuted ? 'Mudo' : 'Som'}</span>
            </button>
          )}

          {/* Botão para Destacar / Fixar Navegador no ConTALK */}
          {isHost && (
            <button
              type="button"
              onClick={() => void toggleDetach()}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition ${
                isDetached
                  ? 'bg-sky-600/30 border-sky-500 text-sky-200 hover:bg-sky-600/40'
                  : 'bg-neutral-800/90 border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-700'
              }`}
              title={
                isDetached
                  ? 'Navegador destacado em janela do Windows. Clique para fixar de volta dentro do ConTALK.'
                  : 'Destacar navegador em uma janela separada do Windows (opcional).'
              }
            >
              <ControlIcon name={isDetached ? 'shrink' : 'expand'} size={13} />
              <span>{isDetached ? 'Fixar no ConTALK' : 'Destacar'}</span>
            </button>
          )}

          {/* Botão de alternar Foco / Grade */}
          {isSpotlight && onMinimize && (
            <button
              onClick={onMinimize}
              className="px-2.5 py-1 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition"
              title="Voltar ao modo grade"
            >
              ⊞ Grade
            </button>
          )}

          {/* Tela cheia */}
          {onFullscreen && (
            <button
              onClick={onFullscreen}
              className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
              title="Tela cheia"
            >
              <ControlIcon name="expand" size={14} />
            </button>
          )}

          {/* Parar Compartilhamento (se for host) */}
          {isHost && (
            <button
              onClick={() => void stopSharing()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-semibold transition"
              title="Encerrar compartilhamento do navegador"
            >
              <ControlIcon name="close" size={13} />
              <span>Encerrar</span>
            </button>
          )}
        </div>
      </div>

      {/* Aviso temporário de clique restrito */}
      {clickNotice && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-amber-950/90 text-amber-200 border border-amber-600/80 px-4 py-1.5 rounded-xl text-xs font-medium shadow-lg backdrop-blur animate-fade-in">
          {clickNotice}
        </div>
      )}

      {/* Banner de proteção contra vazamento de senhas */}
      {activeSession.hasPasswordField && (
        <div className="bg-amber-950/90 border-b border-amber-600/60 text-amber-200 px-4 py-1 text-xs flex items-center justify-center gap-2 z-10">
          <ControlIcon name="lock" size={12} />
          <span>
            <strong>Proteção Ativa:</strong> Campos de senha e credenciais confidenciais foram desfocados e ocultados
            automaticamente da visualização.
          </span>
        </div>
      )}

      {/* Container Principal: Viewport + Drawer Lateral de Automação com IA */}
      <div className="flex-1 flex min-h-0 w-full h-full relative overflow-hidden bg-black">
        {/* Área Central: Viewport do Navegador */}
        <div className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden items-center justify-center">
          <div
            ref={viewportRef}
            onClick={handleViewportClick}
            onMouseMove={handleMouseMove}
            className={`relative max-w-full max-h-full overflow-hidden flex items-center justify-center bg-black ${
              canInteract ? 'cursor-pointer' : 'cursor-default'
            }`}
            style={{
              aspectRatio: '1080 / 720',
              width: '100%',
              height: '100%'
            }}
          >
            {activeSession.screenshot ? (
              <img
                src={activeSession.screenshot}
                alt={activeSession.title || 'Navegador Web'}
                className="w-full h-full object-fill pointer-events-none select-none"
                draggable={false}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 text-neutral-400">
                <ControlIcon name="globe" size={32} />
                <p className="text-sm font-medium">Carregando visualização segura do navegador...</p>
              </div>
            )}

            {/* Cursores dos Colaboradores Remotos */}
            {otherCollaborators.map((c) => (
              <div
                key={c.id}
                className="ct-collab-cursor pointer-events-none absolute z-40 transition-all duration-75 ease-out flex flex-col items-start"
                style={{
                  left: `${c.xPercent}%`,
                  top: `${c.yPercent}%`,
                  transform: 'translate(-2px, -2px)'
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill={c.color}
                  stroke="#000"
                  strokeWidth="1.5"
                  className="drop-shadow-md"
                >
                  <path d="M3 3l7 18 3-7 7-3L3 3z" />
                </svg>
                <span
                  className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-md shadow-md -mt-1 ml-3 whitespace-nowrap"
                  style={{ backgroundColor: c.color }}
                >
                  {c.name}
                </span>

                {/* Onda de clique recente do colaborador */}
                {c.lastClick && Date.now() - c.lastClick.time < 700 && (
                  <span
                    className="absolute w-8 h-8 rounded-full border-2 border-white bg-white/30 animate-ping -left-2 -top-2 pointer-events-none"
                    style={{ borderColor: c.color }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Barra de Digitação Colaborativa (visível quando pode interagir) */}
          {canInteract && (
            <div className="w-full bg-[#161616] border-t border-neutral-800 px-3 py-1.5 flex items-center justify-between gap-2 z-10 flex-wrap">
              <form onSubmit={handleSendType} className="flex-1 flex items-center gap-2 max-w-xl">
                <span className="text-[11px] text-neutral-400 whitespace-nowrap flex items-center gap-1">
                  <ControlIcon name="chat" size={11} /> Digitar no campo:
                </span>
                <input
                  type="text"
                  value={typingInput}
                  onChange={(e) => setTypingInput(e.target.value)}
                  placeholder="Clique em um campo acima e digite o texto aqui..."
                  className="flex-1 bg-[#0a0a0a] text-neutral-200 text-xs px-2.5 py-1 rounded-lg border border-neutral-700 focus:border-sky-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!typingInput.trim()}
                  className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-semibold"
                >
                  Digitar
                </button>
              </form>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void sendKey('Enter')}
                  className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono"
                  title="Pressionar tecla Enter na página"
                >
                  ↵ Enter
                </button>
                <button
                  type="button"
                  onClick={() => void sendKey('Backspace')}
                  className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono"
                  title="Pressionar tecla Backspace na página"
                >
                  ⌫ Apagar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Lateral: Opções de Automação com IA */}
        {showAiDrawer && (
          <aside className="w-80 h-full bg-[#181818] border-l border-neutral-800 flex flex-col z-30 shadow-2xl animate-fade-in flex-shrink-0">
            {/* Header do Drawer de IA */}
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-neutral-800">
              <div className="flex items-center gap-1.5 text-purple-300 font-semibold text-xs">
                <ControlIcon name="ai" size={14} />
                <span>Automação com IA</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAiDrawer(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg"
                title="Fechar painel de IA"
              >
                <ControlIcon name="close" size={12} />
              </button>
            </div>

            {/* Conteúdo do Drawer */}
            <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3 scrollbar-thin">
              {/* Card de Ações Rápidas */}
              <div className="bg-[#202020] rounded-xl p-3 border border-neutral-700/60 flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Ações Rápidas
                </span>

                <button
                  type="button"
                  onClick={() =>
                    handleTriggerAiPrompt(
                      `Por favor, acesse a página ${activeSession.url} no navegador e faça um resumo claro dos tópicos principais, pontos-chave e links úteis.`
                    )
                  }
                  className="flex items-center gap-2 p-2 rounded-lg bg-purple-950/40 hover:bg-purple-900/50 border border-purple-700/40 text-purple-200 text-xs font-medium text-left transition"
                >
                  <ControlIcon name="ai" size={13} />
                  <span>Resumir página com IA</span>
                </button>

                <button
                  type="button"
                  onClick={handleReadContent}
                  className="flex items-center gap-2 p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium text-left transition"
                >
                  <ControlIcon name="file" size={13} />
                  <span>Extrair texto & links da página</span>
                </button>
              </div>

              {/* Input de Ação Personalizada para a IA */}
              <div className="bg-[#202020] rounded-xl p-3 border border-neutral-700/60 flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Comandar IA no Navegador
                </span>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Peça à IA para pesquisar, clicar em botões, preencher formulários ou extrair dados específicos desta página:
                </p>

                <textarea
                  value={aiPromptInput}
                  onChange={(e) => setAiPromptInput(e.target.value)}
                  placeholder="Ex: Localize o botão de cadastro e clique nele, ou pesquise sobre inteligência artificial..."
                  rows={3}
                  className="w-full bg-[#101010] text-neutral-200 text-xs p-2 rounded-lg border border-neutral-700 focus:border-purple-500 focus:outline-none resize-none"
                />

                <button
                  type="button"
                  disabled={!aiPromptInput.trim()}
                  onClick={() => {
                    const fullPrompt = `No navegador web aberto em ${activeSession.url}: ${aiPromptInput.trim()}`
                    handleTriggerAiPrompt(fullPrompt)
                    setAiPromptInput('')
                  }}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-semibold shadow-md transition"
                >
                  <ControlIcon name="ai" size={12} />
                  <span>Executar Ação com IA</span>
                </button>
              </div>

              {/* Visualização de Texto Extraído */}
              {extractedContent && (
                <div className="bg-[#202020] rounded-xl p-3 border border-neutral-700/60 flex flex-col gap-2 max-h-48 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                      Texto Extraído
                    </span>
                    <button
                      type="button"
                      onClick={() => setExtractedContent(null)}
                      className="text-[10px] text-neutral-400 hover:text-white"
                    >
                      Limpar
                    </button>
                  </div>
                  <div className="text-[11px] text-neutral-300 font-mono bg-[#101010] p-2 rounded-lg overflow-y-auto max-h-36 scrollbar-thin whitespace-pre-wrap select-text">
                    {extractedContent}
                  </div>
                </div>
              )}

              {/* Histórico de Ações da IA */}
              <div className="bg-[#202020] rounded-xl p-3 border border-neutral-700/60 flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Histórico de Automações
                </span>
                <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto scrollbar-thin">
                  {historyLog.length > 0 ? (
                    historyLog.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-1.5 text-[11px] text-neutral-300 bg-[#161616] p-1.5 rounded-md"
                      >
                        <ControlIcon name="check" size={11} />
                        <span className="break-all">{item}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-[11px] text-neutral-500 italic">
                      Nenhuma automação solicitada recentemente.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer do Drawer com Status */}
            <div className="px-3.5 py-2 border-t border-neutral-800 bg-[#141414] text-[11px] text-neutral-400 truncate">
              {aiStatus}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
