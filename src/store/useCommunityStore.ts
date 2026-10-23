import { create } from 'zustand'
import { Room, RoomEvent } from 'livekit-client'
import { useAppStore } from './useAppStore'
import { getLiveKitToken } from './useVoiceStore'
import type { User } from './useAuthStore'
import { useFriendStore } from './useFriendStore'

export interface Member { username: string; display_name: string; avatar?: string; bio?: string; online: boolean }
function cachedMembers(): Member[] { try { return JSON.parse(localStorage.getItem('contalk-members-v1') || '[]').map((m: Member) => ({ ...m, online: false })) } catch { return [] } }
let room: Room | null = null
let generation = 0
let friendRetry: ReturnType<typeof setInterval> | undefined
const encoder = new TextEncoder()
function safeMember(identity: string, name: string, metadata?: string): Member {
  let profile: {avatar?: string; bio?: string} = {}
  try { const value = JSON.parse(metadata || '{}'); if(value && typeof value === 'object') profile = value } catch { /* Empty profile. */ }
  return { username: identity, display_name: name.slice(0,40) || identity,
    avatar: typeof profile.avatar === 'string' && profile.avatar.length < 50000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(profile.avatar) ? profile.avatar : undefined,
    bio: typeof profile.bio === 'string' ? profile.bio.slice(0,240) : '', online: true }
}
export const useCommunityStore = create<{ members: Member[]; status: string; profileError: string | null; connect: (user: User) => Promise<void>; disconnect: () => void; updateProfile: (user: User) => Promise<void>; broadcastChannels: () => Promise<void>; sendMessage: (channelId: string, content: string, destination?: string) => Promise<void> }>((set,get) => ({
  members: cachedMembers(), status: 'offline', profileError: null,
  disconnect: () => { generation++; clearInterval(friendRetry); useFriendStore.getState().activate(null); const previous = room; room = null; void previous?.disconnect(); set({ members: get().members.map(m=>({...m,online:false})), status:'offline' }) },
  connect: async user => {
    get().disconnect()
    const version = generation
    set({status:'connecting',profileError:null})
    const connection = new Room({ adaptiveStream: false, dynacast: false })
    room = connection
    useFriendStore.getState().activate(user.username, async (username, packet) => {
      if(room !== connection || connection.state !== 'connected' || !connection.remoteParticipants.has(username)) throw new Error('Pessoa offline')
      await connection.localParticipant.publishData(encoder.encode(JSON.stringify(packet)), { reliable: true, topic: 'contalk-friendship-v1', destinationIdentities: [username] })
    })
    const refresh = () => {
      if (room !== connection) return
      const known = new Map(get().members.map(m=>[m.username,{...m,online:false}]))
      for (const p of [connection.localParticipant,...connection.remoteParticipants.values()]) known.set(p.identity,safeMember(p.identity,p.name || p.identity,p.metadata))
      const members = [...known.values()]
      localStorage.setItem('contalk-members-v1',JSON.stringify(members.map(m=>({...m,online:false}))))
      set({members})
    }
    const receive = (payload: Uint8Array, _participant: unknown, _kind: unknown, topic?: string) => {
      if (room !== connection) return
      if(topic === 'contalk-friendship-v1') {
        const participant = _participant as {identity?: string; name?: string}
        if (!participant?.identity || !connection.remoteParticipants.has(participant.identity) || payload.byteLength > 2000) return
        try { void useFriendStore.getState().receive(participant.identity, participant.name || participant.identity, JSON.parse(new TextDecoder().decode(payload))).catch(() => {}) } catch { /* Invalid friendship packet. */ }
        return
      }
      if(topic==='community-message') {
        const participant=_participant as {identity?:string;name?:string}
        if(!participant?.identity || payload.byteLength>12000)return
        try {
          const message=JSON.parse(new TextDecoder().decode(payload))
          if(typeof message.content!=='string'||message.content.length>2000||typeof message.channelId!=='string')return
          const direct='dm:'+ [connection.localParticipant.identity,participant.identity].sort().join(':')
          if(message.channelId!==direct&&!useAppStore.getState().servers.some(s=>s.channels.some(c=>c.type==='text'&&c.id===message.channelId)))return
          useAppStore.getState().addMessage(message.channelId,message.content,{username:participant.identity,display_name:participant.name||participant.identity})
        } catch { /* Ignore invalid messages. */ }
        return
      }
      if(topic!=='community-channels' || payload.byteLength>60000) return
      try { const channels=JSON.parse(new TextDecoder().decode(payload)); if(!Array.isArray(channels))return
        for(const c of channels.slice(0,200)) if(typeof c.id==='string'&&c.id.length<=80&&typeof c.name==='string'&&c.name.length<=60&&c.serverId==='srv-1'&&['voice','text'].includes(c.type)) useAppStore.getState().addChannel(c.serverId,c.name,c.type,c.id)
      } catch { /* Ignore malformed peer data. */ }
    }
    connection.on(RoomEvent.ParticipantConnected,()=>{refresh();void get().broadcastChannels().catch(()=>{});void useFriendStore.getState().flush()})
    connection.on(RoomEvent.ParticipantDisconnected,refresh)
    connection.on(RoomEvent.ParticipantMetadataChanged,refresh)
    connection.on(RoomEvent.ParticipantNameChanged,refresh)
    connection.on(RoomEvent.DataReceived,receive)
    connection.on(RoomEvent.Reconnecting,()=>{if(room===connection)set({status:'reconnecting',members:get().members.map(m=>({...m,online:false}))})})
    connection.on(RoomEvent.Reconnected,()=>{if(room===connection){set({status:'online'});refresh();void useFriendStore.getState().flush()}})
    connection.on(RoomEvent.Disconnected,()=>{if(room===connection)set({status:'offline',members:get().members.map(m=>({...m,online:false}))})})
    try {
      const local = await window.contalkDesktop?.listAccounts().catch(()=>[])
      if(version!==generation)return
      if(local) set({members:[...new Map([...get().members,...local.map(m=>({...m,online:false}))].map(m=>[m.username,m])).values()]})
      const token=await getLiveKitToken('contalk-community-presence-v1',user.username,user.display_name)
      if(version!==generation)return
      await connection.connect('wss://contalk-vwlfqz0q.livekit.cloud',token,{autoSubscribe:false})
      if(version!==generation){await connection.disconnect();return}
      set({status:'online'});refresh()
      friendRetry = setInterval(() => { void useFriendStore.getState().flush() }, 10000)
      void useFriendStore.getState().flush()
      try { await connection.localParticipant.setMetadata(JSON.stringify({avatar:user.avatar || '',bio:user.bio || ''})) }
      catch { if(version===generation)set({profileError:'O perfil não foi sincronizado. A presença continua conectada.'}) }
      if(version!==generation){await connection.disconnect();return}
      refresh();await get().broadcastChannels().catch(()=>{})
    } catch { if(version===generation){set({status:'offline',members:get().members.map(m=>({...m,online:false}))});await connection.disconnect()} }
  },
  updateProfile: async user => {
    set({members:get().members.map(m=>m.username===user.username?{...m,display_name:user.display_name,avatar:user.avatar,bio:user.bio}:m)})
    if(room?.state==='connected') {await room.localParticipant.setName(user.display_name);await room.localParticipant.setMetadata(JSON.stringify({avatar:user.avatar || '',bio:user.bio || ''}))}
  },
  sendMessage: async (channelId, content, destination) => {
    if(!room || room.state!=='connected')throw new Error('Aguarde a conexão para enviar mensagens.')
    if(!content.trim()||content.length>2000)throw new Error('Escreva uma mensagem de até 2000 caracteres.')
    if(destination&&!room.remoteParticipants.has(destination))throw new Error('Essa pessoa está offline.')
    await room.localParticipant.publishData(encoder.encode(JSON.stringify({channelId,content})),{reliable:true,topic:'community-message',...(destination?{destinationIdentities:[destination]}:{})})
    useAppStore.getState().addMessage(channelId,content,{username:room.localParticipant.identity,display_name:room.localParticipant.name||room.localParticipant.identity})
  },
  broadcastChannels: async () => {if(room?.state==='connected')await room.localParticipant.publishData(encoder.encode(JSON.stringify(useAppStore.getState().servers.flatMap(s=>s.channels))),{reliable:true,topic:'community-channels'})},
}))
