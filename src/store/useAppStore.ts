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
  parentId?:string
  project?:boolean
  aiEnabled?:boolean
  aiEndpoints?:Partial<Record<'compatible-responses'|'compatible-chat',string>>
  aiModel?:string
  aiEndpoint?:string
  slowmodeSeconds?:number
  nameUpdatedAt?:number
  voiceMode?:'conversation'|'stage'
  voiceStatus?:string|null
  voiceStatusUpdatedAt?:number
}

export interface Server {
  id: string
  name: string
  description?:string
  icon?: string
  channels: Channel[]
}

export interface Attachment { storageId?:string; thumbnail?:string; name: string; type: string; size: number; data: string }

export interface MessageOptions { expression?:import('../roles/expressions').ExpressionReference;voice?:{durationMs:number};tts?:boolean;poll?:import('../roles/polls').PollDraft; id?: string; preview?: boolean; once?: boolean }

export interface Message {
  id: string
  channelId: string
  userId: string
  userName: string
  ai?:any
  content: string
  expression?:import('../roles/expressions').ExpressionReference&{name:string;kind:import('../roles/expressions').ExpressionKind}
  webhook?:{id:string;name:string}
  voice?:{durationMs:number}
  tts?:boolean
  timestamp: number
  preview?: boolean
  once?: boolean
  poll?:import('../roles/polls').Poll
  editedAt?: number
  reactions?:Array<{emoji:string;members:string[]}>
  pinnedAt?:number
  pinnedBy?:string
  attachment?: Attachment
  userColor?: string
  roleMentions?:string[]
  mentionsEveryone?:'all'|'online'
}

interface AppState {
  currentUser: User | null
  servers: Server[]
  activeServerId: string
  activeChannelId: string
  messages: Record<string, Message[]>
  deletedChannels: Record<string, string>
  messageDeletions: Record<string,boolean>
  changeMessage: (channelId:string,id:string,actor:string,content?:string)=>void

  addChannel: (serverId: string, name: string, type: 'text' | 'voice', id?: string, nameUpdatedAt?:number) => void
  renameChannel:(serverId:string,channelId:string,name:string,nameUpdatedAt?:number)=>void
  removeChannel: (serverId: string, channelId: string) => void
  setCurrentUser: (user: User) => void
  addServer: (server: Server) => void
  syncServers: (list: Array<{id:string;name:string}>) => void
  setActiveServer: (serverId: string) => void
  setActiveChannel: (channelId: string) => void
  addMessage: (channelId: string, content: string, user: { username: string; display_name: string }, attachment?: Attachment, options?: MessageOptions) => void
}

const COLORS = ['#757575', '#57F287', '#FEE75C', '#878787', '#ED4245', '#747474', '#919191', '#E67E22']

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
      name: 'ConTALK HQ',
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
  deletedChannels: {},
  messageDeletions: {},
  changeMessage:(channelId,id,actor,content)=>set(state=>{
    const message=state.messages[channelId]?.find(m=>m.id===id)
    if(!message || message.userId!==actor || (content!==undefined&&(!content.trim()||content.length>2000)))return state
    return {messageDeletions:content===undefined?{...state.messageDeletions,[id]:true}:state.messageDeletions,messages:{...state.messages,[channelId]:state.messages[channelId].flatMap(m=>m.id!==id?[m]:content===undefined?[]:[{...m,content,editedAt:Date.now()}])}}
  }),
  addChannel: (serverId, name, type, id = crypto.randomUUID(), nameUpdatedAt=0) => set(state => {
    const clean = name.trim().slice(0, 60)
    if (!clean || state.deletedChannels?.[id]) return state
    return { servers: state.servers.map(server => server.id === serverId && !server.channels.some(c => c.id === id) ? { ...server, channels: [...server.channels, {id, name: clean, type, serverId, nameUpdatedAt:Number.isSafeInteger(nameUpdatedAt)&&nameUpdatedAt>=0&&nameUpdatedAt<=Date.now()+60000?nameUpdatedAt:0}] } : server) }
  }),

  renameChannel:(serverId,channelId,name,nameUpdatedAt)=>set(state=>{
    const existing=state.servers.find(s=>s.id===serverId)?.channels.find(c=>c.id===channelId)
    const clean=typeof name==='string'?name.trim().slice(0,60):''
    const revision=nameUpdatedAt??Math.max(Date.now(),(existing?.nameUpdatedAt||0)+1)
    if(!existing||!clean||state.deletedChannels?.[channelId]||!Number.isSafeInteger(revision)||(revision<(existing.nameUpdatedAt||0)||(revision===(existing.nameUpdatedAt||0)&&clean<=existing.name))||revision>Date.now()+60000)return state
    return {servers:state.servers.map(server=>server.id!==serverId?server:{...server,channels:server.channels.map(c=>c.id!==channelId?c:{...c,name:clean,nameUpdatedAt:revision})})}
  }),
  removeChannel: (serverId, channelId) => set(state => {
    if (!channelId || channelId.length > 80 || !state.servers.some(server => server.id === serverId) || state.servers.some(server => server.id !== serverId && server.channels.some(c => c.id === channelId))) return state
    const servers = state.servers.map(server => server.id === serverId ? { ...server, channels: server.channels.filter(c => c.id !== channelId) } : server)
    const messages = { ...state.messages }; delete messages[channelId]
    const fallback = servers.find(server => server.id === state.activeServerId)?.channels[0]?.id || ''
    return { servers, messages, deletedChannels: { ...state.deletedChannels, [channelId]: serverId }, activeChannelId: state.activeChannelId === channelId ? fallback : state.activeChannelId }
  }),

  setCurrentUser: (user) => set({ currentUser: user }),
  addServer: (server) => set((state) => ({ servers: [...state.servers.filter(item => item.id !== server.id), server] })),
  // The account's server list on the community is the truth; cached channels are kept for servers still in it.
  syncServers: (list) => set((state) => ({ servers: list.map(item => state.servers.find(server => server.id === item.id) ?? { id: item.id, name: item.name, channels: [] }) })),
  setActiveServer: (serverId) => set({ activeServerId: serverId }),
  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),

  addMessage: (channelId, content, user, attachment, options) => set((state) => {
    const trimmed = content.trim()
    if ((!trimmed && !attachment) || state.deletedChannels?.[channelId]) return state

    if(options?.id && (state.messageDeletions?.[options.id] || state.messages[channelId]?.some(m=>m.id===options.id)))return state
    const newMsg: Message = {
      id: options?.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      channelId,
      userId: user.username,
      userName: user.display_name || user.username,
      content: trimmed,
      attachment,
      preview:options?.preview, once:options?.once,
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
}), { name: 'contalk-community-v2', merge: (persisted, current) => {
  const saved = persisted as Partial<AppState>
  return { ...current, ...saved, servers: (saved.servers ?? current.servers).map(server =>
    server.id === 'srv-1' && /^contalk HQ$/i.test(server.name) ? { ...server, name: 'ConTALK HQ' } : server) }
} }))
