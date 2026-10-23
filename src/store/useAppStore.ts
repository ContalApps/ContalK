import { create } from 'zustand'

export interface User {
  id: string
  name: string
  avatar?: string
  status: 'online' | 'idle' | 'dnd' | 'offline'
}

export interface Channel {
  id: string
  name: string
  type: 'text' | 'voice'
  serverId: string
}

export interface Server {
  id: string
  name: string
  icon?: string
  channels: Channel[]
}

export interface Message {
  id: string
  channelId: string
  userId: string
  userName: string
  content: string
  timestamp: number
  userColor?: string
}

interface AppState {
  currentUser: User | null
  servers: Server[]
  activeServerId: string
  activeChannelId: string
  messages: Record<string, Message[]>

  setCurrentUser: (user: User) => void
  addServer: (server: Server) => void
  setActiveServer: (serverId: string) => void
  setActiveChannel: (channelId: string) => void
  addMessage: (channelId: string, content: string, user: { username: string; display_name: string }) => void
}

const COLORS = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245', '#9B59B6', '#3498DB', '#E67E22']

function getColorForUser(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  servers: [
    {
      id: 'srv-1',
      name: 'ContalK HQ',
      channels: [
        { id: 'ch-welcome', name: 'bem-vindo', type: 'text', serverId: 'srv-1' },
        { id: 'ch-general', name: 'geral', type: 'text', serverId: 'srv-1' },
        { id: 'ch-announcements', name: 'anúncios', type: 'text', serverId: 'srv-1' },
        { id: 'ch-offtopic', name: 'off-topic', type: 'text', serverId: 'srv-1' },
        { id: 'vc-general', name: 'Sala Geral', type: 'voice', serverId: 'srv-1' },
        { id: 'vc-streaming', name: 'Streaming', type: 'voice', serverId: 'srv-1' },
        { id: 'vc-music', name: 'Música', type: 'voice', serverId: 'srv-1' },
      ],
    },
  ],
  activeServerId: 'srv-1',
  activeChannelId: 'ch-welcome',
  messages: {
    'ch-welcome': [
      {
        id: 'msg-welcome-1',
        channelId: 'ch-welcome',
        userId: 'system',
        userName: 'ContalBot 🤖',
        content: 'Bem-vindo ao ContalK! 🎉 Este é um cliente de voz e texto ultra-rápido desenvolvido com Rust + Tauri + LiveKit.',
        timestamp: Date.now() - 3600000 * 2,
        userColor: '#5865F2',
      },
      {
        id: 'msg-welcome-2',
        channelId: 'ch-welcome',
        userId: 'alice',
        userName: 'Alice Silva',
        content: 'Olá a todos! Para entrar em um canal de voz com WebRTC em tempo real, clique em qualquer canal de voz abaixo! 🎙️',
        timestamp: Date.now() - 3600000,
        userColor: '#57F287',
      },
    ],
    'ch-general': [
      {
        id: 'msg-gen-1',
        channelId: 'ch-general',
        userId: 'bob',
        userName: 'Bob Santos',
        content: 'LiveKit SFU rodando localmente com latência de menos de 20ms! ⚡',
        timestamp: Date.now() - 1800000,
        userColor: '#EB459E',
      },
    ],
    'ch-announcements': [
      {
        id: 'msg-ann-1',
        channelId: 'ch-announcements',
        userId: 'system',
        userName: 'Novidades 📢',
        content: 'Autenticação SQLite ativa, suporte a canais de voz com SFU LiveKit, mute/ensurdecer e compartilhamento de tela!',
        timestamp: Date.now() - 7200000,
        userColor: '#FEE75C',
      },
    ],
    'ch-offtopic': [
      {
        id: 'msg-off-1',
        channelId: 'ch-offtopic',
        userId: 'carol',
        userName: 'Carol Oliveira',
        content: 'Quem topa testar a sala de Streaming hoje mais tarde? 🎮',
        timestamp: Date.now() - 900000,
        userColor: '#3498DB',
      },
    ],
  },

  setCurrentUser: (user) => set({ currentUser: user }),
  addServer: (server) => set((state) => ({ servers: [...state.servers, server] })),
  setActiveServer: (serverId) => set({ activeServerId: serverId }),
  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),

  addMessage: (channelId, content, user) => set((state) => {
    const trimmed = content.trim()
    if (!trimmed) return state

    const newMsg: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      channelId,
      userId: user.username,
      userName: user.display_name || user.username,
      content: trimmed,
      timestamp: Date.now(),
      userColor: getColorForUser(user.username),
    }

    return {
      messages: {
        ...state.messages,
        [channelId]: [...(state.messages[channelId] || []), newMsg],
      },
    }
  }),
}))
