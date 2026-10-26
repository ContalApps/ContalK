import { create } from 'zustand'
import { Room, RoomEvent } from '../media/realtime'
import { useAppStore } from './useAppStore'
import { useVoiceStore } from './useVoiceStore'
import type { Attachment, MessageOptions } from './useAppStore'
import type { User } from './useAuthStore'
import { useFriendStore } from './useFriendStore'
import { centralCommand, centralEnabled, centralPresenceToken } from '../roles/transport'

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
export const useCommunityStore = create<{ members: Member[]; status: string; profileError: string | null; connect: (user: User) => Promise<void>; disconnect: () => void; updateProfile: (user: User) => Promise<void>; broadcastChannels: () => Promise<void>; renameChannel:(serverId:string,channelId:string,name:string)=>Promise<void>; deleteChannel: (serverId: string, channelId: string) => Promise<void>; sendMessage: (channelId: string, content: string, destination?: string, attachment?: Attachment, options?: MessageOptions) => Promise<void>; changeMessage:(channelId:string,id:string,content?:string)=>Promise<void> }>((set,get) => ({
  members: cachedMembers(), status: 'offline', profileError: null,
  disconnect: () => { generation++; clearInterval(friendRetry); useFriendStore.getState().activate(null); const previous = room; room = null; void previous?.disconnect(); set({ members: get().members.map(m=>({...m,online:false})), status:'offline' }) },
  connect: async user => {
    get().disconnect()
    const version = generation
    set({status:'connecting',profileError:null})
    const connection = new Room({ presence: true, tokenProvider: () => centralPresenceToken(user.display_name) })
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
    const transfers = new Map<string, { chunks: string[]; next: number; total: number; expires: number }>()
    const receive = (payload: Uint8Array, _participant: unknown, _kind: unknown, topic?: string) => {
      if (room !== connection) return
      if(centralEnabled()&&['community-channels','community-channel-deletions-v1'].includes(topic||''))return
      if(topic === 'contalk-friendship-v1') {
        const participant = _participant as {identity?: string; name?: string}
        if (!participant?.identity || !connection.remoteParticipants.has(participant.identity) || payload.byteLength > 2000) return
        try { void useFriendStore.getState().receive(participant.identity, participant.name || participant.identity, JSON.parse(new TextDecoder().decode(payload))).catch(() => {}) } catch { /* Invalid friendship packet. */ }
        return
      }
      if(topic==='community-message-change-v1') {
        const participant=_participant as {identity?:string}
        if(!participant?.identity || !connection.remoteParticipants.has(participant.identity) || payload.byteLength>12000)return
        try{const change=JSON.parse(new TextDecoder().decode(payload));if(centralEnabled()&&!String(change.channelId).startsWith('dm:'))return;if(typeof change.channelId==='string'&&typeof change.id==='string'&&(change.content===undefined||typeof change.content==='string'))useAppStore.getState().changeMessage(change.channelId,change.id,participant.identity,change.content)}catch{/* Invalid change. */}
        return
      }
      if(topic==='community-attachment-v1') {
        const participant = _participant as {identity?: string}
        if(!participant?.identity || !connection.remoteParticipants.has(participant.identity) || payload.byteLength > 12000)return
        try {
          const part = JSON.parse(new TextDecoder().decode(payload))
          if(typeof part.id !== 'string' || part.id.length > 80 || !Number.isInteger(part.index) || !Number.isInteger(part.total) || part.total < 1 || part.total > 180 || typeof part.chunk !== 'string' || part.chunk.length > 8000)return
          for(const [key,value] of transfers)if(value.expires < Date.now())transfers.delete(key)
          const key = participant.identity + ':' + part.id
          if(part.index === 0 && transfers.size < 8)transfers.set(key,{chunks:[],next:0,total:part.total,expires:Date.now()+60000})
          const transfer = transfers.get(key)
          if(!transfer || part.index !== transfer.next || part.total !== transfer.total){transfers.delete(key);return}
          transfer.chunks.push(part.chunk);transfer.next++
          if(transfer.next === transfer.total){transfers.delete(key);receive(encoder.encode(transfer.chunks.join('')),_participant,_kind,'community-message')}
        } catch { /* Invalid transfer. */ }
        return
      }
      if(topic==='community-message') {
        const participant=_participant as {identity?:string;name?:string}
        if(!participant?.identity || payload.byteLength>1450000)return
        try {
          const message=JSON.parse(new TextDecoder().decode(payload))
          if(typeof message.content!=='string'||message.content.length>2000||typeof message.channelId!=='string')return
          if(centralEnabled()&&!message.channelId.startsWith('dm:'))return
          if(message.attachment?.storageId) {
            const a=message.attachment
            if(!/^[0-9a-f-]{36}$/.test(a.storageId)||typeof a.name!=='string'||a.name.length>200||typeof a.type!=='string'||a.type.length>100||!Number.isSafeInteger(a.size)||a.size<0||a.size>2*1024**3||a.data!==''||(a.thumbnail!==undefined&&(typeof a.thumbnail!=='string'||a.thumbnail.length>40000||!/^[A-Za-z0-9+/=]+$/.test(a.thumbnail))))return
          } else if(message.attachment) {
            const a=message.attachment
            if(typeof a.name !== 'string' || a.name.length > 200 || typeof a.type !== 'string' || a.type.length > 100 || !Number.isInteger(a.size) || a.size < 0 || a.size > 1048576 || typeof a.data !== 'string' || a.data.length > 1398200 || !/^data:application\/octet-stream;base64,[A-Za-z0-9+/]*={0,2}$/.test(a.data) || a.data.length - 37 !== 4*Math.ceil(a.size/3))return
          }
          const direct='dm:'+ [connection.localParticipant.identity,participant.identity].sort().join(':')
          if(message.channelId!==direct&&!useAppStore.getState().servers.some(s=>s.channels.some(c=>c.type==='text'&&c.id===message.channelId)))return
          useAppStore.getState().addMessage(message.channelId,message.content,{username:participant.identity,display_name:participant.name||participant.identity},message.attachment,{id:typeof message.id==='string'&&message.id.length<=100?message.id:undefined,preview:message.preview!==false,once:message.once===true})
        } catch { /* Ignore invalid messages. */ }
        return
      }
      if(topic === 'community-channel-deletions-v1') {
        const participant = _participant as { identity?: string }
        if (!participant?.identity || !connection.remoteParticipants.has(participant.identity) || payload.byteLength > 16000) return
        try {
          const deletions = JSON.parse(new TextDecoder().decode(payload))
          if (!Array.isArray(deletions)) return
          for (const item of deletions.slice(0,200)) {
            if (typeof item.id !== 'string' || !item.id || item.id.length > 80 || item.serverId !== 'srv-1') continue
            useAppStore.getState().removeChannel(item.serverId, item.id)
            if (useVoiceStore.getState().activeChannelId === item.id) void useVoiceStore.getState().leaveChannel()
          }
        } catch { /* Ignore malformed deletions. */ }
        return
      }
      if(topic!=='community-channels' || payload.byteLength>60000) return
      try { const channels=JSON.parse(new TextDecoder().decode(payload)); if(!Array.isArray(channels))return
        for(const c of channels.slice(0,200)) if(typeof c.id==='string'&&c.id.length<=80&&typeof c.name==='string'&&c.name.length<=60&&c.serverId==='srv-1'&&['voice','text'].includes(c.type)) {
          useAppStore.getState().addChannel(c.serverId,c.name,c.type,c.id,c.nameUpdatedAt)
          if(typeof c.nameUpdatedAt==='number')useAppStore.getState().renameChannel(c.serverId,c.id,c.name,c.nameUpdatedAt)
          const current=useAppStore.getState().servers.find(s=>s.id===c.serverId)?.channels.find(ch=>ch.id===c.id)
          if(current)useVoiceStore.getState().renameActiveChannel?.(current.id,current.name)
        }
      } catch { /* Ignore malformed peer data. */ }
    }
    connection.on(RoomEvent.ParticipantConnected,()=>{refresh();void get().broadcastChannels().catch(()=>{});void useFriendStore.getState().flush()})
    connection.on(RoomEvent.ParticipantDisconnected,refresh)
    connection.on(RoomEvent.ParticipantMetadataChanged,refresh)
    connection.on(RoomEvent.ParticipantNameChanged,refresh)
    connection.on(RoomEvent.DataReceived,receive)
    connection.on(RoomEvent.Reconnecting,()=>{if(room===connection)set({status:'reconnecting',members:get().members.map(m=>({...m,online:false}))})})
    connection.on(RoomEvent.Reconnected,()=>{if(room===connection){set({status:'online'});refresh();void useFriendStore.getState().flush();void get().broadcastChannels().catch(()=>{})}})
    connection.on(RoomEvent.Disconnected,()=>{if(room===connection)set({status:'offline',members:get().members.map(m=>({...m,online:false}))})})
    try {
      const local = await window.contalkDesktop?.listAccounts().catch(()=>[])
      if(version!==generation)return
      if(local) set({members:[...new Map([...get().members,...local.map(m=>({...m,online:false}))].map(m=>[m.username,m])).values()]})
      const authority=await centralPresenceToken(user.display_name)
      if(!authority)throw new Error('Sua conta ainda não está conectada à comunidade. Saia e entre novamente com a internet ligada.')
      const token=authority.token
      if(version!==generation)return
      await connection.connect(authority.url,token)
      if(version!==generation){await connection.disconnect();return}
      set({status:'online'});refresh()
      friendRetry = setInterval(() => { void useFriendStore.getState().flush(); void get().broadcastChannels().catch(()=>{}) }, 10000)
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
  sendMessage: async (channelId, content, destination, attachment, options) => {
    if(centralEnabled()&&!destination&&!channelId.startsWith('dm:')){await centralCommand({type:'message-send',id:crypto.randomUUID(),channel:channelId,content,attachment,expression:options?.expression,voice:options?.voice,tts:options?.tts,poll:options?.poll,preview:options?.preview,once:options?.once});return}
    if(options?.expression)throw new Error('Expressões exigem um canal conectado à comunidade.')
    if(options?.voice)throw new Error('Mensagens de voz exigem um canal conectado à comunidade.')
    if(options?.tts)throw new Error('A leitura em voz exige um canal conectado à comunidade.')
    const connection=room
    if(!connection || connection.state!=='connected')throw new Error('Aguarde a conexão para enviar mensagens.')
    if((!content.trim()&&!attachment)||content.length>2000)throw new Error('Escreva uma mensagem de até 2000 caracteres.')
    if(destination&&!connection.remoteParticipants.has(destination))throw new Error('Essa pessoa está offline.')
    if(destination&&attachment?.storageId)await window.contalkDesktop?.shareStorageFile(attachment.storageId,destination)
    if(room!==connection||connection.state!=='connected')throw new Error('A conta ou a conexão foi alterada. Tente enviar novamente.')
    const metadata={id:crypto.randomUUID(),preview:options?.preview!==false,once:options?.once===true}
    const data = JSON.stringify({channelId,content,attachment,...metadata})
    if(attachment) {
      if((!attachment.storageId&&attachment.size > 1048576) || attachment.size>2*1024**3 || data.length > 1440000)throw new Error('O arquivo deve ter até 1 MB.')
      const id=crypto.randomUUID(), total=Math.ceil(data.length/8000)
      for(let index=0;index<total;index++)await connection.localParticipant.publishData(encoder.encode(JSON.stringify({id,index,total,chunk:data.slice(index*8000,(index+1)*8000)})),{reliable:true,topic:'community-attachment-v1',...(destination?{destinationIdentities:[destination]}:{})})
    } else await connection.localParticipant.publishData(encoder.encode(data),{reliable:true,topic:'community-message',...(destination?{destinationIdentities:[destination]}:{})})
    if(room!==connection)return
    useAppStore.getState().addMessage(channelId,content,{username:connection.localParticipant.identity,display_name:connection.localParticipant.name||connection.localParticipant.identity},attachment,metadata)
  },
  changeMessage:async(channelId,id,content)=>{
    if(centralEnabled()&&!channelId.startsWith('dm:')){await centralCommand(content===undefined?{type:'message-delete',channel:channelId,id}:{type:'message-edit',channel:channelId,id,content});return}
    if(!room||room.state!=='connected')throw new Error('Aguarde a conexão.')
    const message=useAppStore.getState().messages[channelId]?.find(m=>m.id===id)
    if(message?.userId!==room.localParticipant.identity)throw new Error('Somente o autor pode alterar a mensagem.')
    if(content!==undefined&&(!content.trim()||content.length>2000))throw new Error('Escreva até 2000 caracteres.')
    const destination=channelId.startsWith('dm:')?channelId.split(':').filter(p=>p!=='dm'&&p!==room!.localParticipant.identity):undefined
    await room.localParticipant.publishData(encoder.encode(JSON.stringify({channelId,id,content})),{reliable:true,topic:'community-message-change-v1',...(destination?{destinationIdentities:destination}:{})})
    useAppStore.getState().changeMessage(channelId,id,room.localParticipant.identity,content)
  },
  renameChannel:async(serverId,channelId,name)=>{
    if(centralEnabled()){await centralCommand({type:'channel-rename',id:channelId,name});return}
    if(!name.trim()||name.trim().length>60)throw new Error('Informe um nome de até 60 caracteres.')
    useAppStore.getState().renameChannel(serverId,channelId,name)
    const current=useAppStore.getState().servers.find(s=>s.id===serverId)?.channels.find(c=>c.id===channelId)
    if(!current)throw new Error('Canal não encontrado.')
    useVoiceStore.getState().renameActiveChannel?.(channelId,current.name)
    await get().broadcastChannels()
  },
  deleteChannel: async (serverId, channelId) => {
    if(centralEnabled()){await centralCommand({type:'channel-delete',id:channelId});return}
    useAppStore.getState().removeChannel(serverId, channelId)
    if (useVoiceStore.getState().activeChannelId === channelId) await useVoiceStore.getState().leaveChannel()
    await get().broadcastChannels()
  },
  broadcastChannels: async () => {
    if(centralEnabled())return
    const connection = room
    if (!connection || connection.state !== 'connected') throw new Error('A sincronização aguarda a conexão.')
    const sendRecords = async (records: unknown[], topic: string) => {
      let batch: unknown[] = []
      for (const record of records) {
        if (encoder.encode(JSON.stringify([...batch,record])).byteLength > 10000 && batch.length) {
          await connection.localParticipant.publishData(encoder.encode(JSON.stringify(batch)),{reliable:true,topic}); batch = []
        }
        batch.push(record)
      }
      if (batch.length) await connection.localParticipant.publishData(encoder.encode(JSON.stringify(batch)),{reliable:true,topic})
    }
    await sendRecords(Object.entries(useAppStore.getState().deletedChannels || {}).map(([id,serverId])=>({id,serverId})), 'community-channel-deletions-v1')
    await sendRecords(useAppStore.getState().servers.flatMap(s=>s.channels), 'community-channels')
  },
}))
