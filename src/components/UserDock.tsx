import { useState } from 'react'
import { useVoiceStore } from '../store/useVoiceStore'
import { useAuthStore } from '../store/useAuthStore'
import { useCommunityStore } from '../store/useCommunityStore'
import { Avatar } from './Avatar'
import { ControlIcon } from './ControlIcon'
import { ScreenShareModal } from './ScreenShareModal'

export function UserDock({onProfile,onSettings,onAudioSettings,onOpenChannel}:{onProfile:()=>void;onSettings:()=>void;onAudioSettings:(mode:'input'|'output')=>void;onOpenChannel:(id:string)=>void}) {
  const voice=useVoiceStore(),user=useAuthStore(s=>s.user)
  const online=useCommunityStore(s=>s.status==='online')
  const [shareOpen,setShareOpen]=useState(false),[error,setError]=useState('')
  const connected=voice.connectionStatus==='connected'
  const run=async(action:()=>Promise<unknown>)=>{setError('');try{await action()}catch(e){setError(e instanceof Error?e.message:'Não foi possível realizar a ação.')}}
  return <section className="ct-user-dock" aria-label="Seu perfil e controles de voz">
    {voice.activeChannelId&&<div className="ct-dock-voice"><div className="ct-dock-connection"><button className="ct-dock-status" onClick={()=>onOpenChannel(voice.activeChannelId!)}><ControlIcon name="signal"/><span><strong>{connected?'Voz conectada':voice.connectionStatus==='reconnecting'?'Reconectando…':'Conectando…'}</strong><small>{voice.activeChannelName}</small></span></button><button className="ct-dock-icon ct-dock-disconnect" aria-label="Desconectar da chamada" title="Desconectar da chamada" onClick={()=>void run(voice.leaveChannel)}><ControlIcon name="disconnect"/></button></div><div className="ct-dock-call-actions"><button aria-label={voice.isCameraOn?'Desligar câmera':'Ligar câmera'} title={voice.isCameraOn?'Desligar câmera':'Ligar câmera'} aria-pressed={voice.isCameraOn} disabled={!connected} onClick={()=>void run(voice.toggleCamera)}><ControlIcon name="camera"/><span>Vídeo</span></button><button aria-label={voice.isScreenSharing?'Parar compartilhamento':'Compartilhar tela'} title={voice.isScreenSharing?'Parar compartilhamento':'Compartilhar tela'} aria-pressed={voice.isScreenSharing} disabled={!connected} onClick={()=>voice.isScreenSharing?void run(voice.toggleScreenShare):setShareOpen(true)}><ControlIcon name="screen"/><span>Tela</span></button></div></div>}
    <div className="ct-dock-account"><button className="ct-dock-profile" onClick={onProfile} title="Abrir seu perfil"><Avatar name={user?.display_name||'Você'} identity={user?.username}/><span><strong>{user?.display_name}</strong><small>{connected?'Em voz':online?'Online':'Offline'}</small></span></button><div className="ct-dock-devices"><div className="ct-dock-split"><button className="ct-dock-icon" aria-label={voice.isMicMuted?'Ativar microfone':'Silenciar microfone'} title={voice.isMicMuted?'Ativar microfone':'Silenciar microfone'} aria-pressed={voice.isMicMuted} disabled={!connected} onClick={()=>void run(voice.toggleMic)}><ControlIcon name="mic" slashed={voice.isMicMuted}/></button><button className="ct-dock-arrow" aria-label="Selecionar microfone" title="Selecionar microfone" onClick={()=>onAudioSettings('input')}><ControlIcon name="chevron"/></button></div><div className="ct-dock-split"><button className="ct-dock-icon" aria-label={voice.isDeafened?'Ativar áudio':'Silenciar áudio'} title={voice.isDeafened?'Ativar áudio':'Silenciar áudio'} aria-pressed={voice.isDeafened} disabled={!connected} onClick={()=>void run(voice.toggleDeafen)}><ControlIcon name="audio" slashed={voice.isDeafened}/></button><button className="ct-dock-arrow" aria-label="Selecionar saída de áudio" title="Selecionar saída de áudio" onClick={()=>onAudioSettings('output')}><ControlIcon name="chevron"/></button></div><button className="ct-dock-icon" aria-label="Configurações do ConTALK" title="Configurações do ConTALK" onClick={onSettings}><ControlIcon name="settings"/></button></div></div>
    {error&&<p className="ct-dock-error" role="alert">{error}</p>}
    <ScreenShareModal isOpen={shareOpen&&connected} onClose={()=>setShareOpen(false)} onStartShare={(source,options)=>voice.startScreenShareWithOptions(source,options)}/>
  </section>
}
