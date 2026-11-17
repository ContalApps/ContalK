import { BrandMark } from './BrandMark'

// Foto do servidor quando existe; sem foto, as iniciais do nome (cada servidor fica distinguível no rail).
export function ServerIcon({ name, icon }: { name: string; icon?: string | null }) {
  if (icon) return <img className="ct-server-photo" src={icon} alt="" draggable={false} />
  const initials = name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()
  return initials ? <span className="ct-server-initials" aria-hidden="true">{initials}</span> : <BrandMark />
}
