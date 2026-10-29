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
  const [showAiDrawer, setShowAiDrawer] = useState(false)
  const [showQuickType, setShowQuickType] = useState(false)
  const [typingInput, setTypingInput] = useState('')
  const [aiPromptInput, setAiPromptInput] = useState('')
  const [extractedContent, setExtractedContent] = useState<string | null>(null)
  const [aiStatus, setAiStatus] = useState<string>('Pronto para automação por IA.')
  const [historyLog, setHistoryLog] = useState<string[]>([])
  const [browserAudioMuted, setBrowserAudioMuted] = useState(false)

  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeSession?.url) {
      setUrlInput(activeSession.url)
    }
  }, [activeSession?.url])

  if (!activeSession) return null

  const canInteract = isHost || activeSession.allowCollaboration

  const handleToggleBrowserAudio = async () => {
    const desktop = window.contalkDesktop
    if (!desktop?.browserSetAudioMuted) return
    const next = !browserAudioMuted
    await desktop.browserSetAudioMuted(next)
    setBrowserAudioMuted(next)
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    canvasRef.current?.focus()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) return

    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    if (clickX < 0 || clickX > rect.width || clickY < 0 || clickY > rect.height) return

    const xPercent = (clickX / rect.width) * 100
    const yPercent = (clickY / rect.height) * 100

    if (!canInteract) {
      setClickNotice('Modo apenas visualização. Peça ao anfitrião para ativar a colaboração.')
      setTimeout(() => setClickNotice(''), 3000)
      return
    }

    void sendClick(Math.max(0, Math.min(100, xPercent)), Math.max(0, Math.min(100, yPercent)))
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) return

    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
      sendCursor(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!canInteract) return
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

    if (e.key === 'Backspace' || e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Escape') {
      e.preventDefault()
      void sendKey(e.key)
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      void sendType(e.key)
    }
  }

  const handleNavigateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!urlInput.trim()) return
    if (canInteract) {
      void navigate(urlInput.trim())
    }
  }

  const handleQuickTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!typingInput.trim() || !canInteract) return
    void sendType(typingInput)
    setTypingInput('')
    setShowQuickType(false)
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
        setAiStatus('Leitura de conteúdo disponível no desktop.')
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
    <div className="ct-shared-browser-stage flex-1 flex flex-col min-h-0 w-full h-full bg-[#101010] rounded-xl border border-neutral-800/80 overflow-hidden relative select-none">
      {/* Barra de Ferramentas Slim (Altura compacta e controles discretos que não poluem a tela) */}
      <div className="ct-sb-toolbar flex items-center justify-between px-2.5 h-10 bg-[#141414] border-b border-neutral-800/80 gap-2 flex-shrink-0 z-20">
        {/* Esquerda: Navegação e Identificação */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void goBack()}
            disabled={!canInteract}
            className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-20"
            title="Voltar"
          >
            <ControlIcon name="back" size={13} />
          </button>
          <button
            type="button"
            onClick={() => void goForward()}
            disabled={!canInteract}
            className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-20"
            title="Avançar"
          >
            <ControlIcon name="forward" size={13} />
          </button>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={!canInteract}
            className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-20"
            title="Recarregar página"
          >
            <ControlIcon name="refresh" size={13} />
          </button>
        </div>

        {/* Centro: Barra de URL Compacta com Status de Privacidade */}
        <form onSubmit={handleNavigateSubmit} className="flex-1 max-w-xl flex items-center gap-1.5 min-w-[200px]">
          <div className="flex-1 relative flex items-center bg-[#0a0a0a] rounded-lg border border-neutral-700/60 focus-within:border-sky-500/80 px-2.5 py-1">
            <span className="text-neutral-500 mr-1.5 flex items-center flex-shrink-0">
              <ControlIcon name={activeSession.hasPasswordField ? 'lock' : 'globe'} size={12} />
            </span>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              disabled={!canInteract}
              placeholder="Digite uma URL ou pesquise..."
              className="w-full bg-transparent text-neutral-200 text-xs focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed"
            />
            {activeSession.hasPasswordField && (
              <span
                className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-600/50 flex-shrink-0"
                title="Campos de senha ocultados automaticamente"
              >
                🔒 Protegido
              </span>
            )}
          </div>
        </form>

        {/* Direita: Ações Compactas e Botão Encerrar */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Digitação Rápida / Colar (Popover discreto) */}
          {canInteract && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowQuickType(!showQuickType)}
                className={`w-7 h-7 flex items-center justify-center rounded-md border text-xs transition ${
                  showQuickType
                    ? 'bg-sky-600/30 border-sky-500 text-sky-200'
                    : 'bg-neutral-800/80 border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-700'
                }`}
                title="Digitar ou colar texto longo no campo focado da página"
              >
                <ControlIcon name="chat" size={12} />
              </button>
              {showQuickType && (
                <div className="absolute right-0 top-9 w-64 p-2 bg-[#1c1c1c] border border-neutral-700 rounded-lg shadow-xl z-50 animate-fade-in">
                  <form onSubmit={handleQuickTypeSubmit} className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-neutral-400 font-medium">Digitar / Colar no campo:</span>
                    <input
                      type="text"
                      autoFocus
                      value={typingInput}
                      onChange={(e) => setTypingInput(e.target.value)}
                      placeholder="Texto a enviar..."
                      className="w-full bg-[#0a0a0a] text-neutral-200 text-xs px-2 py-1 rounded border border-neutral-700 focus:outline-none focus:border-sky-500"
                    />
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setShowQuickType(false)}
                        className="px-2 py-0.5 text-[11px] text-neutral-400 hover:text-white"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={!typingInput.trim()}
                        className="px-2 py-0.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-[11px] font-semibold rounded"
                      >
                        Enviar
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* Automação com IA */}
          <button
            type="button"
            onClick={() => setShowAiDrawer(!showAiDrawer)}
            className={`w-7 h-7 flex items-center justify-center rounded-md border text-xs transition ${
              showAiDrawer
                ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                : 'bg-neutral-800/80 border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-700'
            }`}
            title="Automação com IA no Navegador"
          >
            <ControlIcon name="ai" size={12} />
          </button>

          {/* Controle de Colaboração */}
          {isHost ? (
            <button
              type="button"
              onClick={() => setAllowCollaboration(!activeSession.allowCollaboration)}
              className={`flex items-center gap-1 h-7 px-2 rounded-md border text-xs transition ${
                activeSession.allowCollaboration
                  ? 'bg-emerald-600/20 border-emerald-500/80 text-emerald-300'
                  : 'bg-neutral-800/80 border-neutral-700 text-neutral-400 hover:text-white'
              }`}
              title={
                activeSession.allowCollaboration
                  ? 'Interação ativada para outros integrantes (clique para pausar)'
                  : 'Permitir que integrantes interajam com o navegador'
              }
            >
              <ControlIcon name="friends" size={12} />
              <span className="hidden sm:inline text-[11px]">
                {activeSession.allowCollaboration ? 'Interativo' : 'Ver apenas'}
              </span>
            </button>
          ) : (
            <span
              className={`flex items-center gap-1 h-7 px-2 rounded-md border text-[11px] ${
                activeSession.allowCollaboration
                  ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400'
              }`}
              title={activeSession.allowCollaboration ? 'Você pode interagir e clicar' : 'Apenas visualização'}
            >
              <ControlIcon name={activeSession.allowCollaboration ? 'friends' : 'info'} size={11} />
              <span className="hidden sm:inline">
                {activeSession.allowCollaboration ? 'Interativo' : 'Visualizando'}
              </span>
            </span>
          )}

          {/* Som / Mudo (se host) */}
          {isHost && (
            <button
              type="button"
              onClick={handleToggleBrowserAudio}
              className={`w-7 h-7 flex items-center justify-center rounded-md border text-xs transition ${
                browserAudioMuted
                  ? 'bg-amber-950/40 border-amber-600/60 text-amber-300'
                  : 'bg-neutral-800/80 border-neutral-700 text-neutral-300 hover:text-white'
              }`}
              title={browserAudioMuted ? 'Áudio do navegador mudo (clique para ativar)' : 'Silenciar áudio do navegador'}
            >
              <ControlIcon name="audio" slashed={browserAudioMuted} size={12} />
            </button>
          )}

          {/* Destacar / Fixar (se host) */}
          {isHost && (
            <button
              type="button"
              onClick={() => void toggleDetach()}
              className={`w-7 h-7 flex items-center justify-center rounded-md border text-xs transition ${
                isDetached
                  ? 'bg-sky-600/30 border-sky-500 text-sky-200'
                  : 'bg-neutral-800/80 border-neutral-700 text-neutral-300 hover:text-white'
              }`}
              title={isDetached ? 'Fixar de volta no ConTALK' : 'Destacar em janela separada do Windows'}
            >
              <ControlIcon name={isDetached ? 'shrink' : 'expand'} size={12} />
            </button>
          )}

          {/* Foco / Grade */}
          {isSpotlight && onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              className="h-7 px-2 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium"
              title="Voltar ao modo grade"
            >
              ⊞ Grade
            </button>
          )}

          {/* Tela cheia */}
          {onFullscreen && (
            <button
              type="button"
              onClick={onFullscreen}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white"
              title="Tela cheia"
            >
              <ControlIcon name="expand" size={12} />
            </button>
          )}

          {/* Encerrar */}
          {isHost && (
            <button
              type="button"
              onClick={() => void stopSharing()}
              className="h-7 px-2.5 rounded-md bg-red-600/80 hover:bg-red-600 text-white text-[11px] font-semibold flex items-center gap-1 shadow-sm"
              title="Encerrar compartilhamento do navegador"
            >
              <ControlIcon name="close" size={11} />
              <span>Encerrar</span>
            </button>
          )}
        </div>
      </div>

      {/* Aviso temporário de clique restrito */}
      {clickNotice && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-amber-950/90 text-amber-200 border border-amber-600/80 px-3.5 py-1 rounded-lg text-xs font-medium shadow-xl backdrop-blur animate-fade-in">
          {clickNotice}
        </div>
      )}

      {/* Área Central: Viewport com Aspect Ratio Nativo Perfeito e Sem Deformação */}
      <div className="flex-1 flex min-h-0 w-full h-full relative overflow-hidden bg-[#0c0c0c]">
        <div
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden items-center justify-center p-2 outline-none"
        >
          {/* Canvas Wrapper 16:9 Exato com letterbox/pillarbox limpos sem esticar */}
          <div
            ref={canvasRef}
            tabIndex={0}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onKeyDown={handleKeyDown}
            className={`relative flex items-center justify-center overflow-hidden rounded-lg bg-black shadow-2xl outline-none ${
              canInteract ? 'cursor-pointer' : 'cursor-default'
            }`}
            style={{
              aspectRatio: '16 / 9',
              maxWidth: '100%',
              maxHeight: '100%',
              width: '100%',
              height: 'auto'
            }}
          >
            {activeSession.screenshot ? (
              <img
                src={activeSession.screenshot}
                alt={activeSession.title || 'Navegador Web'}
                className="w-full h-full object-contain pointer-events-none select-none block"
                draggable={false}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-neutral-400 p-8">
                <ControlIcon name="globe" size={28} />
                <p className="text-xs font-medium">Carregando visualização do navegador...</p>
              </div>
            )}

            {/* Cursores Colaborativos posicionados dentro da área exata da página */}
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
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill={c.color}
                  stroke="#000"
                  strokeWidth="1.5"
                  className="drop-shadow-md"
                >
                  <path d="M3 3l7 18 3-7 7-3L3 3z" />
                </svg>
                <span
                  className="text-[9px] font-bold text-white px-1 py-0.2 rounded shadow-md -mt-1 ml-2.5 whitespace-nowrap"
                  style={{ backgroundColor: c.color }}
                >
                  {c.name}
                </span>

                {c.lastClick && Date.now() - c.lastClick.time < 700 && (
                  <span
                    className="absolute w-6 h-6 rounded-full border-2 border-white bg-white/30 animate-ping -left-1.5 -top-1.5 pointer-events-none"
                    style={{ borderColor: c.color }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Drawer Lateral de Automação com IA (Retrátil, sem achatar a página) */}
        {showAiDrawer && (
          <aside className="w-72 h-full bg-[#161616] border-l border-neutral-800 flex flex-col z-30 shadow-2xl animate-fade-in flex-shrink-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
              <div className="flex items-center gap-1.5 text-purple-300 font-semibold text-xs">
                <ControlIcon name="ai" size={13} />
                <span>Automação com IA</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAiDrawer(false)}
                className="text-neutral-400 hover:text-white p-0.5 rounded"
                title="Fechar painel"
              >
                <ControlIcon name="close" size={11} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 scrollbar-thin">
              <div className="bg-[#1e1e1e] rounded-lg p-2.5 border border-neutral-700/60 flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Ações Rápidas
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleTriggerAiPrompt(
                      `Por favor, acesse a página ${activeSession.url} no navegador e faça um resumo claro dos tópicos principais, pontos-chave e links úteis.`
                    )
                  }
                  className="flex items-center gap-2 p-1.5 rounded bg-purple-950/40 hover:bg-purple-900/50 border border-purple-700/40 text-purple-200 text-xs font-medium text-left transition"
                >
                  <ControlIcon name="ai" size={12} />
                  <span>Resumir página com IA</span>
                </button>
                <button
                  type="button"
                  onClick={handleReadContent}
                  className="flex items-center gap-2 p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium text-left transition"
                >
                  <ControlIcon name="file" size={12} />
                  <span>Extrair texto & links da página</span>
                </button>
              </div>

              <div className="bg-[#1e1e1e] rounded-lg p-2.5 border border-neutral-700/60 flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Comandar IA
                </span>
                <textarea
                  value={aiPromptInput}
                  onChange={(e) => setAiPromptInput(e.target.value)}
                  placeholder="Ex: Preencha o campo de busca ou clique no primeiro resultado..."
                  rows={2}
                  className="w-full bg-[#0a0a0a] text-neutral-200 text-xs p-1.5 rounded border border-neutral-700 focus:border-purple-500 focus:outline-none resize-none"
                />
                <button
                  type="button"
                  disabled={!aiPromptInput.trim()}
                  onClick={() => {
                    const fullPrompt = `No navegador web aberto em ${activeSession.url}: ${aiPromptInput.trim()}`
                    handleTriggerAiPrompt(fullPrompt)
                    setAiPromptInput('')
                  }}
                  className="flex items-center justify-center gap-1 py-1 px-2.5 rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-semibold shadow transition"
                >
                  <ControlIcon name="ai" size={11} />
                  <span>Executar</span>
                </button>
              </div>

              {extractedContent && (
                <div className="bg-[#1e1e1e] rounded-lg p-2.5 border border-neutral-700/60 flex flex-col gap-1 max-h-40 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      Texto Extraído
                    </span>
                    <button
                      type="button"
                      onClick={() => setExtractedContent(null)}
                      className="text-[9px] text-neutral-400 hover:text-white"
                    >
                      Limpar
                    </button>
                  </div>
                  <div className="text-[10px] text-neutral-300 font-mono bg-[#0a0a0a] p-1.5 rounded overflow-y-auto max-h-28 scrollbar-thin whitespace-pre-wrap select-text">
                    {extractedContent}
                  </div>
                </div>
              )}

              {historyLog.length > 0 && (
                <div className="bg-[#1e1e1e] rounded-lg p-2.5 border border-neutral-700/60 flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Histórico
                  </span>
                  <div className="flex flex-col gap-1 max-h-28 overflow-y-auto scrollbar-thin">
                    {historyLog.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-1 text-[10px] text-neutral-300 bg-[#121212] p-1 rounded"
                      >
                        <ControlIcon name="check" size={10} />
                        <span className="break-all">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-2.5 py-1.5 border-t border-neutral-800 bg-[#121212] text-[10px] text-neutral-400 truncate">
              {aiStatus}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
