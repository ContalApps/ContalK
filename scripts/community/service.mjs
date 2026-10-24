import http from 'node:http'
import { EventEmitter } from 'node:events'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { applyRoleCommand } from '../../src/roles/commands.ts'
import { can, canMentionRole, initialPolicy, permissionsFor, readMask } from '../../src/roles/permissions.ts'
import { validFileId, validInternalToken } from './files.mjs'

const identifier = value => typeof value === 'string' && /^[\w:-]{1,100}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value)
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key)
const copy = value => structuredClone(value)
const digest = value => createHash('sha256').update(value).digest('hex')
const RECENT_MESSAGE_COUNT=100
export class CommunityError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
function requireValue(condition, message, status = 400) { if (!condition) throw new CommunityError(status, message) }
function text(value, maximum) { requireValue(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maximum, `Use um texto entre 1 e ${maximum} caracteres.`); return value.trim() }
function requirePermission(server, actor, permission, channel) { requireValue(can(server.policy, actor, permission, channel), 'Você não tem permissão para esta ação.', 403) }
function updateMentions(message, policy, actor, channel) {
  message.roleMentions=[...new Set([...message.content.matchAll(/<@&([\w:-]{1,100})>/g)].map(match=>match[1]))].filter(id=>{const role=policy.roles.find(role=>role.id===id);return role&&canMentionRole(policy,actor,role,channel)})
  delete message.mentionsEveryone
  if(can(policy,actor,'MENTION_EVERYONE',channel)){if(/@everyone\b/.test(message.content))message.mentionsEveryone='all';else if(/@here\b/.test(message.content))message.mentionsEveryone='online'}
}

export function createCommunityState(members) {
  const id = 'srv-1'
  const channels = [
    ['ch-welcome', 'bem-vindo', 'text'], ['ch-general', 'geral', 'text'],
    ['ch-announcements', 'anúncios', 'text'], ['ch-offtopic', 'off-topic', 'text'],
    ['vc-general', 'Sala Geral', 'voice'], ['vc-streaming', 'Streaming', 'voice'], ['vc-music', 'Música', 'voice'],
  ].map(([channelId, name, type]) => ({ id: channelId, name, type, serverId: id }))
  return { schemaVersion: 1, servers: { [id]: { id, name: 'ConTALK HQ', revision: 0, policy: initialPolicy(id, members), channels, messages: {}, audit: [] } } }
}

// Atomic replacement is completed before publishing a revision to any client.
export function jsonCommunityStorage(filename) {
  const target = path.resolve(filename)
  return {
    load: () => fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf8')) : null,
    save(state) {
      fs.mkdirSync(path.dirname(target), { recursive: true })
      const temporary = target + '.' + randomUUID() + '.tmp'
      try {
        const descriptor = fs.openSync(temporary, 'wx', 0o600)
        try { fs.writeFileSync(descriptor, JSON.stringify(state)); fs.fsyncSync(descriptor) } finally { fs.closeSync(descriptor) }
        fs.renameSync(temporary, target)
      } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary) }
    },
  }
}

export function createCommunityService({ tokens, storage, initialState, voice, files, internalToken, allowedOrigins = [] }) {
  requireValue(tokens && typeof tokens === 'object' && !Array.isArray(tokens), 'Configure as chaves individuais do serviço.')
  const credentials = new Map()
  for (const [token, member] of Object.entries(tokens)) {
    requireValue(token.length >= 32 && token.length <= 512 && identifier(member), 'Chave ou usuário inválido na configuração do serviço.')
    credentials.set(digest(token), member)
  }
  requireValue(credentials.size > 0, 'Configure pelo menos uma chave individual.')
  if(internalToken)requireValue(validInternalToken(internalToken,internalToken)&&!own(tokens,internalToken),'Use uma chave interna diferente das chaves dos usuários.')
  const changes = new EventEmitter(); changes.setMaxListeners(1000)
  let state = storage?.load() || initialState || createCommunityState([...new Set(credentials.values())])
  requireValue(state.schemaVersion === 1 && state.servers && own(state.servers, 'srv-1'), 'Dados do serviço incompatíveis.')
  const channelIds=new Set()
  for (const server of Object.values(state.servers)) {
    requireValue(identifier(server.id) && Number.isSafeInteger(server.revision) && Array.isArray(server.channels) && Array.isArray(server.policy?.members) && Array.isArray(server.policy?.roles), 'Dados do servidor inválidos.')
    requireValue(server.policy.serverId===server.id,'A política não corresponde ao servidor.')
    for(const channel of server.channels){requireValue(identifier(channel.id)&&!channelIds.has(channel.id)&&channel.serverId===server.id,'Os canais precisam de identificadores únicos.');channelIds.add(channel.id)}
    for (const role of server.policy.roles) readMask(role.permissions)
  }
  // Provisioning a new individual key also enrolls that account in the HQ.
  // Removing a key revokes authentication without silently deleting history.
  const provisioned = [...new Set(credentials.values())]
  const newcomers = provisioned.filter(member => !state.servers['srv-1'].policy.members.includes(member))
  if (newcomers.length) {
    const next = copy(state), hq = next.servers['srv-1']
    hq.policy.members.push(...newcomers); hq.revision++
    hq.audit = [{ id:randomUUID(), actor:'community-service', event:'member.provision', timestamp:Date.now() }, ...hq.audit].slice(0,2000)
    storage?.save(next)
    state = next
  }
  let queue = Promise.resolve()
  const pendingVoice = new Map(), voiceRetries = new Map(), streams = new Map(), subscriptions = new Map()
  let timeoutWake, closed=false
  const reconcileVoice = async (id, previous) => {
    if (!voice) return
    const existing = pendingVoice.get(id)
    const channels = new Map([...(existing?.channels || []), ...previous.channels].map(channel=>[channel.id,channel]))
    const before = { ...previous, channels:[...channels.values()] }
    pendingVoice.set(id,before)
    try {
      await voice.reconcile(before,state.servers[id])
      pendingVoice.delete(id)
      clearTimeout(voiceRetries.get(id)); voiceRetries.delete(id)
    } catch {
      if (!closed&&!voiceRetries.has(id)) voiceRetries.set(id,setTimeout(()=>{
        voiceRetries.delete(id)
        const retry = queue.then(()=>reconcileVoice(id,before)); queue=retry.catch(()=>{})
      },3000))
    }
    changes.emit(id)
  }
  const scheduleTimeouts = () => {
    clearTimeout(timeoutWake)
    if (closed) return
    const deadlines = Object.values(state.servers).flatMap(server=>Object.values(server.policy.timeouts)).filter(deadline=>deadline>Date.now())
    if (!deadlines.length) return
    timeoutWake=setTimeout(()=>{
      const task=queue.then(async()=>{for(const server of Object.values(state.servers)){if(voice)await reconcileVoice(server.id,server);else changes.emit(server.id)}scheduleTimeouts()})
      queue=task.catch(()=>{})
    },Math.min(2147483647,Math.max(1,Math.min(...deadlines)-Date.now())))
  }
  const serverFor = (actor, id) => {
    requireValue(identifier(id) && own(state.servers, id), 'Servidor não encontrado.', 404)
    const server = state.servers[id]
    requireValue(server.policy.members.includes(actor), 'Você não pertence a este servidor.', 403)
    return server
  }
  const snapshot = (actor, id) => {
    const server = serverFor(actor, id)
    const visible = server.channels.filter(channel => can(server.policy, actor, 'VIEW_CHANNEL', channel.id))
    const ids = new Set(visible.map(channel => channel.id))
    const policy = copy(server.policy)
    policy.channelCategories = Object.fromEntries(Object.entries(policy.channelCategories).filter(([channel]) => ids.has(channel)))
    const categoryIds = new Set(Object.values(policy.channelCategories).map(link => link.categoryId))
    policy.categories = policy.categories.filter(category => categoryIds.has(category.id) || can(server.policy, actor, 'VIEW_CHANNEL',category.id))
    policy.overwrites = Object.fromEntries(Object.entries(policy.overwrites).filter(([channel]) => ids.has(channel) || policy.categories.some(category => category.id === channel)))
    return {
      id: server.id, name: server.name, revision: server.revision, actor, policy, channels: copy(visible), voiceSync:voice?(pendingVoice.has(id)?'pending':'synced'):'unconfigured',
      serverPermissions: permissionsFor(server.policy, actor).toString(),
      channelPermissions: Object.fromEntries(visible.map(channel => [channel.id, permissionsFor(server.policy, actor, channel.id).toString()])),
      messages: Object.fromEntries(visible.filter(channel => can(server.policy, actor, 'READ_MESSAGE_HISTORY', channel.id)).map(channel => [channel.id, copy((server.messages[channel.id] || []).slice(-RECENT_MESSAGE_COUNT))])),
      hasOlder:Object.fromEntries(visible.filter(channel=>can(server.policy,actor,'READ_MESSAGE_HISTORY',channel.id)).map(channel=>[channel.id,(server.messages[channel.id]?.length||0)>RECENT_MESSAGE_COUNT])),
      audit: can(server.policy, actor, 'VIEW_AUDIT_LOG') ? copy(server.audit) : [],
    }
  }
  const commit = (actor, id, revision, action) => {
    const task = queue.then(async () => {
      const previous = serverFor(actor, id)
      requireValue(Number.isSafeInteger(revision) && revision === previous.revision, 'O servidor mudou. Atualize os dados antes de tentar novamente.', 409)
      const server = copy(previous), policy = server.policy
      requireValue(action && typeof action === 'object' && !Array.isArray(action), 'Operação inválida.')
      let target, event, liveMessage, messageChange, auditAction=true
      switch (action.type) {
        case 'role': {
          const command = action.command
          requireValue(command && typeof command === 'object' && typeof command.type === 'string', 'Comando de cargo inválido.')
          if (['overwrite', 'category-link'].includes(command.type)) requireValue(server.channels.some(channel => channel.id === command.channel) || (command.type === 'overwrite' && policy.categories.some(category => category.id === command.channel)), 'Canal ou categoria não encontrado.', 404)
          if (command.type === 'category-create') {requireValue(!server.channels.some(channel => channel.id === command.id) && command.id !== id, 'Identificador já utilizado.');requireValue(server.channels.length+policy.categories.length<500,'O servidor atingiu o limite de canais e categorias.')}
          try { server.policy = applyRoleCommand(policy, actor, command) } catch (error) { throw new CommunityError(403, error.message) }
          target = command.id || command.channel || command.member; event = 'role.' + command.type
          break
        }
        case 'channel-create': {
          requirePermission(server, actor, 'MANAGE_CHANNELS')
          requireValue(identifier(action.id) && !Object.values(state.servers).some(item=>item.channels.some(channel=>channel.id===action.id)||item.deletedChannels?.includes(action.id)) && !policy.categories.some(category => category.id === action.id) && action.id !== id, 'Identificador de canal inválido ou já utilizado.')
          requireValue(['text', 'voice'].includes(action.channelType) && server.channels.length+policy.categories.length < 500, 'Tipo ou limite de canais inválido.')
          server.channels.push({ id: action.id, name: text(action.name, 60), type: action.channelType, serverId: id })
          target = action.id; event = action.type; break
        }
        case 'channel-rename': case 'channel-delete': {
          const channel = server.channels.find(channel => channel.id === action.id)
          requireValue(channel, 'Canal não encontrado.', 404)
          requirePermission(server, actor, 'MANAGE_CHANNELS', channel.id)
          if (action.type === 'channel-rename') channel.name = text(action.name, 60)
          else { server.deletedChannels=[...(server.deletedChannels||[]),action.id];for(const message of server.messages[action.id]||[]){server.messageDeletions||={};server.messageDeletions[message.id]=true;delete server.fileDeliveries?.[message.id]}server.channels = server.channels.filter(channel => channel.id !== action.id); delete server.messages[action.id]; delete policy.overwrites[action.id]; delete policy.channelCategories[action.id] }
          target = action.id; event = action.type; break
        }
        case 'message-send': {
          auditAction=false
          const channel = server.channels.find(channel => channel.id === action.channel && channel.type === 'text')
          requireValue(channel, 'Canal de texto não encontrado.', 404)
          requirePermission(server, actor, 'VIEW_CHANNEL', channel.id); requirePermission(server, actor, 'SEND_MESSAGES', channel.id)
          const content = typeof action.content === 'string' ? action.content.trim() : ''
          requireValue(content.length <= 2000 && (content || action.attachment), 'Envie uma mensagem de até 2000 caracteres ou um anexo.')
          let attachment
          if (action.attachment) {
            requirePermission(server, actor, 'ATTACH_FILES', channel.id)
            const item = action.attachment
            requireValue(validFileId(item.storageId) && Number.isSafeInteger(item.size) && item.size >= 0 && item.size <= 2 * 1024 ** 3, 'Anexo central inválido.')
            requireValue(files,'A autorização do armazenamento central ainda não foi configurada.',503)
            let referenceAllowed
            try{referenceAllowed=await files.canReference(actor,item.storageId)}catch{throw new CommunityError(503,'A autorização do arquivo está indisponível. Tente novamente.')}
            requireValue(referenceAllowed,'Você não pode compartilhar este arquivo.',403)
            attachment = { storageId: item.storageId, name: text(item.name, 200), type: text(item.type, 100), size: item.size, data: '' }
            if(typeof item.thumbnail==='string'&&item.thumbnail.length<=40000&&/^[A-Za-z0-9+/=]+$/.test(item.thumbnail))attachment.thumbnail=item.thumbnail
          }
          const list = server.messages[channel.id] || []
          requireValue(identifier(action.id) && !Object.values(state.servers).some(item=>item.messageDeletions?.[action.id]||Object.values(item.messages).some(messages => messages.some(message => message.id === action.id))), 'Identificador de mensagem inválido ou já utilizado.')
          const message = { id: action.id, channelId: channel.id, userId: actor, userName: actor, content, timestamp: Date.now(), preview: action.preview !== false && can(policy, actor, 'EMBED_LINKS', channel.id), once: action.once === true, ...(attachment ? { attachment } : {}) }
          updateMentions(message,policy,actor,channel.id)
          server.messages[channel.id] = [...list, message]
          if(attachment){server.fileDeliveries||={};server.fileDeliveries[message.id]=policy.members.filter(member=>(subscriptions.get(JSON.stringify([id,member]))||0)>0&&can(policy,member,'VIEW_CHANNEL',channel.id))}
          liveMessage=message
          target = message.id; event = action.type; break
        }
        case 'message-edit': case 'message-delete': {
          const messages = server.messages[action.channel] || []
          const message = messages.find(message => message.id === action.id)
          requireValue(message, 'Mensagem não encontrada.', 404); requirePermission(server, actor, 'VIEW_CHANNEL', action.channel)
          auditAction=action.type==='message-delete'&&message.userId!==actor
          if (action.type === 'message-edit') { requireValue(message.userId === actor, 'Somente o autor pode editar a mensagem.', 403); requirePermission(server, actor, 'SEND_MESSAGES', action.channel); message.content = text(action.content, 2000); message.editedAt = Date.now(); updateMentions(message,policy,actor,action.channel) }
          else { if (message.userId !== actor) requirePermission(server, actor, 'MANAGE_MESSAGES', action.channel);server.messageDeletions||={};server.messageDeletions[action.id]=true;delete server.fileDeliveries?.[action.id];server.messages[action.channel] = messages.filter(message => message.id !== action.id) }
          messageChange={id:action.id,channelId:action.channel,deleted:action.type==='message-delete',...(action.type==='message-edit'?{content:message.content,editedAt:message.editedAt,roleMentions:message.roleMentions,mentionsEveryone:message.mentionsEveryone??null}:{})}
          target = action.id; event = action.type; break
        }
        default: throw new CommunityError(400, 'Operação desconhecida.')
      }
      server.revision++
      const targetName = [...server.policy.roles,...previous.policy.roles,...server.channels,...previous.channels,...server.policy.categories,...previous.policy.categories].find(item=>item.id===target)?.name || (server.policy.members.includes(target) ? target : undefined)
      const member=action.type==='role'?action.command.member:undefined
      if(auditAction)server.audit = [{ id: randomUUID(), actor, event, target, targetName, member, timestamp: Date.now() }, ...server.audit].slice(0, 2000)
      const next = { ...state, servers: { ...state.servers, [id]: server } }
      await storage?.save(next)
      state = next
      if(voice&&(action.type==='role'||action.type==='channel-delete'))pendingVoice.set(id,pendingVoice.get(id)||previous)
      changes.emit(id,{message:liveMessage,messageChange})
      // Revoke/update connected participants as soon as permissions change.
      if (voice && (action.type === 'role' || action.type === 'channel-delete')) await reconcileVoice(id,previous)
      scheduleTimeouts()
      return {...snapshot(actor,id),...(liveMessage?{liveMessages:[copy(liveMessage)]}:{}),...(messageChange?{messageChanges:[messageChange]}:{})}
    })
    queue = task.catch(() => {})
    return task
  }
  const json = (response, status, value) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)) }
  const readBody = async request => {
    let length = 0; const chunks = []
    for await (const chunk of request) { length += chunk.length; requireValue(length <= 100000, 'Solicitação grande demais.', 413); chunks.push(chunk) }
    try { return JSON.parse(Buffer.concat(chunks).toString()) } catch { throw new CommunityError(400, 'JSON inválido.') }
  }
  const handler = async (request, response) => {
    try {
      response.setHeader('X-Content-Type-Options', 'nosniff')
      const origin = request.headers.origin
      if (origin && allowedOrigins.includes(origin)) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin') }
      if (request.method === 'OPTIONS') { requireValue(origin && allowedOrigins.includes(origin), 'Origem inválida.', 403); response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' }); response.end(); return }
      const authorization = request.headers.authorization || ''
      const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
      const url = new URL(request.url, 'http://localhost')
      if(request.method==='GET'&&url.pathname==='/health'){json(response,200,{service:'ConTALK Community',status:'ok'});return}
      if(request.method==='POST'&&url.pathname==='/internal/files/authorize'){
        requireValue(validInternalToken(token,internalToken),'Origem interna inválida.',401)
        const {username,storageId}=await readBody(request)
        requireValue(identifier(username)&&validFileId(storageId),'Usuário ou arquivo inválido.')
        const allowed=[...credentials.values()].includes(username)&&Object.values(state.servers).some(server=>server.policy.members.includes(username)&&Object.entries(server.messages).some(([channel,list])=>can(server.policy,username,'VIEW_CHANNEL',channel)&&list.some(message=>message.attachment?.storageId===storageId&&(can(server.policy,username,'READ_MESSAGE_HISTORY',channel)||server.fileDeliveries?.[message.id]?.includes(username)))))
        json(response,200,{allowed});return
      }
      requireValue(token.length >= 32 && token.length <= 512, 'Entre com sua chave individual.', 401)
      const actor = credentials.get(digest(token))
      requireValue(actor, 'Chave de acesso inválida.', 401)
      if (request.method === 'GET' && url.pathname === '/identity') { json(response, 200, { username: actor, serverIds: Object.values(state.servers).filter(server => server.policy.members.includes(actor)).map(server => server.id) }); return }
      if(request.method==='POST'&&url.pathname==='/presence-token'){requireValue(voice?.presenceToken,'O serviço de presença ainda não está configurado.',503);const body=await readBody(request);json(response,200,await voice.presenceToken(actor,text(body.name||actor,40)));return}
      const history=/^\/servers\/([\w:-]{1,100})\/history\/([\w:-]{1,100})$/.exec(url.pathname)
      if(request.method==='GET'&&history){
        const [,serverId,channelId]=history,server=serverFor(actor,serverId)
        requireValue(server.channels.some(channel=>channel.id===channelId&&channel.type==='text'),'Canal não encontrado.',404)
        requirePermission(server,actor,'VIEW_CHANNEL',channelId);requirePermission(server,actor,'READ_MESSAGE_HISTORY',channelId)
        const list=server.messages[channelId]||[],cursor=url.searchParams.get('before'),index=cursor?list.findIndex(message=>message.id===cursor):list.length
        requireValue(index>=0,'A mensagem de referência mudou. Atualize o histórico.',409)
        const start=Math.max(0,index-RECENT_MESSAGE_COUNT)
        json(response,200,{serverId,channelId,revision:server.revision,messages:copy(list.slice(start,index)),hasMore:start>0});return
      }
      const match = /^\/servers\/([\w:-]{1,100})(?:\/(events|commands|voice-token|occupants))?$/.exec(url.pathname)
      requireValue(match, 'Rota não encontrada.', 404)
      const [, id, operation] = match
      serverFor(actor, id)
      if (request.method === 'GET' && !operation) { json(response, 200, snapshot(actor, id)); return }
      if(request.method==='GET'&&operation==='occupants'){requireValue(voice?.occupants,'A presença de voz ainda não está configurada.',503);json(response,200,await voice.occupants(serverFor(actor,id),actor));return}
      if (request.method === 'GET' && operation === 'events') {
        requireValue((streams.get(actor)||0)<8,'Há muitas conexões abertas para esta conta.',429)
        streams.set(actor,(streams.get(actor)||0)+1)
        const subscription=JSON.stringify([id,actor]);subscriptions.set(subscription,(subscriptions.get(subscription)||0)+1)
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
        const send = change => { if(response.writableLength>32*1024*1024){response.destroy();return}if (!response.destroyed){const live=change?.message&&can(state.servers[id].policy,actor,'VIEW_CHANNEL',change.message.channelId)?{liveMessages:[change.message]}:{};const update=change?.messageChange&&can(state.servers[id].policy,actor,'VIEW_CHANNEL',change.messageChange.channelId)?{messageChanges:[change.messageChange]}:{};response.write('event: snapshot\ndata: ' + JSON.stringify({...snapshot(actor,id),...live,...update}) + '\n\n')} }
        const pulse = setInterval(() => { if (!response.destroyed) response.write(': keepalive\n\n') }, 15000)
        changes.on(id, send); send()
        response.once('close', () => {subscriptions.set(subscription,Math.max(0,(subscriptions.get(subscription)||1)-1));streams.set(actor,Math.max(0,(streams.get(actor)||1)-1));clearInterval(pulse); changes.removeListener(id, send) }); return
      }
      if (request.method === 'POST' && operation === 'commands') { const body = await readBody(request); json(response, 200, await commit(actor, id, body.revision, body.action)); return }
      if (request.method === 'POST' && operation === 'voice-token') {
        requireValue(voice, 'O serviço de voz ainda não foi configurado.', 503)
        requireValue(!pendingVoice.has(id),'A atualização das permissões de voz ainda está em andamento. Tente novamente.',503)
        const { channelId } = await readBody(request), server = serverFor(actor, id)
        const channel = server.channels.find(channel => channel.id === channelId && channel.type === 'voice')
        requireValue(channel, 'Canal de voz não encontrado.', 404)
        requirePermission(server, actor, 'VIEW_CHANNEL', channelId); requirePermission(server, actor, 'CONNECT', channelId)
        json(response, 200, await voice.token(server, actor, channelId)); return
      }
      throw new CommunityError(404, 'Rota não encontrada.')
    } catch (error) {
      if (!response.headersSent) json(response, error instanceof CommunityError ? error.status : 500, { error: error instanceof CommunityError ? error.message : 'Não foi possível concluir a operação.' })
      else response.destroy()
    }
  }
  const server=http.createServer({ requestTimeout: 30000, headersTimeout: 10000, maxHeaderSize: 8192 }, handler)
  scheduleTimeouts()
  server.once('close',()=>{closed=true;clearTimeout(timeoutWake);for(const timer of voiceRetries.values())clearTimeout(timer);voiceRetries.clear()})
  return { server, snapshot, commit }
}
