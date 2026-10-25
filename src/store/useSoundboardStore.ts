import {create} from 'zustand'
import {RoomEvent,type Room} from '../media/realtime'
import {soundboardGain,validSoundboardPlay,type SoundboardPlay} from '../media/soundboard'
import {useVoiceStore} from './useVoiceStore'
import {usePreferencesStore} from './usePreferencesStore'

interface SoundboardState{status:'idle'|'loading'|'playing'|'error';name:string;actor:string;error:string;stop:()=>void}
let generation=0,player:HTMLAudioElement|null=null,timer:ReturnType<typeof setTimeout>|null=null,active:{room:Room;packet:SoundboardPlay;owner:string;received:number}|null=null
function dispose(){if(timer)clearTimeout(timer);timer=null;if(player){player.onended=null;player.onerror=null;player.pause();player.removeAttribute('src');player.load();player.remove();player=null}}
function volume(){return active?soundboardGain(usePreferencesStore.getState().soundboardVolume,useVoiceStore.getState().userVolumes[active.packet.actor]??100):0}
function valid(){const voice=useVoiceStore.getState(),preferences=usePreferencesStore.getState();return !!active&&voice.currentRoom===active.room&&voice.connectionStatus==='connected'&&active.room.state==='connected'&&active.room.serverId===active.packet.serverId&&voice.activeChannelId===active.packet.channelId&&preferences.owner===active.owner&&active.room.localParticipant.identity===active.owner&&!voice.isDeafened&&!voice.isServerDeafened&&volume()>0&&(active.packet.actor===active.owner||active.room.remoteParticipants.has(active.packet.actor))&&performance.now()-active.received<active.packet.expiresAt-active.packet.startedAt}
export const useSoundboardStore=create<SoundboardState>(()=>({status:'idle',name:'',actor:'',error:'',stop:()=>{generation++;active=null;dispose();useSoundboardStore.setState({status:'idle',name:'',actor:'',error:''})}}))

export function setupSoundboardPlayback(){
 let room:Room|null=null,detach=()=>{};const seen=new Set<string>()
 const receive=async(packet:unknown)=>{
  if(!room||!validSoundboardPlay(packet)||seen.has(packet.id))return
  seen.add(packet.id);if(seen.size>200)seen.delete(seen.values().next().value!)
  useSoundboardStore.getState().stop();const version=generation,owner=usePreferencesStore.getState().owner
  if(!owner)return
  active={room,packet,owner,received:performance.now()};if(!valid()){active=null;return}
  useSoundboardStore.setState({status:'loading',actor:packet.actor,name:packet.name,error:''})
  try{
   if(!window.contalkDesktop?.readStorageAudio)throw new Error('Atualize o aplicativo para ouvir o painel de sons.')
   const data=await window.contalkDesktop.readStorageAudio(packet.storageId)
   if(version!==generation||!valid())return
   const audio=new Audio(data);player=audio;audio.style.display='none';audio.dataset.contalkSoundboard=packet.id;document.body.appendChild(audio);audio.volume=volume()
   const output=useVoiceStore.getState().outputDeviceId
   if('setSinkId'in audio)await (audio as HTMLAudioElement&{setSinkId:(id:string)=>Promise<void>}).setSinkId(output)
   else if(output!=='default')throw new Error('A saída escolhida não está disponível para os sons.')
   if(version!==generation||!valid())return
   audio.onended=()=>{if(version===generation)useSoundboardStore.getState().stop()};audio.onerror=()=>{if(version===generation){useSoundboardStore.getState().stop();useSoundboardStore.setState({status:'error',error:'Não foi possível reproduzir o som.'})}}
   await audio.play();if(version!==generation||!valid())return
   timer=setTimeout(()=>{if(version===generation)useSoundboardStore.getState().stop()},Math.min(5000,packet.durationMs));useSoundboardStore.setState({status:'playing'})
  }catch(error){if(version===generation){useSoundboardStore.getState().stop();useSoundboardStore.setState({status:'error',name:packet.name,actor:packet.actor,error:error instanceof Error?error.message:'Não foi possível ouvir o som.'})}}
  finally{if(version===generation&&active&&!valid())useSoundboardStore.getState().stop()}
 }
 const bind=()=>{const next=useVoiceStore.getState().currentRoom;if(next===room)return;detach();useSoundboardStore.getState().stop();seen.clear();room=next;if(!room)return;const current=room,stop=(packet:{id?:string})=>{if(active?.packet.id===packet?.id)useSoundboardStore.getState().stop()},disconnect=()=>useSoundboardStore.getState().stop();current.on(RoomEvent.Soundboard,receive).on(RoomEvent.SoundboardStopped,stop).on(RoomEvent.Reconnecting,disconnect).on(RoomEvent.Disconnected,disconnect);detach=()=>{current.off(RoomEvent.Soundboard,receive).off(RoomEvent.SoundboardStopped,stop).off(RoomEvent.Reconnecting,disconnect).off(RoomEvent.Disconnected,disconnect)}}
 const voice=useVoiceStore.subscribe((state,previous)=>{bind();if(active&&(!valid()||state.outputDeviceId!==previous.outputDeviceId))useSoundboardStore.getState().stop();else if(player)player.volume=volume()})
 const preferences=usePreferencesStore.subscribe(()=>{if(active&&!valid())useSoundboardStore.getState().stop();else if(player)player.volume=volume()})
 bind();return()=>{voice();preferences();detach();room=null;useSoundboardStore.getState().stop()}
}
