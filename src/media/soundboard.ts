export interface SoundboardPlay{id:string;actor:string;name:string;channelId:string;serverId:string;sourceServerId:string;soundId:string;storageId:string;durationMs:number;startedAt:number;expiresAt:number}
export function validSoundboardPlay(value:unknown):value is SoundboardPlay{
 if(!value||typeof value!=='object')return false
 const item=value as SoundboardPlay
 return ['id','actor','channelId','serverId','sourceServerId','soundId'].every(key=>typeof item[key as keyof SoundboardPlay]==='string'&&/^[\w:-]{1,100}$/.test(String(item[key as keyof SoundboardPlay])))&&typeof item.name==='string'&&item.name.length<=80&&typeof item.storageId==='string'&&/^[0-9a-f-]{36}$/i.test(item.storageId)&&Number.isInteger(item.durationMs)&&item.durationMs>=100&&item.durationMs<=5000&&Number.isFinite(item.startedAt)&&Number.isFinite(item.expiresAt)&&item.expiresAt>item.startedAt&&item.expiresAt-item.startedAt<=15000
}
export const soundboardGain=(volume:number,personal=100)=>Math.max(0,Math.min(1,volume/100*personal/100))
