import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './fonts.css'
import './compact.css'
import { useVoiceStore } from './store/useVoiceStore'
import { setupTraySpeaking } from './media/traySpeaking'

const stopTraySpeaking=setupTraySpeaking(useVoiceStore,speaking=>window.contalkDesktop?.setSpeaking(speaking))
if(import.meta.hot)import.meta.hot.dispose(stopTraySpeaking)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
