import {randomUUID,randomBytes,createHash,timingSafeEqual} from 'node:crypto'
import {can} from '../../src/roles/permissions.ts'
import {slowmodeDeadline} from '../../src/roles/chat.ts'

export class WebhookError extends Error{constructor(status,message){super(message);this.status=status}}
const requireValue=(condition,message,status=400)=>{if(!condition)throw new WebhookError(status,message)}
const digest=value=>createHash('sha256').update(value).digest('hex')
const identifier=value=>typeof value==='string'&&/^[\w:-]{1,100}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value)
export const publicWebhook=({id,channelId,name,creator,createdAt,updatedAt})=>({id,channelId,name,creator,createdAt,updatedAt})
export function visibleWebhooks(server,actor){return Object.values(server.webhooks||{}).filter(hook=>can(server.policy,actor,'VIEW_CHANNEL',hook.channelId)&&can(server.policy,actor,'MANAGE_WEBHOOKS',hook.channelId)).map(publicWebhook)}
const normalizedName=value=>{requireValue(typeof value==='string','Nome da integração inválido.');const name=value.trim().normalize('NFC');requireValue(name.length>0&&name.length<=80&&!/[\p{Cc}\p{Cf}]/u.test(name),'Use um nome de integração entre 1 e 80 caracteres.');return name}
export function manageWebhook(server,actor,action){
 requireValue(action&&typeof action==='object'&&!Array.isArray(action),'Operação de webhook inválida.')
 server.webhooks||={};const existing=identifier(action.id)&&Object.hasOwn(server.webhooks,action.id)?server.webhooks[action.id]:null,channel=action.type==='create'?action.channelId:existing?.channelId
 requireValue(server.channels.some(item=>item.id===channel&&item.type==='text'&&!item.parentId),'Canal de texto principal não encontrado.',404)
 requireValue(can(server.policy,actor,'VIEW_CHANNEL',channel)&&can(server.policy,actor,'MANAGE_WEBHOOKS',channel),'Você não pode gerenciar webhooks neste canal.',403)
 let hook=existing,token
 if(action.type==='create'){
  requireValue(Object.keys(server.webhooks).length<50&&Object.values(server.webhooks).filter(item=>item.channelId===channel).length<10,'Limite de 10 webhooks por canal e 50 por servidor atingido.')
  hook={id:randomUUID(),channelId:channel,name:normalizedName(action.name),creator:actor,createdAt:Date.now(),updatedAt:Date.now(),receipts:[],sentAt:[]};server.webhooks[hook.id]=hook
 }else{requireValue(existing,'Webhook não encontrado.',404);requireValue(['edit','rotate','delete'].includes(action.type),'Operação de webhook inválida.');if(action.type==='edit')hook.name=normalizedName(action.name);hook.updatedAt=Math.max(Date.now(),hook.updatedAt+1)}
 if(action.type==='create'||action.type==='rotate'){token=randomBytes(32).toString('hex');hook.tokenHash=digest(token)}
 if(action.type==='delete')delete server.webhooks[hook.id]
 return {webhook:publicWebhook(hook),...(token?{token}:{})}
}
export function authorizeWebhook(server,id,token){
 const hook=identifier(id)&&Object.hasOwn(server.webhooks||{},id)?server.webhooks[id]:null
 requireValue(hook&&typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)&&timingSafeEqual(Buffer.from(hook.tokenHash,'hex'),Buffer.from(digest(token),'hex')),'Credencial de webhook inválida.',401)
 requireValue(server.policy.members.includes(hook.creator)&&!Object.hasOwn(server.bans||{},hook.creator)&&can(server.policy,hook.creator,'VIEW_CHANNEL',hook.channelId)&&can(server.policy,hook.creator,'SEND_MESSAGES',hook.channelId),'A autorização de envio desta integração foi removida.',403)
 return hook
}
export function publishWebhook(server,id,token,body){
 const hook=authorizeWebhook(server,id,token)
 const channel=server.channels.find(channel=>channel.id===hook.channelId&&channel.type==='text'&&!channel.parentId)
 requireValue(channel,'Canal da integração indisponível.',404)
 requireValue(body&&typeof body==='object'&&!Array.isArray(body)&&typeof body.content==='string'&&body.content.trim().length>0&&body.content.length<=2000&&identifier(body.nonce),'Informe texto de até 2000 caracteres e uma identificação nonce única.')
 requireValue(!['attachment','tts','poll','voice','once','userId','userName','username','mentionsEveryone','roleMentions'].some(key=>Object.hasOwn(body,key)),'Webhooks enviam apenas texto e não podem representar usuários, mencionar cargos ou enviar anexos.')
 const content=body.content.trim(),hash=digest(content),now=Date.now(),receipts=(hook.receipts||[]).filter(item=>now-item.timestamp<300000),existing=receipts.find(item=>item.nonce===body.nonce)
 if(existing){requireValue(existing.hash===hash,'Este nonce já foi usado com outro texto.',409);const message=(server.messages[hook.channelId]||[]).find(item=>item.id===existing.messageId);requireValue(message,'A mensagem desta tentativa já foi removida.',410);return {message,duplicate:true}}
 const sent=(hook.sentAt||[]).filter(timestamp=>now-timestamp<5000)
 requireValue(sent.length<5,'Limite de cinco mensagens da integração a cada cinco segundos.',429)
 const deadline=can(server.policy,hook.creator,'BYPASS_SLOWMODE',channel.id)?0:slowmodeDeadline(channel.slowmodeSeconds,hook.lastSentAt||0)
 requireValue(deadline<=now,'Aguarde o modo lento do canal antes de enviar novamente.',429)
 const message={id:randomUUID(),channelId:channel.id,userId:'webhook:'+hook.id,userName:hook.name,webhook:{id:hook.id,name:hook.name},content,timestamp:now,preview:false,roleMentions:[]}
 server.messages[channel.id]=[...(server.messages[channel.id]||[]),message];hook.lastSentAt=now;hook.sentAt=[...sent,now];hook.receipts=[...receipts,{nonce:body.nonce,hash,messageId:message.id,timestamp:now}].slice(-100)
 return {message,duplicate:false}
}
