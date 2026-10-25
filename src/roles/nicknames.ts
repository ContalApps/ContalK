import { can, canActOnMember, type RolePolicy } from './permissions.ts'

export function canSetNickname(policy:RolePolicy,actor:string,member:string):boolean{
  return policy.members.includes(actor)&&policy.members.includes(member)&&(actor===member?can(policy,actor,'CHANGE_NICKNAME'):canActOnMember(policy,actor,member,'MANAGE_NICKNAMES'))
}
export function normalizeNickname(value:unknown):string|null{
  if(value===null)return null
  if(typeof value!=='string'||value.length>128)throw new Error('Use um apelido de até 32 caracteres.')
  const normalized=value.trim().normalize('NFC')
  if([...normalized].length>32||/[\p{Cc}\p{Zl}\p{Zp}\u200B\u200E\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u.test(normalized))throw new Error('Use até 32 caracteres, sem controles ou quebras de linha.')
  return normalized||null
}
export function memberDisplayName(snapshot:{id:string;policy:Pick<RolePolicy,'members'>;nicknames?:Record<string,string>}|null|undefined,serverId:string|undefined,member:string|undefined,fallback:string):string{
  return snapshot&&serverId===snapshot.id&&member&&snapshot.policy.members.includes(member)&&Object.prototype.hasOwnProperty.call(snapshot.nicknames||{},member)?snapshot.nicknames![member]:fallback
}
