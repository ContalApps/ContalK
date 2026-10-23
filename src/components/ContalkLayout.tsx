import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { useVoiceStore } from '../store/useVoiceStore'
import { VoiceStage } from './VoiceStage'
import { AudioSettings } from './AudioSettings'
import { HomeView } from './HomeView'
import { UpdateNotification } from './UpdateNotification'
import { Avatar } from './Avatar'
import { EditProfile } from './EditProfile'
import { CreateChannel } from './CreateChannel'
import { ParticipantMenu } from './ParticipantMenu'
import { useCommunityStore } from '../store/useCommunityStore'
import { useFriendStore } from '../store/useFriendStore'
import { friendPeople, directPeople } from '../social/people'
import { FriendButton } from './FriendButton'
import type { VoiceParticipant } from '../store/useVoiceStore'

const iconPaths: Record<string, string> = {
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
export function ContalkLayout() {
  const { user, logout } = useAuthStore()
  const { servers, activeServerId, activeChannelId, setActiveServer, setActiveChannel, messages } = useAppStore()
  const voice = useVoiceStore()
  const [view, setView] = useState<'home'|'server'|'friends'|'messages'>('home')
  const [selectedPeer,setSelectedPeer]=useState<string|null>(null)
  const [audioSettings,setAudioSettings]=useState(false)
  const openConversation=(username:string)=>{setSelectedPeer(username);setView('messages')}
  const [search, setSearch] = useState('')
  const [input, setInput] = useState('')
  const [sendError,setSendError]=useState('')
  const [profile, setProfileName] = useState<string | null>(null)
  const [profileIdentity, setProfileIdentity] = useState<string | null>(null)
  const community = useCommunityStore()
  const relations = useFriendStore(s=>s.relations)
  const friends = friendPeople(community.members, relations, user?.username || '')
  const directContacts = directPeople(community.members, friends, messages, user?.username || '', selectedPeer)
  const setProfile = (name: string | null, identity?: string) => {
    setProfileName(name)
    setProfileIdentity(identity || community.members.find(m=>m.display_name===name)?.username || voice.participants.find(p=>p.name===name)?.identity || (name===user?.display_name?user.username:null))
  }
  const [editProfile,setEditProfile] = useState(false)
  const [createType,setCreateType] = useState<'text'|'voice'|null>(null)
  const [context,setContext] = useState<{participant:VoiceParticipant;x:number;y:number}|null>(null)
  useEffect(()=>{if(user)void useCommunityStore.getState().connect(user);return()=>useCommunityStore.getState().disconnect()},[user?.username])
  const [members, setMembers] = useState(true)
  const end = useRef<HTMLDivElement>(null)
  const server = servers.find(s => s.id === activeServerId) || servers[0]
  const channel = server.channels.find(c => c.id === activeChannelId) || server.channels[0]
  const recent = Object.values(messages).flat().sort((a,b)=>b.timestamp-a.timestamp)
  const statusText=(identity:string)=>community.members.some(m=>m.username===identity&&m.online)?'Online':community.status==='online'?'Offline':'Presença indisponível'
  const matchesSearch=(m:{display_name:string;username:string})=>(m.display_name+' '+m.username).toLowerCase().includes(search.toLowerCase())
  const visibleMembers = community.members.filter(matchesSearch)
  const visibleFriends = friends.filter(matchesSearch)
  const visibleContacts = directContacts.filter(matchesSearch)
  const activityMembers = view==='server'?visibleMembers:visibleFriends
  const profileMember=community.members.find(m=>m.username===profileIdentity)
  const isOwnProfile=profileIdentity===user?.username
  const voiceChannels = server.channels.filter(c=>c.type==='voice')
  const voiceKey = voiceChannels.map(c=>c.id).join(',')
  useEffect(()=>{ voice.fetchChannelOccupants(voiceChannels); const timer=setInterval(()=>voice.fetchChannelOccupants(voiceChannels),4000); return ()=>clearInterval(timer) },[voiceKey, voice.fetchChannelOccupants])
  useEffect(()=>{end.current?.scrollIntoView({behavior:'smooth'})},[activeChannelId,messages])
  useEffect(()=>{if(!profile)return; const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setProfile(null)}; window.addEventListener('keydown',close); return ()=>window.removeEventListener('keydown',close)},[profile])
  const openChannel=(id:string)=>{setActiveChannel(id);setView('server')}
  const join=async(id:string,name:string)=>{openChannel(id);if(user)await voice.joinChannel(id,name,{username:user.username,display_name:user.display_name,avatar:user.avatar})}
  const send=async(e:React.FormEvent)=>{e.preventDefault();if(user&&input.trim()){setSendError('');try{await community.sendMessage(channel.id,input);setInput('')}catch(error){setSendError(error instanceof Error?error.message:'Falha ao enviar mensagem.')}}}
  const hour=new Date().getHours(); const greeting=hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite'
  return <div className="ct-app">
    <header className="ct-topbar"><button className="ct-brand" onClick={()=>setView('home')}><img src="./contalk-avatar.png" alt="Morceguinho ContalK"/><strong>ContalK<span>BOAS CONVERSAS</span></strong></button><label className="ct-search"><Icon name="search"/><input aria-label="Buscar pessoas" placeholder="Buscar no ContalK..." value={search} onChange={e=>setSearch(e.target.value)}/><kbd>⌘ K</kbd></label><div className="ct-top-end"><span className="ct-online-dot"/> Boas conversas começam aqui <span className="ct-version">v{import.meta.env.VITE_APP_VERSION}</span><img src="./contalk-avatar.png" alt=""/></div></header>
    <div className="ct-body"><aside className="ct-rail"><button className={view==='home'?'selected':''} title="Início" onClick={()=>setView('home')}><Icon name="home"/></button><button className={view==='messages'?'selected':''} title="Mensagens diretas" onClick={()=>setView('messages')}><Icon name="chat"/></button><hr/>{servers.map(s=><button key={s.id} title={s.name} className={view==='server'&&s.id===server.id?'selected ct-server-logo':'ct-server-logo'} onClick={()=>{setActiveServer(s.id);setActiveChannel(s.channels[0].id);setView('server')}}><img src="./contalk-logo.png" alt={s.name}/></button>)}<div className="ct-rail-bottom"><button title="Meu perfil" onClick={()=>setProfile(user?.display_name||'Você',user?.username)}><Avatar name={user?.display_name||'Você'}/></button></div></aside>
    <>
    <nav className="ct-sidebar">{view!=='server'?<><div className="ct-side-nav"><button className={view==='home'?'active':''} onClick={()=>setView('home')}><Icon name="home"/>Início <span className="ct-nav-dot"/></button><button className={view==='friends'?'active':''} onClick={()=>setView('friends')}><Icon name="friends"/>Amigos</button></div><div className="ct-section-label">MENSAGENS DIRETAS <button title="Abrir mensagens" onClick={()=>setView('messages')}>+</button></div><div className="ct-people">{visibleContacts.map(m=><button className="ct-person" key={m.username} onClick={()=>openConversation(m.username)}><Avatar name={m.display_name} identity={m.username}/><span><strong>{m.display_name}</strong><small>{statusText(m.username)}</small></span></button>)}{!visibleContacts.length&&<p className="ct-friend-hint">Suas amizades e conversas aparecerão aqui.</p>}</div><div className="ct-sidebar-note"><img src="./contalk-avatar.png" alt=""/><strong>Seu lugar para se conectar.</strong><p>Junte os amigos. Entre na conversa.</p></div></>:<><div className="ct-server-banner"><Nightscape/><strong>{server.name}</strong><small><i className="ct-online-dot"/> Sua comunidade</small></div><div className="ct-section-label">CANAIS DE TEXTO <button title="Criar canal de texto" onClick={()=>setCreateType('text')}>+</button></div>{server.channels.filter(c=>c.type==='text').map(c=><button key={c.id} className={`ct-channel ${channel.id===c.id?'active':''}`} onClick={()=>openChannel(c.id)}><Icon name="#"/>{c.name}</button>)}<div className="ct-section-label">CANAIS DE VOZ <button title="Criar canal de voz" onClick={()=>setCreateType('voice')}>+</button></div>{voiceChannels.map(c=><div key={c.id}><button className={`ct-channel ${channel.id===c.id?'active':''}`} onClick={()=>join(c.id,c.name)}><Icon name="voice"/>{c.name}<small>{voice.channelOccupants[c.id]?.length||''}</small></button>{(voice.activeChannelId===c.id?voice.participants:voice.channelOccupants[c.id]||[]).map(p=><button className="ct-occupant" key={p.identity} onClick={()=>setProfile(p.name,p.identity)} onContextMenu={e=>{e.preventDefault();setContext({participant:p,x:e.clientX,y:e.clientY})}}><Avatar name={p.name} identity={p.identity}/>{p.name}<span className="ct-occupant-status">{(voice.userVolumes[p.identity]??100)===0?'🔇':p.isSpeaking?'◖◗':!p.isAudioEnabled?'♩':''}</span></button>)}</div>)}</>}
    {voice.activeChannelId&&<div className="ct-connected"><button onClick={()=>openChannel(voice.activeChannelId!)}><Icon name="voice"/><span><strong>{voice.connectionStatus==='connected'?'Conectado em voz':'Conexão de voz'}</strong><small>{voice.activeChannelName}</small></span></button><button title="Sair da chamada" onClick={voice.leaveChannel}><Icon name="close"/></button></div>}<div className="ct-userbar"><button onClick={()=>setProfile(user?.display_name||'Você',user?.username)}><Avatar name={user?.display_name||'Você'}/><span><strong>{user?.display_name}</strong><small>{community.status==='online'?'● Online':'○ Sem presença'}</small></span></button><button title={voice.isMicMuted?'Ativar microfone':'Silenciar microfone'} onClick={voice.toggleMic} aria-pressed={voice.isMicMuted}><Icon name={voice.isMicMuted?'×':'mic'}/></button><button title="Ensurdecer" aria-pressed={voice.isDeafened} onClick={voice.toggleDeafen}><Icon name="headphones"/></button><button title="Configurações de áudio" onClick={()=>setAudioSettings(true)}><Icon name="settings"/></button></div></nav>
    <main className="ct-main">{(voice.profileError||community.profileError)&&<div className="ct-mic-alert" role="status">{voice.profileError||community.profileError}</div>}{voice.microphoneError&&<div className="ct-mic-alert" role="alert"><span>{voice.microphoneError}</span><button onClick={()=>setAudioSettings(true)}>Escolher microfone</button></div>}{view==='friends'||view==='messages'?<HomeView key={view} mode={view} selected={selectedPeer} onConversation={openConversation} onProfile={setProfile}/>:view==='home'?<div className="ct-dashboard"><section className="ct-hero"><Nightscape/><div className="ct-hero-copy"><span className="ct-eyebrow">SEU PONTO DE ENCONTRO</span><h1>{greeting}, <em>{user?.display_name || 'amigo'}!</em></h1><p>Boas conversas tornam os dias mais leves.</p></div><div className="ct-quick"><button onClick={()=>setView('messages')}><span className="ct-action-icon"><Icon name="chat"/></span><span><strong>Iniciar conversa</strong><small>Chamar um amigo</small></span><Icon name="arrow"/></button><button onClick={()=>{if(voiceChannels[0])join(voiceChannels[0].id,voiceChannels[0].name)}}><span className="ct-action-icon"><Icon name="headphones"/></span><span><strong>Entrar em voz</strong><small>Encontre sua turma</small></span><Icon name="arrow"/></button></div></section>
    <div className="ct-heading"><h2>Canais de voz</h2><button className="ct-secondary" onClick={()=>setCreateType('voice')}>+ Criar canal</button><span className="ct-muted">Uma boa conversa está a um clique</span></div><div className="ct-voice-cards">{voiceChannels.map((c,i)=>{const occupants=voice.activeChannelId===c.id?voice.participants:voice.channelOccupants[c.id]||[];return <article className="ct-card ct-voice-card" key={c.id}><div className="ct-card-title"><span className={`ct-room-icon room-${i}`}><Icon name="voice"/></span><div><h3>{c.name}</h3><small>{server.name}</small></div></div><div className="ct-voice-bottom"><div>{occupants.length?<><div className="ct-avatar-stack">{occupants.slice(0,3).map(p=><Avatar key={p.identity} name={p.name}/>)}</div><small className="ct-voice-status">● {occupants.length} em voz</small></>:<small className="ct-muted">Seja o primeiro a entrar</small>}</div><button className={i===0?'ct-primary':'ct-secondary'} onClick={()=>join(c.id,c.name)}>{voice.activeChannelId===c.id&&voice.connectionStatus==='connected'?'Abrir':'Entrar'}</button></div></article>})}</div>
    <div className="ct-dashboard-lower"><section className="ct-card ct-recent"><div className="ct-heading"><h2>Conversas recentes</h2><Icon name="chat"/></div>{recent.slice(0,5).map(m=><button key={m.id} className="ct-recent-row" onClick={()=>openChannel(m.channelId)}><Avatar name={m.userName}/><span><strong>{m.userName}</strong><small>{m.content}</small></span><time>{new Date(m.timestamp).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time></button>)}</section><div className="ct-lower-right"><section className="ct-card"><div className="ct-heading"><h2>Suas comunidades</h2><span className="ct-pill">{servers.length}</span></div><div className="ct-community-grid">{servers.map(s=><button key={s.id} onClick={()=>{setActiveServer(s.id);openChannel(s.channels[0].id)}}><img src="./contalk-logo.png" alt=""/><strong>{s.name}</strong><small><i className="ct-online-dot"/> {s.channels.length} canais</small></button>)}</div></section><section className="ct-card ct-welcome"><span className="ct-eyebrow">FEITO PARA ESTAR JUNTO</span><h2>A próxima conversa<br/>pode ser a melhor do dia.</h2><p>Um espaço para jogar, compartilhar ideias e ficar perto de quem importa.</p><button onClick={()=>setView('friends')}>Encontre seus amigos <Icon name="arrow"/></button><img src="./contalk-avatar.png" alt="Morceguinho ContalK"/></section></div></div><footer className="ct-dashboard-footer"><img src="./contalk-avatar.png" alt=""/> ContalK <span>Conecte-se. Converse. Fique à vontade.</span></footer></div>:<><header className="ct-channel-header"><div><Icon name={channel.type==='voice'?'voice':'#'}/><span><h2>{channel.name}</h2><small>{channel.type==='voice'?'Seu espaço para conversar':'Compartilhe ideias e boas conversas com a comunidade.'}</small></span></div><button className="ct-secondary" onClick={()=>setMembers(!members)} title="Alternar lista de membros"><Icon name="members"/></button></header>{channel.type==='voice'?<div className="ct-stage"><VoiceStage showMemberList={members} onToggleMemberList={()=>setMembers(!members)}/></div>:<><div className="ct-messages"><div className="ct-chat-welcome"><span>#</span><h1>Este é o #{channel.name}</h1><p>O começo de muitas boas conversas.</p></div><div className="ct-date-divider">HOJE</div>{(messages[channel.id]||[]).filter(m=>m.content.toLowerCase().includes(search.toLowerCase())||m.userName.toLowerCase().includes(search.toLowerCase())).map(m=><article className="ct-message" key={m.id}><button onClick={()=>setProfile(m.userName)}><Avatar name={m.userName}/></button><div><header><button onClick={()=>setProfile(m.userName)}>{m.userName}</button><time>{new Date(m.timestamp).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time></header><p>{m.content}</p></div></article>)}<div ref={end}/></div><form className="ct-composer" onSubmit={send}><span aria-hidden="true">#</span><input value={input} onChange={e=>setInput(e.target.value)} maxLength={2000} placeholder={`Conversar em #${channel.name}`} aria-label="Mensagem"/><button className="ct-primary" disabled={!input.trim()} title="Enviar mensagem"><Icon name="send"/></button></form><div className="ct-composer-hint" role={sendError?'alert':undefined}>{sendError || 'Um espaço melhor começa com respeito. 💜'}</div></>}</> }</main>
    {(view!=='server'||members)&&<aside className="ct-activity"><div className="ct-heading"><h2>{view==='server'?'Sobre o servidor':'Seus amigos'}</h2><span className="ct-online-dot"/></div>{view==='server'&&<div className="ct-server-about"><img src="./contalk-logo.png" alt=""/><h3>{server.name}</h3><p>Pessoas que fazem parte deste servidor.</p></div>}<div className="ct-section-label">{community.status==='online'?(view==='server'?'MEMBROS':'AMIGOS'):'PRESENÇA INDISPONÍVEL'} — {activityMembers.length}</div>{activityMembers.map(m=><button className="ct-person ct-activity-person" key={m.username} onClick={()=>setProfile(m.display_name,m.username)}><Avatar name={m.display_name} identity={m.username}/><span><strong>{m.display_name}</strong><small>{statusText(m.username)}</small></span><i className={m.online?"ct-online-dot":"ct-offline-dot"}/></button>)}{!activityMembers.length&&<p className="ct-muted">{view==='server'?'Nenhuma pessoa encontrada.':'Adicione alguém da call ou do servidor para aparecer aqui.'}</p>}{view!=='server'&&<button className="ct-secondary" onClick={()=>setView('friends')}>Abrir amigos</button>}</aside>}
    </></div>
    {profile&&<div className="ct-modal-backdrop" onClick={()=>setProfile(null)}><section role="dialog" aria-modal="true" aria-label={`Perfil de ${profile}`} className="ct-profile" onClick={e=>e.stopPropagation()}><div className="ct-profile-banner"><Nightscape/><button autoFocus className="ct-modal-close" onClick={()=>setProfile(null)} aria-label="Fechar perfil">×</button></div><div className="ct-profile-content"><Avatar name={profile} identity={profileIdentity||undefined} large/><h1>{profile}</h1><span className="ct-pill">{profileIdentity ? statusText(profileIdentity) : ''}</span><hr/><h3>Sobre mim</h3><p>{profileMember?.bio || (isOwnProfile?user?.bio:'') || 'Ainda não adicionou uma descrição.'}</p><div className="ct-profile-community"><img src="./contalk-logo.png" alt=""/><div><small>COMUNIDADE</small><strong>{server.name}</strong></div></div>{isOwnProfile?<><button className="ct-primary" onClick={()=>{setProfile(null);setEditProfile(true)}}>Editar perfil</button><button className="ct-secondary" onClick={async()=>{setProfile(null);await voice.leaveChannel();await logout()}}>Sair da conta</button></>:<>{profileIdentity&&<FriendButton username={profileIdentity} name={profile}/>}<button className="ct-primary" disabled={!profileIdentity} onClick={()=>{if(profileIdentity)openConversation(profileIdentity);setProfile(null)}}>Abrir mensagens diretas <Icon name="arrow"/></button></>}</div></section></div>}
    {audioSettings&&<AudioSettings onClose={()=>setAudioSettings(false)}/>}
    {editProfile&&<EditProfile onClose={()=>setEditProfile(false)}/>}
    {createType&&<CreateChannel type={createType} serverId={server.id} onClose={()=>setCreateType(null)}/>}
    {context&&<ParticipantMenu participant={context.participant} position={{x:context.x,y:context.y}} onClose={()=>setContext(null)} onProfile={()=>{setProfile(context.participant.name,context.participant.identity);setContext(null)}}/>}
    <UpdateNotification/>
  </div>
}

