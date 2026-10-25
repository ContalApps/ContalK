import { can, type RolePolicy } from './permissions.ts'

export function canSetVoiceStatus(policy:RolePolicy,actor:string,channelId:string,connected:boolean):boolean{
  return can(policy,actor,'VIEW_CHANNEL',channelId)&&can(policy,actor,'SET_VOICE_CHANNEL_STATUS',channelId)&&(connected||can(policy,actor,'MANAGE_CHANNELS',channelId))
}
export function normalizeVoiceStatus(value:unknown):string|null{
  if(value===null)return null
  if(typeof value!=='string')throw new Error('O status deve ser um texto ou vazio.')
  const status=value.trim().normalize('NFC')
  if(status.length>500||/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value))throw new Error('Use até 500 caracteres, sem controles ou quebras de linha.')
  return status||null
}
