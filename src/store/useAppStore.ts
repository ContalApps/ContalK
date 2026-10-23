import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

  addChannel: (serverId: string, name: string, type: 'text' | 'voice', id?: string) => void
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

export const useAppStore = create<AppState>()(persist((set) => ({
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
  messages: {},
  addChannel: (serverId, name, type, id = crypto.randomUUID()) => set(state => {
    const clean = name.trim().slice(0, 60)
    if (!clean) return state
    return { servers: state.servers.map(server => server.id === serverId && !server.channels.some(c => c.id === id) ? { ...server, channels: [...server.channels, {id, name: clean, type, serverId}] } : server) }
  }),

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
}), { name: 'contalk-community-v2' }))
