import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk'
import { can } from '../../src/roles/permissions.ts'

export function communityRoom(serverId, channelId) { return `contalk-community:${serverId}:${channelId}` }
export function voicePermissions(policy, actor, channelId) {
  const connect = can(policy, actor, 'VIEW_CHANNEL', channelId) && can(policy, actor, 'CONNECT', channelId)
  const sources = []
  if (connect && can(policy, actor, 'SPEAK', channelId)) sources.push(TrackSource.MICROPHONE)
  if (connect && can(policy, actor, 'STREAM', channelId)) sources.push(TrackSource.CAMERA, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO)
  return { canSubscribe: connect, canPublish: sources.length > 0, canPublishData: false, canPublishSources: sources, canUpdateOwnMetadata: true }
}
export function createCommunityVoice({ url, apiKey, apiSecret, client }) {
  const endpoint = new URL(url)
  if (!['wss:', 'ws:', 'https:', 'http:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || !apiKey || !apiSecret) throw new Error('Configuração privada de voz inválida.')
  const rooms = client || new RoomServiceClient(url, apiKey, apiSecret)
  return {
    async presenceToken(actor,name){
      const token=new AccessToken(apiKey,apiSecret,{identity:actor,name,ttl:'5m'})
      token.addGrant({roomJoin:true,room:'contalk-community-presence-v2',canPublish:false,canPublishSources:[],canSubscribe:true,canPublishData:true,canUpdateOwnMetadata:true})
      return {url,token:await token.toJwt()}
    },
    async occupants(server,actor) {
      const result={}
      for(const channel of server.channels.filter(channel=>channel.type==='voice'&&can(server.policy,actor,'VIEW_CHANNEL',channel.id))){
        let participants
        try{participants=await rooms.listParticipants(communityRoom(server.id,channel.id))}catch(error){if(error.code==='not_found'||error.code===5||error.status===404){result[channel.id]=[];continue}throw error}
        result[channel.id]=participants.filter(person=>server.policy.members.includes(person.identity)).map(person=>({identity:person.identity,name:(person.name||person.identity).slice(0,40),isLocal:person.identity===actor,isSpeaking:false,isAudioEnabled:person.tracks?.some(track=>track.source===TrackSource.MICROPHONE&&!track.muted)||false,isVideoEnabled:person.tracks?.some(track=>track.source===TrackSource.CAMERA&&!track.muted)||false,isScreenShareEnabled:person.tracks?.some(track=>track.source===TrackSource.SCREEN_SHARE&&!track.muted)||false}))
      }
      return result
    },
    async token(server, actor, channelId) {
      const grant = voicePermissions(server.policy, actor, channelId)
      if (!grant.canSubscribe) throw new Error('Você não pode se conectar a este canal.')
      const token = new AccessToken(apiKey, apiSecret, { identity: actor, name: actor, ttl: '5m' })
      token.addGrant({ roomJoin: true, room: communityRoom(server.id, channelId), ...grant })
      return { url, token: await token.toJwt() }
    },
    async reconcile(previous, current) {
      const ids = new Set([...previous.channels, ...current.channels].filter(channel => channel.type === 'voice').map(channel => channel.id))
      for (const channelId of ids) {
        const room = communityRoom(current.id, channelId)
        // Listing connected people avoids creating phantom participants or
        // issuing one request for every offline member on each role edit.
        let participants
        try { participants = await rooms.listParticipants(room) }
        catch (error) { if (error.code === 'not_found' || error.code === 5 || error.status === 404) continue; throw error }
        for (const participant of participants) {
          const grant = voicePermissions(current.policy, participant.identity, channelId)
          const exists = current.channels.some(channel => channel.id === channelId && channel.type === 'voice')
          if (!exists || !grant.canSubscribe) await rooms.removeParticipant(room, participant.identity)
          else await rooms.updateParticipant(room, participant.identity, { permission: { canSubscribe: grant.canSubscribe, canPublish: grant.canPublish, canPublishData: false, canPublishSources: grant.canPublishSources, canUpdateMetadata: true } })
        }
      }
    },
  }
}
