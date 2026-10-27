import { useEffect, useRef, useState } from 'react'
import { useVoiceStore, VoiceParticipant } from '../store/useVoiceStore'
import { useAuthStore } from '../store/useAuthStore'
import { useCommunityStore } from '../store/useCommunityStore'
import { Track } from '../media/realtime'
import { ControlIcon } from './ControlIcon'
import { FriendButton } from './FriendButton'
import { RoleName } from './RoleName'

function voiceName(person:VoiceParticipant){return person.serverNickname||person.name}

export function VideoTrackView({
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
  onFocus,
  onMinimize,
  isSpotlight = false,
  onFullscreen,
}: {
  participant: VoiceParticipant
  onFocus?: () => void
  onMinimize?: () => void
  isSpotlight?: boolean
  onFullscreen?: () => void
}) {
  const [ready,setReady]=useState(false)
  useEffect(()=>setReady(false),[participant.screenTrack])

  return (
    <div
      onDoubleClick={onFocus || onMinimize}
      className="ct-share-view relative flex-1 w-full h-full overflow-hidden flex flex-col items-center justify-center group min-h-0 select-none"
    >
      {participant.screenTrack&&<VideoTrackView track={participant.screenTrack} isLocal={participant.isLocal} className="ct-share-video w-full h-full object-contain" onReady={()=>setReady(true)}/>}
      {!ready&&<div className="ct-share-waiting"><span><ControlIcon name="screen"/></span><strong>Aguardando transmissão</strong><p>A tela de {voiceName(participant)} aparecerá aqui assim que os primeiros quadros chegarem.</p></div>}
      {/* Top Header Overlay */}
      <div className="ct-share-header">
        <div className="ct-share-label">
          <span className="flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md shadow">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            AO VIVO
          </span>
          <span data-profile-identity={participant.identity} data-profile-name={voiceName(participant)} title="Botão direito para opções da pessoa" className="text-white text-xs font-semibold tracking-wide">
            {participant.isLocal ? 'Sua Transmissão de Tela' : `Tela de ${voiceName(participant)}`}
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
              className="bg-black/80 hover:bg-black text-neutral-200 px-3 py-1 rounded-xl border border-neutral-500/30 text-xs font-semibold transition shadow-md flex items-center gap-1.5 cursor-pointer"
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
              className="bg-black/80 hover:bg-black text-neutral-200 px-3 py-1 rounded-xl border border-neutral-500/30 text-xs font-semibold transition shadow-md flex items-center gap-1.5 cursor-pointer"
              title="Maximizar esta tela (Foco)"
            >
              <ControlIcon name="expand"/>
              <span>Focar</span>
            </button>
          )}

          {onFullscreen && <button
            onClick={onFullscreen}
            className="bg-black/80 hover:bg-black text-neutral-200 p-1.5 rounded-xl border border-neutral-500/30 text-xs font-semibold transition shadow-md cursor-pointer"
            title="Tela cheia · selecionar transmissões"
            aria-label={`Tela cheia: ${voiceName(participant)}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M16 21h5v-5"/></svg>
          </button>}
        </div>
      </div>


    </div>
  )
}

function ParticipantTile({
  participant,
  userVolume,
  onProfile,
  onParticipantMenu,
  isMaximized,
  onMaximize,
  onViewScreen,
}: {
  participant: VoiceParticipant
  userVolume: number
  onProfile: (p: VoiceParticipant) => void
  onParticipantMenu: (p:VoiceParticipant,event:React.MouseEvent)=>void
  isMaximized?: boolean
  onMaximize?: () => void
  onViewScreen?: () => void
}) {
  const member=useCommunityStore(s=>s.members.find(m=>m.username===participant.identity))
  const avatar=participant.avatar || member?.avatar
  return (
    <div
      onDoubleClick={onMaximize}
      onContextMenu={e => { e.preventDefault(); onParticipantMenu(participant,e) }}
      className={`relative rounded-xl overflow-hidden bg-[#181818] flex flex-col items-center justify-center p-3 transition-colors border group select-none ${
        participant.isSpeaking
          ? 'ring-1 ring-white/50 border-transparent'
          : 'border-neutral-900/40 hover:border-neutral-500/50'
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
              <div className="hidden" />
            )}
            <div
              onClick={() => onProfile(participant)}
              className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-semibold text-white transition-all duration-300 relative cursor-pointer hover:scale-105 ${
                participant.isSpeaking
                  ? 'ring-2 ring-white/80 bg-[#303030]'
                  : 'bg-[#303030]'
              }`}
              title="Abrir perfil · botão direito para opções"
            >
              {avatar?<img src={avatar} alt={voiceName(participant)} className="ct-voice-avatar"/>:voiceName(participant).charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      )}

      {/* Badges no canto inferior esquerdo */}
      <div
        onClick={() => onProfile(participant)}
        className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/75 px-3 py-1.5 rounded-xl text-xs border border-white/10 shadow-lg cursor-pointer hover:bg-black/90 transition"
        title="Abrir perfil · botão direito para opções"
      >
        <span className="font-bold text-white tracking-wide"><RoleName identity={participant.identity} name={voiceName(participant)}/></span>
        {participant.isLocal && (
          <span className="text-[10px] bg-neutral-950/80 border border-neutral-700/50 text-neutral-300 px-1.5 py-0.5 rounded font-medium">
            você
          </span>
        )}
        {(!participant.isAudioEnabled||userVolume===0) && (
          <span className="text-red-400 text-xs ml-1" title="Microfone Desativado">
            <ControlIcon name="speaker" slashed/>
          </span>
        )}
        {participant.isSpeaking && (
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
        )}
      </div>

      {/* Botões de Ação no Canto Superior Direito */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {participant.isScreenShareEnabled && participant.screenTrack && (
          <button
            onClick={onViewScreen}
            className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold px-3 py-1 rounded-xl shadow-lg flex items-center gap-1.5 transition cursor-pointer"
            title="Ver transmissão de tela"
          >
            <span className="w-2 h-2 rounded-full bg-white" />
            AO VIVO
          </button>
        )}

        <button
          onClick={onMaximize}
          className="opacity-0 group-hover:opacity-100 bg-black/80 hover:bg-black text-neutral-200 hover:text-white p-2 rounded-xl border border-neutral-500/40 transition text-xs font-semibold shadow-lg cursor-pointer"
          title={isMaximized ? 'Restaurar grade' : 'Maximizar participante (Focar)'}
        >
          <ControlIcon name={isMaximized ? 'shrink' : 'expand'}/>
        </button>
      </div>
    </div>
  )
}

export function VoiceStage({
  showMemberList,
  onToggleMemberList,
  onProfile,
  onParticipantMenu,
}: {
  showMemberList?: boolean
  onToggleMemberList?: () => void
  onProfile:(participant:VoiceParticipant)=>void
  onParticipantMenu:(participant:VoiceParticipant,event:React.MouseEvent)=>void
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
    userVolumes,
  } = useVoiceStore()

  // Telas compartilhadas ativas
  const screenShares = participants.filter((p) => p.isScreenShareEnabled && p.screenTrack)

  // Modo de exibição: 'grid' (grade lado a lado) ou 'spotlight' (foco em 1 tela)
  const [stageViewMode, setStageViewMode] = useState<'grid' | 'spotlight'>('grid')
  const [spotlightScreenId, setSpotlightScreenId] = useState<string | null>(null)
  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null)

  // Popup de Volume e Modal de Transmissão de Tela
  const stageRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  // null acompanha todas as transmissões, inclusive as que começam depois.
  const [selectedScreens, setSelectedScreens] = useState<string[] | null>(null)
  const [fullscreenError, setFullscreenError] = useState('')
  const visibleScreens = selectedScreens === null
    ? screenShares
    : screenShares.filter(p => selectedScreens.includes(p.identity))

  useEffect(() => {
    const changed = () => setIsFullscreen(document.fullscreenElement === stageRef.current)
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])
  const shareIds = screenShares.map(p => p.identity).join('\n')
  useEffect(() => {
    // Se todas as telas escolhidas pararem, acompanha as restantes.
    setSelectedScreens(current => current && !current.some(id => screenShares.some(p => p.identity === id)) ? null : current)
  }, [shareIds])
  const openFullscreen = async (identity: string) => {
    setSelectedScreens([identity])
    setFullscreenError('')
    try { await stageRef.current?.requestFullscreen() }
    catch { setFullscreenError('Não foi possível abrir a tela cheia. Tente novamente.') }
  }
  const exitFullscreen = async () => {
    try { await document.exitFullscreen() }
    catch { setFullscreenError('Não foi possível sair da tela cheia. Pressione Esc.') }
  }

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
    <div ref={stageRef} data-sharing-count={screenShares.length} className="ct-voice-stage flex-1 flex flex-col h-full relative overflow-hidden select-none min-w-0">
      {isFullscreen ? <>
        <header className="ct-fullscreen-toolbar">
          <strong>Transmissões · {visibleScreens.length} de {screenShares.length}</strong>
          <details className="ct-stream-picker">
            <summary>Selecionar transmissões</summary>
            <div className="ct-stream-picker-options">
              <button onClick={() => setSelectedScreens(null)}>Ver todas</button>
              {screenShares.map(p => <label key={p.identity}>
                <input type="checkbox" checked={selectedScreens === null || selectedScreens.includes(p.identity)}
                  disabled={visibleScreens.length === 1 && visibleScreens[0].identity === p.identity}
                  onChange={e => setSelectedScreens(e.target.checked
                    ? [...(selectedScreens ?? screenShares.map(s => s.identity)), p.identity]
                    : (selectedScreens ?? screenShares.map(s => s.identity)).filter(id => id !== p.identity))}/>
                {voiceName(p)}{p.isLocal ? ' (você)' : ''}
              </label>)}
            </div>
          </details>
          <button onClick={() => void exitFullscreen()}>Sair da tela cheia <kbd>Esc</kbd></button>
        </header>
        <div className="ct-fullscreen-content">
          {visibleScreens.length ? <div className="ct-stream-grid" data-count={visibleScreens.length} style={{gridTemplateRows: `repeat(${Math.ceil(visibleScreens.length / 2)}, minmax(120px, 1fr))`}}>
            {visibleScreens.map(p => <div key={p.identity} className="ct-stream-cell"><ScreenShareViewer participant={p}/></div>)}
          </div> : <p className="ct-stream-ended" role="status">As transmissões foram encerradas.</p>}
        </div>
      </> : <>
      {/* Header do palco de voz estilo Discord */}
      <header className="ct-voice-toolbar">
        {/* Canto direito do Header: Controles de Grade/Foco, Contador e Membros */}
        <div className="flex items-center gap-3">
          {/* Seletor Grade vs Foco quando há telas compartilhadas */}
          {screenShares.length > 0 && (
            <div className="flex items-center bg-[#0f0f0f] p-0.5 rounded-xl border border-neutral-900/40">
              <button
                onClick={() => setStageViewMode('grid')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  stageViewMode === 'grid'
                    ? 'bg-white text-black!'
                    : 'text-neutral-300 hover:text-white'
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
                    ? 'bg-white text-black!'
                    : 'text-neutral-300 hover:text-white'
                }`}
                title="Focar em uma tela única"
              >
                <ControlIcon name="expand"/>
                <span>Modo Foco</span>
              </button>
            </div>
          )}

          <span className="text-xs text-neutral-300/80 font-medium hidden sm:inline">
            {participants.length} {participants.length === 1 ? 'participante' : 'participantes'}
          </span>

          {onToggleMemberList && (
            <button
              onClick={onToggleMemberList}
              className={`p-1.5 rounded-xl border transition text-xs flex items-center gap-1.5 font-bold ${
                showMemberList
                  ? 'bg-white border-white text-black'
                  : 'bg-[#161616] border-neutral-900/40 text-neutral-300 hover:text-white hover:border-neutral-500/40'
              }`}
              title="Mostrar/Ocultar lista de membros do servidor"
            >
              <ControlIcon name="friends"/>
              <span className="hidden md:inline">Membros</span>
            </button>
          )}
        </div>
      </header>

      {/* Área Central: Grade Multi-Telas / Transmissão em Foco / Grade de Usuários */}
      <div className="ct-voice-content flex-1 overflow-hidden flex flex-col justify-center min-h-0">
        {connectionStatus === 'connecting' ? (
          <div className="text-center text-neutral-300/70 space-y-3 m-auto">
            <ControlIcon name="audio" size={28}/>
            <p className="text-white font-medium text-base">Conectando à sala de voz...</p>
            <p className="text-xs text-neutral-400/60">Conectando à chamada</p>
          </div>
        ) : connectionStatus === 'disconnected' || error ? (
          <div className="text-center space-y-4 max-w-sm p-6 bg-[#181818] rounded-3xl border border-white/5 m-auto">
            <span className="text-red-400"><ControlIcon name="warning" size={28}/></span>
            <div>
              <h3 className="text-white font-bold mb-1">Não foi possível conectar</h3>
              <p className="text-xs text-red-400 break-words">{error || 'A conexão foi encerrada'}</p>
            </div>
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-neutral-200 text-black! font-medium rounded-full text-sm transition-all"
            >
              <ControlIcon name="refresh"/> Tentar novamente
            </button>
          </div>
        ) : participants.length === 0 ? (
          <div className="text-center text-neutral-300/70 space-y-2 m-auto">
            <ControlIcon name="mic" size={28}/>
            <p className="text-white font-medium">Você está na sala!</p>
            <p className="text-xs text-neutral-400/60">Aguardando outros participantes entrarem...</p>
          </div>
        ) : screenShares.length > 0 && stageViewMode === 'grid' ? (
          /* ═══════════════════════════════════════════════════════════════════ */
          /* MODO GRADE DE TELAS (EXIBE 2 OU MAIS TELAS LADO A LADO!)           */
          /* ═══════════════════════════════════════════════════════════════════ */
          <div className="ct-share-layout flex-1 flex flex-col min-h-0 w-full h-full">
            <div
              className="ct-stream-grid"
              data-count={screenShares.length}
            >
              {screenShares.map((p) => (
                <div key={p.identity} className="ct-stream-cell">
                  <ScreenShareViewer
                    participant={p}
                    onFullscreen={() => void openFullscreen(p.identity)}
                    onFocus={() => {
                      setSpotlightScreenId(p.identity)
                      setStageViewMode('spotlight')
                    }}
                    isSpotlight={false}
                  />
                </div>
              ))}
            </div>


          </div>
        ) : screenShares.length > 0 && stageViewMode === 'spotlight' && focusedScreen ? (
          /* ═══════════════════════════════════════════════════════════════════ */
          /* MODO FOCO (SPOTLIGHT EM UMA TELA ESPECÍFICA)                        */
          /* ═══════════════════════════════════════════════════════════════════ */
          <div className="flex-1 flex flex-col gap-3 min-h-0 w-full max-w-6xl mx-auto h-full">
            <ScreenShareViewer
              participant={focusedScreen}
              onFullscreen={() => void openFullscreen(focusedScreen.identity)}
              onMinimize={() => setStageViewMode('grid')}
              isSpotlight={true}
            />


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
                onProfile={onProfile} onParticipantMenu={onParticipantMenu}
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
                    className={`relative h-20 aspect-video rounded-2xl overflow-hidden bg-[#181818] flex-shrink-0 flex items-center justify-center transition cursor-pointer hover:scale-105 shadow-md ${
                      isCurrent
                        ? 'ring-3 ring-neutral-500 border border-neutral-400'
                        : p.isSpeaking
                        ? 'ring-2 ring-green-500'
                        : 'border border-neutral-900/40'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#303030] flex items-center justify-center text-white font-bold text-sm shadow">
                      {voiceName(p).charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute bottom-1 left-1 bg-black/75 px-1.5 py-0.5 rounded text-[10px] text-white">
                      {voiceName(p)}
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
                  onProfile={onProfile} onParticipantMenu={onParticipantMenu}
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
      </>}

      {fullscreenError && <p role="alert">{fullscreenError}</p>}
      {screenShareError && <div role="alert" className="mx-4 mb-2 rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-200">{screenShareError}</div>}


    </div>
  )
}
