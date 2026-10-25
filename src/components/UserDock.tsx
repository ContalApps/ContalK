import {SoundboardPanel} from './SoundboardPanel'
import { pushToTalkKeys } from '../media/voice-input'
import { usePreferencesStore } from '../store/usePreferencesStore'
import { useState } from 'react'
import { useVoiceStore } from '../store/useVoiceStore'
import { useAuthStore } from '../store/useAuthStore'
import { useCommunityStore } from '../store/useCommunityStore'
import { Avatar } from './Avatar'
import { ControlIcon } from './ControlIcon'
import { ScreenShareModal } from './ScreenShareModal'
export function UserDock({onProfile,onOpenChannel}:{onProfile:()=>void;onOpenChannel:(id:string)=>void}) {
  const inputKey=usePreferencesStore(state=>state.pushToTalkKey)
  const voice=useVoiceStore(),user=useAuthStore(s=>s.user)
  const online=useCommunityStore(s=>s.status==='online')
  const [sounds,setSounds]=useState(false)
  const [shareOpen,setShareOpen]=useState(false),[error,setError]=useState('')
  const micBlocked=voice.isServerMuted||voice.isServerDeafened,outputBlocked=voice.isServerDeafened
  const micLabel=micBlocked?'Microfone bloqueado pelo servidor':voice.isMicMuted?'Ativar microfone':'Silenciar microfone'
  const outputLabel=outputBlocked?'Áudio bloqueado pelo servidor':voice.isDeafened?'Ativar áudio':'Silenciar áudio'
  const connected=voice.connectionStatus==='connected'
  const run=async(action:()=>Promise<unknown>)=>{setError('');try{await action()}catch(e){setError(e instanceof Error?e.message:'Não foi possível realizar a ação.')}}
  return <section className="ct-user-dock" aria-label="Seu perfil e controles de voz">
    {sounds&&<SoundboardPanel onClose={()=>setSounds(false)}/>}
    {voice.activeChannelId&&<div className="ct-dock-voice"><div className="ct-dock-connection"><button className="ct-dock-status" onClick={()=>onOpenChannel(voice.activeChannelId!)}><ControlIcon name="signal"/><span><strong>{connected?'Voz conectada':voice.connectionStatus==='reconnecting'?'Reconectando…':voice.connectionStatus==='connecting'?'Conectando…':'Voz desconectada'}</strong><small>{voice.activeChannelName}</small></span></button><button className="ct-dock-icon ct-dock-disconnect" aria-label="Desconectar da chamada" title="Desconectar da chamada" onClick={()=>void run(voice.leaveChannel)}><ControlIcon name="disconnect"/></button></div><div className="ct-dock-call-actions"><button aria-label="Abrir painel de sons" title="Painel de sons" disabled={!connected} onClick={()=>setSounds(true)}><ControlIcon name="speaker"/><span>Sons</span></button><button aria-label={voice.isCameraOn?'Desligar câmera':'Ligar câmera'} title={voice.isCameraOn?'Desligar câmera':'Ligar câmera'} aria-pressed={voice.isCameraOn} disabled={!connected} onClick={()=>void run(voice.toggleCamera)}><ControlIcon name="camera"/><span>Vídeo</span></button><button aria-label={voice.isScreenSharing?'Parar compartilhamento':'Compartilhar tela'} title={voice.isScreenSharing?'Parar compartilhamento':'Compartilhar tela'} aria-pressed={voice.isScreenSharing} disabled={!connected} onClick={()=>voice.isScreenSharing?void run(voice.toggleScreenShare):setShareOpen(true)}><ControlIcon name="screen"/><span>Tela</span></button></div></div>}
    <div className="ct-dock-account"><button className="ct-dock-profile" data-profile-identity={user?.username} data-profile-name={user?.display_name} onClick={onProfile} title="Perfil · botão direito para configurações"><Avatar name={user?.display_name||'Você'} identity={user?.username} live={voice.isScreenSharing}/><span><strong>{user?.display_name}</strong><small>{connected?(voice.currentRoom?.inputMode==='push-to-talk'&&!voice.isMicMuted?(voice.voiceInputState==='starting'?'Preparando atalho…':(pushToTalkKeys[inputKey]?.label||inputKey)+(voice.voiceInputState==='focused'?' · janela ativa':' para falar')):'Em voz'):online?'Online':'Offline'}</small></span></button><div className="ct-dock-devices"><div className="ct-dock-split"><button className="ct-dock-icon" aria-label={micLabel} title={micLabel} aria-pressed={voice.isMicMuted||micBlocked} disabled={!connected||micBlocked} onClick={()=>void run(voice.toggleMic)}><ControlIcon name="mic" slashed={voice.isMicMuted||micBlocked}/></button></div><div className="ct-dock-split"><button className="ct-dock-icon" aria-label={outputLabel} title={outputLabel} aria-pressed={voice.isDeafened||outputBlocked} disabled={outputBlocked} onClick={()=>void run(voice.toggleDeafen)}><ControlIcon name="audio" slashed={voice.isDeafened||outputBlocked}/></button></div></div></div>
    {(micBlocked||outputBlocked)&&<p className="ct-muted" role="status">{outputBlocked?'Áudio e microfone bloqueados pelo servidor':'Microfone bloqueado pelo servidor'}</p>}
    {error&&<p className="ct-dock-error" role="alert">{error}</p>}
    <ScreenShareModal isOpen={shareOpen&&connected} onClose={()=>setShareOpen(false)} onStartShare={(source,options)=>voice.startScreenShareWithOptions(source,options)}/>
  </section>
}
