import { create } from 'zustand'
import { startScreenShare, stopScreenShare } from '../media/screenShare'
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  Participant,
} from 'livekit-client'

export interface VoiceParticipant {
  identity: string
  name: string
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
  isMicMuted: boolean
  isDeafened: boolean
  isCameraOn: boolean
  isScreenSharing: boolean
  participants: VoiceParticipant[]
  activeSpeakers: string[]
  error: string | null
  screenShareError: string | null
  userVolumes: Record<string, number>
  channelOccupants: Record<string, VoiceParticipant[]>

  // Actions
  joinChannel: (channelId: string, channelName: string, user: { username: string; display_name: string }) => Promise<boolean>
  leaveChannel: () => Promise<void>
  refreshParticipants: () => void
  setUserVolume: (identity: string, volume: number) => void
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

async function getLiveKitToken(room: string, identity: string, name: string): Promise<string> {
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
    tokenObj.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })
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

const initialUserVolumes: Record<string, number> = (() => {
  try {
    const saved = localStorage.getItem('contalk_user_volumes')
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
})()

export const useVoiceStore = create<VoiceState>((set, get) => ({
  currentRoom: null,
  activeChannelId: null,
  activeChannelName: null,
  connectionStatus: 'disconnected',
  isMicMuted: false,
  isDeafened: false,
  isCameraOn: false,
  isScreenSharing: false,
  participants: [],
  activeSpeakers: [],
  error: null,
  screenShareError: null,
  userVolumes: initialUserVolumes,
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
          if (pub.audioTrack && typeof (pub.audioTrack as any).setVolume === 'function') {
            (pub.audioTrack as any).setVolume(volume / 100)
          }
        })
      }
    }
  },

  fetchChannelOccupants: async (channels: Array<{ id: string; name: string }>) => {
    try {
      const { RoomServiceClient } = await import('livekit-server-sdk')
      const client = new RoomServiceClient('https://contalk-vwlfqz0q.livekit.cloud', LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
      const activeRooms = await client.listRooms()
      const newOccupants: Record<string, VoiceParticipant[]> = {}

      for (const ch of channels) {
        const roomFound = activeRooms.find((r) => r.name.toLowerCase() === ch.name.toLowerCase())
        if (roomFound && roomFound.numParticipants > 0) {
          try {
            const parts = await client.listParticipants(roomFound.name)
            newOccupants[ch.id] = parts.map((p) => ({
              identity: p.identity,
              name: p.name || p.identity,
              isLocal: false,
              isSpeaking: false,
              isAudioEnabled: p.tracks.some((track) => track.type === 0 && !track.muted),
              isVideoEnabled: p.tracks?.some((t: any) => t.source === 1) || false,
              isScreenShareEnabled: p.tracks?.some((t: any) => t.source === 2) || false,
            }))
          } catch {}
        } else {
          newOccupants[ch.id] = []
        }
      }

      set((state) => {
        const currentActive = state.activeChannelId
        const merged = { ...state.channelOccupants, ...newOccupants }
        if (currentActive && state.participants.length > 0) {
          merged[currentActive] = state.participants
        }
        return { channelOccupants: merged }
      })
    } catch {
      // Falha silenciosa em checagem de fundo
    }
  },

  refreshParticipants: () => {
    const { currentRoom } = get()
    if (!currentRoom) return

    const list: VoiceParticipant[] = []
    const local = currentRoom.localParticipant

    const localCamPub = local.getTrackPublication(Track.Source.Camera)
    const localScreenPub = local.getTrackPublication(Track.Source.ScreenShare)

    list.push({
      identity: local.identity,
      name: local.name || local.identity,
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
    if (state.activeChannelId === channelId && state.connectionStatus === 'connected') {
      return true
    }

    if (state.currentRoom) {
      await state.leaveChannel()
    }

    set({
      connectionStatus: 'connecting',
      activeChannelId: channelId,
      activeChannelName: channelName,
      error: null,
      screenShareError: null,
      participants: [],
    })

    try {
      // 1. Obter token JWT do LiveKit
      const token = await getLiveKitToken(channelId, user.username, user.display_name)
      if (!token || typeof token !== 'string') {
        throw new Error('Não foi possível gerar um token de acesso para a sala.')
      }

      // 2. Instanciar LiveKit Room com opções otimizadas para localhost WebRTC
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      const triggerUpdate = () => {
        get().refreshParticipants()
      }

      // 3. Configurar eventos de conexão e mídia
      room.on(RoomEvent.Connected, () => {
        set({ connectionStatus: 'connected', currentRoom: room, error: null })
        triggerUpdate()
      })

      room.on(RoomEvent.Reconnecting, () => {
        set({ connectionStatus: 'reconnecting' })
      })

      room.on(RoomEvent.Reconnected, () => {
        set({ connectionStatus: 'connected' })
        triggerUpdate()
      })

      room.on(RoomEvent.ParticipantConnected, () => triggerUpdate())
      room.on(RoomEvent.ParticipantDisconnected, () => triggerUpdate())

      room.on(RoomEvent.TrackPublished, () => triggerUpdate())
      room.on(RoomEvent.TrackUnpublished, () => triggerUpdate())

      room.on(RoomEvent.LocalTrackPublished, (pub) => {
        if (pub.source === Track.Source.ScreenShare) {
          set({ isScreenSharing: true })
        }
        triggerUpdate()
      })

      room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
        if (pub.source === Track.Source.ScreenShare) {
          set({ isScreenSharing: false })
        }
        triggerUpdate()
      })

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const audioContainer = getAudioContainer()
          const element = track.attach()
          element.muted = get().isDeafened
          audioContainer.appendChild(element)

          const userVol = Math.min(200, Math.max(0, get().userVolumes[participant.identity] ?? 100))
          if (typeof (track as any).setVolume === 'function') {
            (track as any).setVolume(userVol / 100)
          }
        }
        triggerUpdate()
      })

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el) => el.remove())
        triggerUpdate()
      })

      room.on(RoomEvent.TrackMuted, () => triggerUpdate())
      room.on(RoomEvent.TrackUnmuted, () => triggerUpdate())

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        const identities = speakers.map((s) => s.identity)
        set({ activeSpeakers: identities })
        triggerUpdate()
      })

      room.on(RoomEvent.Disconnected, () => {
        void stopScreenShare(room)
        const audioContainer = getAudioContainer()
        audioContainer.innerHTML = ''
        const prevId = get().activeChannelId
        const remotes = get().participants.filter((p) => !p.isLocal)
        set((s) => ({
          currentRoom: null,
          activeChannelId: null,
          activeChannelName: null,
          connectionStatus: 'disconnected',
          participants: [],
          activeSpeakers: [],
          isMicMuted: false,
          isCameraOn: false,
          isScreenSharing: false,
          channelOccupants: prevId ? { ...s.channelOccupants, [prevId]: remotes } : s.channelOccupants,
        }))
      })

      // 4. Conectar ao SFU LiveKit
      await room.connect(LIVEKIT_URL, token)

      // 5. Ativar microfone local se permitido
      try {
        await room.localParticipant.setMicrophoneEnabled(true)
      } catch (micErr) {
        console.warn('Microfone não pôde ser ativado automaticamente:', micErr)
      }

      set({
        currentRoom: room,
        connectionStatus: 'connected',
        isMicMuted: !room.localParticipant.isMicrophoneEnabled,
      })

      triggerUpdate()
      return true
    } catch (err: any) {
      console.error('Erro ao conectar na sala de voz:', err)
      set({
        currentRoom: null,
        connectionStatus: 'disconnected',
        error: err.message || 'Falha ao conectar no LiveKit SFU',
      })
      return false
    }
  },

  leaveChannel: async () => {
    const { currentRoom, activeChannelId, participants } = get()
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
      await currentRoom.localParticipant.setMicrophoneEnabled(!nextMuted)
      set({ isMicMuted: !currentRoom.localParticipant.isMicrophoneEnabled })
      get().refreshParticipants()
    } catch (err) {
      console.error('Erro ao alternar microfone:', err)
    }
  },

  toggleDeafen: async () => {
    const { currentRoom, isDeafened } = get()
    if (!currentRoom) return

    const nextDeafened = !isDeafened
    const audioContainer = getAudioContainer()
    const audioElements = audioContainer.querySelectorAll('audio')

    audioElements.forEach((el) => {
      el.muted = nextDeafened
    })

    if (nextDeafened) {
      await currentRoom.localParticipant.setMicrophoneEnabled(false)
      set({ isDeafened: true, isMicMuted: true })
    } else {
      await currentRoom.localParticipant.setMicrophoneEnabled(true)
      set({ isDeafened: false, isMicMuted: false })
    }
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
