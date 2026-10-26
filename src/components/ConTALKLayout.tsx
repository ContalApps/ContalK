import { CommunityEvents } from './CommunityEvents'
import { ThreadCreate } from './ThreadCreate'
import { ThreadList } from './ThreadList'
import { ThreadHeader } from './ThreadHeader'
import { AiProjectCreate } from './AiProjectCreate'
import { useAiEvents } from '../roles/useAiEvents'
import { parseAiModel } from '../roles/ai'
import { threadArchived } from '../roles/permissions'
import { PinnedMessages } from './PinnedMessages'
import { ChatComposer, ChatMessage } from './MessageContent'
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { useVoiceStore } from '../store/useVoiceStore'
import { VoiceStage } from './VoiceStage'
import { AudioSettings } from './AudioSettings'
import { HomeView } from './HomeView'
import { TitleBar } from './TitleBar'
import { visit, step, type NavigationHistory, type Route } from '../navigation/history'
import { Avatar } from './Avatar'
import { EditProfile } from './EditProfile'
import { CreateChannel } from './CreateChannel'
import { ParticipantMenu } from './ParticipantMenu'
import { useCommunityStore } from '../store/useCommunityStore'
import { useFriendStore } from '../store/useFriendStore'
import { friendPeople, directPeople } from '../social/people'
import { FriendButton } from './FriendButton'
import type { VoiceParticipant } from '../store/useVoiceStore'
import type { Channel } from '../store/useAppStore'
import { usePreferencesStore } from '../store/usePreferencesStore'
import { CoastalScene } from './CoastalScene'
import { SettingsView } from './SettingsView'
import { ChannelRow } from './ChannelRow'
import { BrandMark } from './BrandMark'
import { ControlIcon } from './ControlIcon'
import { UserDock } from './UserDock'
import { ChannelSettings } from './ChannelSettings'
import { RoleManager, RoleBadge } from './RoleManager'
import { canSetNickname, memberDisplayName } from '../roles/nicknames'
import { RoleName } from './RoleName'
import { MemberRoles } from './MemberRoles'
import { InviteJoinDialog } from './InviteJoin'
import { useRoleStore } from '../store/useRoleStore'
import { centralAllows } from '../roles/transport'
import { assignedRoles } from '../roles/permissions'
import { useNotificationStore } from '../store/useNotificationStore'
import '../themes.css'
import '../ai.css'

const iconPaths: Record<string, string> = {
  plus: 'M12 5v14M5 12h14',
  home: 'm3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9',
  chat: 'M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5ZM8 10h.01M12 10h.01M16 10h.01',
  friends: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  search: 'm21 21-4.5-4.5M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  voice: 'M4 10v4M8 6v12M12 3v18M16 6v12M20 10v4',
  arrow: 'M7 17 17 7M7 7h10v10',
  mic: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8',
  headphones: 'M3 14v-3a9 9 0 0 1 18 0v3M3 13h4v8H3zM17 13h4v8h-4z',
  settings: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
  close: 'm6 6 12 12M6 18 18 6',
  send: 'm3 3 18 9-18 9 4-9-4-9ZM7 12h14',
  '#': 'M4 8h16M3 16h16M10 3 7 21M17 3l-3 18',
}
function Icon({ name }: { name: string }) {
  const path = iconPaths[name === 'members' ? 'friends' : name === 'Ω' ? 'headphones' : name === '×' ? 'close' : name]
  return path ? <svg className="ct-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path}/></svg> : <span className="ct-icon" aria-hidden="true">{name}</span>
}
function Nightscape() {
  return <svg className="ct-nightscape" viewBox="0 0 1000 280" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="night"><stop stopColor="#10101c"/><stop offset="1" stopColor="#402078"/></linearGradient><radialGradient id="moon"><stop stopColor="#eee3ff"/><stop offset="1" stopColor="#a678ed"/></radialGradient></defs><path fill="url(#night)" d="M0 0h1000v280H0z"/>{Array.from({length:35},(_,i)=><circle key={i} cx={(i*137)%1000} cy={(i*43)%175} r={i%3===0?1.5:.7} fill="#c8b5ff" opacity=".6"/>)}<circle cx="815" cy="78" r="49" fill="#a779ff" opacity=".12"/><circle cx="815" cy="78" r="37" fill="url(#moon)"/><path d="m0 220 130-95 65 65 115-120 160 170 100-130 115 88 100-40 125 65 90-90v147H0" fill="#171127"/><path d="m0 260 110-45 110 35 150-90 130 75 120-55 180 70 200-70v100H0" fill="#0d0e18"/>{[690,730,925,965,990,620].map((x,i)=><g key={x} fill="#090b12"><path d={`M${x} ${70+i*16}l-28 65h15l-28 48h24l-30 50h94l-30-50h24l-28-48h15z`}/><path d={`M${x-3} 150h6v130h-6z`}/></g>)}<path d="m797 80-25-15 7 22-12 11 28-2 12 13 10-15 28-6-15-8 1-23-20 24-6-8z" fill="#160b2c"/></svg>
}
function Atmosphere() { const theme=usePreferencesStore(s=>s.theme); return theme==='vice-city'?<CoastalScene/>:<Nightscape/> }
export function ConTALKLayout() {
  const { user, logout } = useAuthStore()
  const preferences=usePreferencesStore()
  const activity=useNotificationStore()
  useLayoutEffect(()=>{
    const desktop=window.contalkDesktop
    if(desktop?.setInterfaceScale){desktop.setInterfaceScale(preferences.interfaceScale);return}
    const root=document.documentElement
    root.style.zoom=String(preferences.interfaceScale/100)
    root.style.setProperty('--ct-interface-scale',String(preferences.interfaceScale/100))
  },[preferences.interfaceScale])
  useLayoutEffect(()=>()=>{window.contalkDesktop?.setInterfaceScale?.(100);const root=document.documentElement;root.style.removeProperty('zoom');root.style.removeProperty('--ct-interface-scale')},[])
  useLayoutEffect(()=>{usePreferencesStore.getState().activate(user?.username||null)},[user?.username])
  const [settingsOpen,setSettingsOpen]=useState(false)
  const [eventsOpen,setEventsOpen]=useState(false),[eventTarget,setEventTarget]=useState<string|undefined>()
  const [rolesOpen,setRolesOpen]=useState(false)
  const [joinOpen,setJoinOpen]=useState(false)
  const [settingsTab,setSettingsTab]=useState<'appearance'|'community'|'ai'>('appearance')
  const [nicknameFirst,setNicknameFirst]=useState(false)
  const [memberRoles,setMemberRoles]=useState<string|null>(null)
  const roles=useRoleStore()
  const [threadCreate,setThreadCreate]=useState<string|null>(null),[threadList,setThreadList]=useState<string|null>(null)
  const [projectCreate,setProjectCreate]=useState<string|null>(null)
  const [pinnedChannel,setPinnedChannel]=useState<string|null>(null)
  const [channelSettings,setChannelSettings]=useState<Channel|null>(null)
  const { servers, activeServerId, activeChannelId, setActiveServer, setActiveChannel, messages } = useAppStore()
  const voice = useVoiceStore()
  const [navigation, setNavigation] = useState<NavigationHistory>(() => ({entries: [{view:'home', serverId:activeServerId, channelId:activeChannelId, peer:null}], index:0}))
  const { view, peer: selectedPeer } = navigation.entries[navigation.index]
  const setView = (nextView: Route['view'], peer = selectedPeer) => {
    const state = useAppStore.getState()
    setNavigation(current => visit(current, {view:nextView, peer, serverId:state.activeServerId, channelId:state.activeChannelId}))
  }
  const travel = (direction: -1 | 1) => {
    const next = step(navigation, direction)
    if (next === navigation) return
    const route = next.entries[next.index]
    const destination = servers.find(s => s.id === route.serverId) || servers[0]
    if (destination) {
      setActiveServer(destination.id)
      setActiveChannel(destination.channels.find(c => c.id === route.channelId)?.id || destination.channels[0]?.id || '')
    }
    setNavigation(next)
  }
  const [audioSettings,setAudioSettings]=useState<'input'|'output'|null>(null)
  const openConversation=(username:string)=>setView('messages',username)
  const [search, setSearch] = useState('')
  const [profile, setProfileName] = useState<string | null>(null)
  const [profileIdentity, setProfileIdentity] = useState<string | null>(null)
  const community = useCommunityStore()
  const relations = useFriendStore(s=>s.relations)
  const friends = friendPeople(community.members, relations, user?.username || '')
  const directContacts = directPeople(community.members, friends, messages, user?.username || '', selectedPeer)
  const globalName=(identity:string|undefined,fallback:string)=>community.members.find(member=>member.username===identity)?.display_name||(user&&identity===user.username?user.display_name:undefined)||voice.participants.find(person=>person.identity===identity)?.name||relations[identity||'']?.display_name||fallback
  const setProfile = (name: string | null, identity?: string) => {
    setProfileName(name===null?null:globalName(identity,name))
    setProfileIdentity(identity || community.members.find(m=>m.display_name===name)?.username || voice.participants.find(p=>p.name===name)?.identity || (name===user?.display_name?user.username:null))
  }
  const [editProfile,setEditProfile] = useState(false)
  const [createType,setCreateType] = useState<'text'|'voice'|null>(null)
  const [context,setContext] = useState<{participant:VoiceParticipant;x:number;y:number}|null>(null)
  useEffect(()=>{if(user)void useCommunityStore.getState().connect(user);return()=>useCommunityStore.getState().disconnect()},[user?.username,roles.configured,roles.url,roles.connectionVersion])
  const end = useRef<HTMLDivElement>(null)
  const server = servers.find(s => s.id === activeServerId) || servers[0]
  const channel = server.channels.find(c => c.id === activeChannelId) || server.channels[0] || {id:'',name:'',type:'text' as const,serverId:server.id}
  const project=roles.snapshot?.id===server.id?roles.snapshot.policy.projects?.[channel.id]:undefined
  const aiModel=project?.model||server.channels.find(item=>item.id===(project?.parentId||channel.id))?.aiModel||''
  const aiParsed=parseAiModel(aiModel)
  const aiEnabled=!!aiModel&&channel.type==='text'&&roles.snapshot?.id===server.id
  const aiEvents=useAiEvents(server.id,channel.id,aiEnabled)
  const [aiActionError,setAiActionError]=useState('')
  const activeAi=(messages[channel.id]||[]).find(message=>message.ai?.status==='running')
  const canStopAi=!!activeAi&&(activeAi.ai?.actor===user?.username||project?.members[user?.username||'']==='manager'||!project&&centralAllows('MANAGE_CHANNELS',channel.id))
  const recent = Object.values(messages).flat().sort((a,b)=>b.timestamp-a.timestamp)
  const statusText=(identity:string)=>community.members.some(m=>m.username===identity&&m.online)?'Online':community.status==='online'?'Offline':'Presença indisponível'
  const serverName=(identity:string,fallback:string)=>memberDisplayName(roles.snapshot,view==='server'?server.id:undefined,identity,fallback)
  const matchesSearch=(m:{display_name:string;username:string})=>(serverName(m.username,m.display_name)+' '+m.display_name+' '+m.username).toLowerCase().includes(search.toLowerCase())
  const visibleMembers = community.members.filter(matchesSearch)
  const visibleFriends = friends.filter(matchesSearch)
  const visibleContacts = directContacts.filter(matchesSearch)
  const activityMembers = view==='server'?(roles.snapshot?.id===server.id?visibleMembers.filter(member=>roles.snapshot!.policy.members.includes(member.username)):visibleMembers):visibleFriends
  const groupRole=(identity:string)=>view==='server'&&roles.snapshot?.id===server.id?assignedRoles(roles.snapshot.policy,identity).filter(role=>role.hoist).sort((a,b)=>b.position-a.position)[0]:undefined
  const groupedMembers=[...activityMembers].sort((a,b)=>(groupRole(b.username)?.position||0)-(groupRole(a.username)?.position||0)||serverName(a.username,a.display_name).localeCompare(serverName(b.username,b.display_name),'pt-BR'))
  const profileMember=community.members.find(m=>m.username===profileIdentity)
  const isOwnProfile=profileIdentity===user?.username
  const voiceChannels = server.channels.filter(c=>c.type==='voice')
  const liveIdentities=new Set([...voice.participants,...Object.values(voice.channelOccupants).flat()].filter(person=>person.isScreenShareEnabled).map(person=>person.identity))
  const voiceKey = voiceChannels.map(c=>c.id).join(',')
  useEffect(()=>{ voice.fetchChannelOccupants(voiceChannels); const timer=setInterval(()=>voice.fetchChannelOccupants(voiceChannels),4000); return ()=>clearInterval(timer) },[voiceKey, voice.fetchChannelOccupants])
  const lastReadPosition=useRef({channel:'',tail:'',view:''})
  useEffect(()=>{const tail=messages[activeChannelId]?.slice(-1)[0]?.id||'';if(lastReadPosition.current.view!==view||lastReadPosition.current.channel!==activeChannelId||lastReadPosition.current.tail!==tail)end.current?.scrollIntoView({behavior:lastReadPosition.current.channel===activeChannelId?'smooth':'instant'});lastReadPosition.current={channel:activeChannelId,tail,view}},[activeChannelId,messages,view])
  useEffect(()=>{if(!profile)return; const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setProfile(null)}; window.addEventListener('keydown',close); return ()=>window.removeEventListener('keydown',close)},[profile])
  const openChannel=(id:string)=>{setActiveChannel(id);setView('server')}
  useEffect(()=>{activity.activate(user?.username||null)},[user?.username])
  useEffect(()=>{activity.setVisibleChannel(view==='server'&&channel.type==='text'?channel.id:view==='messages'&&selectedPeer?'dm:'+[user?.username,selectedPeer].sort().join(':'):null);return()=>useNotificationStore.getState().setVisibleChannel(null)},[view,channel.id,selectedPeer,user?.username])
  const openNotice=(id:string)=>{
    const notice=useNotificationStore.getState().entries.find(entry=>entry.id===id)
    if(!notice)return
    useNotificationStore.getState().markRead(id)
    setSettingsOpen(false);setChannelSettings(null);setProfile(null)
    if(notice.kind==='event'&&notice.serverId){setActiveServer(notice.serverId);setView('server');setEventTarget(notice.eventId);setEventsOpen(true);return}
    if(notice.kind==='friendship'){setView('friends');return}
    if(notice.peer){openConversation(notice.peer);return}
    const destination=servers.find(server=>server.channels.some(channel=>channel.id===notice.channelId))
    if(destination&&notice.channelId){setActiveServer(destination.id);openChannel(notice.channelId)}
  }
  useEffect(()=>window.contalkDesktop?.onNotificationOpen?.(openNotice),[servers,navigation])
  const join=async(id:string,name:string)=>{openChannel(id);if(user)await voice.joinChannel(id,name,{username:user.username,display_name:user.display_name,avatar:user.avatar})}
  const hour=new Date().getHours(); const greeting=hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite'
  return <div className="ct-app" data-theme={preferences.theme} data-reduced-motion={preferences.reducedMotion} data-text-size={preferences.textSize} onContextMenu={event=>{
      if(event.defaultPrevented)return
      const target=(event.target as Element).closest<HTMLElement>('[data-profile-identity]')
      const identity=target?.dataset.profileIdentity
      if(!identity)return
      event.preventDefault()
      const person=voice.participants.find(p=>p.identity===identity)
      setContext({participant:person||{identity,name:globalName(identity,target.dataset.profileName||identity),serverNickname:view==='server'&&roles.snapshot?.id===server.id?roles.snapshot.nicknames?.[identity]:undefined,isLocal:identity===user?.username,isSpeaking:false,isAudioEnabled:true,isVideoEnabled:false,isScreenShareEnabled:false},x:event.clientX,y:event.clientY})
    }}>
    <TitleBar onOpenNotification={openNotice} authenticated disabled={settingsOpen} title={view==='server'?server.name+' · '+(channel.name||'Canais'):view==='friends'?'Amigos':view==='messages'?(selectedPeer?'Mensagens · '+(community.members.find(m=>m.username===selectedPeer)?.display_name||selectedPeer):'Mensagens diretas'):'ConTALK'} canBack={navigation.index>0} canForward={navigation.index<navigation.entries.length-1} onBack={()=>travel(-1)} onForward={()=>travel(1)} search={search} onSearch={setSearch}/>
    <div className="ct-body" inert={settingsOpen}><aside className="ct-rail"><button className={view==='home'?'selected':''} title="Início" onClick={()=>setView('home')}><Icon name="home"/></button><button className={view==='messages'?'selected':''} title="Mensagens diretas" onClick={()=>setView('messages')}><Icon name="chat"/></button><hr/>{servers.map(s=><button key={s.id} title={s.name} className={view==='server'&&s.id===server.id?'selected ct-server-logo':'ct-server-logo'} onClick={()=>{setActiveServer(s.id);setActiveChannel(s.channels[0]?.id || '');setView('server')}}><BrandMark/></button>)}<button title="Entrar em um servidor" aria-label="Entrar em um servidor" onClick={()=>setJoinOpen(true)}><Icon name="plus"/></button><div className="ct-rail-bottom"><button title="Meu perfil" onClick={()=>setProfile(user?.display_name||'Você',user?.username)}><Avatar name={user?.display_name||'Você'}/></button></div></aside>
    <>
    <nav className="ct-sidebar" data-collapsed={preferences.sidebarCollapsed}><button className="ct-sidebar-toggle" aria-label={preferences.sidebarCollapsed?'Expandir lista de canais':'Recolher lista de canais'} title={preferences.sidebarCollapsed?'Expandir canais':'Recolher canais'} onClick={()=>preferences.update({sidebarCollapsed:!preferences.sidebarCollapsed})}><ControlIcon name="chevron"/><span>Canais e conversas</span></button><div className="ct-sidebar-scroll">{view!=='server'?<><div className="ct-side-nav"><button className={view==='home'?'active':''} onClick={()=>setView('home')}><Icon name="home"/>Início <span className="ct-nav-dot"/></button><button className={view==='friends'?'active':''} onClick={()=>setView('friends')}><Icon name="friends"/>Amigos</button></div><div className="ct-section-label">MENSAGENS DIRETAS <button title="Abrir mensagens" onClick={()=>setView('messages')}>+</button></div><div className="ct-people">{visibleContacts.map(m=><button className="ct-person" data-profile-identity={m.username} data-profile-name={m.display_name} key={m.username} onClick={()=>openConversation(m.username)}><Avatar name={m.display_name} identity={m.username} live={voice.participants.some(p=>p.identity===m.username&&p.isScreenShareEnabled)||Object.values(voice.channelOccupants).some(list=>list.some(p=>p.identity===m.username&&p.isScreenShareEnabled))}/><span><strong><RoleName identity={m.username} name={m.display_name}/></strong><small>{statusText(m.username)}</small></span></button>)}{!visibleContacts.length&&<p className="ct-friend-hint">Suas amizades e conversas aparecerão aqui.</p>}</div><div className="ct-sidebar-note"><img src="./contalk-avatar.png" alt=""/><strong>Seu lugar para se conectar.</strong><p>Junte os amigos. Entre na conversa.</p></div></>:<><div className="ct-server-banner">{roles.snapshot?.id===server.id&&<button className="ct-server-events" title="Eventos do servidor" aria-label="Eventos do servidor" onClick={()=>{setEventTarget(undefined);setEventsOpen(true)}}><ControlIcon name="event"/></button>}<strong title={server.description||server.name}>{server.name}</strong>{(!roles.snapshot||centralAllows('VIEW_GUILD_INSIGHTS')||centralAllows('MANAGE_GUILD')||centralAllows('MANAGE_ROLES')||centralAllows('BAN_MEMBERS')||!!roles.snapshot.invites?.length||roles.snapshot.channels.some(item=>centralAllows('CREATE_INSTANT_INVITE',item.id)))&&<button className="ct-server-role-settings" title="Configurações do servidor" aria-label="Configurações do servidor" onClick={()=>setRolesOpen(true)}><ControlIcon name="settings"/></button>}<small><i className="ct-online-dot"/> {community.status==='online'?community.members.filter(m=>m.online).length+' online':'Presença indisponível'}</small></div><div className="ct-section-label">CANAIS DE TEXTO <button title="Criar canal de texto" onClick={()=>setCreateType('text')}>+</button></div>{server.channels.filter(c=>c.type==='text'&&!c.parentId).map(c=><Fragment key={c.id}><ChannelRow unread={activity.unreadByChannel[c.id]||0} channel={c} active={channel.id===c.id} onOpen={()=>openChannel(c.id)} onSettings={()=>setChannelSettings(c)}/>{server.channels.filter(child=>child.parentId===c.id&&(child.id===channel.id||roles.snapshot?.policy.projects?.[child.id]||roles.snapshot?.policy.threads?.[child.id]&&!threadArchived(roles.snapshot.policy.threads[child.id],roles.snapshot.serverNow))).map(child=><div className="ct-thread-sidebar" key={child.id}><ChannelRow unread={activity.unreadByChannel[child.id]||0} channel={child} active={channel.id===child.id} onOpen={()=>openChannel(child.id)} onSettings={()=>setChannelSettings(child)}/></div>)}</Fragment>)}<div className="ct-section-label">CANAIS DE VOZ <button title="Criar canal de voz" onClick={()=>setCreateType('voice')}>+</button></div>{voiceChannels.map(c=><div className={`ct-voice-group ${voice.activeChannelId===c.id?'connected':''}`} key={c.id}><ChannelRow channel={c} active={channel.id===c.id} connected={voice.activeChannelId===c.id} count={voice.channelOccupants[c.id]?.length} onOpen={()=>void join(c.id,c.name)} onSettings={()=>setChannelSettings(c)}/><div className="ct-channel-occupants">{(voice.activeChannelId===c.id?voice.participants:voice.channelOccupants[c.id]||[]).map(p=><button className="ct-occupant" title={p.name} key={p.identity} onClick={()=>setProfile(p.name,p.identity)} onContextMenu={e=>{e.preventDefault();setContext({participant:p,x:e.clientX,y:e.clientY})}}><Avatar name={p.name} identity={p.identity} live={p.isScreenShareEnabled}/><span className="ct-occupant-name"><RoleName serverId={server.id} identity={p.identity} name={p.name}/></span><span className="ct-occupant-status">{p.isPrioritySpeaker&&<span className="ct-priority-indicator" role="img" aria-label="Prioridade de fala ativa" title="Prioridade de fala ativa"><ControlIcon name="priority"/></span>}{p.isScreenShareEnabled?<span className="ct-live-badge">LIVE</span>:<ControlIcon name="mic" slashed={!p.isAudioEnabled}/>}</span></button>)}</div></div>)}</>}
    </div><UserDock onProfile={()=>setProfile(user?.display_name||'Você',user?.username)} onOpenChannel={openChannel}/></nav>
    <main className="ct-main">{roles.configured&&roles.error&&<div className="ct-mic-alert" role="status">{roles.error}</div>}{(voice.profileError||community.profileError)&&<div className="ct-mic-alert" role="status">{voice.profileError||community.profileError}</div>}{voice.microphoneError&&<div className="ct-mic-alert" role="alert"><span>{voice.microphoneError}</span><button onClick={()=>setAudioSettings('input')}>Escolher microfone</button></div>}{view==='friends'||view==='messages'?<HomeView key={view} mode={view} searchQuery={search} selected={selectedPeer} onConversation={openConversation} onProfile={setProfile}/>:view==='home'?<div className="ct-dashboard"><section className="ct-hero"><Atmosphere/><div className="ct-hero-copy"><span className="ct-eyebrow">SEU PONTO DE ENCONTRO</span><h1>{greeting}, <em>{user?.display_name || 'amigo'}!</em></h1><p>Boas conversas tornam os dias mais leves.</p></div><div className="ct-quick"><button onClick={()=>setView('messages')}><span className="ct-action-icon"><Icon name="chat"/></span><span><strong>Iniciar conversa</strong><small>Chamar um amigo</small></span><Icon name="arrow"/></button><button onClick={()=>{if(voiceChannels[0])join(voiceChannels[0].id,voiceChannels[0].name)}}><span className="ct-action-icon"><Icon name="headphones"/></span><span><strong>Entrar em voz</strong><small>Encontre sua turma</small></span><Icon name="arrow"/></button></div></section>
    <div className="ct-heading"><h2>Canais de voz</h2><button className="ct-secondary" onClick={()=>setCreateType('voice')}>+ Criar canal</button><span className="ct-muted">Uma boa conversa está a um clique</span></div><div className="ct-voice-cards">{voiceChannels.map((c,i)=>{const occupants=voice.activeChannelId===c.id?voice.participants:voice.channelOccupants[c.id]||[];return <article className="ct-card ct-voice-card" key={c.id}><div className="ct-card-title"><span className={`ct-room-icon room-${i}`}><Icon name="voice"/></span><div><h3>{c.name}</h3><small>{server.name}</small></div></div><div className="ct-voice-bottom"><div>{occupants.length?<><div className="ct-avatar-stack">{occupants.slice(0,3).map(p=><Avatar key={p.identity} name={p.name}/>)}</div><small className="ct-voice-status">● {occupants.length} em voz</small></>:<small className="ct-muted">Seja o primeiro a entrar</small>}</div><button className={i===0?'ct-primary':'ct-secondary'} onClick={()=>join(c.id,c.name)}>{voice.activeChannelId===c.id&&voice.connectionStatus==='connected'?'Abrir':'Entrar'}</button></div></article>})}</div>
    <div className="ct-dashboard-lower"><section className="ct-card ct-recent"><div className="ct-heading"><h2>Conversas recentes</h2><Icon name="chat"/></div>{recent.filter(m=>(m.content+' '+m.userName).toLowerCase().includes(search.toLowerCase())).slice(0,5).map(m=><button key={m.id} className="ct-recent-row" onClick={()=>openChannel(m.channelId)}><Avatar name={m.userName} identity={m.userId}/><span><strong>{m.userName}</strong><small>{m.once?'Mensagem de visualização única':m.content||m.attachment?.name}</small></span>{m.webhook&&<small className="ct-integration-badge">Integração</small>}<time>{new Date(m.timestamp).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time></button>)}</section><div className="ct-lower-right"><section className="ct-card"><div className="ct-heading"><h2>Suas comunidades</h2><span className="ct-pill">{servers.length}</span></div><div className="ct-community-grid">{servers.map(s=><button key={s.id} onClick={()=>{setActiveServer(s.id);openChannel(s.channels[0]?.id || '')}}><img src="./contalk-logo.png" alt=""/><strong>{s.name}</strong><small><i className="ct-online-dot"/> {s.channels.length} canais</small></button>)}</div></section><section className="ct-card ct-welcome"><span className="ct-eyebrow">FEITO PARA ESTAR JUNTO</span><h2>A próxima conversa<br/>pode ser a melhor do dia.</h2><p>Um espaço para jogar, compartilhar ideias e ficar perto de quem importa.</p><button onClick={()=>setView('friends')}>Encontre seus amigos <Icon name="arrow"/></button><img src="./contalk-avatar.png" alt="Morceguinho ConTALK"/></section></div></div><footer className="ct-dashboard-footer"><img src="./contalk-avatar.png" alt=""/> ConTALK <span>Conecte-se. Converse. Fique à vontade.</span></footer></div>:!channel.id?<section className="ct-empty-channels"><span className="ct-eyebrow">UM NOVO COMEÇO</span><h1>Nenhum canal por aqui ainda</h1><p>Crie um canal de texto ou voz para começar.</p><div><button className="ct-primary" onClick={()=>setCreateType('text')}>Criar canal de texto</button><button className="ct-secondary" onClick={()=>setCreateType('voice')}>Criar canal de voz</button></div></section>:<><header className="ct-channel-header"><div>{channel.type==='voice'?<span className="ct-channel-type"><ControlIcon name="mic"/></span>:<Icon name="#"/>}<span><h2>{channel.name}</h2><small title={channel.type==='voice'?channel.voiceStatus||undefined:undefined}>{channel.type==='voice'?(channel.voiceStatus||'Seu espaço para conversar e transmitir conteúdos'):'Compartilhe ideias e boas conversas com a comunidade.'}</small></span></div><div className="ct-channel-header-actions">{aiEnabled&&<button aria-label="Configurar minha IA" title="Configurar minha IA" onClick={()=>{setSettingsTab('ai');setSettingsOpen(true)}}>✧</button>}{channel.type==='text'&&!channel.parentId&&!!channel.aiModel&&roles.snapshot?.id===server.id&&centralAllows('CREATE_PRIVATE_THREADS',channel.id)&&<button aria-label="Criar projeto de IA" title="Criar projeto privado" onClick={()=>setProjectCreate(channel.id)}><Icon name="plus"/></button>}{channel.type==='text'&&roles.snapshot?.id===server.id&&<button aria-label="Tópicos do canal" title="Tópicos do canal" onClick={()=>setThreadList(channel.parentId||channel.id)}><ControlIcon name="thread"/></button>}{channel.type==='text'&&roles.snapshot?.id===server.id&&centralAllows('READ_MESSAGE_HISTORY',channel.id)&&<button aria-label="Mensagens fixadas" title="Mensagens fixadas" onClick={()=>setPinnedChannel(channel.id)}><ControlIcon name="pin"/></button>}<button className="ct-channel-header-settings" aria-label={`Configurações de ${channel.name}`} title="Configurações do canal" onClick={()=>setChannelSettings(channel)}><Icon name="settings"/></button><button className="ct-secondary" onClick={()=>preferences.update({membersCollapsed:!preferences.membersCollapsed})} aria-expanded={!preferences.membersCollapsed} title="Recolher ou expandir membros"><Icon name="members"/></button></div></header>{channel.type==='voice'?<div className="ct-stage"><VoiceStage onProfile={person=>setProfile(person.name,person.identity)} onParticipantMenu={(participant,event)=>setContext({participant,x:event.clientX,y:event.clientY})} showMemberList={!preferences.membersCollapsed} onToggleMemberList={()=>preferences.update({membersCollapsed:!preferences.membersCollapsed})}/></div>:<><>{channel.parentId&&(channel.project?<div className="ct-thread-header"><button onClick={()=>openChannel(channel.parentId!)}>← Canal principal</button><span>Projeto privado · {project?.members[roles.snapshot?.actor||'']||'leitor'}{project?.archived?' · Arquivado':''}</span></div>:<ThreadHeader id={channel.id} onParent={()=>openChannel(channel.parentId!)}/>)}<div className="ct-messages"><div className="ct-chat-welcome"><span>#</span><h1>Este é o #{channel.name}</h1><p>O começo de muitas boas conversas.</p></div><div className="ct-date-divider">HOJE</div>{(roles.historyMore[channel.id]??roles.snapshot?.hasOlder?.[channel.id])&&<button className="ct-history-more" disabled={roles.historyBusy} onClick={()=>void roles.loadHistory(channel.id).catch(()=>{})}>{roles.historyBusy?'Carregando…':'Carregar mensagens anteriores'}</button>}{(messages[channel.id]||[]).filter(m=>m.content.toLowerCase().includes(search.toLowerCase())||serverName(m.userId,m.userName).toLowerCase().includes(search.toLowerCase())).map(m=><article className="ct-message" data-message-id={m.id} key={m.id}><button disabled={!!m.webhook} data-profile-identity={m.webhook?undefined:m.userId} data-profile-name={m.userName} onClick={()=>setProfile(m.userName,m.userId)}><Avatar name={m.userName} identity={m.userId}/></button><div><header><button disabled={!!m.webhook} data-profile-identity={m.webhook?undefined:m.userId} data-profile-name={m.userName} onClick={()=>setProfile(m.userName,m.userId)}><RoleName serverId={server.id} identity={m.userId} name={m.userName}/></button>{m.webhook&&<small className="ct-integration-badge">Integração</small>}<time>{new Date(m.timestamp).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time></header><ChatMessage message={m} onOpenChannel={openChannel} aiPartial={m.ai?aiEvents.partials[m.ai.id]:undefined} onAiCancel={m.ai?.status==='queued'&&(m.ai.actor===user?.username||project?.members[user?.username||'']==='manager'||!project&&centralAllows('MANAGE_CHANNELS',channel.id))?async()=>{if(!window.contalkDesktop)throw new Error('Abra no aplicativo desktop.');await window.contalkDesktop.communityAiStop(server.id,channel.id,m.ai!.id)}:undefined} onAiRetry={m.ai?.promptId&&!m.ai.files?.length&&aiEnabled&&centralAllows('SEND_MESSAGES',channel.id)?async()=>{const original=(messages[channel.id]||[]).find(item=>item.id===m.ai?.promptId);if(!original)throw new Error('Carregue a mensagem original no histórico para tentar novamente.');if(!window.contalkDesktop)throw new Error('Abra no aplicativo desktop.');await window.contalkDesktop.communityAiStart(server.id,channel.id,original.content,[],undefined,aiParsed?.provider)}:undefined}/></div></article>)}<div ref={end}/></div>{aiEnabled&&activeAi&&<div className="ct-ai-run-bar"><span>IA respondendo em {aiParsed?.model||aiModel}</span>{canStopAi&&<button aria-label="Interromper resposta da IA" onClick={()=>{setAiActionError('');void window.contalkDesktop?.communityAiStop(server.id,channel.id).catch(error=>setAiActionError(error.message))}}>Interromper</button>}</div>}{aiEvents.streamError&&<small role="status">{aiEvents.streamError}</small>}{aiActionError&&<small role="alert">{aiActionError}</small>}<ChatComposer channelId={channel.id} disabled={!centralAllows('SEND_MESSAGES',channel.id)} key={channel.id} placeholder={`Conversar em #${channel.name}`} onSend={(text,attachment,options)=>community.sendMessage(channel.id,text,undefined,attachment,options)} ai={aiEnabled?{model:aiParsed?.model||aiModel,active:!!activeAi,onPrompt:async(text,fileIds,limits)=>{if(!window.contalkDesktop)throw new Error('Abra no aplicativo desktop.');await window.contalkDesktop.communityAiStart(server.id,channel.id,text,fileIds,limits,aiParsed?.provider)}}:undefined}/></></>}</> }</main>
    <aside className="ct-activity" data-collapsed={preferences.membersCollapsed}><button className="ct-members-toggle" aria-label={preferences.membersCollapsed?'Expandir lista de membros':'Recolher lista de membros'} title={preferences.membersCollapsed?'Expandir membros':'Recolher membros'} onClick={()=>preferences.update({membersCollapsed:!preferences.membersCollapsed})}><ControlIcon name="chevron"/></button><div className="ct-heading"><h2>{view==='server'?'Membros':'Seus amigos'}</h2><span className="ct-online-dot"/></div><div className="ct-section-label">{community.status==='online'?(view==='server'?'MEMBROS':'AMIGOS'):'PRESENÇA INDISPONÍVEL'} — {activityMembers.length}</div>{groupedMembers.map((m,index)=><Fragment key={m.username}>{groupRole(m.username)&&groupRole(m.username)?.id!==groupRole(groupedMembers[index-1]?.username||'')?.id&&<div className="ct-section-label ct-role-group-label">{groupRole(m.username)?.name}</div>}<button className="ct-person ct-activity-person" data-profile-identity={m.username} data-profile-name={m.display_name} title={serverName(m.username,m.display_name)} key={m.username} onClick={()=>setProfile(m.display_name,m.username)}><Avatar name={m.display_name} identity={m.username} live={liveIdentities.has(m.username)}/><span><strong><RoleName serverId={view==='server'?server.id:undefined} identity={m.username} name={m.display_name}/></strong><small className={voice.participants.some(p=>p.identity===m.username&&p.isScreenShareEnabled)?'ct-member-live':''}>{voice.participants.some(p=>p.identity===m.username&&p.isScreenShareEnabled)?'Ao vivo na '+voice.activeChannelName:statusText(m.username)}</small></span><i className={m.online?"ct-online-dot":"ct-offline-dot"}/></button></Fragment>)}{!activityMembers.length&&<p className="ct-muted">{view==='server'?'Nenhuma pessoa encontrada.':'Adicione alguém da call ou do servidor para aparecer aqui.'}</p>}{view!=='server'&&<button className="ct-secondary" onClick={()=>setView('friends')}>Abrir amigos</button>}</aside>
    </></div>
    {settingsOpen&&<SettingsView initialTab={settingsTab} onClose={()=>setSettingsOpen(false)} onEditProfile={()=>setEditProfile(true)}/>}
    {memberRoles&&<MemberRoles member={memberRoles} initialSection={nicknameFirst?'nickname':undefined} onClose={()=>setMemberRoles(null)}/>}
    {joinOpen&&<InviteJoinDialog onClose={()=>setJoinOpen(false)} onConfigure={()=>{setJoinOpen(false);setSettingsTab('community');setSettingsOpen(true)}} onJoined={()=>{setJoinOpen(false);setView('server')}}/>}
    {eventsOpen&&<CommunityEvents key={server.id} initialEvent={eventTarget} onOpenChannel={openChannel} onClose={()=>setEventsOpen(false)}/>}
    {rolesOpen&&<RoleManager onClose={()=>setRolesOpen(false)}/>}
    {projectCreate&&<AiProjectCreate parentId={projectCreate} onCreated={openChannel} onClose={()=>setProjectCreate(null)}/>}
    {threadCreate&&<ThreadCreate parentId={threadCreate} onCreated={openChannel} onClose={()=>setThreadCreate(null)}/>}
    {threadList&&<ThreadList parentId={threadList} onOpen={openChannel} onCreate={()=>{setThreadCreate(threadList);setThreadList(null)}} onClose={()=>setThreadList(null)}/>}
    {pinnedChannel&&<PinnedMessages channelId={pinnedChannel} onOpenChannel={id=>{setPinnedChannel(null);openChannel(id)}} onClose={()=>setPinnedChannel(null)}/>}
    {channelSettings&&<ChannelSettings channel={channelSettings} onClose={()=>setChannelSettings(null)}/>}
    {profile&&<div className="ct-modal-backdrop" onClick={()=>setProfile(null)}><section role="dialog" aria-modal="true" aria-label={`Perfil de ${profile}`} className="ct-profile" onClick={e=>e.stopPropagation()}><div className="ct-profile-banner"><Atmosphere/><button autoFocus className="ct-modal-close" onClick={()=>setProfile(null)} aria-label="Fechar perfil">×</button></div><div className="ct-profile-content"><Avatar name={profile} identity={profileIdentity||undefined} large/><h1><RoleName serverId={view==='server'?server.id:undefined} identity={profileIdentity||undefined} name={profile}/></h1>{roles.snapshot&&profileIdentity&&<div className="ct-profile-roles">{assignedRoles(roles.snapshot.policy,profileIdentity).filter(role=>role.id!==roles.snapshot!.policy.serverId).sort((a,b)=>b.position-a.position).map(role=><RoleBadge key={role.id} role={role}/>)}</div>}<span className="ct-pill">{profileIdentity ? statusText(profileIdentity) : ''}</span><hr/><h3>Sobre mim</h3><p>{profileMember?.bio || (isOwnProfile?user?.bio:'') || 'Ainda não adicionou uma descrição.'}</p><div className="ct-profile-community"><img src="./contalk-logo.png" alt=""/><div><small>COMUNIDADE</small><strong>{server.name}</strong></div></div>{isOwnProfile?<p className="ct-profile-menu-hint">Clique com o botão direito no seu perfil para editar seus dados, configurar o aplicativo ou sair da conta.</p>:<>{profileIdentity&&<FriendButton username={profileIdentity} name={profile}/>}<button className="ct-primary" disabled={!profileIdentity} onClick={()=>{if(profileIdentity)openConversation(profileIdentity);setProfile(null)}}>Abrir mensagens diretas <Icon name="arrow"/></button></>}</div></section></div>}
    {audioSettings&&<AudioSettings initialMode={audioSettings} onClose={()=>setAudioSettings(null)}/>}
    {editProfile&&<EditProfile onClose={()=>setEditProfile(false)}/>}
    {createType&&<CreateChannel type={createType} serverId={server.id} onClose={()=>setCreateType(null)}/>}
    {context&&<ParticipantMenu onNickname={view==='server'&&roles.snapshot?.id===server.id&&canSetNickname(roles.snapshot.policy,roles.snapshot.actor,context.participant.identity)?()=>{setNicknameFirst(true);setMemberRoles(context.participant.identity)}:undefined} onRoles={roles.snapshot&&roles.snapshot.policy.members.includes(context.participant.identity)&&(centralAllows('MANAGE_ROLES')||centralAllows('MODERATE_MEMBERS')||centralAllows('KICK_MEMBERS')||centralAllows('BAN_MEMBERS')||roles.snapshot.channels.some(channel=>channel.type==='voice'&&['MUTE_MEMBERS','DEAFEN_MEMBERS','MOVE_MEMBERS'].some(permission=>centralAllows(permission as 'MUTE_MEMBERS'|'DEAFEN_MEMBERS'|'MOVE_MEMBERS',channel.id))))?()=>{setNicknameFirst(false);setMemberRoles(context.participant.identity)}:undefined} onLogout={()=>void (async()=>{await voice.leaveChannel();await logout()})()} onSettings={()=>setSettingsOpen(true)} onEditProfile={()=>setEditProfile(true)} onAudioSettings={setAudioSettings} participant={context.participant} position={{x:context.x,y:context.y}} onClose={()=>setContext(null)} onProfile={()=>{setProfile(context.participant.name,context.participant.identity);setContext(null)}}/>}

  </div>
}

