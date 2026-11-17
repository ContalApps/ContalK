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
import {setupSoundboardPlayback} from './store/useSoundboardStore'
import { setupSpeechPlayback } from './store/useSpeechStore'
import { setupVoiceInput } from './media/push-to-talk'
import { setupTrayControls } from './media/trayControls'
import { setupActivityNotifications } from './notifications/activity'
import { setupCentralCommunity } from './roles/runtime'
import { setupPresenceStatus } from './store/usePresenceStatus'
import { useCommunityStore, setPresenceStatusSource } from './store/useCommunityStore'
import { useAuthStore } from './store/useAuthStore'
import './roles.css'
import './codex.css'
import './shell.css'
import './screens.css'
import './panels.css'
import './settings.css'

const stopTraySpeaking=setupTraySpeaking(useVoiceStore,speaking=>window.contalkDesktop?.setSpeaking(speaking))
const stopNotifications=setupActivityNotifications()
const stopCommunity=setupCentralCommunity()
const stopPresenceStatus=setupPresenceStatus({setPresenceStatusSource,republish:()=>{const user=useAuthStore.getState().user;if(user)void useCommunityStore.getState().updateProfile(user).catch(()=>{})}})
if(import.meta.hot)import.meta.hot.dispose(stopPresenceStatus)
const stopVoiceInput=setupVoiceInput()
const stopSoundboardPlayback=setupSoundboardPlayback()
if(import.meta.hot)import.meta.hot.dispose(stopSoundboardPlayback)
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
