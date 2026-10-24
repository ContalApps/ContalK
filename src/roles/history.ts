import { Permission, readMask } from './permissions'
import type { CommunitySnapshot } from './types'
import type { Message } from '../store/useAppStore'

export function mergeHistory(previous:CommunitySnapshot|null,next:CommunitySnapshot,cache:Record<string,Message[]>){
  const result:Record<string,Message[]>={}
  for(const [channel,current]of Object.entries(next.messages)){
    if((readMask(next.channelPermissions[channel]||'0')&Permission.READ_MESSAGE_HISTORY)===0n)continue
    const before=previous?.id===next.id?previous.messages[channel]||[]:[]
    const boundary=current[0]?before.findIndex(message=>message.id===current[0].id):0
    const rows=new Map([...(cache[channel]||[]),...(boundary>0?before.slice(0,boundary):[])].map(message=>[message.id,message]))
    for(const message of current)rows.delete(message.id)
    for(const change of next.messageChanges||[])if(change.channelId===channel){if(change.deleted)rows.delete(change.id);else{const message=rows.get(change.id);if(message)rows.set(change.id,{...message,content:change.content??message.content,editedAt:change.editedAt,roleMentions:change.roleMentions??message.roleMentions,mentionsEveryone:change.mentionsEveryone===null?undefined:change.mentionsEveryone??message.mentionsEveryone})}}
    if(rows.size)result[channel]=[...rows.values()]
  }
  return result
}
