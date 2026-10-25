import { useRoleStore } from '../store/useRoleStore'
import { can, type PermissionName } from './permissions'
import type { CommunityAction } from './types'

export const centralEnabled=()=>{const state=useRoleStore.getState();return state.configured||state.status==='loading'}
export function centralAllows(permission:PermissionName,channelId?:string):boolean {
  const state=useRoleStore.getState()
  if(state.status==='loading'&&!state.snapshot)return false
  return !state.configured || !!state.snapshot&&can(state.snapshot.policy,state.snapshot.actor,permission,channelId)
}
export async function centralCommand(action:CommunityAction){await useRoleStore.getState().command(action)}
async function configurationMode():Promise<boolean>{
  const current=useRoleStore.getState()
  if(current.configured)return true
  if(current.status==='off')return false
  if(current.status==='error')throw new Error(current.error||'Não foi possível verificar a comunidade.')
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{stop();reject(new Error('A verificação da comunidade não respondeu.'))},10000)
    const stop=useRoleStore.subscribe(state=>{if(state.configured||state.status==='off'||state.status==='error'){clearTimeout(timer);stop();if(state.status==='error'&&!state.configured)reject(new Error(state.error||'Falha ao verificar a comunidade.'));else resolve(state.configured)}})
  })
}
export async function centralPresenceToken(name:string){
  if(!await configurationMode())return null
  if(!window.contalkDesktop?.communityPresenceToken)throw new Error('Atualize o aplicativo para conectar a presença da comunidade.')
  return window.contalkDesktop.communityPresenceToken(name)
}
export async function centralVoiceToken(channelId:string,serverId?:string){
  if(!await configurationMode())return null
  const state=useRoleStore.getState()
  const target=serverId||state.serverId
  if(!target||!window.contalkDesktop?.communityVoiceToken)throw new Error('Reconecte a comunidade para entrar na chamada.')
  return {...await window.contalkDesktop.communityVoiceToken(target,channelId),serverId:target}
}
export async function centralOccupants(){
  const state=useRoleStore.getState()
  if(!state.serverId||!window.contalkDesktop?.communityOccupants)throw new Error('A presença de voz está indisponível.')
  return window.contalkDesktop.communityOccupants(state.serverId)
}
