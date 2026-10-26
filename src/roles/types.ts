import type { Channel, Message } from '../store/useAppStore'
import type { RoleCommand } from './commands'
import type { RolePolicy } from './permissions'

export interface CommunitySnapshot {
  id:string
  name:string
  description?:string
  revision:number
  actor:string
  voiceSync?:'synced'|'pending'|'unconfigured'
  policy:RolePolicy
  channels:Channel[]
  serverPermissions:string
  channelPermissions:Record<string,string>
  messages:Record<string,Message[]>
  hasOlder?:Record<string,boolean>
  liveMessages?:Message[]
  messageChanges?:Array<{id:string;channelId:string;deleted:boolean;content?:string;editedAt?:number;roleMentions?:string[];mentionsEveryone?:'all'|'online'|null;reactions?:Message['reactions'];pinnedAt?:number|null;pinnedBy?:string|null;poll?:Message['poll'];ai?:Message['ai']}>
  serverNow?:number
  sendAfter?:Record<string,number>
  nicknames?:Record<string,string>
  bans?:Array<{username:string;actor:string;reason:string;timestamp:number;threadParent?:string;privateThread?:boolean}>
  expressionsRevision?:number
  webhooks?:import('./webhooks').CommunityWebhook[]
  events?:import('./events').ScheduledEvent[]
  invites?:import('./invites').CommunityInvite[]
  memberAdmissions?:Record<string,{joinedAt:number;method:'invite';invitedBy:string;channelId:string;inviteId?:string}>
  audit:Array<{id:string;actor:string;event:string;target?:string;targetName?:string;member?:string;reason?:string;timestamp:number}>
}
export type CommunityAction =
  | {type:'ai-channel-model';channelId:string;model:string|null}
  | {type:'project-create';id:string;parentId:string;name:string;model?:string}
  | {type:'project-member';id:string;member:string;access:import('./ai').ProjectAccess|null}
  | {type:'project-model';id:string;model:string|null}
  | {type:'project-rename';id:string;name:string}
  | {type:'project-delete';id:string}
  | {type:'project-restore';id:string}
  | {type:'channel-voice-mode';channelId:string;mode:'conversation'|'stage'}
  | {type:'stage-request';channelId:string;enabled:boolean}
  | {type:'stage-invite'|'stage-decline'|'stage-audience';channelId:string;member:string}
  | {type:'stage-accept'|'stage-join';channelId:string}
  | {type:'expression-create';id:string;kind:import('./expressions').ExpressionKind;name:string;durationMs?:number;attachment:import('../store/useAppStore').Attachment}
  | {type:'expression-edit';id:string;updatedAt:number;name:string}
  | {type:'expression-delete';id:string;updatedAt:number}
  | {type:'event-create';id:string;draft:import('./events').EventDraft}
  | {type:'event-edit';id:string;draft:import('./events').EventDraft}
  | {type:'event-status';id:string;status:import('./events').EventStatus}
  | {type:'event-interest';id:string;enabled:boolean}
  | {type:'event-delete';id:string}
  | {type:'voice-status';channelId:string;status:string|null}
  | {type:'server-edit';patch:{name?:string;description?:string}}
  | {type:'member-nickname';member:string;nickname:string|null}
  | {type:'role';command:RoleCommand}
  | {type:'member-kick'|'member-ban'|'member-unban';member:string;reason?:string}
  | {type:'invite-create';channelId:string;maxAge:number;maxUses:number}
  | {type:'invite-revoke';code:string}
  | {type:'voice-mute'|'voice-deafen';member:string;channelId:string;enabled:boolean;reason?:string}
  | {type:'voice-move';member:string;channelId:string;destinationId:string|null;reason?:string}
  | {type:'thread-create';id:string;parentId:string;name:string;private:boolean;autoArchiveMinutes:number;invitable:boolean;sourceMessageId?:string}
  | {type:'thread-edit';id:string;patch:{name?:string;archived?:boolean;locked?:boolean;invitable?:boolean;autoArchiveMinutes?:number}}
  | {type:'thread-member';id:string;member:string;enabled:boolean}
  | {type:'thread-delete';id:string}
  | {type:'channel-create';id:string;name:string;channelType:'text'|'voice'}
  | {type:'channel-rename';id:string;name:string}
  | {type:'channel-delete';id:string}
  | {type:'channel-slowmode';channel:string;seconds:number}
  | {type:'message-reaction';channel:string;id:string;emoji:string;enabled:boolean;member?:string}
  | {type:'message-reactions-clear';channel:string;id:string}
  | {type:'message-pin';channel:string;id:string;enabled:boolean}
  | {type:'poll-vote';channel:string;id:string;answers:string[]}
  | {type:'poll-close';channel:string;id:string}
  | {type:'message-send';id:string;channel:string;content:string;expression?:import('./expressions').ExpressionReference;voice?:{durationMs:number};tts?:boolean;poll?:import('./polls').PollDraft;attachment?:import('../store/useAppStore').Attachment;preview?:boolean;once?:boolean}
  | {type:'message-edit';channel:string;id:string;content:string}
  | {type:'message-delete';channel:string;id:string}
export type CommunityEvent = {serverId:string;snapshot?:CommunitySnapshot;error?:string;accessRevoked?:boolean}
export interface CommunityHistory {serverId:string;channelId:string;revision:number;messages:Message[];hasMore:boolean}
