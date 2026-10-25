import { SpeechSettings } from './SpeechSettings'
import { VoiceInputSettings } from './VoiceInputSettings'
import { useEffect, useRef, useState } from 'react'
import { useVoiceStore } from '../store/useVoiceStore'
import { isLoopbackInput, microphoneOptions } from '../media/microphone'
export function AudioSettings({onClose,embedded=false,initialMode='input'}:{onClose:()=>void;embedded?:boolean;initialMode?:'input'|'output'}) {
  const voice=useVoiceStore()
  const [output,setOutput]=useState(voice.outputDeviceId)
  const [devices,setDevices]=useState<MediaDeviceInfo[]>([])
  const [selected,setSelected]=useState(voice.microphoneDeviceId)
  const [error,setError]=useState('');const [busy,setBusy]=useState(false)
  const [testing,setTesting]=useState(false);const [level,setLevel]=useState(0)
  const resources=useRef<{stream?:MediaStream;context?:AudioContext;frame?:number;generation:number}>({generation:0})
  const stop=()=>{const r=resources.current;r.generation++;r.stream?.getTracks().forEach(t=>t.stop());void r.context?.close().catch(()=>{});if(r.frame)cancelAnimationFrame(r.frame);r.stream=undefined;r.context=undefined;setTesting(false);setLevel(0)}
  const list=async()=>{setDevices((await navigator.mediaDevices.enumerateDevices()))}
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
  const displayedError=error||(initialMode==='input'?voice.microphoneError:null)
  const content = <section className="ct-edit-dialog ct-audio-settings" role={embedded?undefined:"dialog"} aria-modal={embedded?undefined:true} aria-label="Configurações de áudio">
    <h2>{initialMode==='output'?'Saída de áudio':'Microfone e voz'}</h2>
    {initialMode==='input'&&<VoiceInputSettings/>}
    <div className="ct-audio-device-fields"><label>Dispositivo de saída<select aria-label="Dispositivo de saída" value={output} onChange={event=>setOutput(event.target.value)}><option value="default">Padrão do sistema</option>{devices.filter(device=>device.kind==='audiooutput'&&device.deviceId!=='default').map((device,index)=><option key={device.deviceId} value={device.deviceId}>{device.label||('Saída '+(index+1))}</option>)}</select></label>
    {initialMode==='input'&&<label>Dispositivo de entrada<select aria-label="Dispositivo de entrada" value={selected} onChange={event=>{stop();setSelected(event.target.value);setError('')}}><option value="">Padrão do Windows (verificado ao abrir)</option>{devices.filter(device=>device.kind==='audioinput').map((device,index)=><option key={device.deviceId} value={device.deviceId} disabled={isLoopbackInput(device.label)}>{device.label||('Entrada '+(index+1))}{isLoopbackInput(device.label)?' — mistura bloqueada':''}</option>)}</select></label>}</div>
    {initialMode==='input'&&<><small>Em uso: {voice.microphoneLabel||'microfone ainda não aberto'}</small><div className="ct-audio-input-test"><button type="button" disabled={busy||blocked} onClick={()=>testing?stop():void test()}>{testing?'Parar teste':'Testar entrada e identificar dispositivos'}</button><meter min={0} max={100} value={level} aria-label="Nível do microfone"/></div><p>O teste é local: não reproduz nem transmite áudio.</p><details><summary>Proteções e diagnóstico da entrada</summary><div className="ct-mic-protections"><span>Cancelamento de eco</span><span>Redução de ruído</span><span>Ganho automático desativado</span><span>Entradas de mistura conhecidas bloqueadas</span></div><p>Se o medidor reagir ao som de outros aplicativos, confira o microfone físico e o mixer do sistema.</p></details></>}
    <SpeechSettings/>
    {displayedError&&<p role="alert">{displayedError}</p>}
    <footer><button disabled={busy} onClick={()=>{stop();onClose()}}>Fechar</button><button className="ct-primary" disabled={busy||initialMode==='input'&&blocked} onClick={async()=>{stop();setBusy(true);try{await voice.selectOutput(output);if(initialMode==='input')await voice.selectMicrophone(selected);onClose()}catch(error){setError(error instanceof Error?error.message:'Não foi possível salvar.')}finally{setBusy(false)}}}>Aplicar dispositivos</button></footer>
  </section>
  return embedded ? content : <div className="ct-modal-backdrop">{content}</div>
}
