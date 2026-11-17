import { useCommunityStore } from '../store/useCommunityStore'
import { useAuthStore } from '../store/useAuthStore'
import { usePresenceStatus } from '../store/usePresenceStatus'
export function Avatar({ name, identity, large = false, live=false }: {name: string; identity?: string; large?: boolean;live?:boolean}) {
  const members=useCommunityStore(s=>s.members)
  const self=useAuthStore(s=>s.user)
  const ownStatus=usePresenceStatus(s=>s.status)
  const presenceOnline=useCommunityStore(s=>s.status==='online')
  const member=identity?members.find(m=>m.username===identity):members.find(m=>m.username===name)||members.find(m=>m.display_name===name)
  const isSelf=!!self&&(identity?self.username===identity:self.username===name||self.display_name===name)
  const account=isSelf?self:member
  // Própria bolinha: o status escolhido só vale com a presença conectada.
  const dot=isSelf?(presenceOnline&&ownStatus!=='invisible'?ownStatus:'offline'):member?.online?member.status||'online':'offline'
  return <span className={`ct-avatar ${large?'large':''}`} data-profile-identity={identity||account?.username} data-profile-name={name}>{account?.avatar?<img src={account.avatar} alt=""/>:name.slice(0,2).toUpperCase()}<i className={dot==='offline'?'offline':''} data-status={dot}/>{live&&<span className="ct-avatar-live" role="img" aria-label="Transmitindo ao vivo"/>}</span>
}
