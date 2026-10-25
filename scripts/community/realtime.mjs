import { randomBytes, createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import { networkInterfaces } from 'node:os'
import { WebSocketServer } from 'ws'
import { createWorker } from 'mediasoup'
import { can } from '../../src/roles/permissions.ts'

const sources = ['microphone', 'camera', 'screen_share', 'screen_share_audio']
export function voicePermissions(policy, actor, channel) {
  const connect = can(policy, actor, 'VIEW_CHANNEL', channel) && can(policy, actor, 'CONNECT', channel)
  const serverMuted=policy.voiceRestrictions?.[actor]?.muted===true,serverDeafened=policy.voiceRestrictions?.[actor]?.deafened===true
  return { canPrioritySpeaker:connect&&!serverMuted&&!serverDeafened&&can(policy,actor,'SPEAK',channel)&&can(policy,actor,'PRIORITY_SPEAKER',channel),canUseVoiceActivity:connect&&can(policy,actor,'USE_VAD',channel),canSubscribe:connect,canReceiveAudio:connect&&!serverDeafened,serverMuted,serverDeafened,canPublishSources:connect?sources.filter(source=>can(policy,actor,source==='microphone'?'SPEAK':'STREAM',channel)&&(source!=='microphone'||!serverMuted&&!serverDeafened)):[] }
}
export function mediaListenInfos({ announcedAddress, mediaPort, exposeInternalIp = false, interfaces = networkInterfaces() }) {
  const ip = exposeInternalIp ? Object.values(interfaces).flat().find(info => info?.family === 'IPv4' && !info.internal)?.address : '0.0.0.0'
  if (!ip) throw new Error('Nenhum endereço IPv4 interno disponível para a mídia.')
  return ['udp', 'tcp'].map(protocol => ({ protocol, ip, announcedAddress, exposeInternalIp, port: mediaPort }))
}
export function createCommunityVoice({ url, announcedAddress = '127.0.0.1', mediaPort = 40000, turnUrls = [], turnSecret, exposeInternalIp = false, createMediaWorker = createWorker }) {
  const endpoint = new URL(url)
  if (!['wss:', 'ws:'].includes(endpoint.protocol) || endpoint.protocol === 'ws:' && !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('Use um endereço WSS público para a sinalização.')
  if (!Number.isInteger(mediaPort) || mediaPort < 1024 || mediaPort > 65535) throw new Error('Porta de mídia inválida.')
  if (isIP(announcedAddress) !== 4 || announcedAddress === '0.0.0.0' || endpoint.protocol === 'wss:' && announcedAddress.startsWith('127.')) throw new Error('Configure o IPv4 público anunciado para mídia.')
  if (!Array.isArray(turnUrls) || turnUrls.some(value => typeof value !== 'string' || !/^turns?:[^\s]+$/.test(value)) || turnUrls.length && (typeof turnSecret !== 'string' || turnSecret.length < 32)) throw new Error('Configure URLs TURN e um segredo privado de pelo menos 32 caracteres.')
  const tickets = new Map(), rooms = new Map(), roomPromises = new Map(), sessions = new Set()
  let worker, rtcServer, workerPromise, wss, snapshotFor
  const issue = (actor, room, name = actor, reserved = false) => {
    for (const [key, value] of tickets) if (value.expires < Date.now()) tickets.delete(key)
    if (tickets.size >= 1000) throw new Error('Muitas solicitações de conexão.')
    const token = randomBytes(32).toString('hex')
    tickets.set(token, { actor, room, name, reserved, expires: Date.now() + 30000 })
    return { url, token }
  }
  const send = (session, value) => {
    if (session.socket.readyState !== 1) return
    if (session.socket.bufferedAmount > 4 * 1024 ** 2) { session.socket.terminate(); return }
    session.socket.send(JSON.stringify(value))
  }
  const event = (session, name, data) => send(session, { event: name, data })
  const roomMembers = session => [...sessions].filter(peer => peer.room === session.room)
  const broadcast = (session, name, data) => roomMembers(session).forEach(peer => event(peer, name, data))
  const moderation = session => {const grant=permission(session);return {serverMuted:!!grant.serverMuted,serverDeafened:!!grant.serverDeafened,canPublishMicrophone:grant.canPublishSources.includes('microphone'),canUseVoiceActivity:!!grant.canUseVoiceActivity,canPrioritySpeaker:!!grant.canPrioritySpeaker}}
  const profile = session => ({ identity: session.actor, name:session.name,serverNickname:session.room==='presence'?null:snapshotFor(session.actor,session.serverId).nicknames?.[session.actor]||null, metadata: session.metadata || '',...moderation(session) })
  const permission = session => session.room === 'presence' ? { canSubscribe: true, canPublishSources: [] } : voicePermissions(snapshotFor(session.actor, session.serverId).policy, session.actor, session.channelId)
  const microphoneAllowed=session=>permission(session).canPublishSources.includes('microphone')&&(session.inputMode==='push-to-talk'?session.holdUntil>Date.now():permission(session).canUseVoiceActivity)
  const broadcastPriority=(session,force=false)=>{const ids=roomMembers(session).filter(peer=>peer.priority&&microphoneAllowed(peer)&&permission(peer).canPrioritySpeaker&&[...peer.producers.values()].some(producer=>producer.appData.source==='microphone'&&!producer.paused)).map(peer=>peer.actor),room=rooms.get(session.room),encoded=JSON.stringify(ids);if(!force&&room?.priorityState===encoded)return;if(room)room.priorityState=encoded;broadcast(session,'prioritySpeakers',ids)}
  const pauseMicrophone=async (session,reason='key-release')=>{for(const producer of session.producers.values())if(producer.appData.source==='microphone'&&!producer.paused){await producer.pause();broadcast(session,'producerPaused',{producerId:producer.id,paused:true,reason})}}
  const releasePushToTalk=session=>{clearTimeout(session.holdTimer);session.holdUntil=0;session.priority=false;broadcastPriority(session);return pauseMicrophone(session)}
  const closeProducer = (session, producer) => {
    session.producers.delete(producer.id); producer.close();if(producer.appData.source==='microphone')broadcastPriority(session)
    broadcast(session, 'producerClosed', { producerId: producer.id, identity: session.actor })
  }
  const cleanup = session => {
    if (!sessions.delete(session)) return
    clearTimeout(session.holdTimer);session.holdUntil=0
    if(session.pendingMove){tickets.delete(session.pendingMove);session.pendingMove=undefined}
    for (const producer of [...session.producers.values()]) closeProducer(session, producer)
    for (const transport of session.transports.values()) transport.close()
    broadcast(session, 'left', { identity: session.actor });broadcastPriority(session)
    if (session.room !== 'presence' && !roomMembers(session).length) {
      const room = rooms.get(session.room); room?.router.close(); rooms.delete(session.room)
    }
  }
  const mediaRoom = async name => {
    if (!workerPromise) workerPromise = (async () => {
      worker = await createMediaWorker({ logLevel: 'warn' })
      worker.on('died', () => { for (const session of sessions) session.socket.close(1011, 'Media unavailable'); workerPromise = undefined; worker = undefined; rtcServer = undefined; rooms.clear() })
      rtcServer = await worker.createWebRtcServer({ listenInfos: mediaListenInfos({ announcedAddress, mediaPort, exposeInternalIp }) })
    })().catch(error => { worker?.close(); workerPromise = undefined; throw error })
    await workerPromise
    if (!rooms.has(name) && !roomPromises.has(name)) roomPromises.set(name, (async () => {
      const router = await worker.createRouter({ mediaCodecs: [
        { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
        { kind: 'video', mimeType: 'video/VP8', clockRate: 90000, parameters: { 'x-google-start-bitrate': 800 } },
      ] })
      // Room creation runs inside the per-socket queue, but different sockets can race.
      try {
        const observer = await router.createAudioLevelObserver({ maxEntries: 4, threshold: -55, interval: 500 })
        const room = { router, observer }; rooms.set(name, room)
        observer.on('volumes', volumes => {
          const identities = volumes.map(({ producer }) => producer.appData.identity)
          for (const peer of sessions) if (peer.room === name) event(peer, 'speakers', identities)
        })
        observer.on('silence', () => { for (const peer of sessions) if (peer.room === name) event(peer, 'speakers', []) })
      } catch (error) { router.close(); throw error }
    })().finally(() => roomPromises.delete(name)))
    if (roomPromises.has(name)) await roomPromises.get(name)
    return rooms.get(name)
  }
  const rpc = async (session, method, data = {}) => {
    if (!permission(session).canSubscribe) throw new Error('Você não pode entrar neste canal.')
    if (method === 'profile') {
      if (typeof data.name === 'string' && data.name.trim() && data.name.length <= 40) session.name = data.name.trim()
      if (typeof data.metadata === 'string' && data.metadata.length <= 55000) session.metadata = data.metadata
      broadcast(session, 'profile', profile(session)); return {}
    }
    if (method === 'data') {
      if (session.room !== 'presence' || typeof data.payload !== 'string' || data.payload.length > 1500000 || typeof data.topic !== 'string' || data.topic.length > 100) throw new Error('Mensagem inválida.')
      if (data.destinations !== undefined && (!Array.isArray(data.destinations) || data.destinations.length > 4 || data.destinations.some(value => typeof value !== 'string'))) throw new Error('Destinatário inválido.')
      for (const peer of roomMembers(session)) if (peer !== session && (!data.destinations?.length || data.destinations.includes(peer.actor))) event(peer, 'data', { ...data, participant: profile(session) })
      return {}
    }
    if (session.room === 'presence') throw new Error('Presença não publica mídia.')
    if(method==='input-mode'){
      if(!['voice-activity','push-to-talk'].includes(data.mode)||data.mode==='voice-activity'&&!permission(session).canUseVoiceActivity)throw new Error('Modo de entrada não autorizado.')
      await releasePushToTalk(session);session.inputMode=data.mode;return {mode:session.inputMode}
    }
    if(method==='input-press'){
      if(session.inputMode!=='push-to-talk'||typeof data.pressed!=='boolean')throw new Error('Pressionar para falar não está ativo.')
      if(!data.pressed){await releasePushToTalk(session);return {pressed:false}}
      if(!permission(session).canPublishSources.includes('microphone'))throw new Error('Seu microfone está bloqueado.')
      if(data.priority!==undefined&&typeof data.priority!=='boolean')throw new Error('Prioridade inválida.')
      session.priority=data.priority===true&&permission(session).canPrioritySpeaker
      clearTimeout(session.holdTimer);session.holdUntil=Date.now()+1800
      session.holdTimer=setTimeout(()=>{session.holdUntil=0;session.priority=false;broadcastPriority(session);void pauseMicrophone(session,'lease-expired').catch(()=>{for(const producer of [...session.producers.values()])if(producer.appData.source==='microphone')closeProducer(session,producer)})},1800)
      for(const producer of session.producers.values())if(producer.appData.source==='microphone'&&producer.paused){await producer.resume();if(!microphoneAllowed(session)){await producer.pause();continue}broadcast(session,'producerPaused',{producerId:producer.id,paused:false})}
      broadcastPriority(session);return {pressed:true,priority:session.priority}
    }
    const room = await mediaRoom(session.room)
    if (!sessions.has(session)) {
      if (!roomMembers(session).length) { room.router.close(); rooms.delete(session.room) }
      throw new Error('Sessão encerrada.')
    }
    if (method === 'capabilities') return { routerRtpCapabilities: room.router.rtpCapabilities }
    if (method === 'createTransport') {
      if (!['send', 'recv'].includes(data.direction) || session.transports.size >= 2) throw new Error('Limite de transportes.')
      const transport = await room.router.createWebRtcTransport({ webRtcServer: rtcServer, enableUdp: true, enableTcp: true, preferUdp: true, initialAvailableOutgoingBitrate: 1500000, appData: { direction: data.direction } })
      await transport.setMaxIncomingBitrate(8000000)
      if (!sessions.has(session)) { transport.close(); throw new Error('Sessão encerrada.') }
      session.transports.set(transport.id, transport)
      transport.on('dtlsstatechange', state => { if (state === 'closed') transport.close() })
      let iceServers = []
      if (turnUrls.length && turnSecret) {
        const username = `${Math.floor(Date.now() / 1000) + 3600}:${session.actor}`
        iceServers = [{ urls: turnUrls, username, credential: createHmac('sha1', turnSecret).update(username).digest('base64') }]
      }
      return { id: transport.id, iceParameters: transport.iceParameters, iceCandidates: transport.iceCandidates, dtlsParameters: transport.dtlsParameters, iceServers }
    }
    const transport = session.transports.get(data.transportId)
    if (method === 'connectTransport') { if (!transport) throw new Error('Transporte inválido.'); await transport.connect({ dtlsParameters: data.dtlsParameters }); return {} }
    if (method === 'produce') {
      if (!transport || transport.appData.direction !== 'send' || !permission(session).canPublishSources.includes(data.source) || data.kind !== (['microphone', 'screen_share_audio'].includes(data.source) ? 'audio' : 'video') || [...session.producers.values()].some(producer => producer.appData.source === data.source)) throw new Error('Publicação não autorizada.')
      if(data.source==='microphone'&&!microphoneAllowed(session)&&!(session.inputMode==='push-to-talk'&&data.paused===true))throw new Error('Ative Pressionar para falar ou peça Atividade de voz.')
      const producer = await transport.produce({ kind: data.kind, rtpParameters: data.rtpParameters, paused: !!data.paused, appData: { source: data.source, identity: session.actor } })
      if (!sessions.has(session) || !permission(session).canPublishSources.includes(data.source)) { producer.close(); throw new Error('Publicação não autorizada.') }
      if(data.source==='microphone'&&!microphoneAllowed(session)&&!producer.paused){await producer.pause()}
      session.producers.set(producer.id, producer)
      producer.on('transportclose', () => closeProducer(session, producer))
      if (data.source === 'microphone') await room.observer.addProducer({ producerId: producer.id })
      broadcast(session, 'producer', { producerId: producer.id, identity: session.actor, source: data.source, paused: producer.paused })
      if(data.source==='microphone')broadcastPriority(session)
      return { id: producer.id }
    }
    if (method === 'producers') return [...sessions].filter(peer => peer.room === session.room && peer !== session).flatMap(peer => [...peer.producers.values()].map(producer => ({ producerId: producer.id, identity: peer.actor, source: producer.appData.source, paused: producer.paused })))
    if (method === 'producerControl') {
      const producer = session.producers.get(data.producerId)
      if (!producer) throw new Error('Publicação inválida.')
      if (data.action === 'close') closeProducer(session, producer)
      else if (data.action === 'pause') { await producer.pause(); broadcast(session, 'producerPaused', { producerId: producer.id, paused: true });if(producer.appData.source==='microphone')broadcastPriority(session) }
      else if (data.action === 'resume' && permission(session).canPublishSources.includes(producer.appData.source)&&(producer.appData.source!=='microphone'||microphoneAllowed(session))) { await producer.resume(); broadcast(session, 'producerPaused', { producerId: producer.id, paused: false });if(producer.appData.source==='microphone')broadcastPriority(session) }
      else throw new Error('Publicação não autorizada.')
      return {}
    }
    if (method === 'consume') {
      const owner = roomMembers(session).find(peer => peer !== session && peer.producers.has(data.producerId))
      if (!owner || !transport || transport.appData.direction !== 'recv' || session.consumers.size >= 16 || !room.router.canConsume({ producerId: data.producerId, rtpCapabilities: data.rtpCapabilities })) throw new Error('Recepção não autorizada.')
      const consumer = await transport.consume({ producerId: data.producerId, rtpCapabilities: data.rtpCapabilities, paused: true })
      if(!sessions.has(session)||!permission(session).canSubscribe){consumer.close();throw new Error('Sessão encerrada.')}
      session.consumers.set(consumer.id, consumer)
      consumer.on('producerclose', () => { session.consumers.delete(consumer.id); event(session, 'consumerClosed', { consumerId: consumer.id }) })
      consumer.on('transportclose', () => session.consumers.delete(consumer.id))
      return { id: consumer.id, producerId: data.producerId, kind: consumer.kind, rtpParameters: consumer.rtpParameters, identity: owner.actor, source: owner.producers.get(data.producerId).appData.source, paused: consumer.producerPaused }
    }
    if (method === 'resumeConsumer') {
      const consumer=session.consumers.get(data.consumerId);if(!consumer)throw new Error('Recepção inválida.')
      consumer.appData.ready=true
      if(consumer.kind==='audio'&&!permission(session).canReceiveAudio)return {paused:true}
      await consumer.resume()
      if(consumer.kind==='audio'&&!permission(session).canReceiveAudio)await consumer.pause()
      return {paused:consumer.paused}
    }
    throw new Error('Operação inválida.')
  }
  return {
    hasParticipant(serverId,member,channelId){return [...sessions].some(peer=>peer.serverId===serverId&&peer.channelId===channelId&&peer.actor===member&&peer.socket.readyState===1)},
    prepareMove({serverId,member,fromChannelId,destinationId,destinationName}){
      const source=[...sessions].find(peer=>peer.serverId===serverId&&peer.actor===member&&peer.channelId===fromChannelId&&peer.socket.readyState===1)
      if(!source)throw new Error('A pessoa não está mais conectada a este canal.')
      let authority
      if(destinationId){
        if(!source.features.includes('voice-move-v1'))throw new Error('O participante precisa atualizar o aplicativo para ser movido.')
        const room=serverId+'/'+destinationId
        const reserved=[...tickets.values()].filter(ticket=>ticket.room===room&&ticket.reserved&&ticket.expires>=Date.now()).length
        if([...sessions].filter(peer=>peer.room===room).length+reserved>=4)throw new Error('O destino já tem quatro participantes ou vagas reservadas.')
        authority=issue(member,room,source.name,true);source.pendingMove=authority.token
      }
      let finished=false
      const cancel=()=>{if(finished)return;finished=true;if(authority){tickets.delete(authority.token);if(source.pendingMove===authority.token)source.pendingMove=undefined}}
      return {cancel,commit(){
        if(finished)return
        if(!sessions.has(source)||source.socket.readyState!==1){cancel();return}
        finished=true;source.pendingMove=undefined
        if(destinationId)event(source,'moved',{serverId,channelId:destinationId,channelName:destinationName,authority})
        else event(source,'moderatorDisconnected',{})
        cleanup(source);source.socket.close(destinationId?4009:4003,destinationId?'Moved by moderator':'Disconnected by moderator')
      }}
    },
    presenceToken: async (actor, name) => issue(actor, 'presence', name),
    async token(server, actor, channelId) {
      if (!voicePermissions(server.policy, actor, channelId).canSubscribe) throw new Error('Você não pode se conectar a este canal.')
      return issue(actor, `${server.id}/${channelId}`)
    },
    async occupants(server, actor) {
      return Object.fromEntries(server.channels.filter(channel => channel.type === 'voice' && can(server.policy, actor, 'VIEW_CHANNEL', channel.id)).map(channel => [channel.id, [...sessions].filter(peer => peer.room === `${server.id}/${channel.id}`&&server.policy.members.includes(peer.actor)).map(peer => ({ ...profile(peer), isLocal: peer.actor === actor, isSpeaking: false, isAudioEnabled: [...peer.producers.values()].some(producer => producer.appData.source === 'microphone' && !producer.paused), isVideoEnabled: [...peer.producers.values()].some(producer => producer.appData.source === 'camera'), isScreenShareEnabled: [...peer.producers.values()].some(producer => producer.appData.source === 'screen_share') }))]))
    },
    async reconcile(previous, current) {
      for (const session of sessions) if (session.serverId === current.id) {
        const grant = voicePermissions(current.policy, session.actor, session.channelId)
        if (!current.channels.some(channel => channel.id === session.channelId && channel.type === 'voice') || !grant.canSubscribe) { cleanup(session); session.socket.close(4003, 'Access revoked'); continue }
        for (const producer of [...session.producers.values()]) if (!grant.canPublishSources.includes(producer.appData.source)||producer.appData.source==='microphone'&&session.inputMode!=='push-to-talk'&&!grant.canUseVoiceActivity) closeProducer(session, producer)
        for(const consumer of session.consumers.values())if(consumer.kind==='audio'){
          if(!grant.canReceiveAudio&&!consumer.paused)await consumer.pause()
          else if(grant.canReceiveAudio&&consumer.appData.ready&&consumer.paused)await consumer.resume()
        }
        if(!grant.canPrioritySpeaker)session.priority=false
        broadcastPriority(session)
        const flags=moderation(session),encoded=JSON.stringify({...flags,serverNickname:profile(session).serverNickname})
        if(session.lastModeration!==encoded){session.lastModeration=encoded;event(session,'moderation',flags);broadcast(session,'profile',profile(session))}
      }
    },
    attach(server, getSnapshot) {
      snapshotFor = getSnapshot
      wss = new WebSocketServer({ server, path: endpoint.pathname, maxPayload: 1600000, perMessageDeflate: false })
      wss.on('connection', socket => {
        if (wss.clients.size > 32) { socket.close(1013, 'Server busy'); return }
        let session, queue = Promise.resolve(), frames = 0, queued = 0
        const timer = setTimeout(() => socket.close(4001, 'Authentication required'), 5000)
        socket.on('error', () => {})
        socket.on('close', () => { clearTimeout(timer); if (session) cleanup(session) })
        const limiter = setInterval(() => { frames = 0 }, 1000)
        socket.once('close', () => clearInterval(limiter))
        socket.on('message', payload => {
          if (++frames > 80 || ++queued > 16) { socket.close(4008, 'Rate limit'); return }
          queue = queue.then(async () => {
            if (socket.readyState !== 1) return
            let message
            try {
              message = JSON.parse(payload.toString())
              if (!session) {
                const ticket = tickets.get(message.token); tickets.delete(message.token)
                if (message.method !== 'auth' || !ticket || ticket.expires < Date.now()) throw new Error('Sessão expirada. Reconecte a comunidade.')
                const [serverId, channelId] = ticket.room.split('/')
                if (ticket.room !== 'presence') {
                  const current = snapshotFor(ticket.actor, serverId)
                  if (!current.channels.some(channel => channel.id === channelId && channel.type === 'voice') || !voicePermissions(current.policy, ticket.actor, channelId).canSubscribe) throw new Error('Acesso negado.')
                }
                const sameRoom = [...sessions].filter(peer => peer.room === ticket.room)
                for (const peer of sameRoom) if (peer.actor === ticket.actor) { cleanup(peer); peer.socket.close(4009, 'Session replaced') }
                if ([...sessions].filter(peer => peer.room === ticket.room).length + [...tickets.values()].filter(value=>value.room===ticket.room&&value.reserved&&value.expires>=Date.now()).length >= 4) throw new Error('A sala já tem quatro participantes.')
                session = { ...ticket, serverId, channelId, socket, features:Array.isArray(message.features)&&message.features.includes('voice-move-v1')?['voice-move-v1']:[], inputMode:'voice-activity',holdUntil:0,priority:false,metadata: '', transports: new Map(), producers: new Map(), consumers: new Map() }
                sessions.add(session); clearTimeout(timer)
                send(session, { id: message.id, data: { self: profile(session), peers: roomMembers(session).filter(peer => peer !== session).map(profile) } })
                broadcast(session, 'joined', profile(session));broadcastPriority(session,true); return
              }
              const result = await rpc(session, message.method, message.data)
              send(session, { id: message.id, data: result })
            } catch {
              if (!session) { socket.close(4003, 'Authentication failed'); return }
              send(session, { id: message?.id, error: 'Operação de comunicação recusada. Verifique sua conexão e permissões.' })
            }
          }).catch(() => socket.close(1011, 'Session error')).finally(() => { queued-- })
        })
      })
      const heartbeat = setInterval(() => { for (const socket of wss.clients) { if (socket.alive === false) socket.terminate(); else { socket.alive = false; socket.ping() } } }, 15000)
      wss.on('connection', socket => { socket.alive = true; socket.on('pong', () => { socket.alive = true }) })
      server.once('close', () => { clearInterval(heartbeat); for (const socket of wss.clients) socket.terminate(); wss.close(); worker?.close() })
    },
    close() { for (const session of sessions) session.socket.terminate(); worker?.close() },
  }
}
