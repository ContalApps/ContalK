import {create} from 'zustand'
import {useRoleStore} from './useRoleStore'
import {usePreferencesStore} from './usePreferencesStore'
import {useVoiceStore} from './useVoiceStore'
import {useNotificationStore} from './useNotificationStore'
import {can} from '../roles/permissions'
import type {Message} from './useAppStore'

interface Job {message:Message;owner:string;serverId:string;history:boolean;automatic:boolean}
interface SpeechState {messageId:string|null;channelId:string|null;status:'idle'|'loading'|'speaking'|'error';error:string;read:(message:Message)=>void;enqueue:(message:Message)=>void;stop:()=>void;check:()=>void}
let queue:Job[]=[],active:Job|null=null,audio:HTMLAudioElement|null=null,generation=0
function valid(job:Job){const state=useRoleStore.getState(),snapshot=state.snapshot,voice=useVoiceStore.getState();return !!snapshot&&state.status==='connected'&&state.owner===job.owner&&snapshot.actor===job.owner&&snapshot.id===job.serverId&&snapshot.channels.some(channel=>channel.id===job.message.channelId)&&!voice.isDeafened&&!voice.isServerDeafened&&useNotificationStore.getState().visibleChannel===job.message.channelId&&can(snapshot.policy,job.owner,'VIEW_CHANNEL',job.message.channelId)&&(!job.history||can(snapshot.policy,job.owner,'READ_MESSAGE_HISTORY',job.message.channelId))}
function discardAudio(){if(audio){audio.onended=null;audio.onerror=null;audio.pause();audio.removeAttribute('src');audio.load();audio.remove();audio=null}}
async function output(){
 if(!audio)return
 const state=useVoiceStore.getState(),target=audio
 target.volume=state.isDeafened||state.isServerDeafened?0:usePreferencesStore.getState().speechVolume/100
 if('setSinkId'in target){try{const element=target as HTMLAudioElement&{setSinkId:(id:string)=>Promise<void>;sinkId:string};if(element.sinkId!==state.outputDeviceId)await element.setSinkId(state.outputDeviceId)}catch{if(audio===target)throw new Error('Não foi possível usar a saída de áudio escolhida.')}}
 else if(state.outputDeviceId!=='default')throw new Error('Esta instalação não permite selecionar a saída da leitura.')
}

async function pump(){
 if(active||!queue.length)return
 const job=queue.shift()!;if(!valid(job)){void pump();return}
 active=job;const version=++generation
 useSpeechStore.setState({messageId:job.message.id,channelId:job.message.channelId,status:'loading',error:''})
 try{
  const bridge=window.contalkDesktop;if(!bridge?.communityMessage||!bridge.synthesizeSpeech)throw new Error('A leitura em voz exige o aplicativo Windows atualizado.')
  const message=await bridge.communityMessage(job.serverId,job.message.channelId,job.message.id)
  if(version!==generation||!valid(job))return
  if(message.once||!message.content.trim()||job.automatic&&!message.tts)throw new Error('Esta mensagem não permite leitura em voz.')
  job.message=message
  const name=useRoleStore.getState().snapshot?.nicknames?.[message.userId]||message.userName||message.userId
  const text=(name.slice(0,80)+' disse: '+message.content).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,' ').slice(0,2500)
  const data=await bridge.synthesizeSpeech(text,usePreferencesStore.getState().speechVoice)
  if(version!==generation||!valid(job))return
  if(!data)throw new Error('A leitura foi cancelada.')
  const player=new Audio(data);audio=player;player.style.display='none';document.body.appendChild(player);await output();if(version!==generation||!valid(job))return
  player.onended=()=>{if(version!==generation)return;discardAudio();active=null;useSpeechStore.setState({messageId:null,channelId:null,status:'idle'});void pump()}
  player.onerror=()=>{if(version===generation){useSpeechStore.getState().stop();useSpeechStore.setState({messageId:message.id,channelId:message.channelId,status:'error',error:'Não foi possível reproduzir a leitura.'})}}
  await player.play();if(version===generation)useSpeechStore.setState({status:'speaking'})
 }catch(error){if(version===generation){discardAudio();queue=[];active=null;useSpeechStore.setState({status:'error',error:error instanceof Error?error.message:'Não foi possível ler a mensagem.'})}}
 finally{if(version===generation&&active===job&&!valid(job))useSpeechStore.getState().stop()}
}
function add(message:Message,automatic:boolean){const state=useRoleStore.getState(),snapshot=state.snapshot;if(!snapshot||!state.owner||message.once||!message.content.trim())return;const job:Job={message,owner:state.owner,serverId:snapshot.id,history:can(snapshot.policy,state.owner,'READ_MESSAGE_HISTORY',message.channelId),automatic};if(!valid(job))return;if(queue.some(item=>item.message.id===message.id)||active?.message.id===message.id)return;queue.push(job);queue=queue.slice(-5);void pump()}
export const useSpeechStore=create<SpeechState>(()=>({messageId:null,channelId:null,status:'idle',error:'',read:message=>{useSpeechStore.getState().stop();add(message,false)},enqueue:message=>add(message,true),stop:()=>{generation++;queue=[];active=null;discardAudio();window.contalkDesktop?.cancelSpeech?.();useSpeechStore.setState({messageId:null,channelId:null,status:'idle',error:''})},check:()=>{const state=useSpeechStore.getState(),roles=useRoleStore.getState();if(state.channelId&&(!roles.snapshot||roles.status!=='connected'||!roles.snapshot.channels.some(channel=>channel.id===state.channelId)||!can(roles.snapshot.policy,roles.snapshot.actor,'VIEW_CHANNEL',state.channelId))||active&&!valid(active)||state.channelId&&state.channelId!==useNotificationStore.getState().visibleChannel){useSpeechStore.getState().stop();return}const changes=useRoleStore.getState().snapshot?.messageChanges||[];if(active&&changes.some(change=>change.id===active!.message.id&&(change.deleted||change.content!==undefined&&change.content!==active!.message.content))){useSpeechStore.getState().stop();return}const version=generation;void output().catch(error=>{if(version===generation){const current=useSpeechStore.getState();useSpeechStore.getState().stop();useSpeechStore.setState({messageId:current.messageId,channelId:current.channelId,status:'error',error:error instanceof Error?error.message:'Falha na saída de áudio.'})}})}}))

export function setupSpeechPlayback(){
 const seen=new Set<string>()
 const roles=useRoleStore.subscribe((state,previous)=>{
  useSpeechStore.getState().check()
  if(state.owner!==previous.owner||state.serverId!==previous.serverId){seen.clear();useSpeechStore.getState().stop();return}
  const snapshot=state.snapshot;if(!snapshot||state.status!=='connected'||!usePreferencesStore.getState().speechAuto)return
  for(const message of snapshot.liveMessages||[])if(message.tts&&message.userId!==snapshot.actor&&!seen.has(message.id)){seen.add(message.id);if(seen.size>2000)seen.delete(seen.values().next().value!);useSpeechStore.getState().enqueue(message)}
 })
 const visible=useNotificationStore.subscribe(()=>useSpeechStore.getState().check()),voice=useVoiceStore.subscribe(()=>useSpeechStore.getState().check()),preferences=usePreferencesStore.subscribe((state,previous)=>{if(state.owner!==previous.owner||state.speechVoice!==previous.speechVoice||previous.speechAuto&&!state.speechAuto)useSpeechStore.getState().stop();else useSpeechStore.getState().check()})
 return()=>{roles();visible();voice();preferences();useSpeechStore.getState().stop()}
}
