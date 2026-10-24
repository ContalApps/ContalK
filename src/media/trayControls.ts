type TrayState={connectionStatus:string;isMicMuted:boolean;isDeafened:boolean;toggleMic:()=>Promise<unknown>;toggleDeafen:()=>Promise<unknown>}
export function setupTrayControls(store:{getState:()=>TrayState;subscribe:(listener:(state:TrayState)=>void)=>()=>void},bridge:{setTrayState:(state:{connected:boolean;micMuted:boolean;deafened:boolean})=>void;onTrayAction:(listener:(action:string)=>void)=>()=>void},onError:(error:unknown)=>void) {
  let previous='',pending=false
  const sync=(state:TrayState)=>{
    const value={connected:state.connectionStatus==='connected',micMuted:state.isMicMuted,deafened:state.isDeafened}
    const encoded=JSON.stringify(value)
    if(encoded!==previous){previous=encoded;bridge.setTrayState(value)}
  }
  sync(store.getState())
  const unsubscribe=store.subscribe(sync)
  const stop=bridge.onTrayAction(action=>{
    if(pending||store.getState().connectionStatus!=='connected'||!['toggle-microphone','toggle-output'].includes(action))return
    pending=true
    void (async()=>{try{if(action==='toggle-microphone')await store.getState().toggleMic();else await store.getState().toggleDeafen()}catch(error){onError(error)}finally{pending=false;sync(store.getState())}})()
  })
  return()=>{unsubscribe();stop();bridge.setTrayState({connected:false,micMuted:true,deafened:false})}
}
