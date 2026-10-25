import { useVoiceStore } from '../store/useVoiceStore'
import { usePreferencesStore } from '../store/usePreferencesStore'

// Runs outside React so hiding the window does not stop the global key.
export function setupVoiceInput(){
  const bridge=window.contalkDesktop
  let activeRoom:ReturnType<typeof useVoiceStore.getState>['currentRoom']=null,activeKey:string|null=null,id:string|null=null,stopped=false
  let clearLocal:(()=>void)|undefined
  const press=(pressed:boolean)=>{void useVoiceStore.getState().pushToTalk(pressed)}
  const localFallback=()=>{
    if(clearLocal||!activeKey)return
    let held=false,armed=true,timer:ReturnType<typeof setInterval>|undefined
    const release=()=>{held=false;clearInterval(timer);press(false)}
    const down=(event:KeyboardEvent)=>{if(event.code!==activeKey||event.repeat||!armed||held)return;event.preventDefault();held=true;press(true);timer=setInterval(()=>{if(held)press(true)},400)}
    const up=(event:KeyboardEvent)=>{if(event.code===activeKey){armed=true;release()}}
    const blur=()=>{armed=false;release()}
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur)
    clearLocal=()=>{release();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur)}
  }
  const reset=()=>{
    id=null;clearLocal?.();clearLocal=undefined
    const room=activeRoom;activeRoom=null;activeKey=null
    if(room)void room.setPushToTalk(false).catch(()=>{})
    void bridge?.configureVoiceInput?.(null).catch(()=>{})
  }
  const keyEvents=bridge?.onVoiceInputKey?.(value=>{
    if(!id||value.id!==id||!activeRoom)return
    if(value.error){id=null;useVoiceStore.setState({voiceInputError:value.error,voiceInputState:'focused'});localFallback()}
    press(value.pressed&&!value.error)
  })
  const sync=()=>{
    if(stopped)return
    const preferences=usePreferencesStore.getState(),state=useVoiceStore.getState()
    if(state.prioritySpeaker!==preferences.prioritySpeaker){void state.selectInputPriority(preferences.prioritySpeaker).catch(()=>{});return}
    if(state.inputMode!==preferences.voiceInputMode){void state.selectInputMode(preferences.voiceInputMode).catch(()=>{});return}
    const room=state.connectionStatus==='connected'&&state.currentRoom?.inputMode==='push-to-talk'&&!state.isMicMuted&&!state.isDeafened&&!state.isServerMuted&&!state.isServerDeafened?state.currentRoom:null
    const key=room?preferences.pushToTalkKey:null
    if(room===activeRoom&&key===activeKey)return
    reset();activeRoom=room;activeKey=key
    if(!room||!key){useVoiceStore.setState({voiceInputState:'idle'});return}
    const version=crypto.randomUUID();id=version
    useVoiceStore.setState({voiceInputState:'starting'})
    if(bridge?.configureVoiceInput){
      void bridge.configureVoiceInput({key,id:version}).then(()=>{if(id===version)useVoiceStore.setState({voiceInputError:null,voiceInputState:'global'})}).catch(error=>{if(id!==version)return;id=null;useVoiceStore.setState({voiceInputState:'focused',voiceInputError:error instanceof Error?error.message:'Atalho global indisponível; use a janela ativa.'});localFallback()})
    }else{
      useVoiceStore.setState({voiceInputState:'focused',voiceInputError:'Atalho disponível enquanto a janela estiver ativa. O atalho global exige o aplicativo Windows atualizado.'});localFallback()
    }
  }
  const voice=useVoiceStore.subscribe(sync),preferences=usePreferencesStore.subscribe(sync)
  sync()
  return()=>{stopped=true;voice();preferences();keyEvents?.();reset()}
}
