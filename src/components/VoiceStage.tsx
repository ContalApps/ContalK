import { useEffect, useRef, useState } from 'react'
import { useVoiceStore, VoiceParticipant } from '../store/useVoiceStore'
import { useAuthStore } from '../store/useAuthStore'
import { useCommunityStore } from '../store/useCommunityStore'
import { Track } from 'livekit-client'
import { ParticipantVolumePopup } from './ParticipantVolumePopup'
import { ControlIcon } from './ControlIcon'
import { StreamAudioPopover } from './StreamVolumeControl'
import { FriendButton } from './FriendButton'

function VideoTrackView({
  track,
  className = 'w-full h-full object-cover',
  onReady,
}: {
  track: Track
  isLocal: boolean
  className?: string
  onReady?:()=>void
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
      onLoadedData={onReady}
      playsInline
      muted
      className={className}
    />
  )
}

function ScreenShareViewer({
  participant,
  onStopSharing,
  onFocus,
  onMinimize,
  isSpotlight = false,
  hideAudioControl = false,
}: {
  participant: VoiceParticipant
  onStopSharing?: () => void
  onFocus?: () => void
  onMinimize?: () => void
  isSpotlight?: boolean
  hideAudioControl?:boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [ready,setReady]=useState(false)
  useEffect(()=>setReady(false),[participant.screenTrack])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  const handleToggleFullscreen = (e?: React.MouseEvent) => {
    e?.stopPropagation()
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
      onDoubleClick={onFocus || onMinimize}
      className="ct-share-view relative flex-1 w-full h-full overflow-hidden flex flex-col items-center justify-center group min-h-0 select-none"
    >
      {participant.screenTrack&&<VideoTrackView track={participant.screenTrack} isLocal={participant.isLocal} className="ct-share-video w-full h-full object-contain" onReady={()=>setReady(true)}/>}
      {!ready&&<div className="ct-share-waiting"><span><ControlIcon name="screen"/></span><strong>Aguardando transmissão</strong><p>A tela de {participant.name} aparecerá aqui assim que os primeiros quadros chegarem.</p></div>}
      {/* Top Header Overlay */}
      <div className="ct-share-header">
        <div className="ct-share-label">
          <span className="flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            AO VIVO
          </span>
          <span className="text-white text-xs font-semibold tracking-wide">
            {participant.isLocal ? 'Sua Transmissão de Tela' : `Tela de ${participant.name}`}
          </span>
        </div>

        <div className="ct-share-tools">
          {/* Botão de alternar Foco / Grade */}
          {isSpotlight && onMinimize && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMinimize()
              }}
              className="bg-black/80 hover:bg-black text-purple-200 px-3 py-1 rounded-xl border border-purple-500/30 text-xs font-semibold transition shadow-md flex items-center gap-1.5 cursor-pointer"
              title="Restaurar modo grade"
            >
              <span>⊞</span>
              <span>Modo Grade</span>
            </button>
          )}

          {!isSpotlight && onFocus && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onFocus()
              }}
              className="bg-black/80 hover:bg-black text-purple-200 px-3 py-1 rounded-xl border border-purple-500/30 text-xs font-semibold transition shadow-md flex items-center gap-1.5 cursor-pointer"
              title="Maximizar esta tela (Foco)"
            >
              <span>⛶</span>
              <span>Focar</span>
            </button>
          )}

          <button
            onClick={handleToggleFullscreen}
            className="bg-black/80 hover:bg-black text-purple-200 p-1.5 rounded-xl border border-purple-500/30 text-xs font-semibold transition shadow-md cursor-pointer"
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M16 21h5v-5"/></svg>
          </button>
        </div>
      </div>

      {/* Bottom overlay para o usuário transmissor local */}
      {!participant.isLocal && !hideAudioControl && <div className="ct-stream-overlay"><StreamAudioPopover identity={participant.identity} name={participant.name}/></div>}
      {participant.isLocal && onStopSharing && (
        <div className="absolute bottom-3 flex items-center gap-3 bg-black/85 backdrop-blur-md px-4 py-1.5 rounded-full border border-purple-500/30 shadow-2xl pointer-events-auto">
          <span className="text-xs text-purple-200 flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Você está transmitindo
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onStopSharing()
            }}
            className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-3 py-0.5 rounded-full transition shadow-md"
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
  userVolume,
  onOpenVolume,
  isMaximized,
  onMaximize,
  onViewScreen,
}: {
  participant: VoiceParticipant
  userVolume: number
  onOpenVolume: (p: VoiceParticipant) => void
  isMaximized?: boolean
  onMaximize?: () => void
  onViewScreen?: () => void
}) {
  const member=useCommunityStore(s=>s.members.find(m=>m.username===participant.identity))
  const avatar=participant.avatar || member?.avatar
  return (
    <div
      onDoubleClick={onMaximize}
      onContextMenu={e => { e.preventDefault(); onOpenVolume(participant) }}
      className={`relative rounded-xl overflow-hidden bg-[#181427] flex flex-col items-center justify-center p-3 transition-colors border group select-none ${
        participant.isSpeaking
          ? 'ring-4 ring-green-500 border-green-400 shadow-green-500/25'
          : 'border-purple-900/40 hover:border-purple-500/50'
      } ${isMaximized ? 'w-full h-full flex-1' : 'aspect-video'}`}
    >
      {avatar && !participant.isVideoEnabled && <img src={avatar} alt="" className="ct-voice-avatar-bg"/>}
      {!participant.isLocal && <div className="ct-tile-friend" onDoubleClick={e=>e.stopPropagation()}><FriendButton username={participant.identity} name={participant.name} compact/></div>}
      {participant.isVideoEnabled && participant.videoTrack ? (
        <VideoTrackView
          track={participant.videoTrack}
          isLocal={participant.isLocal}
          className="w-full h-full object-cover rounded-2xl"
        />
      ) : (
        <div className="relative z-10 flex flex-col items-center justify-center gap-4">
          <div className="relative">
            {participant.isSpeaking && (
              <div className="absolute -inset-2 rounded-full bg-green-500/30 blur-md animate-ping" />
            )}
            <div
              onClick={() => onOpenVolume(participant)}
              className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black text-white transition-all duration-300 shadow-2xl relative cursor-pointer hover:scale-105 ${
                participant.isSpeaking
                  ? 'scale-110 ring-4 ring-green-400 bg-gradient-to-br from-green-600 to-emerald-700'
                  : 'bg-gradient-to-br from-purple-600 to-indigo-700 border-2 border-purple-400/40 ring-4 ring-purple-900/30'
              }`}
              title="Clique para ajustar volume"
            >
              {avatar?<img src={avatar} alt={participant.name} className="ct-voice-avatar"/>:participant.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      )}

      {/* Badges no canto inferior esquerdo */}
      <div
        onClick={() => onOpenVolume(participant)}
        className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs border border-white/10 shadow-lg cursor-pointer hover:bg-black/90 transition"
        title="Clique para ajustar volume"
      >
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

      {/* Botões de Ação no Canto Superior Direito */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {/* Botão de Controle de Volume Individual */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onOpenVolume(participant)
          }}
          className="bg-black/80 hover:bg-black text-purple-300 hover:text-white px-2 py-1 rounded-xl border border-purple-500/30 text-xs font-semibold flex items-center gap-1 shadow-lg cursor-pointer transition"
          title={`Ajustar volume de ${participant.name}`}
        >
          <span>{userVolume === 0 ? '🔇' : userVolume > 100 ? '🔊' : '🔉'}</span>
          <span className="font-mono text-[11px]">{userVolume}%</span>
        </button>

        {participant.isScreenShareEnabled && participant.screenTrack && (
          <button
            onClick={onViewScreen}
            className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-black px-3 py-1 rounded-xl shadow-lg flex items-center gap-1.5 transition cursor-pointer animate-pulse hover:animate-none"
            title="Ver transmissão de tela"
          >
            <span className="w-2 h-2 rounded-full bg-white" />
            AO VIVO
          </button>
        )}

        <button
          onClick={onMaximize}
          className="opacity-0 group-hover:opacity-100 bg-black/80 hover:bg-black text-purple-200 hover:text-white p-2 rounded-xl border border-purple-500/40 transition text-xs font-semibold shadow-lg cursor-pointer"
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
    screenShareError,
    joinChannel,
    toggleScreenShare,
    userVolumes,
    setUserVolume,
  } = useVoiceStore()

  // Telas compartilhadas ativas
  const screenShares = participants.filter((p) => p.isScreenShareEnabled && p.screenTrack)

  // Modo de exibição: 'grid' (grade lado a lado) ou 'spotlight' (foco em 1 tela)
  const [stageViewMode, setStageViewMode] = useState<'grid' | 'spotlight'>('grid')
  const [spotlightScreenId, setSpotlightScreenId] = useState<string | null>(null)
  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null)

  // Popup de Volume e Modal de Transmissão de Tela
  const [volumeTarget, setVolumeTarget] = useState<VoiceParticipant | null>(null)

  // Transmissão de tela selecionada para foco
  const focusedScreen =
    (spotlightScreenId && screenShares.find((p) => p.identity === spotlightScreenId)) ||
    (screenShares.length > 0 ? screenShares[0] : null)

  // Participante maximizado / fixado (Spotlight de usuário)
  const pinnedParticipant = pinnedParticipantId
    ? participants.find((p) => p.identity === pinnedParticipantId)
    : null

  const handleRetry = () => {
    if (activeChannelId && user) {
      joinChannel(activeChannelId, activeChannelName || 'Canal de Voz', {
        username: user.username,
        display_name: user.display_name,
        avatar: user.avatar,
      })
    }
  }

  return (
    <div data-sharing-count={screenShares.length} className="ct-voice-stage flex-1 flex flex-col h-full relative overflow-hidden select-none min-w-0">
      {/* Header do palco de voz estilo Discord */}
      <header className="ct-voice-toolbar">
        {/* Canto direito do Header: Controles de Grade/Foco, Contador e Membros */}
        <div className="flex items-center gap-3">
          {/* Seletor Grade vs Foco quando há telas compartilhadas */}
          {screenShares.length > 0 && (
            <div className="flex items-center bg-[#100d1c] p-0.5 rounded-xl border border-purple-900/40">
              <button
                onClick={() => setStageViewMode('grid')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  stageViewMode === 'grid'
                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                    : 'text-purple-300 hover:text-white'
                }`}
                title="Ver todas as telas em grade lado a lado"
              >
                <span>⊞</span>
                <span>Modo Grade {screenShares.length > 1 ? `(${screenShares.length})` : ''}</span>
              </button>
              <button
                onClick={() => {
                  setStageViewMode('spotlight')
                  if (!spotlightScreenId && screenShares.length > 0) {
                    setSpotlightScreenId(screenShares[0].identity)
                  }
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  stageViewMode === 'spotlight'
                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                    : 'text-purple-300 hover:text-white'
                }`}
                title="Focar em uma tela única"
              >
                <span>⛶</span>
                <span>Modo Foco</span>
              </button>
            </div>
          )}

          <span className="text-xs text-purple-300/80 font-medium hidden sm:inline">
            {participants.length} {participants.length === 1 ? 'participante' : 'participantes'}
          </span>

          {onToggleMemberList && (
            <button
              onClick={onToggleMemberList}
              className={`p-1.5 rounded-xl border transition text-xs flex items-center gap-1.5 font-bold ${
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

      {/* Área Central: Grade Multi-Telas / Transmissão em Foco / Grade de Usuários */}
      <div className="ct-voice-content flex-1 overflow-hidden flex flex-col justify-center min-h-0">
        {connectionStatus === 'connecting' ? (
          <div className="text-center text-purple-300/70 space-y-3 m-auto">
            <div className="text-5xl animate-bounce">🎧</div>
            <p className="text-white font-medium text-base">Conectando à sala de voz...</p>
            <p className="text-xs text-purple-400/60">Estabelecendo túnel WebRTC com LiveKit Cloud</p>
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
        ) : screenShares.length > 0 && stageViewMode === 'grid' ? (
          /* ═══════════════════════════════════════════════════════════════════ */
          /* MODO GRADE DE TELAS (EXIBE 2 OU MAIS TELAS LADO A LADO!)           */
          /* ═══════════════════════════════════════════════════════════════════ */
          <div className="ct-share-layout flex-1 flex flex-col min-h-0 w-full h-full">
            <div
              className={`flex-1 grid gap-3 min-h-0 ${
                screenShares.length === 1
                  ? 'grid-cols-1'
                  : screenShares.length === 2
                  ? 'grid-cols-1 md:grid-cols-2'
                  : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2'
              }`}
            >
              {screenShares.map((p) => (
                <div key={p.identity} className="relative w-full h-full min-h-0 flex flex-col">
                  <ScreenShareViewer
                    participant={p}
                    onStopSharing={p.isLocal ? toggleScreenShare : undefined}
                    onFocus={() => {
                      setSpotlightScreenId(p.identity)
                      setStageViewMode('spotlight')
                    }}
                    isSpotlight={false}
                    hideAudioControl={screenShares.length===1}
                  />
                </div>
              ))}
            </div>

            <div className="ct-share-footer">{screenShares.length===1&&!screenShares[0].isLocal&&<div className="ct-stream-overlay"><StreamAudioPopover identity={screenShares[0].identity} name={screenShares[0].name}/></div>}<div className="ct-share-people">{participants.map(p=><button className={p.isScreenShareEnabled?'sharing':''} key={p.identity} onClick={()=>setVolumeTarget(p)} title={`Ajustar volume de ${p.name}`}><span className="ct-share-initial">{p.name.slice(0,1).toUpperCase()}</span><strong>{p.name}</strong>{p.isScreenShareEnabled&&<small>AO VIVO</small>}</button>)}</div></div>
          </div>
        ) : screenShares.length > 0 && stageViewMode === 'spotlight' && focusedScreen ? (
          /* ═══════════════════════════════════════════════════════════════════ */
          /* MODO FOCO (SPOTLIGHT EM UMA TELA ESPECÍFICA)                        */
          /* ═══════════════════════════════════════════════════════════════════ */
          <div className="flex-1 flex flex-col gap-3 min-h-0 w-full max-w-6xl mx-auto h-full">
            <ScreenShareViewer
              participant={focusedScreen}
              onStopSharing={focusedScreen.isLocal ? toggleScreenShare : undefined}
              onMinimize={() => setStageViewMode('grid')}
              isSpotlight={true}
            />

            {/* Faixa inferior de participantes e outras telas */}
            <div className="h-24 flex items-center justify-center gap-3 overflow-x-auto py-1 px-1 scrollbar-thin flex-shrink-0">
              {participants.map((p) => {
                const isFocused = p.identity === focusedScreen.identity
                const isSharing = p.isScreenShareEnabled && p.screenTrack
                const userVol = userVolumes[p.identity] ?? 100
                return (
                  <div
                    key={p.identity}
                    onClick={() => {
                      if (isSharing) {
                        setSpotlightScreenId(p.identity)
                      } else {
                        setVolumeTarget(p)
                      }
                    }}
                    className={`relative h-20 aspect-video rounded-2xl overflow-hidden bg-[#181427] flex-shrink-0 flex items-center justify-center transition shadow-md cursor-pointer hover:scale-105 ${
                      isFocused
                        ? 'ring-3 ring-red-500 shadow-red-500/30 border border-red-500'
                        : isSharing
                        ? 'ring-2 ring-purple-500'
                        : p.isSpeaking
                        ? 'ring-2 ring-green-500'
                        : 'border border-purple-900/40 hover:border-purple-500/50'
                    }`}
                    title={isSharing ? `Ver tela de ${p.name}` : `Ajustar volume de ${p.name}`}
                  >
                    {p.isVideoEnabled && p.videoTrack ? (
                      <VideoTrackView track={p.videoTrack} isLocal={p.isLocal} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="absolute bottom-1 left-1 flex items-center gap-1 bg-black/75 px-1.5 py-0.5 rounded text-[10px] text-white max-w-[90%]">
                      <span className="truncate">{p.name}</span>
                      {userVol === 0 && <span className="text-red-400">🔇</span>}
                    </div>

                    {isSharing && (
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
          /* ═══════════════════════════════════════════════════════════════════ */
          /* MODO SPOTLIGHT DE UM PARTICIPANTE ESPECÍFICO                       */
          /* ═══════════════════════════════════════════════════════════════════ */
          <div className="flex-1 flex flex-col gap-3 min-h-0 w-full max-w-5xl mx-auto h-full">
            <div className="flex-1 flex items-center justify-center min-h-0">
              <ParticipantTile
                participant={pinnedParticipant}
                userVolume={userVolumes[pinnedParticipant.identity] ?? 100}
                onOpenVolume={setVolumeTarget}
                isMaximized={true}
                onMaximize={() => setPinnedParticipantId(null)}
                onViewScreen={() => {
                  setSpotlightScreenId(pinnedParticipant.identity)
                  setStageViewMode('spotlight')
                }}
              />
            </div>

            {/* Faixa inferior */}
            <div className="h-24 flex items-center justify-center gap-3 overflow-x-auto py-1 px-1 scrollbar-thin flex-shrink-0">
              {participants.map((p) => {
                const isCurrent = p.identity === pinnedParticipant.identity
                return (
                  <div
                    key={p.identity}
                    onClick={() => setPinnedParticipantId(p.identity)}
                    className={`relative h-20 aspect-video rounded-2xl overflow-hidden bg-[#181427] flex-shrink-0 flex items-center justify-center transition cursor-pointer hover:scale-105 shadow-md ${
                      isCurrent
                        ? 'ring-3 ring-purple-500 border border-purple-400'
                        : p.isSpeaking
                        ? 'ring-2 ring-green-500'
                        : 'border border-purple-900/40'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute bottom-1 left-1 bg-black/75 px-1.5 py-0.5 rounded text-[10px] text-white">
                      {p.name}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* ═══════════════════════════════════════════════════════════════════ */
          /* MODO GRADE NORMAL (AVATARES / WEBCAMS ESTILO DISCORD)              */
          /* ═══════════════════════════════════════════════════════════════════ */
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
                  userVolume={userVolumes[p.identity] ?? 100}
                  onOpenVolume={setVolumeTarget}
                  onMaximize={() => setPinnedParticipantId(p.identity)}
                  onViewScreen={() => {
                    setSpotlightScreenId(p.identity)
                    setStageViewMode('spotlight')
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {screenShareError && <div role="alert" className="mx-4 mb-2 rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-200">{screenShareError}</div>}
      {/* Popup de Controle de Volume do Participante */}
      {volumeTarget && (
        <ParticipantVolumePopup
          participant={volumeTarget}
          volume={userVolumes[volumeTarget.identity] ?? 100}
          onVolumeChange={(newVol) => setUserVolume(volumeTarget.identity, newVol)}
          onClose={() => setVolumeTarget(null)}
        />
      )}

    </div>
  )
}
