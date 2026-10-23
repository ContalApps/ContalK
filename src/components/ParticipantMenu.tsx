import { useEffect, useRef } from 'react'
import { Avatar } from './Avatar'
import { useVoiceStore, type VoiceParticipant } from '../store/useVoiceStore'
import { FriendButton } from './FriendButton'
import { StreamVolumeControl } from './StreamVolumeControl'
export function ParticipantMenu({participant,position,onClose,onProfile}:{participant:VoiceParticipant;position:{x:number;y:number};onClose:()=>void;onProfile:()=>void}) {
  const ref=useRef<HTMLDivElement>(null)
  const closeRef=useRef(onClose)
  closeRef.current=onClose
  const volume=useVoiceStore(s=>s.userVolumes[participant.identity]??100)
  const previous=useRef(volume||100)
  useEffect(()=>{ref.current?.focus();const bounds=ref.current?.getBoundingClientRect();if(bounds){ref.current!.style.top=`${Math.max(8,Math.min(position.y,window.innerHeight-bounds.height-8))}px`}const close=(e:MouseEvent)=>{if(!ref.current?.contains(e.target as Node))closeRef.current()};const key=(e:KeyboardEvent)=>{if(e.key==='Escape')closeRef.current()};const resize=()=>closeRef.current();document.addEventListener('mousedown',close);document.addEventListener('keydown',key);window.addEventListener('resize',resize);return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',key);window.removeEventListener('resize',resize)}},[participant.identity,position.x,position.y])
  return <div className="ct-participant-menu" ref={ref} tabIndex={-1} role="dialog" aria-label={`Áudio de ${participant.name}`} style={{left:Math.max(8,Math.min(position.x,window.innerWidth-270)),top:8}}>
    <header><Avatar name={participant.name} identity={participant.identity}/><strong>{participant.name}</strong></header>
    <button onClick={onProfile}>Ver perfil</button>
    {!participant.isLocal ? <>
      <FriendButton username={participant.identity} name={participant.name}/>
      <label>Volume da voz <output>{volume}%</output><input aria-label="Volume da voz" type="range" min={0} max={200} value={volume} onChange={e=>useVoiceStore.getState().setUserVolume(participant.identity,Number(e.target.value))}/></label>
      <label className="ct-check">Silenciar voz para mim<input type="checkbox" checked={volume===0} onChange={e=>{if(e.target.checked){previous.current=volume||100;useVoiceStore.getState().setUserVolume(participant.identity,0)}else useVoiceStore.getState().setUserVolume(participant.identity,previous.current)}}/></label>
      <button onClick={()=>useVoiceStore.getState().setUserVolume(participant.identity,100)}>Restaurar volume da voz</button>
      {participant.isScreenShareEnabled && <StreamVolumeControl identity={participant.identity} name={participant.name}/>}
    </> : <button onClick={()=>void useVoiceStore.getState().toggleMic()}>Alternar meu microfone</button>}
  </div>
}
