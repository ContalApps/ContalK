import {useVoiceStore} from '../store/useVoiceStore'
import type {CommunityAction} from './types'

export async function stageCommand(action:Extract<CommunityAction,{type:'stage-request'|'stage-invite'|'stage-decline'|'stage-audience'|'stage-accept'|'stage-join'}>){
 const state=useVoiceStore.getState(),room=state.currentRoom,serverId=room?.serverId,owner=room?.localParticipant.identity,bridge=window.contalkDesktop
 const valid=()=>{const current=useVoiceStore.getState();return current.currentRoom===room&&current.connectionStatus==='connected'&&current.activeChannelId===action.channelId&&current.currentRoom?.localParticipant.identity===owner}
 if(!serverId||!valid()||!bridge?.communitySnapshot||!bridge.communityCommand)throw new Error('Entre no palco e atualize o aplicativo antes de usar estes controles.')
 const snapshot=await bridge.communitySnapshot(serverId)
 if(!valid()||snapshot.actor!==owner)throw new Error('A chamada ou a conta foi alterada.')
 await bridge.communityCommand(serverId,snapshot.revision,action)
}
