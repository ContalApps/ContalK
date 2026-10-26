import { priorityAudioGain } from '../media/priority-audio'
import type { VoiceInputMode } from '../media/voice-input'
import { useRoleStore } from './useRoleStore'
import { create } from 'zustand'
import { publishSafeMicrophone, setSafeMicrophoneEnabled } from '../media/microphone'
import { centralAllows, centralEnabled, centralOccupants, centralVoiceToken } from '../roles/transport'
import { startScreenShare, stopScreenShare } from '../media/screenShare'
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  Participant,
  ParticipantEvent,
} from '../media/realtime'

function readAvatar(metadata?: string) { try { const value = JSON.parse(metadata || '{}').avatar; return typeof value === 'string' && value.length < 50000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value) ? value : undefined } catch { return undefined } }

export interface VoiceParticipant {
  identity: string
  name: string
  avatar?: string
  serverNickname?:string|null
  isPrioritySpeaker?:boolean
  serverMuted?: boolean
  serverDeafened?: boolean
  isLocal: boolean
  isSpeaking: boolean
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  isScreenShareEnabled: boolean
  videoTrack?: Track | null // Câmera / Webcam
  screenTrack?: Track | null // Compartilhamento de Tela
}

interface VoiceState {
  prioritySpeaker:boolean
  selectInputPriority:(enabled:boolean)=>Promise<void>
  inputMode:VoiceInputMode
  voiceInputError:string|null
  voiceInputState:'idle'|'starting'|'global'|'focused'
  selectInputMode:(mode:VoiceInputMode)=>Promise<void>
  pushToTalk:(pressed:boolean)=>Promise<void>
  currentRoom: Room | null
  activeChannelId: string | null
  activeChannelName: string | null
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  outputDeviceId: string
  selectOutput: (deviceId:string)=>Promise<void>
  microphoneDeviceId: string
  microphoneLabel: string
  microphoneError: string | null
  micMutedBeforeDeafen: boolean
  selectMicrophone: (deviceId: string) => Promise<void>
  isServerMuted: boolean
  isServerDeafened: boolean
  isMicMuted: boolean
  isDeafened: boolean
  isCameraOn: boolean
  isScreenSharing: boolean
  participants: VoiceParticipant[]
  activeSpeakers: string[]
  error: string | null
  screenShareError: string | null
  profileError: string | null
  userVolumes: Record<string, number>
  streamVolumes: Record<string, number>
  channelOccupants: Record<string, VoiceParticipant[]>

  // Actions
  joinChannel: (channelId: string, channelName: string, user: { username: string; display_name: string; avatar?: string }, move?: {authority:{url:string;token:string};serverId:string;preserveMicMuted:boolean;preserveDeafened:boolean}) => Promise<boolean>
  leaveChannel: () => Promise<void>
  renameActiveChannel:(id:string,name:string)=>void
  refreshParticipants: () => void
  setUserVolume: (identity: string, volume: number) => void
  setStreamVolume: (identity: string, volume: number) => void
  fetchChannelOccupants: (channelList: Array<{ id: string; name: string }>) => Promise<void>
  toggleMic: () => Promise<void>
  toggleDeafen: () => Promise<void>
  toggleCamera: () => Promise<void>
  toggleScreenShare: () => Promise<void>
  startScreenShareWithOptions: (
    source: any,
    options: { audio: boolean; fps: number; resolution: string }
  ) => Promise<void>
}

function voicePlaybackLevel(state:VoiceState,identity:string,source:string,deafened=state.isDeafened||state.isServerDeafened){
  const volume=(source===Track.Source.ScreenShareAudio?state.streamVolumes:state.userVolumes)[identity]??100,priority=state.currentRoom?.prioritySpeakers
  return priorityAudioGain(volume,deafened,source===Track.Source.Microphone,!!priority?.size,priority?.has(identity)===true)
}

function getAudioContainer(): HTMLElement {
  let el = document.getElementById('contalk-audio-tracks')
  if (!el) {
    el = document.createElement('div')
    el.id = 'contalk-audio-tracks'
    el.style.display = 'none'
    document.body.appendChild(el)
  }
  return el
}

let connectionGeneration = 0
let pendingRoom: Room | null = null
const speakingCleanup=new WeakMap<Room,()=>void>()
let occupantsGeneration = 0

const initialUserVolumes: Record<string, number> = (() => {
  try {
    const saved = localStorage.getItem('contalk_user_volumes')
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
})()
const initialStreamVolumes: Record<string, number> = (() => {
  try { return JSON.parse(localStorage.getItem('contalk_stream_volumes') || '{}') } catch { return {} }
})()
const clampVolume = (volume: number) => Math.min(200, Math.max(0, Number.isFinite(volume) ? volume : 100))

export const useVoiceStore = create<VoiceState>((set, get) => ({
  prioritySpeaker:false,
  selectInputPriority:async enabled=>{const room=get().currentRoom;set({prioritySpeaker:enabled,...(room?{isMicMuted:true}:{})});if(room){room.prioritySpeaker=enabled;await room.setPushToTalk(false).catch(()=>{});if(get().currentRoom===room)get().refreshParticipants()}},
  inputMode:'voice-activity',voiceInputError:null,voiceInputState:'idle',
  selectInputMode:async mode=>{
    const room=get().currentRoom
    set({inputMode:mode,voiceInputError:null,...(room?{isMicMuted:true}:{})})
    if(room){try{await room.setInputMode(mode);get().refreshParticipants()}catch(error){if(get().currentRoom===room)set({voiceInputError:error instanceof Error?error.message:'Não foi possível alterar o modo de entrada.'});throw error}}
  },
  pushToTalk:async pressed=>{
    const state=get(),room=state.currentRoom
    if(!room||room.inputMode!=='push-to-talk')return
    const active=pressed&&state.connectionStatus==='connected'&&!state.isMicMuted&&!state.isDeafened&&!state.isServerMuted&&!state.isServerDeafened
    try{await room.setPushToTalk(active);if(get().currentRoom===room)get().refreshParticipants()}catch(error){if(get().currentRoom===room){await room.setPushToTalk(false).catch(()=>{});if(get().currentRoom!==room)return;set({isMicMuted:true,voiceInputError:error instanceof Error?error.message:'O atalho de voz foi interrompido.'});get().refreshParticipants()}}
  },
  currentRoom: null,
  activeChannelId: null,
  activeChannelName: null,
  connectionStatus: 'disconnected',
  outputDeviceId: localStorage.getItem('contalk-output-id') || 'default',
  selectOutput: async deviceId => {
    const room=get().currentRoom
    if(room && !await room.switchActiveDevice('audiooutput',deviceId))throw new Error('Não foi possível trocar a saída de áudio.')
    localStorage.setItem('contalk-output-id',deviceId);set({outputDeviceId:deviceId})
  },
  microphoneDeviceId: localStorage.getItem('contalk-microphone-id') || '',
  microphoneLabel: '',
  microphoneError: null,
  micMutedBeforeDeafen: false,
  isServerMuted: false,
  isServerDeafened: false,
  isMicMuted: false,
  isDeafened: false,
  isCameraOn: false,
  isScreenSharing: false,
  participants: [],
  activeSpeakers: [],
  error: null,
  screenShareError: null,
  profileError: null,
  userVolumes: initialUserVolumes,
  streamVolumes: initialStreamVolumes,
  channelOccupants: {},

  setUserVolume: (identity: string, volume: number) => {
    const { currentRoom, userVolumes } = get()
    volume = Math.min(200, Math.max(0, Number.isFinite(volume) ? volume : 100))
    const nextVolumes = { ...userVolumes, [identity]: volume }
    set({ userVolumes: nextVolumes })
    try {
      localStorage.setItem('contalk_user_volumes', JSON.stringify(nextVolumes))
    } catch {}

    if (currentRoom) {
      const remote = currentRoom.remoteParticipants.get(identity)
      if (remote) {
        remote.audioTrackPublications.forEach((pub) => {
          if (pub.source !== Track.Source.ScreenShareAudio && pub.audioTrack && 'setVolume' in pub.audioTrack) {
            pub.audioTrack.setVolume(voicePlaybackLevel(get(),identity,pub.source))
          }
        })
      }
    }
  },

  setStreamVolume: (identity, volume) => {
    volume = clampVolume(volume)
    const streamVolumes = { ...get().streamVolumes, [identity]: volume }
    set({ streamVolumes })
    try { localStorage.setItem('contalk_stream_volumes', JSON.stringify(streamVolumes)) } catch { /* Still applies for this call. */ }
    get().currentRoom?.remoteParticipants.get(identity)?.audioTrackPublications.forEach(pub => {
      if (pub.source === Track.Source.ScreenShareAudio && pub.audioTrack && 'setVolume' in pub.audioTrack) pub.audioTrack.setVolume((get().isDeafened||get().isServerDeafened) ? 0 : volume / 100)
    })
  },

  fetchChannelOccupants: async () => {
    if(centralEnabled()){
      const attempt=++occupantsGeneration,authority=useRoleStore.getState(),serverId=authority.serverId,owner=authority.owner
      const current=()=>attempt===occupantsGeneration&&useRoleStore.getState().serverId===serverId&&useRoleStore.getState().owner===owner&&useRoleStore.getState().status==='connected'
      if(authority.status!=='connected')return
      try{const occupants=await centralOccupants();if(current())set({channelOccupants:{...occupants,...(get().activeChannelId?{[get().activeChannelId!]:get().participants}:{})}})}catch{if(current())set({channelOccupants:get().activeChannelId?{[get().activeChannelId!]:get().participants}:{}})}
      return
    }
    set({channelOccupants:get().activeChannelId?{[get().activeChannelId!]:get().participants}:{}})
  },

  renameActiveChannel:(id,name)=>{if(get().activeChannelId===id)set({activeChannelName:name})},
  refreshParticipants: () => {
    const { currentRoom } = get()
    if (!currentRoom || currentRoom.state !== 'connected') return

    const list: VoiceParticipant[] = []
    const local = currentRoom.localParticipant
    const outputChanged=get().isServerDeafened!==local.serverDeafened
    if(outputChanged)currentRoom.remoteParticipants.forEach(participant=>participant.audioTrackPublications.forEach(pub=>{pub.audioTrack?.setVolume(voicePlaybackLevel(get(),participant.identity,pub.source,get().isDeafened||local.serverDeafened))}))

    const localCamPub = local.getTrackPublication(Track.Source.Camera)
    const localScreenPub = local.getTrackPublication(Track.Source.ScreenShare)

    list.push({
      identity: local.identity,
      name: local.name || local.identity,
      avatar: readAvatar(local.metadata),
      isPrioritySpeaker:currentRoom.prioritySpeakers?.has(local.identity)===true,
      serverNickname:local.serverNickname,serverMuted:local.serverMuted,serverDeafened:local.serverDeafened,
      isLocal: true,
      isSpeaking: local.isSpeaking,
      isAudioEnabled: local.isMicrophoneEnabled,
      isVideoEnabled: local.isCameraEnabled && !!localCamPub?.track && !localCamPub.isMuted,
      isScreenShareEnabled: local.isScreenShareEnabled && !!localScreenPub?.track && !localScreenPub.isMuted,
      videoTrack: localCamPub?.track || null,
      screenTrack: localScreenPub?.track || null,
    })

    currentRoom.remoteParticipants.forEach((p) => {
      const camPub = p.getTrackPublication(Track.Source.Camera)
      const screenPub = p.getTrackPublication(Track.Source.ScreenShare)

      list.push({
        identity: p.identity,
        name: p.name || p.identity,
        avatar: readAvatar(p.metadata),
        isPrioritySpeaker:currentRoom.prioritySpeakers?.has(p.identity)===true,
        serverNickname:p.serverNickname,serverMuted:p.serverMuted,serverDeafened:p.serverDeafened,
        isLocal: false,
        isSpeaking: p.isSpeaking,
        isAudioEnabled: p.isMicrophoneEnabled,
        isVideoEnabled: p.isCameraEnabled && !!camPub?.track && !camPub.isMuted,
        isScreenShareEnabled: p.isScreenShareEnabled && !!screenPub?.track && !screenPub.isMuted,
        videoTrack: camPub?.track || null,
        screenTrack: screenPub?.track || null,
      })
    })

    set({
      isServerMuted:local.serverMuted,isServerDeafened:local.serverDeafened,
      participants: list,
      isScreenSharing: local.isScreenShareEnabled,
      isCameraOn: local.isCameraEnabled,
      isMicMuted: currentRoom.inputMode==='push-to-talk'&&local.getTrackPublication(Track.Source.Microphone)?get().isMicMuted:!local.isMicrophoneEnabled,
    })

    const activeId = get().activeChannelId
    if (activeId) {
      set((s) => ({
        channelOccupants: {
          ...s.channelOccupants,
          [activeId]: list,
        },
      }))
    }
  },

  joinChannel: async (channelId, channelName, user, move) => {
    const state = get()
    if (state.activeChannelId === channelId && ['connected','connecting','reconnecting'].includes(state.connectionStatus)) {
      return true
    }

    const attempt = ++connectionGeneration
    occupantsGeneration++
    const previous = state.currentRoom || pendingRoom
    pendingRoom = null
    if (previous) {
      speakingCleanup.get(previous)?.()
      previous.removeAllListeners()
      await stopScreenShare(previous).catch(() => {})
      await previous.disconnect().catch(() => {})
    }
    if (attempt !== connectionGeneration) return false
    getAudioContainer().innerHTML = ''
    set({ currentRoom: null, channelOccupants: Object.fromEntries(Object.entries(get().channelOccupants).map(([id, users]) => [id, users.filter(p => p.identity !== user.username)])) })

    set({
      isServerMuted:false,isServerDeafened:false,
      isDeafened:move?.preserveDeafened??get().isDeafened,
      connectionStatus: 'connecting',
      activeChannelId: channelId,
      activeChannelName: channelName,
      error: null,
      screenShareError: null,
      profileError: null,
      participants: [],
    })

    let room: Room | undefined
    try {
      // 1. Obter ticket de sessão autenticado.
      const authority=move?{...move.authority,serverId:move.serverId}:await centralVoiceToken(channelId)
      if (!authority) throw new Error('Sua conta ainda não está conectada à comunidade. Saia e entre novamente com a internet ligada.')
      const token = authority.token
      if (!token || typeof token !== 'string') {
        throw new Error('Não foi possível gerar um token de acesso para a sala.')
      }

      if (attempt !== connectionGeneration) return false
      // 2. Preparar os transportes WebRTC do servidor.
      const connection = new Room({
        serverId:authority.serverId,
        tokenProvider: () => centralVoiceToken(channelId,authority.serverId),
        inputMode:get().inputMode,prioritySpeaker:get().prioritySpeaker,
      })

      room = connection
      pendingRoom = connection
      const on = (event: RoomEvent, handler: (...args: any[]) => void) => connection.on(event, (...args: any[]) => { if (attempt === connectionGeneration) handler(...args) })
      const triggerUpdate = () => {
        get().refreshParticipants()
      }

      const localSpeakingChanged=()=>{if(attempt===connectionGeneration)triggerUpdate()}
      connection.localParticipant.on(ParticipantEvent.IsSpeakingChanged,localSpeakingChanged)
      const cleanupSpeaking=()=>{connection.localParticipant.off(ParticipantEvent.IsSpeakingChanged,localSpeakingChanged);speakingCleanup.delete(connection)}
      speakingCleanup.set(connection,cleanupSpeaking)
      connection.once(RoomEvent.Disconnected,cleanupSpeaking)

      // 3. Configurar eventos de conexão e mídia
      on(RoomEvent.Connected, () => {
        set({ connectionStatus: 'connected', currentRoom: connection, error: null })
        triggerUpdate()
      })

      on(RoomEvent.Reconnecting, () => {
        set({ connectionStatus: 'reconnecting' })
      })

      on(RoomEvent.Reconnected, () => {
        set({ connectionStatus: 'connected' })
        triggerUpdate()
      })

      on(RoomEvent.StageChanged,triggerUpdate)
      on(RoomEvent.PrioritySpeakersChanged,()=>{
        connection.remoteParticipants.forEach(participant=>participant.audioTrackPublications.forEach(pub=>pub.audioTrack?.setVolume(voicePlaybackLevel(get(),participant.identity,pub.source))));triggerUpdate()
      })
      on(RoomEvent.ServerModerationChanged,()=>{
        set({isServerMuted:connection.localParticipant.serverMuted,isServerDeafened:connection.localParticipant.serverDeafened})
        connection.remoteParticipants.forEach(participant=>participant.audioTrackPublications.forEach(pub=>{
          pub.audioTrack?.setVolume(voicePlaybackLevel(get(),participant.identity,pub.source))
        }));triggerUpdate()
      })
      on(RoomEvent.ServerMoved,data=>{void get().joinChannel(data.channelId,data.channelName,user,{authority:data.authority,serverId:data.serverId,preserveMicMuted:get().isMicMuted,preserveDeafened:get().isDeafened})})
      let moderatorDisconnected=false
      on(RoomEvent.ServerVoiceDisconnected,()=>{moderatorDisconnected=true})
      on(RoomEvent.ParticipantConnected, () => triggerUpdate())
      on(RoomEvent.ParticipantDisconnected, () => triggerUpdate())

      on(RoomEvent.TrackPublished, () => triggerUpdate())
      on(RoomEvent.TrackUnpublished, () => triggerUpdate())

      on(RoomEvent.LocalTrackPublished, (pub) => {
        if (pub.source === Track.Source.ScreenShare) {
          set({ isScreenSharing: true })
        }
        triggerUpdate()
      })

      on(RoomEvent.LocalTrackUnpublished, (pub) => {
        if (pub.source === Track.Source.ScreenShare) {
          set({ isScreenSharing: false })
        }
        triggerUpdate()
      })

      if(get().outputDeviceId!=='default')await connection.switchActiveDevice('audiooutput',get().outputDeviceId)
      on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const audioContainer = getAudioContainer()
          const element = track.attach()
          audioContainer.appendChild(element)

          const userVol = voicePlaybackLevel(get(),participant.identity,_pub.source)
          if (typeof (track as any).setVolume === 'function') {
            (track as any).setVolume(userVol)
          }
        }
        triggerUpdate()
      })

      on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el) => el.remove())
        triggerUpdate()
      })

      on(RoomEvent.ParticipantMetadataChanged, () => triggerUpdate())
      on(RoomEvent.TrackMuted, () => triggerUpdate())
      on(RoomEvent.TrackUnmuted, () => triggerUpdate())

      on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        const identities = speakers.map((s) => s.identity)
        set({ activeSpeakers: identities })
        triggerUpdate()
      })

      on(RoomEvent.Disconnected, () => {
        if (pendingRoom === connection) pendingRoom = null
        void stopScreenShare(connection)
        const audioContainer = getAudioContainer()
        audioContainer.innerHTML = ''
        const prevId = get().activeChannelId
        const remotes = get().participants.filter((p) => !p.isLocal)
        set((s) => ({
          currentRoom: null,

          connectionStatus: 'disconnected',
          activeChannelId:null,activeChannelName:null,
          isServerMuted:false,isServerDeafened:false,isDeafened:false,
          error: moderatorDisconnected?'Você foi desconectado da voz por um moderador.':'A conexão de voz foi encerrada. Tente novamente.',
          participants: [],
          activeSpeakers: [],
          isMicMuted: false,
          isCameraOn: false,
          isScreenSharing: false,
          channelOccupants: prevId ? { ...s.channelOccupants, [prevId]: remotes } : s.channelOccupants,
        }))
      })

      // 4. Conectar à sinalização e ao SFU da comunidade.
      await connection.connect(authority.url, token)
      if (attempt !== connectionGeneration) { await connection.disconnect(); return false }
      if (connection.state !== 'connected') throw new Error('A conexão de voz foi encerrada. Tente novamente.')
      try { await connection.localParticipant.setName(user.display_name); await connection.localParticipant.setMetadata(JSON.stringify({ avatar: user.avatar || '' })) }
      catch { if (attempt === connectionGeneration) set({profileError: 'Não foi possível sincronizar a foto. A chamada continua conectada.'}) }
      if (attempt !== connectionGeneration) { await connection.disconnect(); return false }

      // 5. Ativar microfone local se permitido
      if(!move?.preserveMicMuted&&!get().isDeafened&&!connection.localParticipant.serverMuted&&!connection.localParticipant.serverDeafened&&(connection.localParticipant.canPublishMicrophone??centralAllows('SPEAK',channelId)))try {
        const label = await publishSafeMicrophone(connection, get().microphoneDeviceId)
        if (attempt === connectionGeneration) set({ microphoneLabel: label, microphoneError: null })
      } catch (micErr) {
        if (attempt === connectionGeneration) set({ isMicMuted: true, microphoneError: micErr instanceof Error ? micErr.message : 'Não foi possível abrir o microfone. Escolha uma entrada em Configurações de áudio.' })
      }

      if (attempt !== connectionGeneration) { await connection.disconnect(); return false }
      if (connection.state !== 'connected') throw new Error('A conexão de voz foi encerrada. Tente novamente.')
      pendingRoom = null
      set({
        currentRoom: connection,
        connectionStatus: 'connected',
        isMicMuted: connection.inputMode==='push-to-talk'&&connection.localParticipant.getTrackPublication(Track.Source.Microphone)?move?.preserveMicMuted??false:!connection.localParticipant.isMicrophoneEnabled,
      })

      triggerUpdate()
      return true
    } catch (err: any) {
      if (room) { speakingCleanup.get(room)?.(); room.removeAllListeners(); await stopScreenShare(room).catch(() => {}); await room.disconnect().catch(() => {}) }
      if (pendingRoom === room) pendingRoom = null
      if (attempt !== connectionGeneration) return false
      getAudioContainer().innerHTML = ''
      set({
        currentRoom: null,
        connectionStatus: 'disconnected',
        isServerMuted:false,isServerDeafened:false,isDeafened:false,
        participants: [], isScreenSharing: false, isCameraOn: false, isMicMuted: true,
        channelOccupants: Object.fromEntries(Object.entries(get().channelOccupants).map(([id, users]) => [id, users.filter(p => p.identity !== user.username)])),
        error: /websocket|signal|connection refused/i.test(err?.message || '') ? 'Não foi possível conectar ao servidor de voz. Verifique o domínio de voz, HTTPS e WebSocket no Coolify.' : /ICE|peer connection/i.test(err?.message || '') ? 'O transporte de mídia falhou. Verifique as portas UDP/TCP e TURN da VPS.' : String(err?.message || 'Falha ao conectar ao servidor de voz.').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token removido]'),
      })
      return false
    }
  },

  leaveChannel: async () => {
    const attempt = ++connectionGeneration; occupantsGeneration++
    const { activeChannelId, participants } = get()
    const currentRoom = get().currentRoom || pendingRoom
    pendingRoom = null
    if(currentRoom)speakingCleanup.get(currentRoom)?.()
    currentRoom?.removeAllListeners()
    if (activeChannelId) {
      const remotes = participants.filter((p) => !p.isLocal)
      set((s) => ({
        channelOccupants: {
          ...s.channelOccupants,
          [activeChannelId]: remotes,
        },
      }))
    }
    if (currentRoom) {
      try {
        await stopScreenShare(currentRoom)
        await currentRoom.disconnect()
      } catch {
        // Disconnect silencioso
      }
    }
    if (attempt !== connectionGeneration) return
    const audioContainer = getAudioContainer()
    audioContainer.innerHTML = ''
    set({
      currentRoom: null,
      activeChannelId: null,
      activeChannelName: null,
      connectionStatus: 'disconnected',
      participants: [],
      activeSpeakers: [],
      isMicMuted: false,
      isDeafened: get().isDeafened,
      isServerMuted:false,isServerDeafened:false,
      isCameraOn: false,
      isScreenSharing: false,
      error: null,
    })
  },

  toggleMic: async () => {
    if(get().currentRoom?.localParticipant.canPublishMicrophone===false){set({microphoneError:get().currentRoom?.stage?.audience?'Peça a fala ou aceite um convite para entrar no palco.':'Seu microfone não está autorizado neste canal.'});return}
    if(get().isServerMuted||get().isServerDeafened){set({microphoneError:'Seu microfone está bloqueado pela moderação do servidor.'});return}
    if(get().isMicMuted&&!centralAllows('SPEAK',get().activeChannelId||undefined)){set({microphoneError:'Seu cargo não permite falar neste canal.'});return}
    const { currentRoom, isMicMuted, isDeafened } = get()
    if (!currentRoom) return
    if (isDeafened) return

    const nextMuted = !isMicMuted
    set({isMicMuted:nextMuted})
    try {
      const label = await setSafeMicrophoneEnabled(currentRoom, !nextMuted, get().microphoneDeviceId)
      set({ microphoneLabel: label, microphoneError: null })
      set({ isMicMuted: currentRoom.inputMode==='push-to-talk'?nextMuted:!currentRoom.localParticipant.isMicrophoneEnabled })
      get().refreshParticipants()
    } catch (err) {
      set({ isMicMuted:true,microphoneError: err instanceof Error ? err.message : 'Falha ao abrir o microfone.' })
    }
  },

  selectMicrophone: async deviceId => {
    const { currentRoom, isMicMuted, isDeafened } = get()
    try {
      let label = ''
      if (currentRoom&&currentRoom.localParticipant.canPublishMicrophone!==false&&!get().isServerMuted&&!get().isServerDeafened) label = await publishSafeMicrophone(currentRoom, deviceId, isMicMuted || isDeafened)
      localStorage.setItem('contalk-microphone-id', deviceId)
      set({ microphoneDeviceId: deviceId, microphoneLabel: label, microphoneError: null,...(currentRoom?.inputMode==='push-to-talk'?{isMicMuted:isMicMuted||isDeafened||get().isServerMuted||get().isServerDeafened}:{}) })
      get().refreshParticipants()
    } catch (error) { set({ microphoneError: error instanceof Error ? error.message : 'Não foi possível trocar de microfone.' }); get().refreshParticipants(); throw error }
  },
  toggleDeafen: async () => {
    const { currentRoom, isDeafened, isMicMuted, microphoneDeviceId, micMutedBeforeDeafen } = get()
    if(get().isServerDeafened)return
    if(!currentRoom){set({isDeafened:!isDeafened,...(!isDeafened?{micMutedBeforeDeafen:isMicMuted}:{})});return}
    const nextDeafened = !isDeafened
    set({ isDeafened: nextDeafened,isMicMuted:nextDeafened?true:micMutedBeforeDeafen||currentRoom.localParticipant.canPublishMicrophone===false, ...(nextDeafened ? { micMutedBeforeDeafen: isMicMuted } : {}) })
    currentRoom.remoteParticipants.forEach(participant => participant.audioTrackPublications.forEach(pub => {
      if (pub.audioTrack && 'setVolume' in pub.audioTrack) pub.audioTrack.setVolume(voicePlaybackLevel(get(),participant.identity,pub.source,nextDeafened||get().isServerDeafened))
    }))
    try {
      if(!get().isServerMuted&&!get().isServerDeafened)await setSafeMicrophoneEnabled(currentRoom, !nextDeafened && !micMutedBeforeDeafen && currentRoom.localParticipant.canPublishMicrophone!==false, microphoneDeviceId)
      set({ microphoneError: null })
    } catch (error) { set({ microphoneError: error instanceof Error ? error.message : 'Falha no microfone.' }) }
    get().refreshParticipants()
  },

  toggleCamera: async () => {
    const { currentRoom, isCameraOn } = get()
    if (!currentRoom) return

    const nextCamera = !isCameraOn
    try {
      await currentRoom.localParticipant.setCameraEnabled(nextCamera)
      set({ isCameraOn: currentRoom.localParticipant.isCameraEnabled })
      get().refreshParticipants()
    } catch (err) {
      console.error('Erro ao alternar câmera:', err)
      set({ isCameraOn: currentRoom.localParticipant.isCameraEnabled })
      get().refreshParticipants()
    }
  },

  toggleScreenShare: async () => {
    const { currentRoom } = get()
    if (!currentRoom) return
    await stopScreenShare(currentRoom)
    set({ isScreenSharing: false, screenShareError: null })
    get().refreshParticipants()
  },

  startScreenShareWithOptions: async (source, options) => {
    const { currentRoom } = get()
    if (!currentRoom) throw new Error('Entre em um canal de voz antes de transmitir.')
    set({ screenShareError: null })
    try {
      await startScreenShare(currentRoom, source, options,
        () => { set({ isScreenSharing: false }); get().refreshParticipants() },
        message => set({ screenShareError: message }),
      )
      get().refreshParticipants()
    } catch (error) {
      set({ screenShareError: error instanceof Error ? error.message : 'Falha ao iniciar transmissão.' })
      get().refreshParticipants()
      throw error
    }
  },
}))
