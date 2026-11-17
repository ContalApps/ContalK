import { SpeechSettings } from './SpeechSettings'
import { VoiceInputSettings } from './VoiceInputSettings'
import { useEffect, useRef, useState } from 'react'
import { useVoiceStore } from '../store/useVoiceStore'
import { isLoopbackInput, microphoneOptions } from '../media/microphone'
import { ControlIcon } from './ControlIcon'

const METER_BARS = 48

// Voz e áudio no formato das configurações do Discord: microfone e alto-falante lado a lado,
// teste com medidor, modo de entrada e leitura em voz. Nas configurações (embedded) a troca de
// dispositivo vale na hora; no diálogo aberto pelo aviso de microfone há botão de aplicar.
export function AudioSettings({onClose,embedded=false,initialMode='input'}:{onClose:()=>void;embedded?:boolean;initialMode?:'input'|'output'}) {
  const voice=useVoiceStore()
  const [output,setOutput]=useState(voice.outputDeviceId)
  const [devices,setDevices]=useState<MediaDeviceInfo[]>([])
  const [selected,setSelected]=useState(voice.microphoneDeviceId)
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [saved,setSaved]=useState('')
  const [testing,setTesting]=useState(false);const [level,setLevel]=useState(0)
  const resources=useRef<{stream?:MediaStream;context?:AudioContext;frame?:number;generation:number}>({generation:0})
  const stop=()=>{const r=resources.current;r.generation++;r.stream?.getTracks().forEach(t=>t.stop());void r.context?.close().catch(()=>{});if(r.frame)cancelAnimationFrame(r.frame);r.stream=undefined;r.context=undefined;setTesting(false);setLevel(0)}
  const list=async()=>{setDevices((await navigator.mediaDevices.enumerateDevices()))}
  useEffect(()=>{void list().catch(()=>setError('Não foi possível listar os dispositivos.'));const change=()=>{void list().catch(()=>{})};navigator.mediaDevices.addEventListener('devicechange',change);return()=>{stop();navigator.mediaDevices.removeEventListener('devicechange',change)}},[])
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
      // Sem ligação com os alto-falantes nem com a sala: o medidor é só local.
      const samples=new Uint8Array(analyser.fftSize)
      const update=()=>{if(resources.current.generation!==generation)return;analyser.getByteTimeDomainData(samples);const rms=Math.sqrt(samples.reduce((n,v)=>n+((v-128)/128)**2,0)/samples.length);setLevel(Math.min(100,rms*250));resources.current.frame=requestAnimationFrame(update)}
      setTesting(true);update()
    }catch(error){setError(error instanceof Error?error.message:'Falha ao testar o microfone.');stop()}finally{setBusy(false)}
  }
  const blocked=isLoopbackInput(devices.find(d=>d.deviceId===selected)?.label || '')
  const displayedError=error||(initialMode==='input'?voice.microphoneError:null)
  const applyNow=async(kind:'input'|'output',value:string)=>{
    if(!embedded)return
    setBusy(true);setError('');setSaved('')
    try{if(kind==='output')await voice.selectOutput(value);else await voice.selectMicrophone(value);setSaved(kind==='output'?'Alto-falante salvo.':'Microfone salvo.')}
    catch(failure){setError(failure instanceof Error?failure.message:'Não foi possível trocar o dispositivo.')}
    finally{setBusy(false)}
  }
  const lit=Math.round(level/100*METER_BARS)

  const content = <section className={`ct-voice-settings ${embedded?'is-embedded':'ct-dialog'}`} role={embedded?undefined:'dialog'} aria-modal={embedded?undefined:true} aria-label="Configurações de áudio">
    {!embedded&&<header className="ct-dialog-header"><div><h2>{initialMode==='output'?'Saída de áudio':'Microfone e voz'}</h2><p>Escolha os dispositivos e teste a entrada.</p></div><button type="button" className="ct-dialog-close" aria-label="Fechar" onClick={()=>{stop();onClose()}}><ControlIcon name="close"/></button></header>}
    <div className="ct-vs-section">
      {embedded&&<h2 className="ct-vs-title">Voz</h2>}
      <div className="ct-vs-devices">
        {initialMode==='input'&&<label className="ct-field"><span>Microfone</span><select aria-label="Dispositivo de entrada" value={selected} disabled={busy&&embedded} onChange={event=>{stop();setSelected(event.target.value);setError('');void applyNow('input',event.target.value)}}><option value="">Padrão do Windows</option>{devices.filter(device=>device.kind==='audioinput'&&device.deviceId!=='default').map((device,index)=><option key={device.deviceId} value={device.deviceId} disabled={isLoopbackInput(device.label)}>{device.label||('Entrada '+(index+1))}{isLoopbackInput(device.label)?' (mistura bloqueada)':''}</option>)}</select></label>}
        <label className="ct-field"><span>Alto-falante</span><select aria-label="Dispositivo de saída" value={output} disabled={busy&&embedded} onChange={event=>{setOutput(event.target.value);void applyNow('output',event.target.value)}}><option value="default">Padrão do sistema</option>{devices.filter(device=>device.kind==='audiooutput'&&device.deviceId!=='default').map((device,index)=><option key={device.deviceId} value={device.deviceId}>{device.label||('Saída '+(index+1))}</option>)}</select></label>
      </div>
      {initialMode==='input'&&<>
        <div className="ct-vs-test">
          <button type="button" className={testing?'ct-button-secondary':'ct-button-primary'} disabled={busy||blocked} onClick={()=>testing?stop():void test()}>{testing?'Parar teste':'Testar o microfone'}</button>
          <div className="ct-vs-meter" role="meter" aria-label="Nível do microfone" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level)}>
            {Array.from({length:METER_BARS},(_,index)=><i key={index} data-on={index<lit} data-zone={index<METER_BARS*0.6?'low':index<METER_BARS*0.85?'mid':'high'}/>)}
          </div>
        </div>
        <p className="ct-vs-hint">Em uso: {voice.microphoneLabel||'o microfone abre quando você entra numa chamada'}. O teste é só local: não reproduz nem transmite áudio.</p>
      </>}
      {saved&&!displayedError&&<p className="ct-vs-saved" role="status"><ControlIcon name="check" size={14}/>{saved}</p>}
      {displayedError&&<p className="ct-vs-error" role="alert">{displayedError}</p>}
    </div>
    {initialMode==='input'&&<div className="ct-vs-section"><VoiceInputSettings/></div>}
    {initialMode==='input'&&<div className="ct-vs-section">
      <h3>Proteções da entrada</h3>
      <ul className="ct-vs-protections">
        <li><ControlIcon name="check" size={14}/>Cancelamento de eco</li>
        <li><ControlIcon name="check" size={14}/>Redução de ruído</li>
        <li><ControlIcon name="check" size={14}/>Ganho automático desativado</li>
        <li><ControlIcon name="check" size={14}/>Entradas de mistura conhecidas bloqueadas</li>
      </ul>
      <p className="ct-vs-hint">Se o medidor reagir ao som de outros aplicativos, confira o microfone físico e o mixer do Windows.</p>
    </div>}
    <div className="ct-vs-section"><SpeechSettings/></div>
    {!embedded&&<footer className="ct-dialog-footer"><button type="button" className="ct-button-secondary" disabled={busy} onClick={()=>{stop();onClose()}}>Cancelar</button><button type="button" className="ct-button-primary" disabled={busy||initialMode==='input'&&blocked} onClick={async()=>{stop();setBusy(true);try{await voice.selectOutput(output);if(initialMode==='input')await voice.selectMicrophone(selected);onClose()}catch(error){setError(error instanceof Error?error.message:'Não foi possível salvar.')}finally{setBusy(false)}}}>Aplicar dispositivos</button></footer>}
  </section>
  return embedded ? content : <div className="ct-modal-backdrop ct-dialog-backdrop">{content}</div>
}
