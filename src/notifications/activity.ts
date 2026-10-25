import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { useNotificationStore, type ActivityNotice } from '../store/useNotificationStore'
import { useFriendStore } from '../store/useFriendStore'
import { usePreferencesStore } from '../store/usePreferencesStore'
import { useVoiceStore } from '../store/useVoiceStore'
import { useRoleStore } from '../store/useRoleStore'
import { eventStatusLabels } from '../roles/events'
import { assignedRoles } from '../roles/permissions'

let suppressed=0
export function withoutActivity<T>(apply:()=>T):T {suppressed++;try{return apply()}finally{suppressed--}}

export function setupActivityNotifications(){
  useNotificationStore.getState().activate(useAuthStore.getState().user?.username||null)
  const present=(notice:ActivityNotice)=>{
    const current=useNotificationStore.getState()
    if(!current.owner||current.entries.some(entry=>entry.id===notice.id))return
    useNotificationStore.getState().push(notice)
    if(notice.read||!usePreferencesStore.getState().systemNotifications)return
    if(window.contalkDesktop?.notifyActivity)window.contalkDesktop.notifyActivity(notice)
    else if(typeof Notification!=='undefined'&&Notification.permission==='granted')new Notification(notice.title,{body:notice.body,tag:notice.channelId||notice.id})
  }
  const auth=useAuthStore.subscribe(state=>useNotificationStore.getState().activate(state.user?.username||null))
  const messages=useAppStore.subscribe((state,previous)=>{
    if(suppressed)return
    const self=useAuthStore.getState().user?.username
    if(!self)return
    for(const [channel,list]of Object.entries(state.messages)){
      if(list===previous.messages[channel])continue
      if(!previous.servers.some(server=>server.channels.some(item=>item.id===channel))&&state.servers.some(server=>server.channels.some(item=>item.id===channel)))continue
      const old=new Set((previous.messages[channel]||[]).map(m=>m.id))
      const channelName=state.servers.flatMap(s=>s.channels).find(c=>c.id===channel)?.name
      for(const message of list){
        if(old.has(message.id)||message.userId===self)continue
        const read=useNotificationStore.getState().visibleChannel===channel&&document.hasFocus()&&!document.hidden
        const direct=channel.startsWith('dm:')
        const policy=useRoleStore.getState().snapshot?.policy
        const ownRoles=new Set(policy?assignedRoles(policy,self).map(role=>role.id):[])
        const mention=usePreferencesStore.getState().roleMentionNotifications!==false&&(!!message.mentionsEveryone||message.roleMentions?.some(id=>ownRoles.has(id))===true)
        const body=message.content.replace(/<@&([\w:-]{1,100})>/g,(token,id:string)=>{const role=policy?.roles.find(role=>role.id===id);return role?'@'+role.name:token})
        const title=direct?message.userName:`#${channelName||'canal'} · ${message.userName}`
        present({id:'message:'+message.id,kind:'message',title:mention?'Você foi mencionado · '+title:title,body:message.once?'Mensagem de visualização única':(message.voice?'Mensagem de voz':body||message.attachment?.name||'Nova mensagem'),channelId:channel,peer:direct?message.userId:undefined,createdAt:Date.now(),read,mention})
      }
    }
  })
  const friends=useFriendStore.subscribe((state,previous)=>{
    for(const [peer,relation] of Object.entries(state.relations)){
      const old=previous.relations[peer]
      if(relation.status==='incoming'&&old?.requestId!==relation.requestId)present({id:'friend:'+relation.requestId,kind:'friendship',title:'Pedido de amizade',body:`${relation.display_name||peer} quer se conectar com você.`,peer,createdAt:Date.now(),read:false})
      if(relation.status==='friend'&&old&&old.status!=='friend')present({id:'friend-accepted:'+relation.requestId,kind:'friendship',title:'Amizade confirmada',body:`Você e ${relation.display_name||peer} agora são amigos.`,peer,createdAt:Date.now(),read:false})
    }
  })
  const voice=useVoiceStore.subscribe((state,previous)=>{
    if(state.connectionStatus!=='connected'||state.activeChannelId!==previous.activeChannelId)return
    for(const person of state.participants){
      if(person.isLocal)continue
      const before=previous.participants.find(p=>p.identity===person.identity)
      if(!before||(!before.isScreenShareEnabled&&person.isScreenShareEnabled))present({id:`voice:${state.activeChannelId}:${person.identity}:${Date.now()}`,kind:person.isScreenShareEnabled?'live':'voice',title:person.isScreenShareEnabled?'Nova transmissão':'Alguém entrou na chamada',body:`${person.name} ${person.isScreenShareEnabled?'está compartilhando a tela':'entrou em '+state.activeChannelName}.`,channelId:state.activeChannelId||undefined,createdAt:Date.now(),read:document.hasFocus()&&!document.hidden})
    }
  })
  const pruneEvents=(state:ReturnType<typeof useRoleStore.getState>)=>{
    const activity=useNotificationStore.getState()
    if(!['connected','revoked'].includes(state.status)||state.owner!==activity.owner)return
    const id=state.snapshot?.id||state.serverId
    if(!id)return
    const visible=new Set(state.status==='connected'?state.snapshot?.events?.map(event=>event.id)||[]:[])
    activity.forgetEvents(id,activity.entries.filter(entry=>entry.serverId===id&&entry.eventId&&!visible.has(entry.eventId)).map(entry=>entry.eventId!))
  }
  pruneEvents(useRoleStore.getState())
  const threads=useRoleStore.subscribe((state,previous)=>{
    pruneEvents(state)
    const before=previous.snapshot,next=state.snapshot
    if(before&&state.owner===previous.owner&&((next&&next.id===before.id)||state.status==='revoked')){
      const visible=new Set(next?.channels.map(channel=>channel.id)||[])
      useNotificationStore.getState().forgetChannels(before.channels.filter(channel=>!visible.has(channel.id)).map(channel=>channel.id))
    }
    if(!before||!next||before.id!==next.id||before.actor!==next.actor||state.status!=='connected')return
    for(const event of next.events||[]){
      const old=before.events?.find(item=>item.id===event.id)
      if(!old||!old.interested||!event.interested||old.status===event.status&&old.updatedAt===event.updatedAt)continue
      present({id:'event:'+next.id+':'+event.id+':'+event.updatedAt+':'+event.status,kind:'event',serverId:next.id,eventId:event.id,...(event.channelId?{channelId:event.channelId}:{}),title:old.status!==event.status?eventStatusLabels[event.status]+' · '+event.name:'Evento atualizado',body:event.name+' · '+new Date(event.startsAt).toLocaleString('pt-BR'),createdAt:Date.now(),read:false})
    }
    for(const [id,thread]of Object.entries(next.policy.threads||{}))if(thread.ownerId!==next.actor&&thread.members.includes(next.actor)&&!before.policy.threads?.[id]?.members.includes(next.actor)){
      const channel=next.channels.find(channel=>channel.id===id)
      if(channel)present({id:'thread:'+id+':'+next.revision,kind:'thread',title:'Você foi adicionado a um tópico',body:channel.name,channelId:id,createdAt:Date.now(),read:useNotificationStore.getState().visibleChannel===id&&document.hasFocus()&&!document.hidden})
    }
  })
  const focus=()=>{const activity=useNotificationStore.getState();if(activity.visibleChannel&&document.hasFocus()&&!document.hidden)activity.markChannelRead(activity.visibleChannel)}
  window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus)
  return()=>{auth();messages();friends();voice();threads();window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus)}
}
