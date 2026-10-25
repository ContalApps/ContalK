import {useState} from 'react'
import { usePreferencesStore } from '../store/usePreferencesStore'
import { useVoiceStore } from '../store/useVoiceStore'
import { pushToTalkKeys, type VoiceInputMode } from '../media/voice-input'

export function VoiceInputSettings(){
  const [error,setError]=useState('')
  const preferences=usePreferencesStore(),voice=useVoiceStore(),forced=voice.currentRoom?.localParticipant.canUseVoiceActivity===false
  const update=(patch:Partial<{voiceInputMode:VoiceInputMode;pushToTalkKey:string;prioritySpeaker:boolean}>)=>{try{preferences.update(patch);setError('')}catch(error){setError(error instanceof Error?error.message:'Não foi possível salvar a configuração.')}}
  return <section className="ct-voice-input-settings" aria-label="Modo de entrada de voz"><h3>Modo de entrada</h3>
    <label>Transmissão<select aria-label="Modo de entrada de voz" value={preferences.voiceInputMode} onChange={event=>update({voiceInputMode:event.target.value as VoiceInputMode})}><option value="voice-activity">Atividade de voz</option><option value="push-to-talk">Pressionar para falar</option></select></label>
    {forced&&<p role="status">Seu cargo exige Pressionar para falar nesta sala. Sua preferência para outras salas foi mantida.</p>}
    {(forced||preferences.voiceInputMode==='push-to-talk')&&<><label>Tecla de transmissão<select aria-label="Tecla para falar" value={preferences.pushToTalkKey} onChange={event=>update({pushToTalkKey:event.target.value})}>{Object.entries(pushToTalkKeys).map(([key,value])=><option value={key} key={key}>{value.label}</option>)}</select></label><label className="ct-voice-priority-check"><span><input type="checkbox" aria-label="Usar prioridade de fala" checked={preferences.prioritySpeaker} onChange={event=>update({prioritySpeaker:event.target.checked})}/>Prioridade de fala</span><small>Diminui as outras vozes enquanto você mantém a tecla pressionada, quando seu cargo permitir.</small></label>{voice.currentRoom?.localParticipant.canPrioritySpeaker===false&&preferences.prioritySpeaker&&<p role="status">Seu cargo não permite prioridade nesta sala; o atalho continua como Pressionar para falar normal.</p>}<p>Mantenha a tecla pressionada para transmitir, inclusive com o app na bandeja no Windows. Escolha uma tecla livre nos outros aplicativos.</p></>}
    <p className="ct-muted">Alterar o modo silencia o microfone; reative-o no seu card quando estiver pronto.</p>
    {error&&<p role="alert">{error}</p>}
    {voice.voiceInputError&&<p role="alert">{voice.voiceInputError}</p>}
  </section>
}
