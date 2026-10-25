import { can, type RolePolicy, type PermissionName } from './permissions.ts'

export type VoiceModerationPermission=Extract<PermissionName,'MUTE_MEMBERS'|'DEAFEN_MEMBERS'|'MOVE_MEMBERS'>
// Unlike kick/ban, voice moderation is authorized in the channel, not by role
// position. It never changes ownership or assigned roles.
export function canModerateVoice(policy:RolePolicy,actor:string,member:string,permission:VoiceModerationPermission,channelId:string):boolean{
  return policy.members.includes(actor)&&policy.members.includes(member)&&can(policy,actor,'VIEW_CHANNEL',channelId)&&can(policy,actor,permission,channelId)
}
