import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './fonts.css'
import './compact.css'
import './title-bar.css'
import './experience.css'
import { useVoiceStore } from './store/useVoiceStore'
import { setupTraySpeaking } from './media/traySpeaking'
import { setupSpeechPlayback } from './store/useSpeechStore'
import { setupVoiceInput } from './media/push-to-talk'
import { setupTrayControls } from './media/trayControls'
import { setupActivityNotifications } from './notifications/activity'
import { setupCentralCommunity } from './roles/runtime'
import './roles.css'

const stopTraySpeaking=setupTraySpeaking(useVoiceStore,speaking=>window.contalkDesktop?.setSpeaking(speaking))
const stopNotifications=setupActivityNotifications()
const stopCommunity=setupCentralCommunity()
const stopVoiceInput=setupVoiceInput()
const stopSpeechPlayback=setupSpeechPlayback()
if(import.meta.hot)import.meta.hot.dispose(stopSpeechPlayback)
if(import.meta.hot)import.meta.hot.dispose(stopVoiceInput)
if(import.meta.hot)import.meta.hot.dispose(stopCommunity)
if(import.meta.hot)import.meta.hot.dispose(stopNotifications)
if(import.meta.hot)import.meta.hot.dispose(stopTraySpeaking)
const trayBridge=window.contalkDesktop
if(trayBridge){
  const stop=setupTrayControls(useVoiceStore,trayBridge,error=>{useVoiceStore.setState({microphoneError:error instanceof Error?error.message:'Falha ao alterar o áudio pela bandeja.'})})
  if(import.meta.hot)import.meta.hot.dispose(stop)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
