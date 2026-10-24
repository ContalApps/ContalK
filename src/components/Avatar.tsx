import { useCommunityStore } from '../store/useCommunityStore'
import { useAuthStore } from '../store/useAuthStore'
export function Avatar({ name, identity, large = false, live=false }: {name: string; identity?: string; large?: boolean;live?:boolean}) {
  const members=useCommunityStore(s=>s.members)
  const self=useAuthStore(s=>s.user)
  const member=identity?members.find(m=>m.username===identity):members.find(m=>m.username===name)||members.find(m=>m.display_name===name)
  const account=self&&(identity?self.username===identity:self.username===name||self.display_name===name)?self:member
  const hue=[...name].reduce((n,c)=>n+c.charCodeAt(0),0)%360
  return <span className={`ct-avatar ${large?'large':''}`} data-profile-identity={identity||account?.username} data-profile-name={name} style={{background:`linear-gradient(140deg,hsl(${hue} 55% 42%),hsl(${hue+45} 55% 16%))`}}>{account?.avatar?<img src={account.avatar} alt=""/>:name.slice(0,2).toUpperCase()}<i className={member?.online?'':'offline'}/>{live&&<span className="ct-avatar-live" role="img" aria-label="Transmitindo ao vivo"/>}</span>
}
