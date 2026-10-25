import { applyMessageChange } from './history'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore, type Server, type Message } from '../store/useAppStore'
import { useVoiceStore } from '../store/useVoiceStore'
import { useRoleStore } from '../store/useRoleStore'
import { withoutActivity } from '../notifications/activity'
import { can, Permission, readMask } from './permissions'
import type { CommunitySnapshot } from './types'

// Central snapshots remain in memory. Preserve the previous local community as
// an archive instead of replacing its persisted channels/history with a filtered
// snapshot, or storing one account's private channels in another account's cache.
export function setupCentralCommunity(){
  const backups=new Map<string,{server:Server|undefined;messages:Record<string,Message[]>;ids:Set<string>}>()
  const recentLive=new Map<string,Message[]>()
  const options=useAppStore.persist.getOptions(),originalPartialize=options.partialize
  let last:CommunitySnapshot|null=null
  let lastOlder:Record<string,Message[]>|null=null
  const restored=(current:ReturnType<typeof useAppStore.getState>)=>{
    let servers=current.servers,messages={...current.messages}
    for(const [id,backup]of backups){
      servers=servers.filter(server=>server.id!==id)
      if(backup.server)servers=[...servers,backup.server]
      for(const channel of backup.ids)delete messages[channel]
      messages={...messages,...backup.messages}
    }
    return {...current,servers,messages}
  }
  useAppStore.persist.setOptions({partialize:state=>originalPartialize?originalPartialize(restored(state)):restored(state)})
  const restore=()=>{
    if(backups.size){withoutActivity(()=>useAppStore.setState(restored(useAppStore.getState())));backups.clear()}
    last=null
    lastOlder=null
    recentLive.clear()
  }
  const apply=(snapshot:CommunitySnapshot)=>{
    const older=useRoleStore.getState().olderMessages
    if(snapshot===last&&older===lastOlder)return
    const historyOnly=snapshot===last
    const first=!backups.has(snapshot.id),current=useAppStore.getState()
    if(first){
      const server=current.servers.find(server=>server.id===snapshot.id),ids=new Set(server?.channels.map(channel=>channel.id)||[])
      const messages=Object.fromEntries(Object.entries(current.messages).filter(([channel])=>ids.has(channel)))
      const backup={server,messages,ids}
      try{const key=`contalk-legacy-community:${JSON.stringify([snapshot.actor,snapshot.id])}`;if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({server,messages}))}catch{useRoleStore.setState({error:'Não foi possível preservar o histórico anterior. Libere espaço antes de conectar a comunidade.',status:'error'});return}
      backups.set(snapshot.id,backup)
    }
    const backup=backups.get(snapshot.id)!
    for(const channel of snapshot.channels)backup.ids.add(channel.id)
    const messages={...current.messages}
    for(const channel of backup.ids)delete messages[channel]
    Object.assign(messages,snapshot.messages)
    for(const [channel,list]of Object.entries(older))if(snapshot.messages[channel]&&can(snapshot.policy,snapshot.actor,'READ_MESSAGE_HISTORY',channel))messages[channel]=[...list,...snapshot.messages[channel]]
    for(const channel of snapshot.channels){
      const hadHistory=last?.id===snapshot.id&&(readMask(last.channelPermissions[channel.id]||'0')&Permission.READ_MESSAGE_HISTORY)!==0n
      const history=can(snapshot.policy,snapshot.actor,'READ_MESSAGE_HISTORY',channel.id)
      if(history||hadHistory)recentLive.delete(channel.id)
      if(!history){
        const incoming=(snapshot.liveMessages||[]).filter(message=>message.channelId===channel.id)
        const seen=new Map((recentLive.get(channel.id)||[]).map(message=>[message.id,message]))
        for(const message of incoming)seen.set(message.id,message)
        for(const change of snapshot.messageChanges||[])if(change.channelId===channel.id){if(change.deleted)seen.delete(change.id);else{const message=seen.get(change.id);if(message)seen.set(change.id,applyMessageChange(message,change))}}
        const list=[...seen.values()].slice(-2000)
        recentLive.set(channel.id,list);messages[channel.id]=list
      }
    }
    for(const channel of recentLive.keys())if(!snapshot.channels.some(item=>item.id===channel)&&backup.ids.has(channel))recentLive.delete(channel)
    const servers=[...current.servers.filter(server=>server.id!==snapshot.id),{id:snapshot.id,name:snapshot.name,description:snapshot.description||'',channels:snapshot.channels}]
    const active=snapshot.channels.some(channel=>channel.id===current.activeChannelId)?current.activeChannelId:snapshot.channels[0]?.id||''
    const change=()=>useAppStore.setState({servers,messages,activeChannelId:current.activeServerId===snapshot.id?active:current.activeChannelId})
    if(first||historyOnly)withoutActivity(change);else change()
    last=snapshot
    lastOlder=older
    const voice=useVoiceStore.getState(),channel=voice.activeChannelId
    if(channel&&backup.ids.has(channel)){
      if(!snapshot.channels.some(item=>item.id===channel)||!can(snapshot.policy,snapshot.actor,'CONNECT',channel))void voice.leaveChannel()
      else{
        voice.renameActiveChannel(channel,snapshot.channels.find(item=>item.id===channel)!.name)
        if(!can(snapshot.policy,snapshot.actor,'SPEAK',channel)&&!voice.isMicMuted)void voice.toggleMic()
        if(!can(snapshot.policy,snapshot.actor,'STREAM',channel)){if(voice.isScreenSharing)void voice.toggleScreenShare();if(voice.isCameraOn)void voice.toggleCamera()}
      }
    }
  }
  const stopRoles=useRoleStore.subscribe((state,previous)=>{
    if(state.owner!==previous.owner)restore()
    if(state.status==='error'&&previous.status!=='error'&&state.snapshot){
      const snapshot=state.snapshot,ids=new Set(snapshot.channels.filter(channel=>!can(snapshot.policy,snapshot.actor,'READ_MESSAGE_HISTORY',channel.id)).map(channel=>channel.id))
      for(const id of ids)recentLive.delete(id)
      if(ids.size)withoutActivity(()=>useAppStore.setState({messages:Object.fromEntries(Object.entries(useAppStore.getState().messages).filter(([channel])=>!ids.has(channel)))}))
    }
    if(state.status==='revoked'&&previous.status!=='revoked'&&state.serverId){
      const id=state.serverId,current=useAppStore.getState()
      if(!backups.has(id)){const server=current.servers.find(server=>server.id===id),ids=new Set(server?.channels.map(channel=>channel.id)||[]);backups.set(id,{server,ids,messages:Object.fromEntries(Object.entries(current.messages).filter(([channel])=>ids.has(channel)))})}
      const ids=backups.get(id)!.ids
      const messages=Object.fromEntries(Object.entries(current.messages).filter(([channel])=>!ids.has(channel)))
      for(const channel of ids)recentLive.delete(channel)
      withoutActivity(()=>useAppStore.setState({servers:current.servers.map(server=>server.id===id?{...server,channels:[]}:server),messages,activeChannelId:current.activeServerId===id?'':current.activeChannelId}))
      last=null;lastOlder=null;if(ids.has(useVoiceStore.getState().activeChannelId||''))void useVoiceStore.getState().leaveChannel()
    }
    if(state.connectionVersion!==previous.connectionVersion||(state.configured&&(!previous.configured||state.url!==previous.url)))void useVoiceStore.getState().leaveChannel()
    if(state.snapshot&&state.configured&&state.status==='connected')apply(state.snapshot)
  })
  const stopAuth=useAuthStore.subscribe((state,previous)=>{
    if(state.user?.username===previous.user?.username)return
    restore();void useVoiceStore.getState().leaveChannel()
    void useRoleStore.getState().activate(state.user?.username||null,useAppStore.getState().activeServerId)
  })
  const ready=useRoleStore.getState()
  if(ready.snapshot&&ready.configured&&ready.status==='connected')apply(ready.snapshot)
  void useRoleStore.getState().activate(useAuthStore.getState().user?.username||null,useAppStore.getState().activeServerId)
  const stopServers=useAppStore.subscribe((state,previous)=>{if(state.activeServerId!==previous.activeServerId)void useRoleStore.getState().activate(useAuthStore.getState().user?.username||null,state.activeServerId)})
  return()=>{stopRoles();stopAuth();stopServers();restore();useAppStore.persist.setOptions({partialize:originalPartialize});void useRoleStore.getState().activate(null)}
}
