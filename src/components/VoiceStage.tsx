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
      if (el.readyState >= 2) onReady?.()
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
      onCanPlay={onReady}
      onPlaying={onReady}
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
  onExit,
  isSpotlight = false,
  isTheater = false,
  onFullscreen,
  objectFit = 'cover',
  onToggleObjectFit,
  watching = true,
  onToggleWatch,
  showMemberList,
  onToggleMemberList,
}: {
  participant: VoiceParticipant
  onFocus?: () => void
  onMinimize?: () => void
  onExit?: () => void
  isSpotlight?: boolean
  isTheater?: boolean
  onFullscreen?: () => void
  objectFit?: 'contain' | 'cover'
  onToggleObjectFit?: () => void
  watching?: boolean
  onToggleWatch?: () => void
  showMemberList?: boolean
  onToggleMemberList?: () => void
}) {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(false), [participant.screenTrack, watching])

  return (
    <div
      onDoubleClick={onFocus || onMinimize}
      className={`ct-share-view relative flex-1 w-full h-full overflow-hidden flex flex-col items-center justify-center group min-h-0 select-none ${isTheater ? 'ct-theater-view' : ''}`}
    >
      {watching && participant.screenTrack && (
        <VideoTrackView
          track={participant.screenTrack}
          isLocal={participant.isLocal}
          className={`ct-share-video w-full h-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain'}`}
          onReady={() => setReady(true)}
        />
      )}
      {!watching ? (
        <div className="flex flex-col items-center gap-2 text-neutral-400">
          <ControlIcon name="screen" size={24} />
          <span className="text-xs">Transmissão fechada</span>
        </div>
      ) : !ready && (
        <div className="ct-share-waiting">
          <span><ControlIcon name="screen"/></span>
          <strong>Aguardando transmissão</strong>
          <p>A tela de {voiceName(participant)} aparecerá aqui assim que os primeiros quadros chegarem.</p>
        </div>
      )}
      {/* Top Header Overlay */}
      <div className="ct-share-header">
        <div className="ct-share-label">
          <span className="flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md shadow">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            AO VIVO
          </span>
          <span
            data-profile-identity={participant.identity}
            data-profile-name={voiceName(participant)}
            title="Botão direito para opções da pessoa"
            className="text-white text-xs font-semibold tracking-wide"
          >
            {participant.isLocal ? 'Sua Transmissão de Tela' : `Tela de ${voiceName(participant)}`}
          </span>
        </div>

        <div className="ct-share-tools">
          {onExit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onExit()
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              className="bg-black/80 hover:bg-red-950/80 hover:border-red-500/50 text-neutral-200 hover:text-red-200 px-2.5 py-1 rounded-xl border border-neutral-500/30 text-xs font-semibold transition shadow-md flex items-center gap-1.5 cursor-pointer"
              title="Sair da transmissão (voltar aos participantes)"
              aria-label="Sair da transmissão"
            >
              <ControlIcon name="close" size={13} />
              <span>Sair da transmissão</span>
            </button>
          )}
          {onToggleWatch && (
            <button
              type="button"
              onClick={onToggleWatch}
              onDoubleClick={event => event.stopPropagation()}
              aria-label={watching ? `Parar de assistir à transmissão de ${voiceName(participant)}` : `Assistir transmissão de ${voiceName(participant)}`}
            >
              <ControlIcon name={watching ? 'close' : 'play'} size={13} />
              <span>{watching ? 'Fechar' : 'Assistir'}</span>
            </button>
          )}
          {onToggleObjectFit && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleObjectFit()
              }}
              className="bg-black/80 hover:bg-black text-neutral-200 px-2.5 py-1 rounded-xl border border-neutral-500/30 text-xs font-semibold transition shadow-md flex items-center gap-1.5 cursor-pointer"
              title={objectFit === 'contain' ? 'Preencher toda a tela (sem barras)' : 'Ajustar à tela (proporção original)'}
              aria-label={objectFit === 'contain' ? 'Preencher tela' : 'Ajustar proporção'}
            >
              <ControlIcon name={objectFit === 'contain' ? 'expand' : 'shrink'} size={14} />
              <span>{objectFit === 'contain' ? 'Preencher' : 'Ajustar'}</span>
            </button>
          )}

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
              title="Maximizar esta tela (Modo Teatro)"
            >
              <ControlIcon name="screen" size={13} />
              <span>Modo Teatro</span>
            </button>
          )}

          {onToggleMemberList && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleMemberList()
              }}
              className={`px-2.5 py-1 rounded-xl border text-xs font-semibold transition shadow-md flex items-center gap-1.5 cursor-pointer ${
                showMemberList
                  ? 'bg-white text-black border-white'
                  : 'bg-black/80 hover:bg-black text-neutral-200 border-neutral-500/30'
              }`}
              title="Mostrar/Ocultar lista de membros"
              aria-label="Membros"
            >
              <ControlIcon name="friends" size={13} />
              <span>Membros</span>
            </button>
          )}

          {onFullscreen && (
            <button
              onClick={onFullscreen}
              className="bg-black/80 hover:bg-black text-neutral-200 p-1.5 rounded-xl border border-neutral-500/30 text-xs font-semibold transition shadow-md cursor-pointer"
              title="Tela cheia (F11)"
              aria-label={`Tela cheia: ${voiceName(participant)}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M16 21h5v-5"/></svg>
            </button>
          )}
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
  const voice = useVoiceStore()
  const {
    activeChannelId,
    activeChannelName,
    participants,
    connectionStatus,
    error,
    screenShareError,
    joinChannel,
    userVolumes,
  } = voice

  // Telas compartilhadas ativas
  const screenShares = participants.filter((p) => p.isScreenShareEnabled && p.screenTrack)

  const gridTracks = voice.gridScreenTracks
  const inGrid = gridTracks !== null
  const [objectFit, setObjectFit] = useState<'contain' | 'cover'>(() => {
    try {
      return (localStorage.getItem('contalk:stream-object-fit') as 'contain' | 'cover') || 'cover'
    } catch {
      return 'cover'
    }
  })
  const [spotlightScreenId, setSpotlightScreenId] = useState<string | null>(null)
  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null)
  const [isWatchingStream, setIsWatchingStream] = useState(true)
  const prevShareCountRef = useRef(screenShares.length)

  const handleToggleObjectFit = () => {
    setObjectFit(fit => {
      const next = fit === 'contain' ? 'cover' : 'contain'
      try {
        localStorage.setItem('contalk:stream-object-fit', next)
      } catch {}
      return next
    })
  }

  useEffect(() => {
    if (prevShareCountRef.current === 0 && screenShares.length > 0) {
      setIsWatchingStream(true)
    }
    prevShareCountRef.current = screenShares.length
  }, [screenShares.length])

  const openGrid = () => {
    setIsWatchingStream(true)
    if (!inGrid) voice.setGridScreenTracks(new Set())
  }
  const openTheater = (identity: string) => {
    setSpotlightScreenId(identity)
    voice.setGridScreenTracks(null)
    setIsWatchingStream(true)
  }
  const exitStream = () => {
    setIsWatchingStream(false)
    voice.setGridScreenTracks(null)
  }
  const toggleGridScreen = (track: Track) => {
    const next = new Set(useVoiceStore.getState().gridScreenTracks)
    if (next.has(track)) next.delete(track)
    else next.add(track)
    voice.setGridScreenTracks(next)
  }
  // Popup de Volume e Modal de Transmissão de Tela
  const stageRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedScreens, setSelectedScreens] = useState<string[] | null>(null)
  const [fullscreenError, setFullscreenError] = useState('')
  const fullscreenScreens = gridTracks ? screenShares.filter(p => gridTracks.has(p.screenTrack!)) : screenShares
  const visibleScreens = selectedScreens === null
    ? fullscreenScreens
    : fullscreenScreens.filter(p => selectedScreens.includes(p.identity))

  useEffect(() => {
    const changed = () => setIsFullscreen(document.fullscreenElement === stageRef.current)
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])
  const shareIds = fullscreenScreens.map(p => p.identity).join('\n')
  useEffect(() => {
    // Se todas as telas escolhidas pararem, acompanha as restantes.
    setSelectedScreens(current => current && !current.some(id => fullscreenScreens.some(p => p.identity === id)) ? null : current)
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
  const focusedScreen = isWatchingStream
    ? ((spotlightScreenId && screenShares.find((p) => p.identity === spotlightScreenId)) ||
       (screenShares.length > 0 ? screenShares[0] : null))
    : null

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
    <div
      ref={stageRef}
      data-sharing-count={screenShares.length}
      data-view-mode={inGrid ? 'grid' : 'theater'}
      className={`ct-voice-stage flex-1 flex flex-col h-full relative overflow-hidden select-none min-w-0 ${screenShares.length > 0 && isWatchingStream ? 'has-screenshare' : ''} ${!inGrid && screenShares.length > 0 && isWatchingStream ? 'ct-theater-active' : ''}`}
    >
      {isFullscreen ? <>
        <header className="ct-fullscreen-toolbar">
          <strong>Transmissões · {visibleScreens.length} de {fullscreenScreens.length}</strong>
          <details className="ct-stream-picker">
            <summary>Selecionar transmissões</summary>
            <div className="ct-stream-picker-options">
              <button onClick={() => setSelectedScreens(null)}>Ver todas</button>
              {fullscreenScreens.map(p => <label key={p.identity}>
                <input type="checkbox" checked={selectedScreens === null || selectedScreens.includes(p.identity)}
                  disabled={visibleScreens.length === 1 && visibleScreens[0].identity === p.identity}
                  onChange={e => setSelectedScreens(e.target.checked
                    ? [...(selectedScreens ?? fullscreenScreens.map(s => s.identity)), p.identity]
                    : (selectedScreens ?? fullscreenScreens.map(s => s.identity)).filter(id => id !== p.identity))}/>
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
          {/* Seletor Grade vs Foco quando há telas compartilhadas e estamos assistindo */}
          {screenShares.length > 0 && isWatchingStream && (
            <div className="flex items-center bg-[#0f0f0f] p-0.5 rounded-xl border border-neutral-900/40">
              <button
                onClick={openGrid}
                aria-pressed={inGrid}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  inGrid
                    ? 'bg-white text-black!'
                    : 'text-neutral-300 hover:text-white'
                }`}
                title="Escolher transmissões na grade"
              >
                <span>⊞</span>
                <span>Modo Grade {screenShares.length > 1 ? `(${screenShares.length})` : ''}</span>
              </button>
              <button
                onClick={() => openTheater(focusedScreen?.identity ?? screenShares[0].identity)}
                aria-pressed={!inGrid}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  !inGrid
                    ? 'bg-white text-black!'
                    : 'text-neutral-300 hover:text-white'
                }`}
                title="Modo Teatro (tela dedicada sem bordas)"
              >
                <ControlIcon name="screen" size={13}/>
                <span>Modo Teatro</span>
              </button>
              <button
                onClick={exitStream}
                className="px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 text-neutral-400 hover:text-red-400 hover:bg-white/5 cursor-pointer ml-0.5"
                title="Sair da transmissão (voltar aos participantes)"
                aria-label="Sair da transmissão"
              >
                <ControlIcon name="close" size={12}/>
                <span>Sair</span>
              </button>
            </div>
          )}

          {/* Botão para voltar a assistir quando tiver saído da transmissão */}
          {screenShares.length > 0 && !isWatchingStream && (
            <button
              onClick={() => {
                setIsWatchingStream(true)
                openTheater(screenShares[0].identity)
              }}
              className="px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 bg-red-600/90 hover:bg-red-600 text-white shadow-sm border border-red-500/40 cursor-pointer"
              title="Voltar a assistir à transmissão de tela"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>Assistir transmissão {screenShares.length > 1 ? `(${screenShares.length})` : ''}</span>
            </button>
          )}

          <button
            onClick={() => void voice.toggleScreenShare()}
            disabled={connectionStatus !== 'connected' || voice.currentRoom?.localParticipant.canStream === false}
            className={`p-1.5 rounded-xl border transition text-xs flex items-center gap-1.5 font-bold ${
              voice.isScreenSharing
                ? 'bg-red-600 border-red-500 text-white'
                : 'bg-[#161616] border-neutral-900/40 text-neutral-300 hover:text-white hover:border-neutral-500/40'
            }`}
            title={voice.isScreenSharing ? 'Parar transmissão de tela' : 'Compartilhar tela nesta chamada'}
          >
            <ControlIcon name="screen" size={14}/>
            <span className="hidden md:inline">{voice.isScreenSharing ? 'Parar Tela' : 'Transmitir'}</span>
          </button>

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
      <div className={`ct-voice-content flex-1 overflow-hidden flex flex-col min-h-0 w-full h-full ${screenShares.length > 0 && isWatchingStream ? 'p-0! m-0! justify-stretch' : 'justify-center'}`}>
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
        ) : isWatchingStream && gridTracks && screenShares.length > 0 ? (
          /* ═══════════════════════════════════════════════════════════════════ */
          /* MODO GRADE: TRANSMISSÕES DE TELA LADO A LADO                       */
          /* ═══════════════════════════════════════════════════════════════════ */
          <div className="ct-share-layout flex-1 flex flex-col min-h-0 w-full h-full">
            <div
              className="ct-stream-grid"
              data-count={screenShares.length}
            >
              {screenShares.map(p => {
                const track = p.screenTrack!
                const watching = gridTracks.has(track)
                return (
                  <div key={p.identity} className="ct-stream-cell">
                    <ScreenShareViewer
                      participant={p}
                      watching={watching}
                      onToggleWatch={() => toggleGridScreen(track)}
                      onExit={exitStream}
                      onFullscreen={watching ? () => void openFullscreen(p.identity) : undefined}
                      onFocus={watching ? () => openTheater(p.identity) : undefined}
                      objectFit={objectFit}
                      onToggleObjectFit={watching ? handleToggleObjectFit : undefined}
                      showMemberList={showMemberList}
                      onToggleMemberList={onToggleMemberList}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ) : isWatchingStream && screenShares.length > 0 && focusedScreen ? (
          /* ═══════════════════════════════════════════════════════════════════ */
          /* MODO TEATRO PADRÃO: TRANSMISSÃO OCUPANDO TODO O ESPAÇO SEM BORDAS  */
          /* ═══════════════════════════════════════════════════════════════════ */
          <div className="ct-theater-stage flex-1 flex flex-col min-h-0 w-full h-full relative overflow-hidden select-none bg-black">
            <ScreenShareViewer
              participant={focusedScreen}
              onFullscreen={() => void openFullscreen(focusedScreen.identity)}
              onMinimize={screenShares.length > 1 ? openGrid : undefined}
              onExit={exitStream}
              isSpotlight={true}
              isTheater={true}
              objectFit={objectFit}
              onToggleObjectFit={handleToggleObjectFit}
              showMemberList={showMemberList}
              onToggleMemberList={onToggleMemberList}
            />
            {screenShares.length > 1 && (
              <div className="ct-theater-thumbs">
                {screenShares.map(p => (
                  <button
                    key={p.identity}
                    className={`ct-theater-thumb ${p.identity === focusedScreen.identity ? 'active' : ''}`}
                    onClick={() => setSpotlightScreenId(p.identity)}
                    title={`Assistir transmissão de ${voiceName(p)}`}
                  >
                    <VideoTrackView track={p.screenTrack!} isLocal={p.isLocal} className="w-full h-full object-cover" />
                    <span>{voiceName(p)}</span>
                  </button>
                ))}
              </div>
            )}
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
                onViewScreen={() => openTheater(pinnedParticipant.identity)}
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
                  onViewScreen={() => openTheater(p.identity)}
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
