import { useEffect, useRef, useState } from 'react'
import { useVoiceStore } from '../store/useVoiceStore'
import { isLoopbackInput, microphoneOptions } from '../media/microphone'
export function AudioSettings({onClose,embedded=false}:{onClose:()=>void;embedded?:boolean}) {
  const voice=useVoiceStore()
  const [devices,setDevices]=useState<MediaDeviceInfo[]>([])
  const [selected,setSelected]=useState(voice.microphoneDeviceId)
  const [error,setError]=useState('');const [busy,setBusy]=useState(false)
  const [testing,setTesting]=useState(false);const [level,setLevel]=useState(0)
  const resources=useRef<{stream?:MediaStream;context?:AudioContext;frame?:number;generation:number}>({generation:0})
  const stop=()=>{const r=resources.current;r.generation++;r.stream?.getTracks().forEach(t=>t.stop());void r.context?.close().catch(()=>{});if(r.frame)cancelAnimationFrame(r.frame);r.stream=undefined;r.context=undefined;setTesting(false);setLevel(0)}
  const list=async()=>{setDevices((await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput'))}
  useEffect(()=>{void list().catch(()=>setError('Não foi possível listar as entradas.'));const change=()=>{void list().catch(()=>{})};navigator.mediaDevices.addEventListener('devicechange',change);return()=>{stop();navigator.mediaDevices.removeEventListener('devicechange',change)}},[])
  const test=async()=>{
    stop();setError('');setBusy(true);const generation=resources.current.generation
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:microphoneOptions(selected),video:false})
      if(resources.current.generation!==generation){stream.getTracks().forEach(t=>t.stop());return}
      resources.current.stream=stream
      if(isLoopbackInput(stream.getAudioTracks()[0]?.label || ''))throw new Error('Entrada de mistura/loopback detectada. Escolha o microfone físico do headset.')
      await list()
      const context=new AudioContext();resources.current.context=context;await context.resume()
      if(resources.current.generation!==generation)return
      const analyser=context.createAnalyser();analyser.fftSize=512
      context.createMediaStreamSource(stream).connect(analyser)
      // No connection to speakers or the room; this meter is strictly local.
      const samples=new Uint8Array(analyser.fftSize)
      const update=()=>{if(resources.current.generation!==generation)return;analyser.getByteTimeDomainData(samples);const rms=Math.sqrt(samples.reduce((n,v)=>n+((v-128)/128)**2,0)/samples.length);setLevel(Math.min(100,rms*250));resources.current.frame=requestAnimationFrame(update)}
      setTesting(true);update()
    }catch(error){setError(error instanceof Error?error.message:'Falha ao testar o microfone.');stop()}finally{setBusy(false)}
  }
  const blocked=isLoopbackInput(devices.find(d=>d.deviceId===selected)?.label || '')
  const content = <section className="ct-edit-dialog ct-audio-settings" role={embedded?undefined:"dialog"} aria-modal={embedded?undefined:true} aria-label="Configurações de áudio"><h2>Microfone e voz</h2><p>Apenas a entrada escolhida é enviada à chamada. O teste abaixo não reproduz nem transmite áudio.</p><label>Dispositivo de entrada<select value={selected} onChange={e=>{stop();setSelected(e.target.value);setError('')}}><option value="">Padrão do Windows (verificado ao abrir)</option>{devices.map((d,i)=><option key={d.deviceId} value={d.deviceId} disabled={isLoopbackInput(d.label)}>{d.label || `Entrada ${i+1} — teste para identificar`}{isLoopbackInput(d.label)?' — mistura bloqueada':''}</option>)}</select></label><small>Em uso: {voice.microphoneLabel || 'microfone ainda não aberto'}</small><div className="ct-mic-protections"><span>✓ Cancelamento de eco</span><span>✓ Redução de ruído</span><span>✓ Ganho automático desativado</span><span>✓ Entradas de mistura conhecidas bloqueadas</span></div><button type="button" disabled={busy||blocked} onClick={()=>testing?stop():void test()}>{testing?'Parar teste':'Testar entrada e identificar dispositivos'}</button><meter min={0} max={100} value={level} aria-label="Nível do microfone"/><p>Fique em silêncio enquanto alguém fala no Discord. Se o medidor reagir, o áudio já está chegando pela entrada selecionada. Confira o microfone físico, o mixer do driver e o cabo do headset.</p>{(error||voice.microphoneError)&&<p role="alert">{error||voice.microphoneError}</p>}<footer><button disabled={busy} onClick={()=>{stop();onClose()}}>Fechar</button><button className="ct-primary" disabled={busy||blocked} onClick={async()=>{stop();setBusy(true);try{await voice.selectMicrophone(selected);onClose()}catch(error){setError(error instanceof Error?error.message:'Não foi possível salvar.')}finally{setBusy(false)}}}>Usar este microfone</button></footer></section>
  return embedded ? content : <div className="ct-modal-backdrop">{content}</div>
}
