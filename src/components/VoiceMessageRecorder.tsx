import {useEffect,useRef,useState} from 'react'
import type {Attachment,MessageOptions} from '../store/useAppStore'
import {useRoleStore} from '../store/useRoleStore'
import {useVoiceStore} from '../store/useVoiceStore'
import {useNotificationStore} from '../store/useNotificationStore'
import {centralAllows} from '../roles/transport'
import {isLoopbackInput,microphoneOptions} from '../media/microphone'

export function RecordingPreview({src}:{src:string}){
 const player=useRef<HTMLAudioElement>(null),voice=useVoiceStore(),[ready,setReady]=useState(false),[error,setError]=useState('')
 useEffect(()=>{let active=true;const audio=player.current;setReady(false);setError('');audio?.pause();if(!audio)return;const apply=async()=>{try{if('setSinkId'in audio)await (audio as HTMLAudioElement&{setSinkId:(id:string)=>Promise<void>}).setSinkId(voice.outputDeviceId);else if(voice.outputDeviceId!=='default')throw new Error('Saída indisponível.');if(active)setReady(true)}catch{if(active)setError('Não foi possível usar a saída de áudio escolhida.')}};void apply();return()=>{active=false;audio.pause()}},[src,voice.outputDeviceId,voice.isDeafened,voice.isServerDeafened])
 return <><audio ref={player} controls={ready&&!voice.isDeafened&&!voice.isServerDeafened} preload="metadata" src={src} aria-label="Ouvir gravação antes de enviar"/>{error&&<p role="alert">{error}</p>}</>
}

export function VoiceMessageRecorder({channelId,onSend,onClose}:{channelId:string;onSend:(text:string,attachment?:Attachment,options?:MessageOptions)=>Promise<void>;onClose:()=>void}){
 const scope=useRef({owner:useRoleStore.getState().owner,server:useRoleStore.getState().serverId,channel:channelId}),alive=useRef(true),recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),timer=useRef<ReturnType<typeof setInterval>|null>(null),started=useRef(0),pending=useRef<Attachment|undefined>(undefined)
 const [status,setStatus]=useState<'idle'|'starting'|'recording'|'ready'|'sending'>('idle'),[elapsed,setElapsed]=useState(0),[data,setData]=useState(''),[error,setError]=useState('')
 const permitted=()=>{const state=useRoleStore.getState(),saved=scope.current;return alive.current&&state.status==='connected'&&state.owner===saved.owner&&state.serverId===saved.server&&channelId===saved.channel&&useNotificationStore.getState().visibleChannel===channelId&&centralAllows('VIEW_CHANNEL',channelId)&&centralAllows('SEND_MESSAGES',channelId)&&centralAllows('SEND_VOICE_MESSAGES',channelId)}
 const release=()=>{if(timer.current)clearInterval(timer.current);timer.current=null;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null}
 const cancel=()=>{if(recorder.current){recorder.current.onstop=null;recorder.current.ondataavailable=null;if(recorder.current.state!=='inactive')recorder.current.stop();recorder.current=null}release();pending.current=undefined}
 useEffect(()=>{alive.current=true;const stop=()=>{if(!permitted()){cancel();onClose()}};const role=useRoleStore.subscribe(stop),visible=useNotificationStore.subscribe(stop);return()=>{alive.current=false;role();visible();cancel()}},[channelId])
 const finish=()=>{if(recorder.current?.state==='recording')recorder.current.stop();release()}
 const start=async()=>{
  if(status!=='idle')return;setError('');setStatus('starting');try{
   if(!permitted())throw new Error('Seu cargo não permite gravar neste canal.')
   if(!window.contalkDesktop||!await window.contalkDesktop.storageStatus())throw new Error('Sua conta ainda não está conectada ao servidor. Saia e entre novamente com a internet ligada.')
   if(!MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))throw new Error('Esta instalação não suporta gravação de voz Opus.')
   const captured=await navigator.mediaDevices.getUserMedia({audio:microphoneOptions(useVoiceStore.getState().microphoneDeviceId),video:false})
   if(!permitted()){captured.getTracks().forEach(track=>track.stop());return}
   stream.current=captured
   if(captured.getAudioTracks().some(track=>isLoopbackInput(track.label)))throw new Error('Escolha um microfone físico nas configurações de áudio.')
   const parts:Blob[]=[],instance=new MediaRecorder(captured,{mimeType:'audio/webm;codecs=opus',audioBitsPerSecond:32000});let size=0
   recorder.current=instance;started.current=performance.now();setElapsed(0);setData('');pending.current=undefined
   instance.ondataavailable=event=>{if(event.data.size){size+=event.data.size;if(size>1048576){cancel();if(alive.current){setStatus('idle');setError('A gravação excedeu 1 MB. Grave novamente.')}return}parts.push(event.data)}}
   instance.onerror=()=>{cancel();if(alive.current){setStatus('idle');setError('Não foi possível gravar o microfone.')}}
   instance.onstop=async()=>{const durationMs=Math.min(60000,Math.round(performance.now()-started.current));release();recorder.current=null;if(!permitted())return;if(durationMs<250||!parts.length){setStatus('idle');setError('Grave pelo menos um instante antes de parar.');return}const blob=new Blob(parts,{type:instance.mimeType}),reader=new FileReader();reader.onload=()=>{if(!permitted())return;setElapsed(durationMs);setData(String(reader.result));setStatus('ready')};reader.onerror=()=>{if(alive.current){setStatus('idle');setError('Não foi possível preparar a gravação.')}};reader.readAsDataURL(blob)}
   instance.start(250);setStatus('recording');timer.current=setInterval(()=>{const value=Math.round(performance.now()-started.current);setElapsed(Math.min(60000,value));if(value>=60000)finish()},100)
  }catch(error){cancel();if(alive.current){setStatus('idle');setError(error instanceof Error?error.message:'Não foi possível acessar o microfone.')}}
 }
 const send=async()=>{setError('');setStatus('sending');try{if(!permitted())throw new Error('O acesso ao canal foi alterado.');if(!pending.current){const bytes=atob(data.split(',')[1]).length;pending.current=await window.contalkDesktop!.uploadInlineAttachment({name:'mensagem-de-voz.webm',type:'audio/webm;codecs=opus',size:bytes,data:data.replace(/^data:[^,]*,/,'data:application/octet-stream;base64,')})}if(!permitted())throw new Error('O acesso ao canal foi alterado durante o envio.');await onSend('',pending.current,{voice:{durationMs:elapsed},preview:false});if(alive.current)onClose()}catch(error){if(alive.current){setStatus('ready');setError(error instanceof Error?error.message:'Não foi possível enviar a gravação.')}}}
 return <section className="ct-voice-message-recorder" aria-label="Mensagem de voz"><span>{status==='recording'?'Gravando':'Mensagem de voz'} · {(elapsed/1000).toFixed(1)} s / 60 s</span>{status==='idle'&&<button onClick={()=>void start()}>Gravar</button>}{status==='recording'&&<button onClick={finish}>Parar gravação</button>}{status==='ready'&&<><RecordingPreview src={data}/><button onClick={()=>void send()}>Enviar gravação</button><button onClick={()=>{setStatus('idle');setData('');pending.current=undefined}}>Gravar novamente</button></>}{status==='sending'&&<span role="status">Enviando gravação…</span>}<button disabled={status==='sending'} onClick={()=>{cancel();onClose()}}>Cancelar gravação</button>{error&&<p role="alert">{error}</p>}</section>
}
