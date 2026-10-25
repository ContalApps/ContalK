import { can, type RolePolicy } from './permissions.ts'

export type EventStatus='scheduled'|'active'|'completed'|'cancelled'
export interface EventDraft {name:string;description:string;channelId:string|null;location:string;startsAt:number;endsAt:number|null}
export interface CommunityEventRecord extends EventDraft {id:string;creator:string;status:EventStatus;interested:string[];createdAt:number;updatedAt:number}
export interface ScheduledEvent extends Omit<CommunityEventRecord,'interested'> {interested:boolean;interestedCount:number}
export function eventStatus(event:Pick<CommunityEventRecord,'status'|'channelId'|'startsAt'|'endsAt'>,now=Date.now()):EventStatus{
  if(event.status==='completed'||event.status==='cancelled')return event.status
  if(!event.channelId){if(event.endsAt!==null&&event.endsAt<=now)return 'completed';if(event.startsAt<=now)return 'active'}
  else {if(event.status==='scheduled'&&event.startsAt+3600000<=now)return 'cancelled';if(event.status==='active'&&event.endsAt!==null&&event.endsAt<=now)return 'completed'}
  return event.status
}
export function eventDeadline(event:CommunityEventRecord,now=Date.now()):number{
  const status=eventStatus(event,now)
  if(status==='completed'||status==='cancelled')return 0
  if(status==='active')return event.endsAt||0
  return event.channelId?event.startsAt+3600000:event.startsAt
}
export function canViewEvent(policy:RolePolicy,actor:string,event:Pick<EventDraft,'channelId'>):boolean{
  return policy.members.includes(actor)&&(!event.channelId||can(policy,actor,'VIEW_CHANNEL',event.channelId))
}
export function canCreateEvent(policy:RolePolicy,actor:string,channelId:string|null):boolean{
  return can(policy,actor,'CREATE_EVENTS',channelId||undefined)&&(!channelId||can(policy,actor,'VIEW_CHANNEL',channelId)&&can(policy,actor,'CONNECT',channelId))
}
export function canManageEvent(policy:RolePolicy,actor:string,event:Pick<CommunityEventRecord,'creator'|'channelId'>):boolean{
  return canViewEvent(policy,actor,event)&&(!event.channelId||can(policy,actor,'CONNECT',event.channelId))&&(can(policy,actor,'MANAGE_EVENTS',event.channelId||undefined)||event.creator===actor&&can(policy,actor,'CREATE_EVENTS',event.channelId||undefined))
}
export function normalizeEventDraft(value:unknown,now=Date.now(),active=false):EventDraft{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Dados do evento inválidos.')
  const draft=value as Record<string,unknown>
  if(!Object.keys(draft).every(key=>['name','description','channelId','location','startsAt','endsAt'].includes(key)))throw new Error('O evento contém campos inválidos.')
  const clean=(value:unknown,max:number,required=false)=>{if(typeof value!=='string'||value.trim().length>max||required&&!value.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw new Error('Nome, descrição ou local inválido.');return value.trim().normalize('NFC')}
  const name=clean(draft.name,100,true),description=clean(draft.description,1000),location=clean(draft.location,100,!draft.channelId)
  if(/[\p{Cc}\p{Zl}\p{Zp}]/u.test(name))throw new Error('Use um nome sem quebras de linha.')
  if(draft.channelId!==null&&(typeof draft.channelId!=='string'||!draft.channelId))throw new Error('Canal do evento inválido.')
  const startsAt=draft.startsAt,endsAt=draft.endsAt
  if(typeof startsAt!=='number'||!Number.isSafeInteger(startsAt)||startsAt<=0||startsAt>now+366*86400000||!active&&startsAt<=now)throw new Error('Agende o início no futuro, em até um ano.')
  if(endsAt!==null&&(typeof endsAt!=='number'||!Number.isSafeInteger(endsAt)||endsAt<=startsAt||endsAt<=now||endsAt>now+367*86400000)||!draft.channelId&&endsAt===null)throw new Error('O término deve ser posterior ao início; eventos em outro local precisam de término.')
  if(draft.channelId&&location)throw new Error('Eventos de voz usam o próprio canal como local.')
  return {name,description,location,channelId:draft.channelId as string|null,startsAt,endsAt:endsAt as number|null}
}
export const eventStatusLabels:Record<EventStatus,string>={scheduled:'Agendado',active:'Em andamento',completed:'Concluído',cancelled:'Cancelado'}
