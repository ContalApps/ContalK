// Permission bits follow Discord's published catalogue. Decimal strings keep all
// bits intact in JSON; numeric bitwise operators would truncate at 32 bits.
export const permissionNames=[
  'CREATE_INSTANT_INVITE','KICK_MEMBERS','BAN_MEMBERS','ADMINISTRATOR','MANAGE_CHANNELS','MANAGE_GUILD','ADD_REACTIONS','VIEW_AUDIT_LOG','PRIORITY_SPEAKER','STREAM','VIEW_CHANNEL','SEND_MESSAGES','SEND_TTS_MESSAGES','MANAGE_MESSAGES','EMBED_LINKS','ATTACH_FILES','READ_MESSAGE_HISTORY','MENTION_EVERYONE','USE_EXTERNAL_EMOJIS','VIEW_GUILD_INSIGHTS','CONNECT','SPEAK','MUTE_MEMBERS','DEAFEN_MEMBERS','MOVE_MEMBERS','USE_VAD','CHANGE_NICKNAME','MANAGE_NICKNAMES','MANAGE_ROLES','MANAGE_WEBHOOKS','MANAGE_GUILD_EXPRESSIONS','USE_APPLICATION_COMMANDS','REQUEST_TO_SPEAK','MANAGE_EVENTS','MANAGE_THREADS','CREATE_PUBLIC_THREADS','CREATE_PRIVATE_THREADS','USE_EXTERNAL_STICKERS','SEND_MESSAGES_IN_THREADS','USE_EMBEDDED_ACTIVITIES','MODERATE_MEMBERS','VIEW_CREATOR_MONETIZATION_ANALYTICS','USE_SOUNDBOARD','CREATE_GUILD_EXPRESSIONS','CREATE_EVENTS','USE_EXTERNAL_SOUNDS','SEND_VOICE_MESSAGES',null,'SET_VOICE_CHANNEL_STATUS','SEND_POLLS','USE_EXTERNAL_APPS','PIN_MESSAGES','BYPASS_SLOWMODE',
] as const
export type PermissionName=Exclude<typeof permissionNames[number],null>
export const Permission=Object.fromEntries(permissionNames.flatMap((name,index)=>name?[[name,1n<<BigInt(index)]]:[])) as Record<PermissionName,bigint>
export const ALL_PERMISSIONS=Object.values(Permission).reduce((all,bit)=>all|bit,0n)
export function mask(names:readonly PermissionName[]):bigint{return names.reduce((value,name)=>value|Permission[name],0n)}
export function readMask(value:string):bigint{if(typeof value!=='string'||!/^\d{1,24}$/.test(value))throw new Error('Permissões inválidas.');const result=BigInt(value);if((result&~ALL_PERMISSIONS)!==0n)throw new Error('Permissões desconhecidas.');return result}
export interface Role {id:string;name:string;position:number;permissions:string;color:string|null;secondaryColor:string|null;style:'solid'|'gradient'|'holographic';icon:string|null;hoist:boolean;mentionable:boolean;managed:'none'|'bot'|'integration'|'linked'|'booster'|'subscription';requirements?:Array<{connection:string;field:string;operator:'equals'|'gte'|'exists';value:string|number|boolean}>}
export interface Overwrite {id:string;type:'role'|'member';allow:string;deny:string}
export interface RolePolicy {serverId:string;ownership:'all-members'|'owners';ownerIds:string[];members:string[];roles:Role[];memberRoles:Record<string,string[]>;overwrites:Record<string,Overwrite[]>;categories:Array<{id:string;name:string}>;channelCategories:Record<string,{categoryId:string;synced:boolean}>;timeouts:Record<string,number>}
export function everyoneRole(serverId:string):Role{return {id:serverId,name:'@everyone',position:0,permissions:mask(['VIEW_CHANNEL','READ_MESSAGE_HISTORY','SEND_MESSAGES','EMBED_LINKS','ATTACH_FILES','ADD_REACTIONS','CONNECT','SPEAK','STREAM','USE_VAD','CHANGE_NICKNAME']).toString(),color:null,secondaryColor:null,style:'solid',icon:null,hoist:false,mentionable:false,managed:'none'}}
export function initialPolicy(serverId:string,members:string[]=[]):RolePolicy{return {serverId,ownership:serverId==='srv-1'?'all-members':'owners',ownerIds:[],members:[...new Set(members)],roles:[everyoneRole(serverId)],memberRoles:{},overwrites:{},categories:[],channelCategories:{},timeouts:{}}}
export function isOwner(policy:RolePolicy,member:string):boolean{return policy.ownership==='all-members'?policy.members.includes(member):policy.ownerIds.includes(member)}
export function assignedRoles(policy:RolePolicy,member:string):Role[]{const ids=new Set([policy.serverId,...(Object.prototype.hasOwnProperty.call(policy.memberRoles,member)?policy.memberRoles[member]:[])]);return policy.roles.filter(role=>ids.has(role.id))}
export function highestPosition(policy:RolePolicy,member:string):number{return Math.max(0,...assignedRoles(policy,member).map(role=>role.position))}
export const CHANNEL_PERMISSIONS=mask(['CREATE_INSTANT_INVITE','MANAGE_CHANNELS','ADD_REACTIONS','PRIORITY_SPEAKER','STREAM','VIEW_CHANNEL','SEND_MESSAGES','SEND_TTS_MESSAGES','MANAGE_MESSAGES','EMBED_LINKS','ATTACH_FILES','READ_MESSAGE_HISTORY','MENTION_EVERYONE','USE_EXTERNAL_EMOJIS','CONNECT','SPEAK','MUTE_MEMBERS','DEAFEN_MEMBERS','MOVE_MEMBERS','USE_VAD','MANAGE_ROLES','MANAGE_WEBHOOKS','USE_APPLICATION_COMMANDS','REQUEST_TO_SPEAK','MANAGE_THREADS','CREATE_PUBLIC_THREADS','CREATE_PRIVATE_THREADS','USE_EXTERNAL_STICKERS','SEND_MESSAGES_IN_THREADS','USE_EMBEDDED_ACTIVITIES','USE_SOUNDBOARD','USE_EXTERNAL_SOUNDS','SEND_VOICE_MESSAGES','SET_VOICE_CHANNEL_STATUS','SEND_POLLS','USE_EXTERNAL_APPS','PIN_MESSAGES','BYPASS_SLOWMODE'])
const messageDependencies=mask(['SEND_TTS_MESSAGES','ATTACH_FILES','EMBED_LINKS','MENTION_EVERYONE','SEND_POLLS','SEND_VOICE_MESSAGES'])
const voiceDependencies=mask(['SPEAK','STREAM','USE_VAD','PRIORITY_SPEAKER','USE_SOUNDBOARD','USE_EXTERNAL_SOUNDS','REQUEST_TO_SPEAK'])
export function permissionsFor(policy:RolePolicy,member:string,channelId?:string,previewRoles?:readonly string[],now=Date.now()):bigint {
  if(previewRoles===undefined&&!policy.members.includes(member)&&!isOwner(policy,member))return 0n
  if(previewRoles===undefined&&isOwner(policy,member))return ALL_PERMISSIONS
  const roles=previewRoles===undefined?assignedRoles(policy,member):policy.roles.filter(role=>role.id===policy.serverId||previewRoles.includes(role.id))
  let result=roles.reduce((permissions,role)=>permissions|readMask(role.permissions),0n)
  if((result&Permission.ADMINISTRATOR)!==0n)return ALL_PERMISSIONS
  if(channelId){
    const category=policy.channelCategories[channelId]
    const key=category?.synced?category.categoryId:channelId
    const overwrites=Object.prototype.hasOwnProperty.call(policy.overwrites,key)?policy.overwrites[key]:[]
    const base=overwrites.find(overwrite=>overwrite.type==='role'&&overwrite.id===policy.serverId)
    if(base)result=(result&~readMask(base.deny))|readMask(base.allow)
    let deny=0n,allow=0n
    const ids=new Set(roles.filter(role=>role.id!==policy.serverId).map(role=>role.id))
    for(const overwrite of overwrites)if(overwrite.type==='role'&&ids.has(overwrite.id)){deny|=readMask(overwrite.deny);allow|=readMask(overwrite.allow)}
    result=(result&~deny)|allow
    const individual=previewRoles===undefined?overwrites.find(overwrite=>overwrite.type==='member'&&overwrite.id===member):undefined
    if(individual)result=(result&~readMask(individual.deny))|readMask(individual.allow)
    if((result&Permission.VIEW_CHANNEL)===0n)result&=~CHANNEL_PERMISSIONS
    if((result&Permission.SEND_MESSAGES)===0n)result&=~messageDependencies
    if((result&Permission.CONNECT)===0n)result&=~voiceDependencies
  }
  if(previewRoles===undefined&&(policy.timeouts[member]||0)>now)result&=Permission.VIEW_CHANNEL|Permission.READ_MESSAGE_HISTORY
  return result
}
export function can(policy:RolePolicy,member:string,permission:PermissionName,channelId?:string):boolean{return (permissionsFor(policy,member,channelId)&Permission[permission])!==0n}
export function canManageRole(policy:RolePolicy,actor:string,role:Role):boolean{return role.id!==policy.serverId&&role.managed==='none'&&(isOwner(policy,actor)||(can(policy,actor,'MANAGE_ROLES')&&highestPosition(policy,actor)>role.position))}
export function canGrant(policy:RolePolicy,actor:string,permissions:string):boolean{return (readMask(permissions)&~permissionsFor(policy,actor))===0n}
export function canActOnMember(policy:RolePolicy,actor:string,target:string,permission:PermissionName):boolean{return policy.members.includes(target)&&actor!==target&&!isOwner(policy,target)&&can(policy,actor,permission)&&(isOwner(policy,actor)||highestPosition(policy,actor)>highestPosition(policy,target))}
export function canRemoveRole(policy:RolePolicy,actor:string,target:string,role:Role):boolean{return policy.members.includes(target)&&canManageRole(policy,actor,role)&&(isOwner(policy,actor)||(!isOwner(policy,target)&&(actor===target||highestPosition(policy,actor)>highestPosition(policy,target))))}
export function canAssignRole(policy:RolePolicy,actor:string,target:string,role:Role):boolean{return canRemoveRole(policy,actor,target,role)&&canGrant(policy,actor,role.permissions)}
export function canMentionRole(policy:RolePolicy,actor:string,role:Role,channel:string):boolean{return can(policy,actor,'SEND_MESSAGES',channel)&&(role.mentionable||can(policy,actor,'MENTION_EVERYONE',channel))}
export function displayRole(policy:RolePolicy,member:string):Role|undefined{return assignedRoles(policy,member).filter(role=>role.color).sort((a,b)=>b.position-a.position)[0]}
export function displayIconRole(policy:RolePolicy,member:string):Role|undefined{return assignedRoles(policy,member).filter(role=>role.icon).sort((a,b)=>b.position-a.position)[0]}
