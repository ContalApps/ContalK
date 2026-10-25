interface SpeakingState {
  connectionStatus:string
  isMicMuted:boolean
  isDeafened:boolean
  isServerMuted?:boolean
  isServerDeafened?:boolean
  participants:Array<{isLocal:boolean;isSpeaking:boolean;isAudioEnabled:boolean}>
}
interface VoiceStore {
  getState:()=>SpeakingState
  subscribe:(listener:(state:SpeakingState)=>void)=>()=>void
}
// Subscribe outside React: tray state must keep updating when the UI is hidden.
export function setupTraySpeaking(store:VoiceStore,send:(speaking:boolean)=>void) {
  let previous:boolean|undefined
  const sync=(state:SpeakingState)=>{
    const speaking=state.connectionStatus==='connected'&&!state.isMicMuted&&!state.isDeafened&&!state.isServerMuted&&!state.isServerDeafened&&state.participants.some(p=>p.isLocal&&p.isAudioEnabled)
    if(speaking!==previous){previous=speaking;send(speaking)}
  }
  sync(store.getState())
  const unsubscribe=store.subscribe(sync)
  return ()=>{unsubscribe();send(false)}
}
