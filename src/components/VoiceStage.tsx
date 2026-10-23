import { useEffect, useRef, useState } from 'react'
import { useVoiceStore, VoiceParticipant } from '../store/useVoiceStore'
import { useAuthStore } from '../store/useAuthStore'
import { Track } from 'livekit-client'
import { ScreenShareModal, CaptureSource } from './ScreenShareModal'

function VideoTrackView({
  track,
  isLocal,
  className = 'w-full h-full object-cover',
}: {
  track: Track
  isLocal: boolean
  className?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = videoRef.current
    if (track && el) {
      track.attach(el)
      return () => {
        track.detach(el)
      }
    }
  }, [track])

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal}
      className={className}
    />
  )
}

function ScreenShareViewer({
  participant,
  onStopSharing,
  onMinimize,
}: {
  participant: VoiceParticipant
  onStopSharing?: () => void
  onMinimize?: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.warn('Falha ao entrar em tela cheia:', err)
      })
    } else {
      document.exitFullscreen().catch((err) => {
        console.warn('Falha ao sair de tela cheia:', err)
      })
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full bg-[#0c0a14] rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center justify-center border border-purple-900/40 group min-h-0"
    >
      {participant.screenTrack ? (
        <VideoTrackView
          track={participant.screenTrack}
          isLocal={participant.isLocal}
          className="w-full h-full object-contain bg-[#0c0a14]"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 text-purple-300">
          <div className="text-5xl animate-pulse">🖥️</div>
          <p className="text-sm font-medium">Carregando transmissão de tela...</p>
        </div>
      )}

      {/* Top Header Overlay */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none opacity-90 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2.5 bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-purple-500/30 pointer-events-auto shadow-lg">
          <span className="flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            AO VIVO
          </span>
          <span className="text-white text-sm font-semibold tracking-wide">
            {participant.isLocal ? 'Sua Transmissão de Tela' : `Tela de ${participant.name}`}
          </span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="bg-black/80 hover:bg-black/95 text-purple-200 px-3 py-1.5 rounded-xl border border-purple-500/30 text-xs font-semibold transition-colors shadow-md flex items-center gap-1.5"
              title="Restaurar grade de participantes"
            >
              <span>🗗</span>
              <span>Restaurar Grade</span>
            </button>
          )}

          <button
            onClick={handleToggleFullscreen}
            className="bg-black/80 hover:bg-black/95 text-purple-200 px-3 py-1.5 rounded-xl border border-purple-500/30 text-xs font-semibold transition-colors shadow-md flex items-center gap-1.5"
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            <span>{isFullscreen ? '🗗' : '⛶'}</span>
            <span>{isFullscreen ? 'Restaurar' : 'Tela Cheia'}</span>
          </button>
        </div>
      </div>

      {/* Bottom overlay para o usuário transmissor local */}
      {participant.isLocal && onStopSharing && (
        <div className="absolute bottom-4 flex items-center gap-3 bg-black/85 backdrop-blur-md px-4 py-2 rounded-full border border-purple-500/30 shadow-2xl pointer-events-auto">
          <span className="text-xs text-purple-200 flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Você está transmitindo para o canal
          </span>
          <button
            onClick={onStopSharing}
            className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-3.5 py-1 rounded-full transition-all shadow-md hover:shadow-red-500/30"
          >
            Parar Transmissão
          </button>
        </div>
      )}
    </div>
  )
}

function ParticipantTile({
  participant,
  isMaximized,
  onMaximize,
  onViewScreen,
}: {
  participant: VoiceParticipant
  isMaximized?: boolean
  onMaximize?: () => void
  onViewScreen?: () => void
}) {
  return (
    <div
      onDoubleClick={onMaximize}
      className={`relative rounded-3xl overflow-hidden bg-[#181427] flex flex-col items-center justify-center p-6 transition-all duration-300 shadow-2xl border group select-none ${
        participant.isSpeaking
          ? 'ring-4 ring-green-500 border-green-400 shadow-green-500/25'
          : 'border-purple-900/40 hover:border-purple-500/50'
      } ${isMaximized ? 'w-full h-full flex-1' : 'aspect-video'}`}
    >
      {participant.isVideoEnabled && participant.videoTrack ? (
        <VideoTrackView
          track={participant.videoTrack}
          isLocal={participant.isLocal}
          className="w-full h-full object-cover rounded-2xl"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-4">
          {/* Avatar central estilizado como no Discord com pulso de voz verde */}
          <div className="relative">
            {participant.isSpeaking && (
              <div className="absolute -inset-2 rounded-full bg-green-500/30 blur-md animate-ping" />
            )}
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black text-white transition-all duration-300 shadow-2xl relative ${
                participant.isSpeaking
                  ? 'scale-110 ring-4 ring-green-400 bg-gradient-to-br from-green-600 to-emerald-700'
                  : 'bg-gradient-to-br from-purple-600 to-indigo-700 border-2 border-purple-400/40 ring-4 ring-purple-900/30'
              }`}
            >
              {participant.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      )}

      {/* Badges no canto inferior esquerdo com nome e mic */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs border border-white/10 shadow-lg">
        <span className="font-bold text-white tracking-wide">{participant.name}</span>
        {participant.isLocal && (
          <span className="text-[10px] bg-purple-950/80 border border-purple-700/50 text-purple-300 px-1.5 py-0.5 rounded font-medium">
            você
          </span>
        )}
        {!participant.isAudioEnabled && (
          <span className="text-red-400 text-xs ml-1" title="Microfone Desativado">
            🔇
          </span>
        )}
        {participant.isSpeaking && (
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
        )}
      </div>

      {/* Botões de Ação no Canto Superior Direito (Hover ou Ativo) */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {participant.isScreenShareEnabled && participant.screenTrack && (
          <button
            onClick={onViewScreen}
            className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-black px-3 py-1 rounded-xl shadow-lg flex items-center gap-1.5 transition-all cursor-pointer animate-pulse hover:animate-none"
            title="Ver transmissão de tela"
          >
            <span className="w-2 h-2 rounded-full bg-white" />
            AO VIVO
          </button>
        )}

        <button
          onClick={onMaximize}
          className="opacity-0 group-hover:opacity-100 bg-black/80 hover:bg-black text-purple-200 hover:text-white p-2 rounded-xl border border-purple-500/40 transition-all text-xs font-semibold shadow-lg"
          title={isMaximized ? 'Restaurar grade' : 'Maximizar participante (Focar)'}
        >
          {isMaximized ? '🗗' : '⛶'}
        </button>
      </div>
    </div>
  )
}

export function VoiceStage({
  showMemberList,
  onToggleMemberList,
}: {
  showMemberList?: boolean
  onToggleMemberList?: () => void
}) {
  const { user } = useAuthStore()
  const {
    activeChannelId,
    activeChannelName,
    participants,
    connectionStatus,
    error,
    isMicMuted,
    isDeafened,
    isCameraOn,
    isScreenSharing,
    joinChannel,
    toggleMic,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
    startScreenShareWithOptions,
    leaveChannel,
  } = useVoiceStore()

  // Telas compartilhadas ativas
  const screenShares = participants.filter((p) => p.isScreenShareEnabled && p.screenTrack)
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null)
  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  // Transmissão de tela selecionada (se houver)
  const activeScreenShare =
    (selectedScreenId && screenShares.find((p) => p.identity === selectedScreenId)) ||
    (screenShares.length > 0 ? screenShares[0] : null)

  // Participante maximizado / fixado (Spotlight)
  const pinnedParticipant = pinnedParticipantId
    ? participants.find((p) => p.identity === pinnedParticipantId)
    : null

  const handleRetry = () => {
    if (activeChannelId && user) {
      joinChannel(activeChannelId, activeChannelName || 'Canal de Voz', {
        username: user.username,
        display_name: user.display_name,
      })
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#161224] relative overflow-hidden select-none min-w-0">
      {/* Header do palco de voz estilo Discord */}
      <header className="h-12 px-4 flex items-center justify-between border-b border-purple-900/30 bg-[#141021] shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">🔊</span>
          <h2 className="font-bold text-white text-base tracking-wide">{activeChannelName || 'Canal de Voz'}</h2>

          {connectionStatus === 'connected' && (
            <div className="flex items-center gap-1.5 ml-3 bg-purple-500/10 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              RTC Conectado • LiveKit SFU (127.0.0.1)
            </div>
          )}

          {connectionStatus === 'connecting' && (
            <div className="flex items-center gap-1.5 ml-3 bg-yellow-500/10 text-yellow-300 border border-yellow-500/30 px-2.5 py-0.5 rounded-full text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
              Conectando ao LiveKit...
            </div>
          )}

          {connectionStatus === 'disconnected' && (
            <div className="flex items-center gap-1.5 ml-3 bg-red-500/10 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Desconectado
            </div>
          )}
        </div>

        {/* Canto direito do Header: Participantes e Botão de Alternar Painel de Membros */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-purple-300/80 font-medium hidden sm:inline">
            {participants.length} {participants.length === 1 ? 'participante' : 'participantes'}
          </span>

          {onToggleMemberList && (
            <button
              onClick={onToggleMemberList}
              className={`p-1.5 rounded-xl border transition-all text-xs flex items-center gap-1.5 font-bold ${
                showMemberList
                  ? 'bg-purple-600 border-purple-400 text-white shadow-md shadow-purple-600/30'
                  : 'bg-[#181329] border-purple-900/40 text-purple-300 hover:text-white hover:border-purple-500/40'
              }`}
              title="Mostrar/Ocultar lista de membros do servidor"
            >
              <span>👥</span>
              <span className="hidden md:inline">Membros</span>
            </button>
          )}
        </div>
      </header>

      {/* Área Central: Transmissão / Participante Maximizado / Grade Normal */}
      <div className="flex-1 p-4 overflow-hidden flex flex-col justify-center min-h-0">
        {connectionStatus === 'connecting' ? (
          <div className="text-center text-purple-300/70 space-y-3 m-auto">
            <div className="text-5xl animate-bounce">🎧</div>
            <p className="text-white font-medium text-base">Conectando à sala de voz...</p>
            <p className="text-xs text-purple-400/60">Estabelecendo túnel WebRTC com LiveKit SFU</p>
          </div>
        ) : connectionStatus === 'disconnected' || error ? (
          <div className="text-center space-y-4 max-w-sm p-6 bg-[#151124] rounded-3xl border border-purple-900/40 shadow-2xl m-auto">
            <div className="text-4xl text-red-400">⚠️</div>
            <div>
              <h3 className="text-white font-bold mb-1">Não foi possível conectar</h3>
              <p className="text-xs text-red-400 break-words">{error || 'A conexão foi encerrada'}</p>
            </div>
            <button
              onClick={handleRetry}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-purple-600/30"
            >
              🔄 Tentar Novamente
            </button>
          </div>
        ) : participants.length === 0 ? (
          <div className="text-center text-purple-300/70 space-y-2 m-auto">
            <div className="text-4xl">🎙️</div>
            <p className="text-white font-medium">Você está na sala!</p>
            <p className="text-xs text-purple-400/60">Aguardando outros participantes entrarem...</p>
          </div>
        ) : activeScreenShare ? (
          /* MODO TRANSMISSÃO DE TELA ESTILO DISCORD COM SUPORTE A RESTAURAR */
          <div className="flex-1 flex flex-col gap-3 min-h-0 w-full max-w-6xl mx-auto">
            <ScreenShareViewer
              participant={activeScreenShare}
              onStopSharing={activeScreenShare.isLocal ? toggleScreenShare : undefined}
              onMinimize={() => setSelectedScreenId(null)}
            />

            {/* Faixa inferior de participantes */}
            <div className="h-24 flex items-center justify-center gap-3 overflow-x-auto py-1 px-1 scrollbar-thin flex-shrink-0">
              {participants.map((p) => {
                const isSelected = p.identity === activeScreenShare.identity
                const isSharingThis = p.isScreenShareEnabled && p.screenTrack
                return (
                  <div
                    key={p.identity}
                    onClick={() => {
                      if (isSharingThis) {
                        setSelectedScreenId(p.identity)
                      }
                    }}
                    className={`relative h-20 aspect-video rounded-2xl overflow-hidden bg-[#181427] flex-shrink-0 flex items-center justify-center transition-all duration-200 shadow-md ${
                      isSharingThis ? 'cursor-pointer hover:scale-105' : ''
                    } ${
                      isSelected
                        ? 'ring-3 ring-red-500 shadow-red-500/30 border border-red-500'
                        : p.isSpeaking
                        ? 'ring-3 ring-green-500 border border-green-500'
                        : 'border border-purple-900/40 hover:border-purple-500/50'
                    }`}
                  >
                    {p.isVideoEnabled && p.videoTrack ? (
                      <VideoTrackView
                        track={p.videoTrack}
                        isLocal={p.isLocal}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="absolute bottom-1 left-1 flex items-center gap-1 bg-black/75 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-white max-w-[90%]">
                      <span className="truncate">{p.name}</span>
                      {!p.isAudioEnabled && <span className="text-red-400 text-[10px]">🔇</span>}
                    </div>

                    {isSharingThis && (
                      <div className="absolute top-1 right-1 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded shadow">
                        AO VIVO
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : pinnedParticipant ? (
          /* MODO SPOTLIGHT / PARTICIPANTE MAXIMIZADO */
          <div className="flex-1 flex flex-col gap-3 min-h-0 w-full max-w-5xl mx-auto">
            <div className="flex-1 flex items-center justify-center min-h-0">
              <ParticipantTile
                participant={pinnedParticipant}
                isMaximized={true}
                onMaximize={() => setPinnedParticipantId(null)}
                onViewScreen={() => setSelectedScreenId(pinnedParticipant.identity)}
              />
            </div>

            {/* Faixa inferior de participantes */}
            <div className="h-24 flex items-center justify-center gap-3 overflow-x-auto py-1 px-1 scrollbar-thin flex-shrink-0">
              {participants.map((p) => {
                const isCurrent = p.identity === pinnedParticipant.identity
                return (
                  <div
                    key={p.identity}
                    onClick={() => setPinnedParticipantId(p.identity)}
                    className={`relative h-20 aspect-video rounded-2xl overflow-hidden bg-[#181427] flex-shrink-0 flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 shadow-md ${
                      isCurrent
                        ? 'ring-3 ring-purple-500 shadow-purple-500/30 border border-purple-400'
                        : p.isSpeaking
                        ? 'ring-3 ring-green-500 border border-green-500'
                        : 'border border-purple-900/40 hover:border-purple-500/50'
                    }`}
                  >
                    {p.isVideoEnabled && p.videoTrack ? (
                      <VideoTrackView
                        track={p.videoTrack}
                        isLocal={p.isLocal}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="absolute bottom-1 left-1 flex items-center gap-1 bg-black/75 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-white max-w-[90%]">
                      <span className="truncate">{p.name}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* MODO GRADE NORMAL DISCORD COM 4 OU MAIS USUÁRIOS */
          <div className="overflow-y-auto flex items-center justify-center w-full h-full py-4">
            <div
              className={`w-full max-w-5xl grid gap-4 items-center justify-center ${
                participants.length === 1
                  ? 'grid-cols-1 max-w-xl'
                  : participants.length === 2
                  ? 'grid-cols-2 max-w-3xl'
                  : 'grid-cols-2 max-w-4xl'
              }`}
            >
              {participants.map((p) => (
                <ParticipantTile
                  key={p.identity}
                  participant={p}
                  onMaximize={() => setPinnedParticipantId(p.identity)}
                  onViewScreen={() => setSelectedScreenId(p.identity)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Barra de Controles de Voz Centralizada */}
      <div className="p-4 bg-[#120f1e] border-t border-purple-900/40 flex items-center justify-center gap-3 flex-shrink-0 shadow-2xl">
        {/* Mute Mic */}
        <button
          onClick={toggleMic}
          disabled={connectionStatus !== 'connected'}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
            isMicMuted
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
              : 'bg-[#251f38] hover:bg-[#322a4d] text-white border border-purple-900/40'
          }`}
          title={isMicMuted ? 'Desmutar microfone' : 'Mutar microfone'}
        >
          <span>{isMicMuted ? '🔇' : '🎙️'}</span>
          <span>{isMicMuted ? 'Mutado' : 'Microfone'}</span>
        </button>

        {/* Deafen */}
        <button
          onClick={toggleDeafen}
          disabled={connectionStatus !== 'connected'}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
            isDeafened
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
              : 'bg-[#251f38] hover:bg-[#322a4d] text-white border border-purple-900/40'
          }`}
          title={isDeafened ? 'Desativar ensurdecer' : 'Ensurdecer áudio'}
        >
          <span>{isDeafened ? '🔕' : '🎧'}</span>
          <span>{isDeafened ? 'Ensurdecido' : 'Áudio'}</span>
        </button>

        {/* Camera */}
        <button
          onClick={toggleCamera}
          disabled={connectionStatus !== 'connected'}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
            isCameraOn
              ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/30'
              : 'bg-[#251f38] hover:bg-[#322a4d] text-white border border-purple-900/40'
          }`}
          title={isCameraOn ? 'Desligar Câmera' : 'Ligar Câmera'}
        >
          <span>📷</span>
          <span>{isCameraOn ? 'Câmera Ativa' : 'Vídeo'}</span>
        </button>

        {/* Screen Share */}
        <button
          onClick={() => {
            if (isScreenSharing) {
              toggleScreenShare()
            } else {
              setIsShareModalOpen(true)
            }
          }}
          disabled={connectionStatus !== 'connected'}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
            isScreenSharing
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white ring-2 ring-purple-400/60 shadow-purple-600/50'
              : 'bg-[#251f38] hover:bg-[#322a4d] text-purple-200 border border-purple-800/40'
          }`}
          title={isScreenSharing ? 'Parar Compartilhamento' : 'Compartilhar Tela'}
        >
          <span>🖥️</span>
          <span>{isScreenSharing ? 'Compartilhando' : 'Compartilhar Tela'}</span>
        </button>

        <div className="w-[1px] h-8 bg-purple-900/40 mx-2" />

        {/* Desconectar */}
        <button
          onClick={leaveChannel}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm bg-red-600 hover:bg-red-700 text-white transition-all shadow-md hover:shadow-red-600/30"
          title="Desconectar da chamada"
        >
          <span>📞</span>
          <span>Desconectar</span>
        </button>
      </div>

      {/* Modal de Transmissão de Tela estilo Discord */}
      <ScreenShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onStartShare={async (source, options) => {
          await startScreenShareWithOptions(source, options)
        }}
      />
    </div>
  )
}
