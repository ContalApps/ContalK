import { roomGrant } from '../../shared/livekit-grant.mjs'
import { create } from 'zustand'
import { microphoneOptions, publishSafeMicrophone, setSafeMicrophoneEnabled } from '../media/microphone'
import { startScreenShare, stopScreenShare } from '../media/screenShare'
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  Participant,
} from 'livekit-client'

function readAvatar(metadata?: string) { try { const value = JSON.parse(metadata || '{}').avatar; return typeof value === 'string' && value.length < 50000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value) ? value : undefined } catch { return undefined } }

export interface VoiceParticipant {
  identity: string
  name: string
  avatar?: string
  isLocal: boolean
  isSpeaking: boolean
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  isScreenShareEnabled: boolean
  videoTrack?: Track | null // Câmera / Webcam
  screenTrack?: Track | null // Compartilhamento de Tela
}

interface VoiceState {
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
  joinChannel: (channelId: string, channelName: string, user: { username: string; display_name: string; avatar?: string }) => Promise<boolean>
  leaveChannel: () => Promise<void>
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

// Conexão direta com o LiveKit Cloud do ContalK
const LIVEKIT_URL = 'wss://contalk-vwlfqz0q.livekit.cloud'
const LIVEKIT_API_KEY = 'APIoDkLmBTDG5T5'
const LIVEKIT_API_SECRET = 'ahn9v2PgmEIJCxM1QQARYd1j39r76pq4bWrVx7KFcnD'

export async function getLiveKitToken(room: string, identity: string, name: string): Promise<string> {
  // 1. Tentar via Electron Desktop (Arquitetura Discord)
  const electron = (window as any).contalkDesktop
  if (electron?.getLiveKitToken) {
    try {
      const token = await electron.getLiveKitToken({ room, identity, name })
      if (token && typeof token === 'string') {
        return token
      }
    } catch (err) {
      console.warn('Electron getLiveKitToken falhou, tentando fallback:', err)
    }
  }

  // 2. Tentar nativamente via comando Rust do Tauri
  const tauri = (window as any).__TAURI__
  if (tauri && tauri.core) {
    try {
      const token = await tauri.core.invoke('get_livekit_token', { room, identity, name })
      if (token && typeof token === 'string') {
        return token
      }
    } catch (err) {
      console.warn('Tauri get_livekit_token falhou, tentando fallback client:', err)
    }
  }

  // 2. Fallback via livekit-server-sdk no cliente
  try {
    const { AccessToken } = await import('livekit-server-sdk')
    const tokenObj = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name,
      ttl: 3600 * 24,
    })
    tokenObj.addGrant(roomGrant(room))
    return await tokenObj.toJwt()
  } catch (err) {
    console.warn('Fallback token client falhou:', err)
  }

  // 3. Fallback servidor local se estiver ativo
  const tokenUrl = `http://127.0.0.1:3001/token?room=${encodeURIComponent(room)}&identity=${encodeURIComponent(identity)}&name=${encodeURIComponent(name)}`
  const res = await fetch(tokenUrl)
  const data = await res.json()
  return data.token
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
            pub.audioTrack.setVolume(get().isDeafened ? 0 : volume / 100)
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
      if (pub.source === Track.Source.ScreenShareAudio && pub.audioTrack && 'setVolume' in pub.audioTrack) pub.audioTrack.setVolume(get().isDeafened ? 0 : volume / 100)
    })
  },

  fetchChannelOccupants: async (channels: Array<{ id: string; name: string }>) => {
    const request = ++occupantsGeneration
    try {
      const { RoomServiceClient } = await import('livekit-server-sdk')
      const client = new RoomServiceClient('https://contalk-vwlfqz0q.livekit.cloud', LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
      const activeRooms = await client.listRooms()
      const newOccupants: Record<string, VoiceParticipant[]> = {}

      for (const ch of channels) {
        const roomFound = activeRooms.find((r) => r.name === ch.id)
        if (roomFound && roomFound.numParticipants > 0) {
          try {
            const parts = await client.listParticipants(roomFound.name)
            newOccupants[ch.id] = parts.map((p) => ({
              identity: p.identity,
              name: p.name || p.identity,
              avatar: readAvatar(p.metadata),
              isLocal: false,
              isSpeaking: false,
              isAudioEnabled: p.tracks.some((track) => track.type === 0 && !track.muted),
              isVideoEnabled: p.tracks?.some((t: any) => t.source === 1) || false,
              isScreenShareEnabled: p.tracks?.some((t: any) => t.source === 3) || false,
            }))
          } catch { newOccupants[ch.id] = [] }
        } else {
          newOccupants[ch.id] = []
        }
      }

      if (request !== occupantsGeneration) return
      set((state) => {
        const currentActive = state.activeChannelId
        const merged = { ...state.channelOccupants, ...newOccupants }
        if (currentActive && state.participants.length > 0) {
          merged[currentActive] = state.participants
        }
        return { channelOccupants: merged }
      })
    } catch {
      if (request === occupantsGeneration) set({channelOccupants: get().activeChannelId ? {[get().activeChannelId!]: get().participants} : {}})
    }
  },

  refreshParticipants: () => {
    const { currentRoom } = get()
    if (!currentRoom || currentRoom.state !== 'connected') return

    const list: VoiceParticipant[] = []
    const local = currentRoom.localParticipant

    const localCamPub = local.getTrackPublication(Track.Source.Camera)
    const localScreenPub = local.getTrackPublication(Track.Source.ScreenShare)

    list.push({
      identity: local.identity,
      name: local.name || local.identity,
      avatar: readAvatar(local.metadata),
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
      participants: list,
      isScreenSharing: local.isScreenShareEnabled,
      isCameraOn: local.isCameraEnabled,
      isMicMuted: !local.isMicrophoneEnabled,
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

  joinChannel: async (channelId, channelName, user) => {
    const state = get()
    if (state.activeChannelId === channelId && ['connected','connecting','reconnecting'].includes(state.connectionStatus)) {
      return true
    }

    const attempt = ++connectionGeneration
    occupantsGeneration++
    const previous = state.currentRoom || pendingRoom
    pendingRoom = null
    if (previous) {
      previous.removeAllListeners()
      await stopScreenShare(previous).catch(() => {})
      await previous.disconnect().catch(() => {})
    }
    if (attempt !== connectionGeneration) return false
    getAudioContainer().innerHTML = ''
    set({ currentRoom: null, channelOccupants: Object.fromEntries(Object.entries(get().channelOccupants).map(([id, users]) => [id, users.filter(p => p.identity !== user.username)])) })

    set({
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
      // 1. Obter token JWT do LiveKit
      const token = await getLiveKitToken(channelId, user.username, user.display_name)
      if (!token || typeof token !== 'string') {
        throw new Error('Não foi possível gerar um token de acesso para a sala.')
      }

      if (attempt !== connectionGeneration) return false
      // 2. Instanciar LiveKit Room com opções otimizadas para localhost WebRTC
      const connection = new Room({
        adaptiveStream: true,
        dynacast: true,
        webAudioMix: true,
        audioCaptureDefaults: microphoneOptions(get().microphoneDeviceId),
      })

      room = connection
      pendingRoom = connection
      const on = (event: RoomEvent, handler: (...args: any[]) => void) => connection.on(event, (...args: any[]) => { if (attempt === connectionGeneration) handler(...args) })
      const triggerUpdate = () => {
        get().refreshParticipants()
      }

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

          const volumes = _pub.source === Track.Source.ScreenShareAudio ? get().streamVolumes : get().userVolumes
          const userVol = get().isDeafened ? 0 : clampVolume(volumes[participant.identity] ?? 100)
          if (typeof (track as any).setVolume === 'function') {
            (track as any).setVolume(userVol / 100)
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
          error: 'A conexão de voz foi encerrada. Tente novamente.',
          participants: [],
          activeSpeakers: [],
          isMicMuted: false,
          isCameraOn: false,
          isScreenSharing: false,
          channelOccupants: prevId ? { ...s.channelOccupants, [prevId]: remotes } : s.channelOccupants,
        }))
      })

      // 4. Conectar ao SFU LiveKit
      await connection.connect(LIVEKIT_URL, token)
      if (attempt !== connectionGeneration) { await connection.disconnect(); return false }
      if (connection.state !== 'connected') throw new Error('A conexão de voz foi encerrada. Tente novamente.')
      try { await connection.localParticipant.setMetadata(JSON.stringify({ avatar: user.avatar || '' })) }
      catch { if (attempt === connectionGeneration) set({profileError: 'Não foi possível sincronizar a foto. A chamada continua conectada.'}) }
      if (attempt !== connectionGeneration) { await connection.disconnect(); return false }

      // 5. Ativar microfone local se permitido
      try {
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
        isMicMuted: !connection.localParticipant.isMicrophoneEnabled,
      })

      triggerUpdate()
      return true
    } catch (err: any) {
      if (room) { room.removeAllListeners(); await stopScreenShare(room).catch(() => {}); await room.disconnect().catch(() => {}) }
      if (pendingRoom === room) pendingRoom = null
      if (attempt !== connectionGeneration) return false
      getAudioContainer().innerHTML = ''
      console.error('Erro ao conectar na sala de voz:', err)
      set({
        currentRoom: null,
        connectionStatus: 'disconnected',
        participants: [], isScreenSharing: false, isCameraOn: false, isMicMuted: true,
        channelOccupants: Object.fromEntries(Object.entries(get().channelOccupants).map(([id, users]) => [id, users.filter(p => p.identity !== user.username)])),
        error: err.message || 'Falha ao conectar no LiveKit SFU',
      })
      return false
    }
  },

  leaveChannel: async () => {
    const attempt = ++connectionGeneration; occupantsGeneration++
    const { activeChannelId, participants } = get()
    const currentRoom = get().currentRoom || pendingRoom
    pendingRoom = null
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
      isDeafened: false,
      isCameraOn: false,
      isScreenSharing: false,
      error: null,
    })
  },

  toggleMic: async () => {
    const { currentRoom, isMicMuted, isDeafened } = get()
    if (!currentRoom) return
    if (isDeafened) return

    const nextMuted = !isMicMuted
    try {
      const label = await setSafeMicrophoneEnabled(currentRoom, !nextMuted, get().microphoneDeviceId)
      set({ microphoneLabel: label, microphoneError: null })
      set({ isMicMuted: !currentRoom.localParticipant.isMicrophoneEnabled })
      get().refreshParticipants()
    } catch (err) {
      set({ microphoneError: err instanceof Error ? err.message : 'Falha ao abrir o microfone.' })
    }
  },

  selectMicrophone: async deviceId => {
    const { currentRoom, isMicMuted, isDeafened } = get()
    try {
      let label = ''
      if (currentRoom) label = await publishSafeMicrophone(currentRoom, deviceId, isMicMuted || isDeafened)
      localStorage.setItem('contalk-microphone-id', deviceId)
      set({ microphoneDeviceId: deviceId, microphoneLabel: label, microphoneError: null })
      get().refreshParticipants()
    } catch (error) { set({ microphoneError: error instanceof Error ? error.message : 'Não foi possível trocar de microfone.' }); get().refreshParticipants(); throw error }
  },
  toggleDeafen: async () => {
    const { currentRoom, isDeafened, isMicMuted, microphoneDeviceId, micMutedBeforeDeafen } = get()
    if (!currentRoom) return
    const nextDeafened = !isDeafened
    set({ isDeafened: nextDeafened, ...(nextDeafened ? { micMutedBeforeDeafen: isMicMuted } : {}) })
    currentRoom.remoteParticipants.forEach(participant => participant.audioTrackPublications.forEach(pub => {
      const volumes = pub.source === Track.Source.ScreenShareAudio ? get().streamVolumes : get().userVolumes
      if (pub.audioTrack && 'setVolume' in pub.audioTrack) pub.audioTrack.setVolume(nextDeafened ? 0 : clampVolume(volumes[participant.identity] ?? 100) / 100)
    }))
    try {
      await setSafeMicrophoneEnabled(currentRoom, !nextDeafened && !micMutedBeforeDeafen, microphoneDeviceId)
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
