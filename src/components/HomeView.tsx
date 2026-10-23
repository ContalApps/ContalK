import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useCommunityStore } from '../store/useCommunityStore'
import { useFriendStore } from '../store/useFriendStore'
import { useAppStore, type Message } from '../store/useAppStore'
import { friendPeople } from '../social/people'
import { Avatar } from './Avatar'
import { FriendButton } from './FriendButton'
const EMPTY_MESSAGES: Message[] = []
export function HomeView({mode,selected,onConversation,onProfile}:{mode:'friends'|'messages';selected:string|null;onConversation:(username:string)=>void;onProfile:(name:string,username?:string)=>void}) {
  const user=useAuthStore(s=>s.user)!
  const {members,status,sendMessage}=useCommunityStore()
  const relations=useFriendStore(s=>s.relations)
  const [search,setSearch]=useState('');const [text,setText]=useState('');const [error,setError]=useState('')
  const [filter,setFilter]=useState<'online'|'all'|'pending'|'add'>('online');const [sending,setSending]=useState(false)
  useEffect(()=>{setText('');setError('')},[selected])
  const friends=friendPeople(members,relations,user.username)
  const pending=Object.values(relations).filter(r=>r.status!=='friend')
  const people=filter==='pending'?pending.map(r=>members.find(m=>m.username===r.username)||{...r,online:false,bio:''}):filter==='add'?members.filter(m=>m.username!==user.username&&!relations[m.username]):friends
  const shown=people.filter(m=>(filter!=='online'||m.online)&&`${m.display_name} ${m.username}`.toLowerCase().includes(search.toLowerCase()))
  const peer=members.find(m=>m.username===selected)||friends.find(m=>m.username===selected)
  const channel='dm:'+ [user.username,selected || ''].sort().join(':')
  const messages=useAppStore(s=>s.messages[channel] || EMPTY_MESSAGES)
  const renderMessage=(message:Message)=><article className="ct-message" key={message.id}><Avatar name={message.userName} identity={message.userId}/><div><header><strong>{message.userName}</strong><time>{new Date(message.timestamp).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time></header><p>{message.content}</p></div></article>
  if(mode==='friends')return <section className="ct-people-page">
    <header className="ct-page-heading"><div><span className="ct-eyebrow">SUAS CONEXÕES</span><h1>Amigos</h1><p>Adicione alguém da call e fique perto de quem importa.</p></div><span className={`ct-presence-badge ${status==='online'?'connected':''}`}>{status==='online'?`${friends.filter(m=>m.online).length} ${friends.filter(m=>m.online).length===1?'amigo online':'amigos online'}`:'Presença indisponível'}</span></header>
    <div className="ct-people-toolbar"><div role="group" aria-label="Filtrar amigos">{([['online','Online'],['all','Todos'],['pending',`Pendentes (${pending.length})`],['add','Adicionar amigo']] as const).map(([value,label])=><button key={value} className={filter===value?'active':''} onClick={()=>setFilter(value)}>{label}</button>)}</div><input aria-label="Buscar amigos" placeholder="Buscar por nome ou usuário..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
    {filter==='add'&&<p className="ct-friend-hint">Adicione pessoas do servidor abaixo ou use “Adicionar amigo” na call e no perfil. A amizade aparece após a outra pessoa aceitar.</p>}
    <div className="ct-member-cards">{shown.map(m=><article className="ct-member-card" key={m.username}><button className="ct-member-profile" onClick={()=>onProfile(m.display_name,m.username)}><Avatar name={m.display_name} identity={m.username} large/><h2>{m.display_name}</h2><small>@{m.username}</small></button><span className={m.online?'ct-member-online':'ct-muted'}>{m.online?'● Online':status==='online'?'○ Offline':'○ Status indisponível'}</span><p>{m.bio || 'Uma boa conversa começa com um oi.'}</p><FriendButton username={m.username} name={m.display_name}/>{relations[m.username]?.status==='friend'&&<button className="ct-primary" onClick={()=>onConversation(m.username)}>Conversar <span aria-hidden="true">↗</span></button>}</article>)}</div>
    {!shown.length&&<div className="ct-empty ct-people-empty"><span aria-hidden="true">♧</span><h2>{search?'Nenhuma pessoa encontrada':filter==='pending'?'Nenhuma solicitação pendente':filter==='add'?'Nenhuma pessoa para adicionar':filter==='online'?'Nenhum amigo online agora':'Sua lista de amigos começa aqui'}</h2><p>{filter==='pending'?'Pedidos recebidos e enviados aparecem nesta aba.':filter==='add'?'Pessoas do servidor aparecerão aqui quando se conectarem.':'Adicione amigos pela call ou pelo perfil. Participar do mesmo servidor não cria uma amizade.'}</p></div>}
  </section>
  return <section className="ct-dm-page">{peer?<><header className="ct-page-heading"><button className="ct-dm-peer" onClick={()=>onProfile(peer.display_name,peer.username)}><Avatar name={peer.display_name} identity={peer.username}/><span><h2>{peer.display_name}</h2><small>{peer.online?'Online':status==='online'?'Offline':'Presença indisponível'}</small></span></button><FriendButton username={peer.username} name={peer.display_name}/></header><div className="ct-dm-history">{messages.length?messages.map(renderMessage):<div className="ct-empty"><Avatar name={peer.display_name} identity={peer.username} large/><h2>Converse com {peer.display_name}</h2><p>Este é o início da conversa de vocês.</p></div>}</div><form className="ct-composer" onSubmit={async e=>{e.preventDefault();if(sending)return;setError('');setSending(true);try{await sendMessage(channel,text,peer.username);setText('')}catch(error){setError(error instanceof Error?error.message:'Falha ao enviar mensagem.')}finally{setSending(false)}}}><input key={peer.username} maxLength={2000} placeholder={`Conversar com ${peer.display_name}...`} aria-label="Mensagem" value={text} onChange={e=>setText(e.target.value)}/><button className="ct-primary" disabled={sending||!text.trim()||!peer.online}>Enviar</button></form><div className="ct-composer-hint" role={error?'alert':undefined}>{error||'O histórico fica salvo neste dispositivo.'}</div></>:<div className="ct-empty ct-people-empty"><span aria-hidden="true">☏</span><h2>Suas conversas, em um só lugar</h2><p>Escolha um amigo ou uma conversa na lista à esquerda.</p></div>}</section>
}
