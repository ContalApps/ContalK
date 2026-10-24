import { useRoleStore } from '../store/useRoleStore'
import { displayRole, displayIconRole } from '../roles/permissions'

export function RoleName({identity,name}:{identity?:string;name:string}){
  const snapshot=useRoleStore(state=>state.snapshot)
  const role=snapshot&&identity?displayRole(snapshot.policy,identity):undefined
  const icon=snapshot&&identity?displayIconRole(snapshot.policy,identity)?.icon:undefined
  return <span data-profile-identity={identity} data-profile-name={name} className={role?`ct-role-badge ${role.style}`:icon?'ct-role-badge':undefined} title={role?`${name} · ${role.name}`:undefined} style={role?{'--role-color':role.color,'--role-secondary':role.secondaryColor||role.color} as React.CSSProperties:undefined}>{icon&&(icon.startsWith('data:image/')?<img src={icon} alt=""/>:<span aria-hidden="true">{icon}</span>)}{name}</span>
}
