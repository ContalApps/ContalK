import {can,type RolePolicy,type PermissionName} from './permissions.ts'

export interface StagePolicy{speakerSessions:Record<string,string>;requests:Record<string,{sessionId:string;requestedAt:number}>;invitations:Record<string,{sessionId:string;invitedBy:string;expiresAt:number}>}
export interface StageView{channelId:string;audience:boolean;canRequest:boolean;canModerate:boolean;speakers:string[];requests:Array<{member:string;requestedAt:number}>;invitation?:{invitedBy:string;expiresAt:number};serverNow:number}
export const canModerateStage=(policy:RolePolicy,actor:string,channel:string)=>['VIEW_CHANNEL','CONNECT','MANAGE_CHANNELS','MUTE_MEMBERS','MOVE_MEMBERS'].every(permission=>can(policy,actor,permission as PermissionName,channel))
export const canJoinStage=(policy:RolePolicy,actor:string,channel:string)=>can(policy,actor,'VIEW_CHANNEL',channel)&&can(policy,actor,'CONNECT',channel)&&can(policy,actor,'SPEAK',channel)&&!policy.voiceRestrictions?.[actor]?.muted&&!policy.voiceRestrictions?.[actor]?.deafened
export const isStageSpeaker=(policy:RolePolicy,actor:string,channel:string,sessionId?:string)=>!policy.stages?.[channel]||!!sessionId&&policy.stages[channel].speakerSessions[actor]===sessionId
export function stageView(policy:RolePolicy,actor:string,channel:string,sessionFor:(member:string)=>string|null,now=Date.now()):StageView|null{
 const stage=policy.stages?.[channel];if(!stage||!can(policy,actor,'VIEW_CHANNEL',channel))return null
 const session=sessionFor(actor),moderator=canModerateStage(policy,actor,channel),speakers=Object.entries(stage.speakerSessions).filter(([member,id])=>policy.members.includes(member)&&sessionFor(member)===id).map(([member])=>member),invitation=stage.invitations[actor]
 return {channelId:channel,audience:!session||!speakers.includes(actor),canRequest:!!session&&canJoinStage(policy,actor,channel)&&can(policy,actor,'REQUEST_TO_SPEAK',channel),canModerate:moderator,speakers,requests:Object.entries(stage.requests).filter(([member,value])=>(moderator||member===actor)&&policy.members.includes(member)&&sessionFor(member)===value.sessionId).map(([member,value])=>({member,requestedAt:value.requestedAt})).sort((a,b)=>a.requestedAt-b.requestedAt||a.member.localeCompare(b.member)),...(invitation&&session&&invitation.sessionId===session&&invitation.expiresAt>now?{invitation:{invitedBy:invitation.invitedBy,expiresAt:invitation.expiresAt}}:{}),serverNow:now}
}
export function pruneStage(stage:StagePolicy,sessionFor:(member:string)=>string|null,now=Date.now()){
 for(const [member,id]of Object.entries(stage.speakerSessions))if(sessionFor(member)!==id)delete stage.speakerSessions[member]
 for(const [member,value]of Object.entries(stage.requests))if(sessionFor(member)!==value.sessionId)delete stage.requests[member]
 for(const [member,value]of Object.entries(stage.invitations))if(sessionFor(member)!==value.sessionId||value.expiresAt<=now)delete stage.invitations[member]
}
