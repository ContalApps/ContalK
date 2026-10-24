import type { Channel, Message } from '../store/useAppStore'
import type { RoleCommand } from './commands'
import type { RolePolicy } from './permissions'

export interface CommunitySnapshot {
  id:string
  name:string
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
  messageChanges?:Array<{id:string;channelId:string;deleted:boolean;content?:string;editedAt?:number;roleMentions?:string[];mentionsEveryone?:'all'|'online'|null}>
  audit:Array<{id:string;actor:string;event:string;target?:string;targetName?:string;member?:string;timestamp:number}>
}
export type CommunityAction =
  | {type:'role';command:RoleCommand}
  | {type:'channel-create';id:string;name:string;channelType:'text'|'voice'}
  | {type:'channel-rename';id:string;name:string}
  | {type:'channel-delete';id:string}
  | {type:'message-send';id:string;channel:string;content:string;attachment?:import('../store/useAppStore').Attachment;preview?:boolean;once?:boolean}
  | {type:'message-edit';channel:string;id:string;content:string}
  | {type:'message-delete';channel:string;id:string}
export type CommunityEvent = {serverId:string;snapshot?:CommunitySnapshot;error?:string}
export interface CommunityHistory {serverId:string;channelId:string;revision:number;messages:Message[];hasMore:boolean}
