import { can, threadArchived, type RolePolicy, type ThreadInfo } from './permissions.ts'
export const threadDurations=[60,1440,4320,10080]
export function canEditThread(policy:RolePolicy,actor:string,id:string):boolean{
  const thread=policy.threads?.[id]
  return !!thread&&can(policy,actor,'VIEW_CHANNEL',id)&&(can(policy,actor,'MANAGE_THREADS',id)||thread.ownerId===actor&&!thread.locked)
}
export function canMutateThread(policy:RolePolicy,actor:string,id:string,operation:'send'|'edit'|'delete'|'react'|'pin'|'vote',now=Date.now()):boolean{
  const thread=policy.threads?.[id]
  if(!thread)return true
  if(!can(policy,actor,'VIEW_CHANNEL',id))return false
  const manage=can(policy,actor,'MANAGE_THREADS',id),archived=threadArchived(thread,now)
  if(operation==='send')return !thread.locked||manage
  if(operation==='delete')return !thread.locked||!archived||manage
  if(archived)return false
  return !thread.locked||manage||operation==='react'||operation==='vote'
}
export function validThreadPatch(patch:unknown):patch is Partial<Pick<ThreadInfo,'archived'|'locked'|'autoArchiveMinutes'|'invitable'>>&{name?:string}{
  if(!patch||typeof patch!=='object'||Array.isArray(patch)||!Object.keys(patch).length)return false
  const values=patch as Record<string,unknown>
  return Object.entries(values).every(([key,value])=>key==='name'?typeof value==='string'&&!!value.trim()&&value.trim().length<=60&&!/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value):key==='autoArchiveMinutes'?threadDurations.includes(value as number):['archived','locked','invitable'].includes(key)&&typeof value==='boolean')
}
