import { useRef } from 'react'
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
