import { can, type RolePolicy } from './permissions.ts'

export interface CommunityInvite {id?:string;code:string;channelId:string;createdBy:string;createdAt:number;expiresAt:number;maxUses:number;uses:number}
export interface InvitePreview {code:string;serverId:string;name:string;expiresAt:number;alreadyMember:boolean}
export const validInviteCode=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{48}$/.test(value)
export function activeInvite(invite:CommunityInvite,now=Date.now()):boolean{return (!invite.expiresAt||invite.expiresAt>now)&&(!invite.maxUses||invite.uses<invite.maxUses)}
export function canManageInvite(policy:RolePolicy,actor:string,invite:CommunityInvite):boolean{return policy.members.includes(actor)&&(invite.createdBy===actor||can(policy,actor,'MANAGE_GUILD')||can(policy,actor,'VIEW_CHANNEL',invite.channelId)&&can(policy,actor,'MANAGE_CHANNELS',invite.channelId))}
export function parseInvite(value:string,origin:string):string{
  const text=value.trim()
  if(validInviteCode(text))return text
  let url:URL
  try{url=new URL(text)}catch{throw new Error('Cole um código ou link de convite válido.')}
  if(url.origin!==new URL(origin).origin||url.username||url.password||url.search||url.hash)throw new Error('Use um convite da comunidade conectada. Nenhuma chave será enviada para outro endereço.')
  const match=/^\/invite\/([a-f0-9]{48})$/.exec(url.pathname)
  if(!match)throw new Error('Cole um código ou link de convite válido.')
  return match[1]
}
