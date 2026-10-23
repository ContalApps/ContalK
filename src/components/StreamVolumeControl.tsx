import { useEffect, useId, useRef, useState } from 'react'
import { useVoiceStore } from '../store/useVoiceStore'

export function StreamVolumeControl({ identity, name }: { identity: string; name: string }) {
  const volume = useVoiceStore(s => s.streamVolumes[identity] ?? 100)
  const previous = useRef(volume || 100)
  const change = (value: number) => useVoiceStore.getState().setStreamVolume(identity, value)
  return <div className="ct-stream-volume" onDoubleClick={e => e.stopPropagation()}>
    <label><span>Volume da transmissão <output>{volume}%</output></span><input type="range" min={0} max={200} step={1} value={volume} aria-label={`Volume da transmissão de ${name}`} onChange={e => change(Number(e.target.value))}/></label>
    <button type="button" aria-pressed={volume === 0} onClick={() => { if (volume) { previous.current = volume; change(0) } else change(previous.current) }}>{volume === 0 ? 'Ativar som para mim' : 'Silenciar para mim'}</button>
    <small>Altera só o áudio que você ouve da tela.</small>
  </div>
}

export function StreamAudioPopover({ identity, name }: { identity: string; name: string }) {
  const [open, setOpen] = useState(false)
  const volume = useVoiceStore(s => s.streamVolumes[identity] ?? 100)
  const ref = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    ref.current?.querySelector<HTMLInputElement>('input')?.focus()
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); button.current?.focus() } }
    document.addEventListener('pointerdown', outside)
    ref.current?.addEventListener('keydown', escape)
    const current = ref.current
    return () => { document.removeEventListener('pointerdown', outside); current?.removeEventListener('keydown', escape) }
  }, [open])
  return <div className="ct-stream-audio" ref={ref} data-open={open} onDoubleClick={e=>e.stopPropagation()}>
    {open && <div id={id} role="group" aria-label={`Áudio da transmissão de ${name}`}><StreamVolumeControl identity={identity} name={name}/></div>}
    <button className="ct-stream-audio-toggle" ref={button} type="button" aria-label={`Áudio da transmissão de ${name}`} aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>setOpen(value=>!value)}><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/>{volume===0?<path d="m17 9 5 6m-5 0 5-6"/>:<path d="M16 9a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12"/>}</svg><span className="ct-stream-mini-level" aria-hidden="true"><i style={{width:Math.min(volume/2,100)+'%'}}/></span><span>{volume===0?'Sem som':`${volume}%`}</span></button>
  </div>
}
