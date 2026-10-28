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
    collaborators,
    setAllowCollaboration,
    navigate,
    sendClick,
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

    void sendClick(x, y)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    sendCursor(x, y)
  }

  const handleNavigateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!urlInput.trim()) return
    if (canInteract) {
      void navigate(urlInput.trim())
    }
  }

  const otherCollaborators = Object.values(collaborators).filter(
    (c) => c.id !== currentUsername && Date.now() - c.lastSeen < 10000
  )

  return (
    <div className="ct-shared-browser-stage flex-1 flex flex-col min-h-0 w-full h-full bg-[#121212] rounded-2xl border border-neutral-800/80 overflow-hidden shadow-2xl relative select-none">
      {/* Barra de Ferramentas / Header do Navegador Compartilhado */}
      <div className="ct-sb-toolbar flex items-center justify-between px-3 py-2 bg-[#181818] border-b border-neutral-800 gap-2 flex-wrap">
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

        {/* Direita: Controles de Colaboração e Parar */}
        <div className="flex items-center gap-2">
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

          {/* Abrir janela nativa do Electron (se for host) */}
          {isHost && (
            <button
              onClick={() => window.contalkDesktop?.browserShow?.()}
              className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-medium transition"
              title="Abrir janela nativa do navegador no Windows"
            >
              <ControlIcon name="expand" size={14} />
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
        <div className="bg-amber-950/90 border-b border-amber-600/60 text-amber-200 px-4 py-1 text-xs flex items-center justify-center gap-2">
          <ControlIcon name="lock" size={12} />
          <span>
            <strong>Proteção Ativa:</strong> Campos de senha e credenciais confidenciais foram desfocados e ocultados
            automaticamente da visualização.
          </span>
        </div>
      )}

      {/* Área da Tela / Viewport do Navegador */}
      <div
        ref={viewportRef}
        onClick={handleViewportClick}
        onMouseMove={handleMouseMove}
        className={`ct-sb-viewport relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-black ${
          canInteract ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        {activeSession.screenshot ? (
          <img
            src={activeSession.screenshot}
            alt={activeSession.title || 'Navegador Web'}
            className="w-full h-full object-contain pointer-events-none select-none"
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
    </div>
  )
}
