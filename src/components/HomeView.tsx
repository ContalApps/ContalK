import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useCommunityStore } from '../store/useCommunityStore'
import { useAppStore } from '../store/useAppStore'
import { Avatar } from './Avatar'
const EMPTY_MESSAGES: import('../store/useAppStore').Message[] = []
export function HomeView() {
  const user=useAuthStore(s=>s.user)!
  const {members,status}=useCommunityStore()
  const [search,setSearch]=useState('');const [selected,setSelected]=useState<string|null>(null);const [text,setText]=useState('')
  const [error,setError]=useState('')
  const peer=members.find(m=>m.username===selected)
  const channel='dm:'+ [user.username,selected || ''].sort().join(':')
  const messages=useAppStore(s=>s.messages[channel] || EMPTY_MESSAGES)
  return <div className="ct-friends"><aside><h2>Pessoas da comunidade</h2><input aria-label="Buscar pessoas" placeholder="Buscar pessoas..." value={search} onChange={e=>setSearch(e.target.value)}/><small>{status==='online'?'Presença conectada':'Presença indisponível — exibindo contatos conhecidos'}</small>{members.filter(m=>m.username!==user.username&&m.display_name.toLowerCase().includes(search.toLowerCase())).map(m=><button key={m.username} className="ct-person" onClick={()=>setSelected(m.username)}><Avatar name={m.display_name} identity={m.username}/><span><strong>{m.display_name}</strong><small>{m.online?'Online':'Offline'}</small></span></button>)}</aside><main>{peer?<><h2>{peer.display_name}</h2><p className="ct-muted">Mensagens em tempo real. O histórico fica salvo neste dispositivo.</p><div className="ct-dm-history">{messages.map(m=><article className="ct-message" key={m.id}><Avatar name={m.userName}/><div><strong>{m.userName}</strong><p>{m.content}</p></div></article>)}</div><form className="ct-composer" onSubmit={async e=>{e.preventDefault();setError('');try{await useCommunityStore.getState().sendMessage(channel,text,peer.username);setText('')}catch(error){setError(error instanceof Error?error.message:'Falha ao enviar mensagem.')}}}><input maxLength={2000} placeholder="Enviar mensagem..." aria-label="Mensagem" value={text} onChange={e=>setText(e.target.value)}/><button className="ct-primary" disabled={!text.trim()||!peer.online}>Enviar</button></form>{error&&<p role="alert">{error}</p>}</>:<div className="ct-empty"><h2>Boas conversas começam aqui</h2><p>As pessoas conectadas ao ContalK aparecem nesta lista. Escolha um contato para conversar.</p></div>}</main></div>
}
