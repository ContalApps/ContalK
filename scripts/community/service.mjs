import {canJoinStage,canModerateStage,pruneStage} from '../../src/roles/stages.ts'
import {activeProject,validAiModel} from '../../src/roles/ai.ts'
import {MAX_AI_BYTES,validateAiFiles,openAiProvider} from './ai.mjs'
import {canManageExpression,expressionName} from '../../src/roles/expressions.ts'
import {WebhookError,authorizeWebhook,visibleWebhooks,manageWebhook,publishWebhook} from './webhooks.mjs'
import { canCreateEvent, canManageEvent, canViewEvent, eventStatus, eventDeadline, normalizeEventDraft } from '../../src/roles/events.ts'
import { canSetVoiceStatus, normalizeVoiceStatus } from '../../src/roles/voice-status.ts'
import { buildCommunityInsights } from '../../src/roles/insights.ts'
import http from 'node:http'
import { EventEmitter } from 'node:events'
import { createHash, randomUUID, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { applyRoleCommand } from '../../src/roles/commands.ts'
import { can, canActOnMember, canMentionRole, initialPolicy, permissionsFor, readMask, threadArchived } from '../../src/roles/permissions.ts'
import { validFileId, validInternalToken } from './files.mjs'
import { activeInvite, canManageInvite, validInviteCode } from '../../src/roles/invites.ts'
import { canEditThread, canMutateThread, threadDurations, validThreadPatch } from '../../src/roles/threads.ts'
import { normalizePoll, pollOpen } from '../../src/roles/polls.ts'
import { MAX_PINS, MAX_REACTIONS, normalizeReaction, slowmodeDeadline } from '../../src/roles/chat.ts'
import { canSetNickname, normalizeNickname } from '../../src/roles/nicknames.ts'
import { canModerateVoice } from '../../src/roles/voice-moderation.ts'

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

export function createCommunityService({ tokens, storage, initialState, voice, files, internalToken, allowedOrigins = [], aiProvider=openAiProvider() }) {
  requireValue(tokens && typeof tokens === 'object' && !Array.isArray(tokens), 'Configure as chaves individuais do serviço.')
  const credentials = new Map()
  for (const [token, member] of Object.entries(tokens)) {
    requireValue(token.length >= 32 && token.length <= 512 && identifier(member), 'Chave ou usuário inválido na configuração do serviço.')
    credentials.set(digest(token), member)
  }
  requireValue(credentials.size > 0, 'Configure pelo menos uma chave individual.')
  if(internalToken)requireValue(validInternalToken(internalToken,internalToken)&&!own(tokens,internalToken),'Use uma chave interna diferente das chaves dos usuários.')
  const changes = new EventEmitter(); changes.setMaxListeners(1000)
  const aiChanges = new EventEmitter(); aiChanges.setMaxListeners(1000)
  let state = storage?.load() || initialState || createCommunityState([...new Set(credentials.values())])
  let interrupted=false
  for(const server of Object.values(state.servers||{}))for(const list of Object.values(server.messages||{}))for(const message of list)if(['running','queued'].includes(message.ai?.status)){message.ai.status='interrupted';message.ai.error='O serviço foi reiniciado antes da conclusão da geração.';interrupted=true}
  if(interrupted)storage?.save(state)
  requireValue(state.schemaVersion === 1 && state.servers && own(state.servers, 'srv-1'), 'Dados do serviço incompatíveis.')
  const channelIds=new Set()
  for (const server of Object.values(state.servers)) {
    requireValue(identifier(server.id) && Number.isSafeInteger(server.revision) && Array.isArray(server.channels) && Array.isArray(server.policy?.members) && Array.isArray(server.policy?.roles), 'Dados do servidor inválidos.')
    requireValue(server.policy.serverId===server.id,'A política não corresponde ao servidor.')
    for(const channel of server.channels){requireValue(identifier(channel.id)&&!channelIds.has(channel.id)&&channel.serverId===server.id,'Os canais precisam de identificadores únicos.');channelIds.add(channel.id)}
    for(const channel of server.channels)requireValue(!channel.parentId||server.policy.threads?.[channel.id]?.parentId===channel.parentId||channel.project===true&&server.policy.projects?.[channel.id]?.parentId===channel.parentId,'Metadados do tópico ausentes.')
    for(const [id,thread]of Object.entries(server.policy.threads||{})){const channel=server.channels.find(channel=>channel.id===id),parent=server.channels.find(channel=>channel.id===thread.parentId);requireValue(channel?.parentId===thread.parentId&&parent?.type==='text'&&!parent.parentId&&identifier(thread.ownerId)&&Array.isArray(thread.members)&&thread.members.every(member=>identifier(member))&&threadDurations.includes(thread.autoArchiveMinutes)&&Number.isFinite(thread.lastActivityAt)&&['private','archived','locked','invitable'].every(key=>typeof thread[key]==='boolean'),'Dados de tópico inválidos.')}
    for(const [id,project]of Object.entries(server.policy.projects||{})){const channel=server.channels.find(channel=>channel.id===id),parent=server.channels.find(channel=>channel.id===project.parentId);requireValue(identifier(id)&&channel?.project===true&&channel.parentId===project.parentId&&parent?.type==='text'&&!parent.parentId&&identifier(project.ownerId)&&project.members?.[project.ownerId]==='manager'&&Object.entries(project.members).every(([member,access])=>identifier(member)&&['reader','collaborator','manager'].includes(access))&&(!project.model||validAiModel(project.model)),'Dados de projeto inválidos.')}
    requireValue(!server.events||typeof server.events==='object'&&!Array.isArray(server.events),'Dados de eventos inválidos.')
    for(const [id,event]of Object.entries(server.events||{}))requireValue(identifier(id)&&event.id===id&&identifier(event.creator)&&['scheduled','active','completed','cancelled'].includes(event.status)&&typeof event.name==='string'&&event.name.length<=100&&typeof event.description==='string'&&typeof event.location==='string'&&Number.isSafeInteger(event.startsAt)&&(event.endsAt===null||Number.isSafeInteger(event.endsAt)&&event.endsAt>event.startsAt)&&(!event.channelId?event.endsAt!==null:server.channels.some(channel=>channel.id===event.channelId&&channel.type==='voice'))&&Array.isArray(event.interested)&&event.interested.every(member=>identifier(member)),'Dados de evento inválidos.')
    for (const role of server.policy.roles) readMask(role.permissions)
  }
  // Provisioning a new individual key also enrolls that account in the HQ.
  // Removing a key revokes authentication without silently deleting history.
  const provisioned = [...new Set(credentials.values())]
  const newcomers = provisioned.filter(member => !state.servers['srv-1'].policy.members.includes(member)&&!state.servers['srv-1'].removedMembers?.includes(member)&&!own(state.servers['srv-1'].bans||{},member))
  if (newcomers.length) {
    const next = copy(state), hq = next.servers['srv-1']
    hq.policy.members.push(...newcomers); hq.revision++
    hq.audit = [{ id:randomUUID(), actor:'community-service', event:'member.provision', timestamp:Date.now() }, ...hq.audit].slice(0,2000)
    storage?.save(next)
    state = next
  }
  let archivedProjects=false
  for(const server of Object.values(state.servers))for(const project of Object.values(server.policy.projects||{}))if(!project.archived&&!Object.entries(project.members).some(([member,access])=>access==='manager'&&server.policy.members.includes(member)&&provisioned.includes(member))){
    project.archived=true;archivedProjects=true
  }
  if(archivedProjects)storage?.save(state)
  let queue = Promise.resolve()
  const pendingVoice = new Map(), voiceRetries = new Map(), streams = new Map(), subscriptions = new Map(), liveContexts=new Set(), activeAi=new Map(), pendingAi=new Map()
  let pendingAiBytes=0
  let timeoutWake,pollWake, closed=false
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
    requireValue(!own(server.bans||{},actor),'Seu acesso a este servidor foi removido.',403)
    requireValue(server.policy.members.includes(actor), 'Você não pertence a este servidor.', 403)
    return server
  }
  const removeChannels=(server,ids)=>{
    for(const id of ids){server.deletedChannels=[...new Set([...(server.deletedChannels||[]),id])];for(const message of server.messages[id]||[]){server.messageDeletions||={};server.messageDeletions[message.id]=true;delete server.fileDeliveries?.[message.id]}delete server.messages[id];delete server.policy.overwrites[id];delete server.policy.channelCategories[id];delete server.policy.threads?.[id];delete server.policy.projects?.[id];delete server.policy.stages?.[id];delete server.slowmodeLastSent?.[id];delete server.aiContext?.[id];for(const [code,invite]of Object.entries(server.invites||{}))if(invite.channelId===id)delete server.invites[code]}
    for(const [id,event]of Object.entries(server.events||{}))if(ids.includes(event.channelId))delete server.events[id]
    server.channels=server.channels.filter(channel=>!ids.includes(channel.id))
  }
  const requireThreadMutation=(server,actor,id,operation)=>requireValue(canMutateThread(server.policy,actor,id,operation),'Reabra o tópico ou peça a alguém com Gerenciar tópicos para desbloqueá-lo.',403)
  const knownMessage=(server,actor,message)=>can(server.policy,actor,'VIEW_CHANNEL',message.channelId)&&(can(server.policy,actor,'READ_MESSAGE_HISTORY',message.channelId)||[...liveContexts].some(context=>context.serverId===server.id&&context.actor===actor&&context.seenLive.get(message.channelId)?.has(message.id)))
  const pollDeadlines=new Map()
  const armPolls=()=>{
    clearTimeout(pollWake);if(closed||!pollDeadlines.size)return
    let next=Infinity;for(const item of pollDeadlines.values())next=Math.min(next,item.expiresAt)
    pollWake=setTimeout(()=>{const affected=new Set();for(const [message,item]of pollDeadlines)if(item.expiresAt<=Date.now()){affected.add(item.serverId);pollDeadlines.delete(message)}for(const id of affected){indexPolls(id);changes.emit(id);voice?.refreshStages?.(id)}armPolls()},Math.min(2147483647,Math.max(1,next-Date.now())))
  }
  const indexPolls=id=>{for(const [message,item]of pollDeadlines)if(item.serverId===id)pollDeadlines.delete(message);for(const [channel,stage]of Object.entries(state.servers[id].policy.stages||{}))for(const [member,invitation]of Object.entries(stage.invitations))if(invitation.expiresAt>Date.now())pollDeadlines.set('stage:'+channel+':'+member,{serverId:id,expiresAt:invitation.expiresAt});for(const list of Object.values(state.servers[id].messages))for(const message of list)if(message.poll&&pollOpen(message.poll))pollDeadlines.set('poll:'+message.id,{serverId:id,expiresAt:message.poll.expiresAt});for(const [threadId,thread]of Object.entries(state.servers[id].policy.threads||{}))if(!threadArchived(thread))pollDeadlines.set('thread:'+threadId,{serverId:id,expiresAt:thread.lastActivityAt+thread.autoArchiveMinutes*60000});for(const event of Object.values(state.servers[id].events||{})){const expiresAt=eventDeadline(event);if(expiresAt)pollDeadlines.set('event:'+event.id,{serverId:id,expiresAt})}armPolls()}
  const lastSent=(server,channel,actor)=>server.slowmodeLastSent?.[channel]?.[actor]??[...(server.messages[channel]||[])].reverse().find(message=>message.userId===actor)?.timestamp??0
  const snapshot = (actor, id) => {
    const server = serverFor(actor, id)
    const visible = server.channels.filter(channel => can(server.policy, actor, 'VIEW_CHANNEL', channel.id))
    const ids = new Set(visible.map(channel => channel.id))
    const policy = copy(server.policy)
    delete policy.stages
    if(policy.projects)policy.projects=Object.fromEntries(Object.entries(policy.projects).filter(([id])=>ids.has(id)))
    if(policy.threads)policy.threads=Object.fromEntries(Object.entries(policy.threads).filter(([id])=>ids.has(id)).map(([id,thread])=>[id,{...thread,archived:threadArchived(thread)}]))
    policy.channelCategories = Object.fromEntries(Object.entries(policy.channelCategories).filter(([channel]) => ids.has(channel)))
    const categoryIds = new Set(Object.values(policy.channelCategories).map(link => link.categoryId))
    policy.categories = policy.categories.filter(category => categoryIds.has(category.id) || can(server.policy, actor, 'VIEW_CHANNEL',category.id))
    policy.visibleChannelIds=[...ids,...policy.categories.map(category=>category.id)]
    policy.overwrites = Object.fromEntries(Object.entries(policy.overwrites).filter(([channel]) => ids.has(channel) || policy.categories.some(category => category.id === channel)))
    return {
      id: server.id, name: server.name, description:server.description||'',serverNow:Date.now(), revision: server.revision, actor, policy, channels: copy(visible), voiceSync:voice?(pendingVoice.has(id)?'pending':'synced'):'unconfigured',
      serverPermissions: permissionsFor(server.policy, actor).toString(),
      channelPermissions: Object.fromEntries(visible.map(channel => [channel.id, permissionsFor(server.policy, actor, channel.id).toString()])),
      messages: Object.fromEntries(visible.filter(channel => can(server.policy, actor, 'READ_MESSAGE_HISTORY', channel.id)).map(channel => [channel.id, copy((server.messages[channel.id] || []).slice(-RECENT_MESSAGE_COUNT))])),
      expressionsRevision:server.expressionsRevision||0,
      webhooks:visibleWebhooks(server,actor),
      hasOlder:Object.fromEntries(visible.filter(channel=>can(server.policy,actor,'READ_MESSAGE_HISTORY',channel.id)).map(channel=>[channel.id,(server.messages[channel.id]?.length||0)>RECENT_MESSAGE_COUNT])),
      audit: can(server.policy, actor, 'VIEW_AUDIT_LOG') ? copy(server.audit.filter(entry=>!entry.threadParent||server.channels.some(channel=>channel.id===entry.threadParent)&&can(server.policy,actor,'VIEW_CHANNEL',entry.threadParent)&&(!entry.privateThread||(server.policy.projects?.[entry.threadParent]?server.policy.projects[entry.threadParent].members[actor]==='manager':can(server.policy,actor,'MANAGE_THREADS',entry.threadParent))))) : [],
      ...(can(server.policy,actor,'BAN_MEMBERS')?{bans:Object.entries(server.bans||{}).map(([username,record])=>({username,...copy(record)}))}:{}),
      sendAfter:Object.fromEntries(visible.filter(channel=>channel.type==='text'&&can(policy,actor,'SEND_MESSAGES',channel.id)).map(channel=>[channel.id,can(policy,actor,'BYPASS_SLOWMODE',channel.id)?0:slowmodeDeadline(channel.slowmodeSeconds,lastSent(server,channel.id,actor))])),
      events:Object.values(server.events||{}).filter(event=>canViewEvent(server.policy,actor,event)).map(event=>{const {interested,...data}=copy(event);return {...data,status:eventStatus(event),interested:interested.includes(actor),interestedCount:interested.filter(member=>server.policy.members.includes(member)).length}}),
      nicknames:Object.fromEntries(Object.entries(server.nicknames||{}).filter(([member])=>policy.members.includes(member))),
      invites:Object.values(server.invites||{}).filter(invite=>canManageInvite(server.policy,actor,invite)).map(copy),
      ...(can(server.policy,actor,'VIEW_AUDIT_LOG')||can(server.policy,actor,'MANAGE_ROLES')?{memberAdmissions:Object.fromEntries(Object.entries(server.memberAdmissions||{}).filter(([member])=>server.policy.members.includes(member)))}:{}),
    }
  }
  // Older clients parse every SSE packet as a snapshot. Send a valid, empty
  // snapshot on revocation so they also discard content instead of crashing.
  const revokedSnapshot=(actor,id)=>({id,name:'Comunidade',actor,revision:state.servers[id].revision,policy:initialPolicy(id),channels:[],serverPermissions:'0',channelPermissions:{},messages:{},audit:[],accessRevoked:true})
  const commit = (actor, id, revision, action) => {
    const task = queue.then(async () => {
      const previous = serverFor(actor, id)
      requireValue(Number.isSafeInteger(revision) && revision === previous.revision, 'O servidor mudou. Atualize os dados antes de tentar novamente.', 409)
      const server = copy(previous), policy = server.policy
      requireValue(action && typeof action === 'object' && !Array.isArray(action), 'Operação inválida.')
      let target, event, liveMessage, messageChange, reason, pendingMove, auditThread, auditAction=true
      switch (action.type) {
        case 'ai-channel-model':{
          const channel=server.channels.find(item=>item.id===action.channelId&&item.type==='text'&&!item.parentId)
          requireValue(channel,'Canal de texto principal não encontrado.',404);requirePermission(server,actor,'MANAGE_CHANNELS',channel.id)
          requireValue(action.model===null||validAiModel(action.model),'Escolha um identificador de modelo válido.')
          if(action.model===null)delete channel.aiModel;else channel.aiModel=action.model
          target=channel.id;event=action.type;break
        }
        case 'project-create':{
          const parent=server.channels.find(item=>item.id===action.parentId&&item.type==='text'&&!item.parentId)
          requireValue(parent,'Canal de texto principal não encontrado.',404)
          requirePermission(server,actor,'VIEW_CHANNEL',parent.id);requirePermission(server,actor,'CREATE_PRIVATE_THREADS',parent.id)
          requireValue(!!parent.aiModel,'Configure a IA do canal antes de criar um projeto.',409)
          requireValue(identifier(action.id)&&!server.channels.some(item=>item.id===action.id)&&!server.deletedChannels?.includes(action.id),'Identificador de projeto inválido ou já utilizado.')
          requireValue(!action.model||validAiModel(action.model),'Modelo inválido.')
          requireValue(Object.keys(policy.projects||{}).length<1000,'Limite de projetos atingido.')
          policy.projects||={};policy.projects[action.id]={parentId:parent.id,ownerId:actor,members:{[actor]:'manager'},...(action.model?{model:action.model}:{}),createdAt:Date.now()}
          server.channels.push({id:action.id,name:text(action.name,60),type:'text',serverId:id,parentId:parent.id,project:true,slowmodeSeconds:parent.slowmodeSeconds||0});server.messages[action.id]=[]
          target=action.id;event=action.type;auditThread={parentId:action.id,private:true};break
        }
        case 'project-member':case 'project-model':case 'project-rename':case 'project-delete':case 'project-restore':{
          const project=policy.projects?.[action.id],channel=server.channels.find(item=>item.id===action.id&&item.project)
          requireValue(project&&channel,'Projeto não encontrado.',404)
          requireValue(can(policy,actor,'VIEW_CHANNEL',action.id)&&project.members[actor]==='manager'&&(action.type==='project-restore'||activeProject(project,policy.members)),'Somente o criador ou um delegado ativo pode gerir este projeto.',403)
          auditThread={parentId:action.id,private:true}
          if(action.type==='project-restore'){
            requireValue(project.archived,'Este projeto já está ativo.',409)
            project.archived=false;target=action.id;event=action.type;break
          }
          if(action.type==='project-member'){
            requireValue(identifier(action.member)&&policy.members.includes(action.member)&&action.member!==project.ownerId,'Participante inválido ou criador protegido.')
            requireValue(can(policy,action.member,'VIEW_CHANNEL',project.parentId),'A pessoa precisa ter acesso ao canal principal.',403)
            requireValue(action.access===null||['reader','collaborator','manager'].includes(action.access),'Acesso inválido.')
            if(action.access===null)delete project.members[action.member];else project.members[action.member]=action.access
            target=action.member;event=action.type;break
          }
          if(action.type==='project-model'){
            requireValue(action.model===null||validAiModel(action.model),'Modelo inválido.')
            if(action.model===null)delete project.model;else project.model=action.model
          }else if(action.type==='project-rename')channel.name=text(action.name,60)
          else removeChannels(server,[action.id])
          target=action.id;event=action.type;break
        }
        case 'channel-voice-mode':{
          const channel=server.channels.find(channel=>channel.id===action.channelId&&channel.type==='voice');requireValue(channel,'Canal de voz não encontrado.',404)
          requirePermission(server,actor,'VIEW_CHANNEL',channel.id);requirePermission(server,actor,'MANAGE_CHANNELS',channel.id);requireValue(['conversation','stage'].includes(action.mode),'Modo de voz inválido.')
          requireValue((channel.voiceMode||'conversation')!==action.mode,'O canal já está neste modo.',409)
          channel.voiceMode=action.mode;policy.stages||={};if(action.mode==='stage')policy.stages[channel.id]={speakerSessions:{},requests:{},invitations:{}};else delete policy.stages[channel.id]
          target=channel.id;event=action.type;auditThread={parentId:channel.id,private:false};break
        }
        case 'stage-request':case 'stage-invite':case 'stage-decline':case 'stage-audience':case 'stage-accept':case 'stage-join':{
          const channel=server.channels.find(channel=>channel.id===action.channelId&&channel.type==='voice'),stage=policy.stages?.[action.channelId]
          requireValue(channel&&stage,'Palco não encontrado.',404);requirePermission(server,actor,'VIEW_CHANNEL',channel.id);requirePermission(server,actor,'CONNECT',channel.id)
          requireValue(voice?.participantSession,'Atualize o serviço de comunicação para usar o palco.',503)
          const sessionFor=member=>policy.members.includes(member)?voice.participantSession(id,member,channel.id):null,session=sessionFor(actor)
          requireValue(session,'Entre neste canal antes de usar o palco.',409);pruneStage(stage,sessionFor)
          const moderator=canModerateStage(policy,actor,channel.id)
          if(action.type==='stage-request'){
            requireValue(typeof action.enabled==='boolean','Pedido de fala inválido.');if(action.enabled){requireValue(canJoinStage(policy,actor,channel.id),'Seu cargo ou bloqueio de áudio não permite falar neste canal.',403);requirePermission(server,actor,'REQUEST_TO_SPEAK',channel.id);requireValue(stage.speakerSessions[actor]!==session,'Você já está no palco.');stage.requests[actor]||={sessionId:session,requestedAt:Date.now()}}else delete stage.requests[actor];auditAction=false
          }else if(action.type==='stage-accept'||action.type==='stage-join'){
            requireValue(canJoinStage(policy,actor,channel.id),'Seu cargo ou bloqueio de áudio não permite falar.',403)
            if(action.type==='stage-join')requireValue(moderator,'Apenas moderadores podem subir sem convite.',403)
            else requireValue(stage.invitations[actor]?.sessionId===session&&stage.invitations[actor]?.expiresAt>Date.now(),'O convite expirou ou não pertence a esta sessão.',409)
            stage.speakerSessions[actor]=session;delete stage.requests[actor];delete stage.invitations[actor];auditAction=false
          }else{
            requireValue(identifier(action.member),'Membro inválido.');const member=action.member,targetSession=sessionFor(member);requireValue(targetSession,'A pessoa não está neste palco.',409)
            if(action.type==='stage-invite'){requireValue(moderator,'Você não pode moderar este palco.',403);requireValue(canJoinStage(policy,member,channel.id),'Esta pessoa não pode falar no canal.',403);stage.invitations[member]={sessionId:targetSession,invitedBy:actor,expiresAt:Date.now()+60000};delete stage.requests[member]}
            else if(action.type==='stage-decline'){requireValue(member===actor||moderator,'Você não pode remover este pedido ou convite.',403);delete stage.requests[member];delete stage.invitations[member];auditAction=member!==actor}
            else{requireValue(member===actor||moderator,'Você não pode mover esta pessoa para a plateia.',403);delete stage.speakerSessions[member];delete stage.requests[member];delete stage.invitations[member];auditAction=member!==actor}
          }
          target=action.member||actor;event=action.type;auditThread={parentId:channel.id,private:false};break
        }
        case 'expression-create':case 'expression-edit':case 'expression-delete':{
          requireValue(identifier(action.id),'Identificador de expressão inválido.');server.expressions||={}
          const existing=own(server.expressions,action.id)?server.expressions[action.id]:null
          if(action.type==='expression-create'){
            requirePermission(server,actor,'CREATE_GUILD_EXPRESSIONS')
            requireValue(!existing&&!server.deletedExpressions?.includes(action.id),'Identificador de expressão já utilizado.')
            requireValue(['emoji','sticker','sound'].includes(action.kind),'Tipo de expressão inválido.')
            requireValue(Object.values(server.expressions).filter(item=>item.kind===action.kind).length<100,'Limite de 100 expressões de cada tipo atingido.')
            const file=action.attachment,sound=action.kind==='sound'
            requireValue(file&&validFileId(file.storageId)&&Number.isSafeInteger(file.size)&&file.size>0&&file.size<=1048576,'Use um arquivo autorizado de até 1 MB.')
            if(sound)requireValue(file.type==='audio/webm;codecs=opus'&&Number.isInteger(action.durationMs)&&action.durationMs>=100&&action.durationMs<=5000,'Use áudio Opus WebM de até cinco segundos.')
            else requireValue(['image/png','image/jpeg','image/gif','image/webp'].includes(file.type)&&typeof file.thumbnail==='string'&&file.thumbnail.length<=12000&&/^[A-Za-z0-9+/=]+$/.test(file.thumbnail),'Use PNG, JPEG, GIF ou WebP com prévia válida.')
            requireValue(files,'O armazenamento de arquivos ainda não foi configurado.',503);let authorized;try{authorized=await files.canReference(actor,file.storageId)}catch{throw new CommunityError(503,'Não foi possível autorizar a imagem.')}requireValue(authorized,'Você não pode usar esta imagem.',403)
            let name;try{name=expressionName(action.name)}catch(error){throw new CommunityError(400,error.message)}
            requireValue(!Object.values(server.expressions).some(item=>item.kind===action.kind&&item.name.toLocaleLowerCase()===name.toLocaleLowerCase()),'Já existe uma expressão desse tipo com esse nome.')
            server.expressions[action.id]={id:action.id,serverId:id,kind:action.kind,name,creator:actor,createdAt:Date.now(),updatedAt:Date.now(),...(sound?{durationMs:action.durationMs}:{}),attachment:{storageId:file.storageId,name:text(file.name,200),type:file.type,size:file.size,data:'',...(!sound?{thumbnail:file.thumbnail}:{})}}
          }else{
            requireValue(existing,'Expressão não encontrada.',404);requireValue(canManageExpression(policy,actor,existing),'Você não pode alterar expressões de outro membro.',403)
            requireValue(action.updatedAt===existing.updatedAt,'Esta expressão mudou em outro cliente. Carregue a versão atual antes de salvar.',409)
            if(action.type==='expression-delete'){delete server.expressions[action.id];server.deletedExpressions=[...new Set([...(server.deletedExpressions||[]),action.id])]}
            else{let name;try{name=expressionName(action.name)}catch(error){throw new CommunityError(400,error.message)}requireValue(!Object.values(server.expressions).some(item=>item.id!==existing.id&&item.kind===existing.kind&&item.name.toLocaleLowerCase()===name.toLocaleLowerCase()),'Já existe uma expressão desse tipo com esse nome.');existing.name=name;existing.updatedAt=Math.max(Date.now(),existing.updatedAt+1)}
          }
          server.expressionsRevision=(server.expressionsRevision||0)+1
          target=action.id;event=action.type;break
        }
        case 'event-create':case 'event-edit':case 'event-status':case 'event-interest':case 'event-delete':{
          requireValue(identifier(action.id),'Identificador do evento inválido.')
          server.events||={};const existing=own(server.events,action.id)?server.events[action.id]:null
          if(action.type==='event-create'){
            requireValue(!existing&&!server.deletedEvents?.includes(action.id),'Identificador de evento já utilizado.')
            requireValue(Object.keys(server.events).length<500&&Object.values(server.events).filter(event=>['scheduled','active'].includes(eventStatus(event))).length<100,'O servidor atingiu o limite de eventos. Exclua eventos antigos ou aguarde o término dos ativos.')
            let draft;try{draft=normalizeEventDraft(action.draft)}catch(error){throw new CommunityError(400,error.message)}
            if(draft.channelId)requireValue(server.channels.some(channel=>channel.id===draft.channelId&&channel.type==='voice'),'Canal de voz não encontrado.',404)
            requireValue(canCreateEvent(policy,actor,draft.channelId),'Você não pode criar eventos neste local.',403)
            server.events[action.id]={...draft,id:action.id,creator:actor,status:'scheduled',interested:[actor],createdAt:Date.now(),updatedAt:Date.now()}
          }else{
            requireValue(existing&&canViewEvent(policy,actor,existing),'Evento não encontrado.',404)
            const status=eventStatus(existing)
            if(action.type==='event-interest'){
              requireValue(typeof action.enabled==='boolean','Interesse inválido.');requireValue(['scheduled','active'].includes(status)||!action.enabled,'Este evento já terminou.',409)
              requireValue(!action.enabled||!((policy.timeouts[actor]||0)>Date.now()),'Aguarde o fim da restrição temporária.',403)
              existing.interested=action.enabled?[...new Set([...existing.interested,actor])]:existing.interested.filter(member=>member!==actor);auditAction=false
            }else{
              requireValue(canManageEvent(policy,actor,existing),'Você não pode administrar este evento.',403)
              if(action.type==='event-delete'){delete server.events[action.id];server.deletedEvents=[...new Set([...(server.deletedEvents||[]),action.id])]}
              else{
                requireValue(!['completed','cancelled'].includes(status),'Eventos encerrados não podem ser alterados.',409)
                if(action.type==='event-edit'){
                  let draft;try{draft=normalizeEventDraft(action.draft,Date.now(),true)}catch(error){throw new CommunityError(400,error.message)}
                  requireValue(status!=='scheduled'||draft.startsAt>Date.now()||draft.startsAt===existing.startsAt,'Use um novo início futuro.')
                  if(draft.channelId)requireValue(server.channels.some(channel=>channel.id===draft.channelId&&channel.type==='voice'),'Canal de voz não encontrado.',404)
                  requireValue(status!=='active'||draft.startsAt===existing.startsAt,'O início de um evento em andamento não pode mudar.');requireValue(draft.channelId===existing.channelId||status==='scheduled','O local não pode mudar após o início.')
                  requireValue(canManageEvent(policy,actor,{...existing,...draft}),'Você não pode administrar eventos no novo local.',403)
                  Object.assign(existing,draft)
                }else{
                  requireValue(status==='scheduled'&&['active','cancelled'].includes(action.status)||status==='active'&&action.status==='completed','Transição de evento inválida.')
                  requireValue(existing.channelId||action.status!=='active','Eventos em outro local começam automaticamente no horário agendado.')
                  requireValue(action.status!=='active'||!existing.endsAt||existing.endsAt>Date.now(),'O horário de término já passou.')
                  existing.status=action.status
                }
                existing.updatedAt=Math.max(Date.now(),existing.updatedAt+1)
              }
            }
          }
          const record=existing||server.events[action.id];if(record?.channelId)auditThread={parentId:record.channelId,private:false}
          target=action.id;event=action.type;break
        }
        case 'thread-create':{
          const parent=server.channels.find(channel=>channel.id===action.parentId&&channel.type==='text'&&!channel.parentId)
          requireValue(parent,'Canal principal não encontrado.',404);requirePermission(server,actor,'VIEW_CHANNEL',parent.id)
          requireValue(validThreadPatch({name:action.name}),'Nome do tópico inválido.')
          requireValue(typeof action.private==='boolean'&&typeof action.invitable==='boolean'&&threadDurations.includes(action.autoArchiveMinutes),'Opções de tópico inválidas.')
          requirePermission(server,actor,action.private?'CREATE_PRIVATE_THREADS':'CREATE_PUBLIC_THREADS',parent.id)
          requireValue(identifier(action.id)&&!Object.values(state.servers).some(item=>item.channels.some(channel=>channel.id===action.id)||item.deletedChannels?.includes(action.id))&&!policy.categories.some(category=>category.id===action.id)&&action.id!==id,'Identificador de tópico inválido ou já utilizado.')
          requireValue(Object.keys(policy.threads||{}).length<1000,'O servidor atingiu o limite de 1000 tópicos.')
          if(action.sourceMessageId!==undefined){requireValue(!action.private&&identifier(action.sourceMessageId),'A mensagem de origem só pode criar um tópico público.');requirePermission(server,actor,'READ_MESSAGE_HISTORY',parent.id);const source=(server.messages[parent.id]||[]).find(message=>message.id===action.sourceMessageId);requireValue(source&&!source.once,'Mensagem de origem indisponível.',404);requireValue(!Object.values(policy.threads||{}).some(thread=>thread.parentId===parent.id&&thread.sourceMessageId===action.sourceMessageId),'Esta mensagem já tem um tópico.')}
          const now=Date.now();policy.threads||={};policy.threads[action.id]={parentId:parent.id,ownerId:actor,private:action.private,members:[actor],archived:false,locked:false,invitable:action.invitable,autoArchiveMinutes:action.autoArchiveMinutes,createdAt:now,lastActivityAt:now,...(action.sourceMessageId?{sourceMessageId:action.sourceMessageId}:{})}
          server.channels.push({id:action.id,parentId:parent.id,type:'text',name:text(action.name,60),serverId:id,slowmodeSeconds:parent.slowmodeSeconds||0});server.messages[action.id]=[]
          target=action.id;event=action.type;auditThread=policy.threads[action.id];break
        }
        case 'thread-edit':case 'thread-member':case 'thread-delete':{
          const thread=policy.threads?.[action.id],channel=server.channels.find(channel=>channel.id===action.id)
          requireValue(identifier(action.id)&&thread&&channel,'Tópico não encontrado.',404);requirePermission(server,actor,'VIEW_CHANNEL',action.id)
          const manage=can(policy,actor,'MANAGE_THREADS',action.id);auditThread=copy(thread);target=action.id;event=action.type
          if(action.type==='thread-delete'){requireValue(manage,'Você precisa de Gerenciar tópicos para excluir.',403);removeChannels(server,[action.id]);break}
          if(action.type==='thread-member'){
            requireValue(identifier(action.member)&&policy.members.includes(action.member)&&typeof action.enabled==='boolean','Participante inválido.');requireValue(!threadArchived(thread),'Reabra o tópico antes de alterar participantes.',409)
            if(action.member!==actor){if(action.enabled){requirePermission(server,actor,'SEND_MESSAGES',action.id);requireValue(!thread.private||thread.invitable||manage||thread.ownerId===actor,'Somente o criador ou um moderador pode adicionar participantes.',403);requirePermission(server,action.member,'VIEW_CHANNEL',thread.parentId)}else requireValue(manage||thread.private&&thread.ownerId===actor&&!thread.locked,'Você não pode remover este participante.',403)}
            thread.members=action.enabled?[...new Set([...thread.members,action.member])]:thread.members.filter(member=>member!==action.member)
            event=action.enabled?'thread-member-add':'thread-member-remove';break
          }
          requireValue(validThreadPatch(action.patch),'Configurações de tópico inválidas.')
          const patch=action.patch
          if(Object.keys(patch).every(key=>key==='archived')&&patch.archived===false)requireValue(manage||!thread.locked&&(thread.members.includes(actor)||thread.ownerId===actor),'Você não pode reabrir este tópico.',403)
          else requireValue(canEditThread(policy,actor,action.id),'Você não pode alterar este tópico.',403)
          if(patch.locked!==undefined)requireValue(manage,'Você precisa de Gerenciar tópicos para bloquear.',403)
          if(patch.name!==undefined)channel.name=text(patch.name,60)
          for(const key of ['archived','locked','invitable','autoArchiveMinutes'])if(patch[key]!==undefined)thread[key]=patch[key]
          if(patch.archived===false||patch.autoArchiveMinutes!==undefined)thread.lastActivityAt=Date.now()
          break
        }
        case 'voice-status':{
          requireValue(identifier(action.channelId),'Canal inválido.')
          const channel=server.channels.find(channel=>channel.id===action.channelId&&channel.type==='voice')
          requireValue(channel,'Canal de voz não encontrado.',404)
          requireValue(canSetVoiceStatus(policy,actor,channel.id,!!voice?.hasParticipant?.(id,actor,channel.id)),'Para definir o status, seu cargo precisa autorizar a ação e você precisa estar na chamada ou ter Gerenciar canais.',403)
          let status;try{status=normalizeVoiceStatus(action.status)}catch(error){throw new CommunityError(400,error.message)}
          channel.voiceStatus=status;channel.voiceStatusUpdatedAt=Math.max(Date.now(),(channel.voiceStatusUpdatedAt||0)+1)
          target=channel.id;event=action.type;reason=status?'Status: '+status:'Status removido';auditThread={parentId:channel.id,private:false};break
        }
        case 'server-edit':{
          requirePermission(server,actor,'MANAGE_GUILD')
          requireValue(action.patch&&typeof action.patch==='object'&&!Array.isArray(action.patch)&&Object.keys(action.patch).length>0&&Object.keys(action.patch).every(key=>['name','description'].includes(key)),'Configurações de servidor inválidas.')
          if(own(action.patch,'name')){const name=text(action.patch.name,100);requireValue(!/[\p{Cc}\p{Zl}\p{Zp}]/u.test(name),'Use um nome sem controles ou quebras de linha.');server.name=name.normalize('NFC')}
          if(own(action.patch,'description')){requireValue(typeof action.patch.description==='string'&&action.patch.description.trim().length<=300&&!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(action.patch.description),'Use uma descrição de até 300 caracteres.');server.description=action.patch.description.trim()}
          target=id;event=action.type
          break
        }
        case 'member-nickname':{
          requireValue(identifier(action.member),'Membro inválido.')
          requireValue(canSetNickname(policy,actor,action.member),'Você não pode alterar este apelido. Confira a permissão, a hierarquia e a propriedade.',403)
          let nickname
          try{nickname=normalizeNickname(action.nickname)}catch(error){throw new CommunityError(400,error.message)}
          server.nicknames||={}
          if(nickname)server.nicknames[action.member]=nickname;else delete server.nicknames[action.member]
          target=action.member;event=action.type
          break
        }
        case 'voice-mute':case 'voice-deafen':case 'voice-move':{
          requireValue(identifier(action.member)&&identifier(action.channelId),'Membro ou canal inválido.')
          requireValue(voice?.hasParticipant,'A moderação de voz ainda não está disponível.',503)
          requireValue(server.channels.some(channel=>channel.id===action.channelId&&channel.type==='voice'),'Canal de voz não encontrado.',404)
          const permission=action.type==='voice-mute'?'MUTE_MEMBERS':action.type==='voice-deafen'?'DEAFEN_MEMBERS':'MOVE_MEMBERS'
          requireValue(canModerateVoice(policy,actor,action.member,permission,action.channelId),'Você não pode moderar a voz neste canal.',403)
          requireValue(voice.hasParticipant(id,action.member,action.channelId),'A pessoa não está mais conectada a este canal.',409)
          requireValue(action.reason===undefined||typeof action.reason==='string'&&action.reason.trim().length<=512,'Use um motivo de até 512 caracteres.')
          reason=action.reason?.trim()||'';target=action.channelId
          if(action.type==='voice-move'){
            requireValue(voice.prepareMove,'A movimentação de voz ainda não está disponível.',503)
            requireValue(action.destinationId===null||identifier(action.destinationId)&&action.destinationId!==action.channelId,'Escolha outro canal de voz.')
            const destination=action.destinationId===null?null:server.channels.find(channel=>channel.id===action.destinationId&&channel.type==='voice')
            requireValue(action.destinationId===null||destination,'Canal de destino não encontrado.',404)
            if(destination){requireValue(canModerateVoice(policy,actor,action.member,'MOVE_MEMBERS',destination.id)&&can(policy,actor,'CONNECT',destination.id)&&can(policy,action.member,'VIEW_CHANNEL',destination.id)&&can(policy,action.member,'CONNECT',destination.id),'Você ou o participante não podem acessar o destino.',403);target=destination.id}
            pendingMove={serverId:id,member:action.member,fromChannelId:action.channelId,destinationId:destination?.id||null,destinationName:destination?.name||''}
            event=destination?'voice-move':'voice-disconnect'
          }else{
            requireValue(typeof action.enabled==='boolean','Estado de moderação inválido.')
            const previous=policy.voiceRestrictions?.[action.member]||{muted:false,deafened:false}
            policy.voiceRestrictions||={};policy.voiceRestrictions[action.member]={...previous,[action.type==='voice-mute'?'muted':'deafened']:action.enabled}
            if(!policy.voiceRestrictions[action.member].muted&&!policy.voiceRestrictions[action.member].deafened)delete policy.voiceRestrictions[action.member]
            event=action.enabled?action.type:action.type==='voice-mute'?'voice-unmute':'voice-undeafen'
          }
          break
        }
        case 'invite-create':{
          requireValue(server.channels.some(channel=>channel.id===action.channelId&&!channel.parentId),'Escolha um canal principal.',404)
          requirePermission(server,actor,'VIEW_CHANNEL',action.channelId);requirePermission(server,actor,'CREATE_INSTANT_INVITE',action.channelId)
          requireValue(Number.isInteger(action.maxAge)&&action.maxAge>=0&&action.maxAge<=604800,'Use um prazo de até sete dias ou sem expiração.')
          requireValue(Number.isInteger(action.maxUses)&&action.maxUses>=0&&action.maxUses<=100,'Use um limite entre 1 e 100 ou sem limite.')
          server.invites=Object.fromEntries(Object.entries(server.invites||{}).filter(([,invite])=>activeInvite(invite)))
          requireValue(Object.keys(server.invites).length<100,'O servidor atingiu o limite de 100 convites ativos.')
          const code=randomBytes(24).toString('hex'),now=Date.now()
          server.invites[code]={id:digest(code),code,createdBy:actor,channelId:action.channelId,createdAt:now,expiresAt:action.maxAge?now+action.maxAge*1000:0,maxUses:action.maxUses,uses:0}
          target=action.channelId;event=action.type;break
        }
        case 'invite-revoke':{
          requireValue(validInviteCode(action.code)&&own(server.invites||{},action.code),'Convite não encontrado.',404)
          const invite=server.invites[action.code]
          requireValue(canManageInvite(policy,actor,invite),'Você não pode revogar este convite.',403)
          delete server.invites[action.code]
          target=invite.channelId;event=action.type;break
        }
        case 'member-kick':case 'member-ban':case 'member-unban':{
          requireValue(identifier(action.member),'Membro inválido.')
          requireValue(action.reason===undefined||typeof action.reason==='string'&&action.reason.trim().length<=512,'Use um motivo de até 512 caracteres.')
          reason=action.reason?.trim()||''
          target=action.member;event=action.type
          if(action.type==='member-unban'){
            requirePermission(server,actor,'BAN_MEMBERS')
            requireValue(own(server.bans||{},target),'Banimento não encontrado.',404)
            delete server.bans[target]
            break
          }
          requireValue(canActOnMember(policy,actor,target,action.type==='member-ban'?'BAN_MEMBERS':'KICK_MEMBERS'),'Você não pode moderar este membro. Confira a hierarquia e a propriedade.',403)
          if(action.type==='member-ban'){server.bans||={};server.bans[target]={actor,reason,timestamp:Date.now()}}
          server.removedMembers=[...new Set([...(server.removedMembers||[]),target])]
          policy.members=policy.members.filter(member=>member!==target)
          delete policy.memberRoles[target];delete policy.timeouts[target]
          delete policy.voiceRestrictions?.[target]
          for(const thread of Object.values(policy.threads||{}))thread.members=thread.members.filter(member=>member!==target)
          for(const project of Object.values(policy.projects||{})){if(target===project.ownerId){if(!Object.entries(project.members).some(([member,level])=>member!==target&&level==='manager'&&policy.members.includes(member)))project.archived=true}else delete project.members[target]}
          for(const event of Object.values(server.events||{}))event.interested=event.interested.filter(member=>member!==target)
          delete server.nicknames?.[target]
          delete server.memberAdmissions?.[target]
          for(const channel of Object.keys(policy.overwrites))policy.overwrites[channel]=policy.overwrites[channel].filter(overwrite=>overwrite.type!=='member'||overwrite.id!==target)
          for(const message of Object.keys(server.fileDeliveries||{}))server.fileDeliveries[message]=server.fileDeliveries[message].filter(member=>member!==target)
          for(const [code,invite]of Object.entries(server.invites||{}))if(invite.createdBy===target)delete server.invites[code]
          break
        }
        case 'role': {
          const command = action.command
          requireValue(!policy.threads?.[command?.channel]&&!policy.projects?.[command?.channel],'Subchats herdam as permissões do canal principal.')
          requireValue(command && typeof command === 'object' && typeof command.type === 'string', 'Comando de cargo inválido.')
          if (['overwrite', 'category-link'].includes(command.type)) requireValue(server.channels.some(channel => channel.id === command.channel) || (command.type === 'overwrite' && policy.categories.some(category => category.id === command.channel)), 'Canal ou categoria não encontrado.', 404)
          if (command.type === 'category-create') {requireValue(!server.channels.some(channel => channel.id === command.id) && command.id !== id, 'Identificador já utilizado.');requireValue(server.channels.filter(channel=>!channel.parentId).length+policy.categories.length<500,'O servidor atingiu o limite de canais e categorias.')}
          try { server.policy = applyRoleCommand(policy, actor, command) } catch (error) { throw new CommunityError(403, error.message) }
          target = command.id || command.channel || command.member; event = 'role.' + command.type
          break
        }
        case 'channel-create': {
          requirePermission(server, actor, 'MANAGE_CHANNELS')
          requireValue(identifier(action.id) && !Object.values(state.servers).some(item=>item.channels.some(channel=>channel.id===action.id)||item.deletedChannels?.includes(action.id)) && !policy.categories.some(category => category.id === action.id) && action.id !== id, 'Identificador de canal inválido ou já utilizado.')
          requireValue(['text', 'voice'].includes(action.channelType) && server.channels.filter(channel=>!channel.parentId).length+policy.categories.length < 500, 'Tipo ou limite de canais inválido.')
          server.channels.push({ id: action.id, name: text(action.name, 60), type: action.channelType, serverId: id })
          target = action.id; event = action.type; break
        }
        case 'channel-rename': case 'channel-delete': {
          const channel = server.channels.find(channel => channel.id === action.id)
          requireValue(channel, 'Canal não encontrado.', 404)
          requireValue(!channel.parentId,'Use as configurações do tópico.');requirePermission(server, actor, 'MANAGE_CHANNELS', channel.id)
          if (action.type === 'channel-rename') channel.name = text(action.name, 60)
          else removeChannels(server,[channel.id,...server.channels.filter(item=>item.parentId===channel.id).map(item=>item.id)])
          target = action.id; event = action.type; break
        }
        case 'poll-vote':case 'poll-close':{
          requireValue(identifier(action.channel)&&identifier(action.id),'Mensagem ou canal inválido.')
          const message=(server.messages[action.channel]||[]).find(message=>message.id===action.id)
          requireValue(message?.poll,'Enquete não encontrada.',404)
          requireValue(knownMessage(server,actor,message),'Você não tem acesso a esta enquete.',403)
          requireThreadMutation(server,actor,action.channel,action.type==='poll-close'?'edit':'vote')
          const poll=message.poll
          if(action.type==='poll-close'){
            requireValue(message.userId===actor,'Somente o autor pode encerrar a enquete.',403)
            if(pollOpen(poll)){poll.closedAt=Date.now();poll.closedBy=actor}else auditAction=false
            event=action.type
          }else{
            requireValue(pollOpen(poll),'Esta enquete já foi encerrada.',409)
            requireValue(!(policy.timeouts[actor]>Date.now()),'Você está temporariamente impedido de votar.',403)
            requireValue(Array.isArray(action.answers)&&action.answers.length<=(poll.multiple?poll.answers.length:1)&&action.answers.every(answer=>typeof answer==='string'&&poll.answers.some(option=>option.id===answer))&&new Set(action.answers).size===action.answers.length,'Escolha respostas válidas para esta enquete.')
            for(const answer of poll.answers){answer.voters=answer.voters.filter(member=>member!==actor);if(action.answers.includes(answer.id))answer.voters.push(actor)}
            auditAction=false
          }
          messageChange={id:message.id,channelId:action.channel,deleted:false,poll:copy(poll)};target=message.id;break
        }
        case 'channel-slowmode':{
          const channel=server.channels.find(channel=>channel.id===action.channel&&channel.type==='text')
          requireValue(channel,'Canal de texto não encontrado.',404);requirePermission(server,actor,channel.parentId?'MANAGE_THREADS':'MANAGE_CHANNELS',channel.id)
          requireValue(Number.isInteger(action.seconds)&&action.seconds>=0&&action.seconds<=21600,'Use um intervalo entre 0 e 21600 segundos.')
          channel.slowmodeSeconds=action.seconds;target=channel.id;event=action.type;break
        }
        case 'message-reaction':case 'message-reactions-clear':case 'message-pin':{
          requireValue(identifier(action.channel)&&identifier(action.id),'Mensagem ou canal inválido.')
          requireValue(server.channels.some(channel=>channel.id===action.channel&&channel.type==='text'),'Canal de texto não encontrado.',404)
          requirePermission(server,actor,'VIEW_CHANNEL',action.channel);requirePermission(server,actor,'READ_MESSAGE_HISTORY',action.channel)
          const messages=server.messages[action.channel]||[],message=messages.find(message=>message.id===action.id)
          requireValue(message,'Mensagem não encontrada.',404)
          requireThreadMutation(server,actor,action.channel,action.type==='message-pin'?'pin':'react')
          if(action.type==='message-pin'){
            requirePermission(server,actor,'PIN_MESSAGES',action.channel);requireValue(typeof action.enabled==='boolean','Estado de fixação inválido.')
            requireValue(!action.enabled||!message.once,'Mensagens de visualização única não podem ser fixadas.')
            requireValue(!action.enabled||message.pinnedAt||messages.filter(message=>message.pinnedAt).length<MAX_PINS,'O canal atingiu o limite de '+MAX_PINS+' mensagens fixadas.')
            if(action.enabled){if(!message.pinnedAt){message.pinnedAt=Date.now();message.pinnedBy=actor}}else{delete message.pinnedAt;delete message.pinnedBy}
            messageChange={id:message.id,channelId:action.channel,deleted:false,pinnedAt:message.pinnedAt??null,pinnedBy:message.pinnedBy??null}
            event=action.enabled?'message-pin':'message-unpin'
          }else{
            requireValue(!message.once,'Mensagens de visualização única não aceitam reações.')
            message.reactions||=[]
            if(action.type==='message-reactions-clear'){requirePermission(server,actor,'MANAGE_MESSAGES',action.channel);message.reactions=[];event=action.type}
            else{
              requireValue(typeof action.enabled==='boolean'&&(action.member===undefined||identifier(action.member)),'Reação inválida.')
              let emoji;try{emoji=normalizeReaction(action.emoji)}catch(error){throw new CommunityError(400,error.message)}
              const member=action.member||actor,reaction=message.reactions.find(reaction=>reaction.emoji===emoji)
              requireValue(!action.enabled||member===actor,'Você não pode reagir em nome de outra pessoa.',403)
              if(member!==actor)requirePermission(server,actor,'MANAGE_MESSAGES',action.channel)
              else if(action.enabled)requireValue(!(policy.timeouts[actor]>Date.now()),'Você está temporariamente impedido de reagir.',403)
              if(action.enabled){
                if(!reaction){requirePermission(server,actor,'ADD_REACTIONS',action.channel);requireValue(message.reactions.length<MAX_REACTIONS,'A mensagem atingiu o limite de '+MAX_REACTIONS+' reações diferentes.');message.reactions.push({emoji,members:[actor]})}
                else if(!reaction.members.includes(actor))reaction.members.push(actor)
              }else if(reaction){reaction.members=reaction.members.filter(value=>value!==member);message.reactions=message.reactions.filter(reaction=>reaction.members.length)}
              auditAction=member!==actor;event='message-reaction-remove'
            }
            messageChange={id:message.id,channelId:action.channel,deleted:false,reactions:copy(message.reactions)}
          }
          target=message.id;break
        }
        case 'message-send': {
          auditAction=false
          const channel = server.channels.find(channel => channel.id === action.channel && channel.type === 'text')
          requireValue(channel, 'Canal de texto não encontrado.', 404)
          requirePermission(server, actor, 'VIEW_CHANNEL', channel.id); requirePermission(server, actor, 'SEND_MESSAGES', channel.id)
          requireThreadMutation(server,actor,channel.id,'send')
          const deadline=can(policy,actor,'BYPASS_SLOWMODE',channel.id)?0:slowmodeDeadline(channel.slowmodeSeconds,lastSent(server,channel.id,actor))
          requireValue(deadline<=Date.now(),'Modo lento: aguarde '+Math.ceil((deadline-Date.now())/1000)+' segundos antes de enviar outra mensagem.',429)
          const content = typeof action.content === 'string' ? action.content.trim() : ''
          let expression,sourceAttachment=action.attachment
          if(action.expression!==undefined){
            const reference=action.expression;requireValue(reference&&identifier(reference.id)&&identifier(reference.serverId),'Expressão inválida.')
            const origin=serverFor(actor,reference.serverId),item=origin.expressions?.[reference.id];requireValue(item&&item.kind!=='sound','Emoji ou figurinha não encontrado.',404)
            requireValue(!action.attachment&&!action.tts&&!action.poll&&!action.voice&&!action.once,'Expressões não podem ser combinadas com anexos, leitura em voz, enquete, gravação ou visualização única.')
            if(reference.serverId!==id)requirePermission(server,actor,item.kind==='emoji'?'USE_EXTERNAL_EMOJIS':'USE_EXTERNAL_STICKERS',channel.id)
            expression={serverId:item.serverId,id:item.id,name:item.name,kind:item.kind};sourceAttachment=item.attachment
          }
          requireValue(action.tts===undefined||typeof action.tts==='boolean','Leitura em voz inválida.');if(action.tts){requirePermission(server,actor,'SEND_TTS_MESSAGES',channel.id);requireValue(!action.once&&!action.attachment&&!action.poll&&!!content,'Leitura em voz exige texto, sem enquete, anexo ou visualização única.')}
          let voice
          if(action.voice!==undefined){requirePermission(server,actor,'SEND_VOICE_MESSAGES',channel.id);const item=action.voice;requireValue(item&&Number.isInteger(item.durationMs)&&item.durationMs>=250&&item.durationMs<=60000&&!content&&!action.tts&&!action.poll&&!action.once&&action.attachment&&action.attachment.type==='audio/webm;codecs=opus'&&action.attachment.size>0&&action.attachment.size<=1048576,'Mensagem de voz inválida. Grave até um minuto sem texto, enquete, leitura em voz ou visualização única.');voice={durationMs:item.durationMs}}
          let poll
          if(action.poll!==undefined){requirePermission(server,actor,'SEND_POLLS',channel.id);requireValue(!action.once&&!action.attachment,'Enquetes não podem ter anexos ou visualização única.');let draft;try{draft=normalizePoll(action.poll)}catch(error){throw new CommunityError(400,error.message)};requireValue(!content||content===draft.question,'Envie apenas a pergunta no texto da enquete.');poll={question:draft.question,answers:draft.answers.map(answer=>({...answer,id:randomUUID(),voters:[]})),multiple:draft.multiple,expiresAt:Date.now()+draft.durationHours*3600000}}
          requireValue(content.length <= 2000 && (content || sourceAttachment || poll), 'Envie uma mensagem de até 2000 caracteres ou um anexo.')
          let attachment
          if (sourceAttachment) {
            if(!voice&&!expression)requirePermission(server, actor, 'ATTACH_FILES', channel.id)
            const item = sourceAttachment
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
          const message = { id: action.id, channelId: channel.id, userId: actor, userName: actor, content:poll?poll.question:content,...(action.tts?{tts:true}:{}),...(voice?{voice}:{}),...(expression?{expression}:{}),...(poll?{poll}:{}), timestamp: Date.now(), preview: action.preview !== false && can(policy, actor, 'EMBED_LINKS', channel.id), once: action.once === true, ...(attachment ? { attachment } : {}) }
          if(policy.threads?.[channel.id]){const thread=policy.threads[channel.id];thread.archived=false;thread.lastActivityAt=message.timestamp;thread.members=[...new Set([...thread.members,actor])]}
          server.slowmodeLastSent||={};server.slowmodeLastSent[channel.id]||={};server.slowmodeLastSent[channel.id][actor]=message.timestamp
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
          requireThreadMutation(server,actor,action.channel,action.type==='message-delete'?'delete':'edit')
          auditAction=action.type==='message-delete'&&message.userId!==actor
          if (action.type === 'message-edit') { requireValue(!message.voice,'Mensagens de voz não podem ser editadas.'); requireValue(!message.poll,'A pergunta e as respostas de uma enquete publicada não podem ser editadas.'); requireValue(message.userId === actor, 'Somente o autor pode editar a mensagem.', 403); requirePermission(server, actor, 'SEND_MESSAGES', action.channel); message.content = text(action.content, 2000); message.editedAt = Date.now(); updateMentions(message,policy,actor,action.channel) }
          else { if (message.userId !== actor) requirePermission(server, actor, 'MANAGE_MESSAGES', action.channel);server.messageDeletions||={};server.messageDeletions[action.id]=true;delete server.fileDeliveries?.[action.id];server.messages[action.channel] = messages.filter(message => message.id !== action.id) }
          messageChange={id:action.id,channelId:action.channel,deleted:action.type==='message-delete',...(action.type==='message-edit'?{content:message.content,editedAt:message.editedAt,roleMentions:message.roleMentions,mentionsEveryone:message.mentionsEveryone??null}:{})}
          target = action.id; event = action.type; break
        }
        default: throw new CommunityError(400, 'Operação desconhecida.')
      }
      auditThread||=policy.threads?.[action.channel]||policy.projects?.[action.channel]&&{parentId:action.channel,private:true}
      if(server.webhooks)server.webhooks=Object.fromEntries(Object.entries(server.webhooks).filter(([,hook])=>server.policy.members.includes(hook.creator)&&server.channels.some(channel=>channel.id===hook.channelId)))
      server.revision++
      const targetName = target===id?server.name:[...Object.values(server.events||{}),...Object.values(previous.events||{}),...server.policy.roles,...previous.policy.roles,...server.channels,...previous.channels,...server.policy.categories,...previous.policy.categories].find(item=>item.id===target)?.name || (server.policy.members.includes(target) ? target : undefined)
      const member=action.type==='role'?action.command.member:action.type==='message-reaction'||action.type==='thread-member'?action.member:action.type.startsWith('member-')||action.type.startsWith('voice-')?action.member:undefined
      if(auditAction)server.audit = [{ id: randomUUID(), actor, event, target, targetName, member, ...(reason?{reason}:{}), timestamp: Date.now(),...(auditThread?{threadParent:auditThread.parentId,privateThread:auditThread.private}:{}) }, ...server.audit].slice(0, 2000)
      const next = { ...state, servers: { ...state.servers, [id]: server } }
      let movePlan
      if(pendingMove){try{movePlan=voice.prepareMove(pendingMove)}catch(error){throw new CommunityError(409,error.message)}}
      try{await storage?.save(next)}catch(error){movePlan?.cancel();throw error}
      state = next
      for(const [key,run]of activeAi)if(key.startsWith(id+':')){const runChannel=key.slice(id.length+1);if(!server.channels.some(item=>item.id===runChannel)||!can(server.policy,run.actor,'SEND_MESSAGES',runChannel))run.controller.abort()}
      if(action.poll||action.type.startsWith('event-')||action.type.startsWith('stage-')||action.type==='channel-voice-mode'||action.type.startsWith('thread-')||action.type==='message-send'&&policy.threads?.[action.channel]||['poll-close','message-delete','channel-delete'].includes(action.type))indexPolls(id)
      movePlan?.commit()
      const syncVoice=voice&&(action.type==='role'||action.type==='channel-delete'||action.type==='member-kick'||action.type==='member-ban'||action.type==='voice-mute'||action.type==='voice-deafen'||action.type==='member-nickname'||action.type==='expression-delete'||action.type.startsWith('stage-')||action.type==='channel-voice-mode')
      if(syncVoice)pendingVoice.set(id,pendingVoice.get(id)||previous)
      changes.emit(id,{message:liveMessage,messageChange})
      // Revoke/update connected participants as soon as permissions change.
      if (syncVoice) await reconcileVoice(id,previous)
      scheduleTimeouts()
      return {...snapshot(actor,id),...(liveMessage?{liveMessages:[copy(liveMessage)]}:{}),...(messageChange?{messageChanges:[messageChange]}:{})}
    })
    queue = task.catch(() => {})
    return task
  }
  const webhookOperation=(actor,id,revision,action,token)=>{
    const task=queue.then(async()=>{
      const previous=token?(identifier(id)&&own(state.servers,id)?state.servers[id]:null):serverFor(actor,id)
      requireValue(previous,'Servidor não encontrado.',404)
      if(!token)requireValue(Number.isSafeInteger(revision)&&revision===previous.revision,'O servidor mudou. Atualize os dados antes de tentar novamente.',409)
      if(token){try{authorizeWebhook(previous,action.id,token)}catch(error){if(error instanceof WebhookError)throw new CommunityError(error.status,error.message);throw error}}
      const server=copy(previous);let result
      try{result=token?publishWebhook(server,action.id,token,action.body):manageWebhook(server,actor,action)}catch(error){if(error instanceof WebhookError)throw new CommunityError(error.status,error.message);throw error}
      if(result.duplicate)return {id:result.message.id,channelId:result.message.channelId,duplicate:true}
      server.revision++
      if(!token)server.audit=[{id:randomUUID(),actor,event:'webhook-'+action.type,target:result.webhook.id,targetName:result.webhook.name,timestamp:Date.now(),threadParent:result.webhook.channelId,privateThread:false},...server.audit].slice(0,2000)
      const next={...state,servers:{...state.servers,[id]:server}}
      await storage?.save(next);state=next;changes.emit(id,token?{message:result.message}:undefined)
      return token?{id:result.message.id,channelId:result.message.channelId,duplicate:false}:result
    });queue=task.catch(()=>{});return task
  }
  const aiKey=(id,channel)=>id+':'+channel
  const finishAi=(id,channel,run,content,status,error,usage)=>{
    const task=queue.then(async()=>{
      const previous=state.servers[id],current=(previous?.messages[channel]||[]).find(message=>message.ai?.id===run.id)
      if(!current)return
      const server=copy(previous),message=server.messages[channel].find(item=>item.id===current.id)
      message.content=content
      message.ai={...message.ai,status,...(error?{error}:{}),inputTokens:usage.inputTokens||0,outputTokens:usage.outputTokens||0}
      server.revision++
      const next={...state,servers:{...state.servers,[id]:server}}
      await storage?.save(next);state=next
      changes.emit(id,{messageChange:{id:message.id,channelId:channel,deleted:false,content:message.content,ai:message.ai}})
      aiChanges.emit(aiKey(id,channel),{type:'done',runId:run.id,status,content:message.content,usage:message.ai,error})
    });queue=task.catch(()=>{});return task
  }
  let drainAi
  const executeAi=async({id,channel,actor,key,model,run,text,files,contextTokens,maxOutputTokens,controller})=>{
    let content='',usage={inputTokens:0,outputTokens:0},status='completed',error
    try{
      const previous=state.servers[id],history=(previous.messages[channel]||[]).filter(message=>!message.ai||message.ai.status==='completed')
      const position=history.findIndex(message=>message.id===run.promptId)
      const items=history.slice(0,position+1)
      const recent=[],older=[];let length=0
      for(let index=items.length-1;index>=0;index--){const item=items[index];if(length+item.content.length<=contextTokens*2||!recent.length){recent.unshift(item);length+=item.content.length}else older.unshift(item)}
      let summary=(previous.aiContext?.[channel]?.text||'').slice(-contextTokens*2)
      const marker=previous.aiContext?.[channel]?.throughMessageId
      if(marker&&recent.some(message=>message.id===marker))summary=''
      const summarizedIndex=older.findIndex(message=>message.id===marker)
      const pending=summarizedIndex>=0?older.slice(summarizedIndex+1):older
      if(pending.length){
        const batches=[];let batch=[],size=0
        for(const item of pending){if(batch.length&&size+item.content.length>contextTokens*2){batches.push(batch);batch=[];size=0}batch.push(item);size+=item.content.length}
        if(batch.length)batches.push(batch)
        for(const messages of batches){
          const remaining=maxOutputTokens-usage.outputTokens
          if(remaining<256)throw new Error('O limite pessoal de saída não comporta o resumo deste histórico.')
          const result=await aiProvider.summarize({key,model,summary,messages,maxOutputTokens:Math.min(512,remaining-128),signal:controller.signal})
          summary=result.text.slice(0,Math.min(6000,contextTokens*2));usage.inputTokens+=result.usage.input_tokens||0;usage.outputTokens+=result.usage.output_tokens||0
        }
        const task=queue.then(async()=>{
          const current=state.servers[id];if(!current.channels.some(item=>item.id===channel))return
          const server=copy(current);server.aiContext||={};server.aiContext[channel]={text:summary,throughMessageId:older.at(-1).id};server.revision++
          const next={...state,servers:{...state.servers,[id]:server}};await storage?.save(next);state=next;changes.emit(id)
        });queue=task.catch(()=>{});await task
      }
      if(maxOutputTokens-usage.outputTokens<128)throw new Error('O limite pessoal de saída foi consumido ao resumir o contexto.')
      const inputTokens=await aiProvider.count({key,model,messages:recent,summary,files,signal:controller.signal})
      if(inputTokens>contextTokens)throw new Error('Este pedido precisa de '+inputTokens+' tokens de contexto e ultrapassa o seu limite de '+contextTokens+'. Reduza anexos ou altere seu limite pessoal.')
      const result=await aiProvider.generate({key,model,messages:recent,summary,files,maxOutputTokens:maxOutputTokens-usage.outputTokens,signal:controller.signal,onDelta:delta=>{
        content+=delta;activeAi.get(aiKey(id,channel))&&(activeAi.get(aiKey(id,channel)).partial=content)
        aiChanges.emit(aiKey(id,channel),{type:'delta',runId:run.id,delta})
      }})
      if(controller.signal.aborted)throw new Error('Execução interrompida.')
      content=result.text;usage.inputTokens+=result.usage.input_tokens||0;usage.outputTokens+=result.usage.output_tokens||0
    }catch(failure){status=controller.signal.aborted?'cancelled':'failed';error=controller.signal.aborted?'Execução interrompida.':failure instanceof Error?failure.message:'A IA não concluiu a resposta.'}
    try{await finishAi(id,channel,run,content,status,error,usage)}finally{if(activeAi.get(aiKey(id,channel))?.id===run.id)activeAi.delete(aiKey(id,channel));drainAi(id,channel)}
  }
  drainAi=(id,channel)=>{
    const key=aiKey(id,channel)
    if(closed||activeAi.has(key))return
    const pending=pendingAi.get(key),job=pending?.shift()
    if(!job)return
    pendingAiBytes-=job.files.reduce((total,file)=>total+file.size,0)
    if(!pending.length)pendingAi.delete(key)
    const controller=new AbortController()
    activeAi.set(key,{...job.run,promptId:job.run.promptId,controller,partial:''})
    const task=queue.then(async()=>{
      const previous=state.servers[id],answer=previous?.messages[channel]?.find(item=>item.ai?.id===job.run.id)
      if(!answer||!previous.channels.some(item=>item.id===channel)||!can(previous.policy,job.actor,'SEND_MESSAGES',channel)||previous.policy.projects?.[channel]&&!activeProject(previous.policy.projects[channel],previous.policy.members))return false
      const server=copy(previous),message=server.messages[channel].find(item=>item.id===answer.id)
      message.ai.status='running';server.revision++
      const next={...state,servers:{...state.servers,[id]:server}}
      await storage?.save(next);state=next
      changes.emit(id,{messageChange:{id:message.id,channelId:channel,deleted:false,ai:message.ai}})
      return true
    });queue=task.catch(()=>{})
    void task.then(allowed=>{
      if(!allowed){void finishAi(id,channel,job.run,'','cancelled','O autor perdeu acesso antes de iniciar a resposta.',{}).finally(()=>{activeAi.delete(key);drainAi(id,channel)});return}
      aiChanges.emit(key,{type:'started',runId:job.run.id,actor:job.actor,model:job.model})
      void executeAi({...job,controller}).catch(()=>{})
    }).catch(()=>{activeAi.delete(key);drainAi(id,channel)})
  }
  const startAi=(actor,id,body)=>{
    requireValue(body&&typeof body==='object'&&typeof body.key==='string'&&body.key.length>=20&&body.key.length<=512,'Configure sua chave pessoal da OpenAI.',400)
    requireValue(identifier(body.channelId)&&typeof body.text==='string'&&body.text.trim()&&body.text.trim().length<=2000,'Envie um prompt de até 2000 caracteres.')
    requireValue(Number.isInteger(body.contextTokens)&&body.contextTokens>=1024&&body.contextTokens<=32768&&Number.isInteger(body.maxOutputTokens)&&body.maxOutputTokens>=128&&body.maxOutputTokens<=8192,'Configure limites válidos para esta solicitação.')
    let files;try{files=validateAiFiles(body.files||[])}catch(error){throw new CommunityError(400,error.message)}
    const task=queue.then(async()=>{
      const previous=serverFor(actor,id),channel=previous.channels.find(item=>item.id===body.channelId&&item.type==='text')
      requireValue(channel,'Conversa não encontrada.',404)
      requirePermission(previous,actor,'VIEW_CHANNEL',channel.id);requirePermission(previous,actor,'SEND_MESSAGES',channel.id)
      const project=previous.policy.projects?.[channel.id]
      requireValue(!project||activeProject(project,previous.policy.members),'Projeto arquivado.',409)
      const model=project?.model||previous.channels.find(item=>item.id===(project?.parentId||channel.id))?.aiModel
      requireValue(validAiModel(model),'Configure um modelo de IA nesta conversa.',409)
      const runKey=aiKey(id,channel.id),waiting=activeAi.has(runKey)||(pendingAi.get(runKey)?.length||0)>0
      requireValue((pendingAi.get(runKey)?.length||0)<3,'A fila desta conversa está cheia. Aguarde uma resposta.',409)
      if(waiting)requireValue(pendingAiBytes+files.reduce((total,file)=>total+file.size,0)<=100*1024*1024,'A fila de anexos da IA está cheia. Aguarde uma resposta.',429)
      const server=copy(previous),promptId=randomUUID(),runId=randomUUID(),now=Date.now()
      const deadline=can(previous.policy,actor,'BYPASS_SLOWMODE',channel.id)?0:slowmodeDeadline(channel.slowmodeSeconds,lastSent(previous,channel.id,actor))
      requireValue(deadline<=now,'Modo lento: aguarde '+Math.ceil((deadline-now)/1000)+' segundos.',429)
      const prompt={id:promptId,channelId:channel.id,userId:actor,userName:actor,content:body.text.trim(),timestamp:now,preview:false}
      const run={id:runId,promptId,channelId:channel.id,actor,model,status:waiting?'queued':'running',files:files.map(({name,size,type})=>({name,size,type}))}
      const answer={id:runId,channelId:channel.id,userId:'ai:'+runId,userName:'IA · '+model,content:'',timestamp:now+1,preview:false,ai:run}
      server.messages[channel.id]=[...(server.messages[channel.id]||[]),prompt,answer]
      server.slowmodeLastSent||={};server.slowmodeLastSent[channel.id]||={};server.slowmodeLastSent[channel.id][actor]=now
      server.revision++
      const next={...state,servers:{...state.servers,[id]:server}}
      await storage?.save(next);state=next
      const job={id,channel:channel.id,actor,key:body.key,model,run,text:body.text,files,contextTokens:body.contextTokens,maxOutputTokens:body.maxOutputTokens}
      if(waiting){const pending=pendingAi.get(runKey)||[];pending.push(job);pendingAi.set(runKey,pending);pendingAiBytes+=files.reduce((total,file)=>total+file.size,0)}
      else{const controller=new AbortController();activeAi.set(runKey,{...run,controller,partial:''});queueMicrotask(()=>void executeAi({...job,controller}).catch(()=>{}))}
      changes.emit(id,{message:prompt});if(!waiting)aiChanges.emit(runKey,{type:'started',runId,actor,model})
      return {runId,promptId,model,queued:waiting}
    });queue=task.catch(()=>{});return task
  }
  const stopAi=async(actor,id,channel,runId)=>{
    const current=serverFor(actor,id),key=aiKey(id,channel),active=activeAi.get(key),pending=pendingAi.get(key)
    const queued=runId?pending?.find(item=>item.run.id===runId):undefined
    const run=queued?.run||active
    requireValue(run&&(!runId||run.id===runId)&&can(current.policy,actor,'VIEW_CHANNEL',channel),'Execução não encontrada.',404)
    const project=current.policy.projects?.[channel]
    requireValue(run.actor===actor||project?.members[actor]==='manager'||!project&&can(current.policy,actor,'MANAGE_CHANNELS',channel),'Você não pode interromper esta resposta.',403)
    if(queued){pending.splice(pending.indexOf(queued),1);pendingAiBytes-=queued.files.reduce((total,file)=>total+file.size,0);if(!pending.length)pendingAi.delete(key);await finishAi(id,channel,run,'','cancelled','Pedido retirado da fila.',{});return {stopping:false,runId:run.id}}
    active.controller.abort();return {stopping:true,runId:run.id}
  }
  const json = (response, status, value) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)) }
  const lookupInvite=(code,requireActive=true)=>{
    requireValue(validInviteCode(code),'Convite inválido ou indisponível.',404)
    const server=Object.values(state.servers).find(server=>own(server.invites||{},code))
    const invite=server?.invites[code]
    requireValue(server&&invite&&(!requireActive||activeInvite(invite))&&server.channels.some(channel=>channel.id===invite.channelId)&&server.policy.members.includes(invite.createdBy),'Convite inválido, expirado ou esgotado.',404)
    return {server,invite}
  }
  const previewInvite=(actor,code)=>{
    const {server,invite}=lookupInvite(code)
    requireValue(!own(server.bans||{},actor),'Você não pode usar convites deste servidor enquanto estiver banido.',403)
    return {code,serverId:server.id,name:server.name,expiresAt:invite.expiresAt,alreadyMember:server.policy.members.includes(actor)}
  }
  const acceptInvite=(actor,code)=>{
    const task=queue.then(async()=>{
      const {server:current,invite}=lookupInvite(code,false)
      requireValue(!own(current.bans||{},actor),'Você não pode usar convites deste servidor enquanto estiver banido.',403)
      if(current.policy.members.includes(actor))return snapshot(actor,current.id)
      requireValue(activeInvite(invite),'Convite inválido, expirado ou esgotado.',404)
      const server=copy(current),next={...state,servers:{...state.servers,[current.id]:server}}
      server.policy.members.push(actor);server.policy.memberRoles[actor]=[];delete server.policy.timeouts[actor]
      delete server.nicknames?.[actor]
      delete server.policy.voiceRestrictions?.[actor]
      server.removedMembers=(server.removedMembers||[]).filter(member=>member!==actor)
      for(const channel of Object.keys(server.policy.overwrites))server.policy.overwrites[channel]=server.policy.overwrites[channel].filter(item=>item.type!=='member'||item.id!==actor)
      server.invites[code].uses++;server.revision++
      const admission={joinedAt:Date.now(),method:'invite',invitedBy:server.invites[code].createdBy,channelId:server.invites[code].channelId,inviteId:digest(code)}
      server.memberAdmissions||={};server.memberAdmissions[actor]=admission
      server.audit=[{id:randomUUID(),actor,event:'member.join',member:actor,reason:'Convite de @'+admission.invitedBy,timestamp:admission.joinedAt},...server.audit].slice(0,2000)
      await storage?.save(next);state=next;changes.emit(server.id)
      return snapshot(actor,server.id)
    })
    queue=task.catch(()=>{});return task
  }
  const readBody = async request => {
    let length = 0; const chunks = []
    for await (const chunk of request) { length += chunk.length; requireValue(length <= 100000, 'Solicitação grande demais.', 413); chunks.push(chunk) }
    try { return JSON.parse(Buffer.concat(chunks).toString()) } catch { throw new CommunityError(400, 'JSON inválido.') }
  }
  const readAiBody=async request=>{
    let length=0;const chunks=[]
    for await(const chunk of request){length+=chunk.length;requireValue(length<=Math.ceil(MAX_AI_BYTES*4/3)+200000,'Solicitação de IA grande demais.',413);chunks.push(chunk)}
    try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw new CommunityError(400,'Solicitação de IA inválida.')}
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
      const landing=/^\/invite\/([a-f0-9]{48})$/.exec(url.pathname)
      if(request.method==='GET'&&landing){
        let name,status=200
        try{name=lookupInvite(landing[1]).server.name}catch{name='Convite indisponível';status=404}
        const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
        response.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"})
        response.end('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Convite ConTALK</title><style>body{color:#eee;background:#101216;font:16px system-ui;max-width:480px;margin:15vh auto;padding:24px;line-height:1.6}h1{font-size:24px}code{overflow-wrap:anywhere;color:#b59bff}</style><h1>'+escape(name)+'</h1><p>'+(status===200?'No ConTALK, abra Configurações → Comunidade → Usar convite e cole este endereço. Você precisa de uma conta local e da sua chave individual da comunidade.':'O convite pode ter expirado, sido revogado ou atingido o limite de usos.')+'</p></html>');return
      }
      if(request.method==='POST'&&url.pathname==='/internal/files/authorize'){
        requireValue(validInternalToken(token,internalToken),'Origem interna inválida.',401)
        const {username,storageId}=await readBody(request)
        requireValue(identifier(username)&&validFileId(storageId),'Usuário ou arquivo inválido.')
        const allowed=[...credentials.values()].includes(username)&&(voice?.canReadSound?.(username,storageId)||Object.values(state.servers).some(server=>server.policy.members.includes(username)&&(Object.values(server.expressions||{}).some(item=>item.attachment.storageId===storageId)||Object.entries(server.messages).some(([channel,list])=>can(server.policy,username,'VIEW_CHANNEL',channel)&&list.some(message=>message.attachment?.storageId===storageId&&(can(server.policy,username,'READ_MESSAGE_HISTORY',channel)||server.fileDeliveries?.[message.id]?.includes(username)))))))
        json(response,200,{allowed});return
      }
      requireValue(token.length >= 32 && token.length <= 512, 'Entre com sua chave individual.', 401)
      const hookRoute=/^\/hooks\/([\w:-]{1,100})\/([\w:-]{1,100})$/.exec(url.pathname)
      if(request.method==='POST'&&hookRoute){requireValue(token,'Credencial de webhook inválida.',401);const body=await readBody(request);json(response,200,await webhookOperation(null,hookRoute[1],null,{id:hookRoute[2],body},token));return}
      const actor = credentials.get(digest(token))
      requireValue(actor, 'Chave de acesso inválida.', 401)
      const aiStart=/^\/servers\/([\w:-]{1,100})\/ai-runs$/.exec(url.pathname)
      if(request.method==='POST'&&aiStart){const body=await readAiBody(request);json(response,202,await startAi(actor,aiStart[1],body));return}
      const aiStop=/^\/servers\/([\w:-]{1,100})\/ai-runs\/([\w:-]{1,100})\/stop$/.exec(url.pathname)
      if(request.method==='POST'&&aiStop){const body=await readBody(request);requireValue(body&&typeof body==='object'&&(!body.runId||identifier(body.runId)),'Execução inválida.');json(response,200,await stopAi(actor,aiStop[1],aiStop[2],body.runId));return}
      const aiStream=/^\/servers\/([\w:-]{1,100})\/ai-events\/([\w:-]{1,100})$/.exec(url.pathname)
      if(request.method==='GET'&&aiStream){
        const [,serverId,channelId]=aiStream,current=serverFor(actor,serverId)
        requireValue(current.channels.some(channel=>channel.id===channelId),'Conversa não encontrada.',404)
        requirePermission(current,actor,'VIEW_CHANNEL',channelId);requirePermission(current,actor,'READ_MESSAGE_HISTORY',channelId)
        response.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store',Connection:'keep-alive','X-Accel-Buffering':'no'})
        const send=value=>{if(!response.destroyed&&!response.writableEnded)response.write('event: ai\ndata: '+JSON.stringify(value)+'\n\n')}
        send({type:'ready'})
        const pending=activeAi.get(aiKey(serverId,channelId));if(pending)send({type:'current',runId:pending.id,partial:pending.partial})
        const onChange=()=>{const latest=state.servers[serverId];if(!latest?.policy.members.includes(actor)||!can(latest.policy,actor,'VIEW_CHANNEL',channelId)||!can(latest.policy,actor,'READ_MESSAGE_HISTORY',channelId))response.end()}
        const pulse=setInterval(()=>{if(!response.destroyed)response.write(': keepalive\n\n')},15000)
        aiChanges.on(aiKey(serverId,channelId),send);changes.on(serverId,onChange)
        response.once('close',()=>{clearInterval(pulse);aiChanges.off(aiKey(serverId,channelId),send);changes.off(serverId,onChange)})
        return
      }
      const inviteRoute=/^\/invites\/([a-f0-9]{48})(?:\/(accept))?$/.exec(url.pathname)
      if(inviteRoute&&request.method==='GET'&&!inviteRoute[2]){json(response,200,previewInvite(actor,inviteRoute[1]));return}
      if(inviteRoute&&request.method==='POST'&&inviteRoute[2]==='accept'){await readBody(request);json(response,200,await acceptInvite(actor,inviteRoute[1]));return}
      if (request.method === 'GET' && url.pathname === '/identity') { json(response, 200, { username: actor, serverIds: Object.values(state.servers).filter(server => server.policy.members.includes(actor)).map(server => server.id) }); return }
      if(request.method==='POST'&&url.pathname==='/presence-token'){requireValue(voice?.presenceToken,'O serviço de presença ainda não está configurado.',503);const body=await readBody(request);json(response,200,await voice.presenceToken(actor,text(body.name||actor,40)));return}
      const hookManagement=/^\/servers\/([\w:-]{1,100})\/webhooks$/.exec(url.pathname)
      if(request.method==='POST'&&hookManagement){const body=await readBody(request);json(response,200,await webhookOperation(actor,hookManagement[1],body.revision,body.action));return}
      if(request.method==='GET'&&url.pathname==='/expression-libraries'){json(response,200,Object.values(state.servers).filter(server=>server.policy.members.includes(actor)&&!own(server.bans||{},actor)).map(server=>({id:server.id,name:server.name,count:Object.keys(server.expressions||{}).length})));return}
      const expressionRoute=/^\/servers\/([\w:-]{1,100})\/expressions$/.exec(url.pathname)
      if(request.method==='GET'&&expressionRoute){const server=serverFor(actor,expressionRoute[1]);json(response,200,{serverId:server.id,name:server.name,revision:server.revision,canCreate:can(server.policy,actor,'CREATE_GUILD_EXPRESSIONS'),items:Object.values(server.expressions||{}).map(item=>({...copy(item),canManage:canManageExpression(server.policy,actor,item)}))});return}
      const singleMessage=/^\/servers\/([\w:-]{1,100})\/messages\/([\w:-]{1,100})\/([\w:-]{1,100})$/.exec(url.pathname)
      if(request.method==='GET'&&singleMessage){const [,serverId,channelId,messageId]=singleMessage,server=serverFor(actor,serverId);requirePermission(server,actor,'VIEW_CHANNEL',channelId);const message=(server.messages[channelId]||[]).find(message=>message.id===messageId&&!message.once);requireValue(message,'Mensagem indisponível.',404);requireValue(knownMessage(server,actor,message),'Seu cargo não permite consultar esta mensagem.',403);json(response,200,copy(message));return}
      const insights=/^\/servers\/([\w:-]{1,100})\/insights$/.exec(url.pathname)
      if(request.method==='GET'&&insights){const server=serverFor(actor,insights[1]);requirePermission(server,actor,'VIEW_GUILD_INSIGHTS');let result;try{result=buildCommunityInsights(server,actor,Number(url.searchParams.get('days')||7),url.searchParams.get('timeZone')||'UTC')}catch(error){throw new CommunityError(400,error.message)}json(response,200,result);return}
      const pins=/^\/servers\/([\w:-]{1,100})\/pins\/([\w:-]{1,100})$/.exec(url.pathname)
      if(request.method==='GET'&&pins){
        const [,serverId,channelId]=pins,server=serverFor(actor,serverId)
        requireValue(server.channels.some(channel=>channel.id===channelId&&channel.type==='text'),'Canal não encontrado.',404)
        requirePermission(server,actor,'VIEW_CHANNEL',channelId);requirePermission(server,actor,'READ_MESSAGE_HISTORY',channelId)
        json(response,200,{serverId,channelId,revision:server.revision,messages:copy((server.messages[channelId]||[]).filter(message=>message.pinnedAt&&!message.once).sort((a,b)=>b.pinnedAt-a.pinnedAt).slice(0,MAX_PINS))});return
      }
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
        const seenLive=new Map(),context={serverId:id,actor,seenLive};liveContexts.add(context)
        const send=change=>{
          const server=state.servers[id]
          if(!server.policy.members.includes(actor)||own(server.bans||{},actor)){liveContexts.delete(context);if(!response.destroyed&&!response.writableEnded)response.end('event: access-revoked\ndata: '+JSON.stringify(revokedSnapshot(actor,id))+'\n\n');return}
          if(response.writableLength>32*1024*1024){response.destroy();return}
          if(response.destroyed||response.writableEnded)return
          for(const channel of seenLive.keys())if(!can(server.policy,actor,'VIEW_CHANNEL',channel)||can(server.policy,actor,'READ_MESSAGE_HISTORY',channel))seenLive.delete(channel)
          const live=change?.message&&can(server.policy,actor,'VIEW_CHANNEL',change.message.channelId)?{liveMessages:[change.message]}:{}
          if(live.liveMessages&&!can(server.policy,actor,'READ_MESSAGE_HISTORY',change.message.channelId)){
            const channel=change.message.channelId,ids=seenLive.get(channel)||new Set();ids.add(change.message.id);if(ids.size>2000)ids.delete(ids.values().next().value);seenLive.set(channel,ids)
          }
          const delta=change?.messageChange
          const update=delta&&can(server.policy,actor,'VIEW_CHANNEL',delta.channelId)&&(can(server.policy,actor,'READ_MESSAGE_HISTORY',delta.channelId)||seenLive.get(delta.channelId)?.has(delta.id))?{messageChanges:[delta]}:{}
          response.write('event: snapshot\ndata: '+JSON.stringify({...snapshot(actor,id),...live,...update})+'\n\n')
        }
        const pulse = setInterval(() => { if (!response.destroyed) response.write(': keepalive\n\n') }, 15000)
        changes.on(id, send); send()
        response.once('close', () => {liveContexts.delete(context);subscriptions.set(subscription,Math.max(0,(subscriptions.get(subscription)||1)-1));streams.set(actor,Math.max(0,(streams.get(actor)||1)-1));clearInterval(pulse); changes.removeListener(id, send) }); return
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
  const server=http.createServer({ requestTimeout: 120000, headersTimeout: 10000, maxHeaderSize: 8192 }, handler)
  voice?.attach?.(server,(actor,id)=>{const current=serverFor(actor,id);return {policy:current.policy,channels:current.channels,nicknames:current.nicknames||{},expressions:current.expressions||{}}})
  scheduleTimeouts()
  for(const id of Object.keys(state.servers))indexPolls(id)
  server.once('close',()=>{closed=true;clearTimeout(timeoutWake);clearTimeout(pollWake);for(const timer of voiceRetries.values())clearTimeout(timer);voiceRetries.clear();for(const run of activeAi.values())run.controller.abort()})
  return { server, snapshot, commit }
}
