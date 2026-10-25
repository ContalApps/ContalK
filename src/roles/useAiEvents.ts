import {useEffect,useState} from 'react'

export function useAiEvents(serverId:string,channelId:string,enabled:boolean){
  const [partials,setPartials]=useState<Record<string,string>>({})
  const [streamError,setStreamError]=useState('')
  useEffect(()=>{
    setPartials({});setStreamError('')
    const bridge=window.contalkDesktop
    if(!enabled||!bridge?.communityAiSubscribe||!channelId)return
    const unsubscribe=bridge.onCommunityAiEvent(event=>{
      if(event.serverId!==serverId||event.channelId!==channelId)return
      if(event.type==='error'){setStreamError(event.error||'Fluxo de IA indisponível.');return}
      if(!event.runId)return
      if(event.type==='current')setPartials(current=>({...current,[event.runId!]:event.partial||''}))
      else if(event.type==='delta')setPartials(current=>({...current,[event.runId!]:String(current[event.runId!]||'')+(event.delta||'')}))
      else if(event.type==='done')setPartials(current=>({...current,[event.runId!]:event.content||''}))
      else if(event.type==='started')setPartials(current=>({...current,[event.runId!]:''}))
    })
    void bridge.communityAiSubscribe(serverId,channelId).catch(error=>setStreamError(error.message))
    return()=>{unsubscribe();void bridge.communityAiUnsubscribe()}
  },[serverId,channelId,enabled])
  return {partials,streamError}
}
