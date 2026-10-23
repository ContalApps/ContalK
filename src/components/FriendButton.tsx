import { useState } from 'react'
import { useFriendStore } from '../store/useFriendStore'
import { useAuthStore } from '../store/useAuthStore'

export function FriendButton({ username, name, compact = false }: { username: string; name: string; compact?: boolean }) {
  const relation = useFriendStore(s => s.relations[username])
  const owner = useAuthStore(s => s.user?.username)
  const [error, setError] = useState('')
  if (!owner || owner === username) return null
  const run = (action: () => void) => { try { action(); setError('') } catch { setError('Não foi possível salvar. Tente novamente.') } }
  return <div className="ct-friend-actions">
    {relation?.status === 'friend' ? <><span className="ct-member-online">✓ Amigos</span>{!compact&&<button className="ct-secondary" onClick={() => run(() => useFriendStore.getState().remove(username))}>Remover amizade</button>}</>
      : relation?.status === 'incoming' ? <><button className="ct-primary" onClick={() => run(() => useFriendStore.getState().accept(username))}>Aceitar amizade</button>{!compact&&<button className="ct-secondary" onClick={() => run(() => useFriendStore.getState().remove(username))}>Recusar</button>}</>
      : relation?.status === 'outgoing' ? <><span className="ct-muted" role="status">Solicitação pendente</span>{!compact&&<button className="ct-secondary" onClick={() => run(() => useFriendStore.getState().remove(username))}>Cancelar solicitação</button>}</>
      : <button className="ct-primary" onClick={() => run(() => useFriendStore.getState().request(username, name))}>+ Adicionar amigo</button>}
    {error && <small role="alert">{error}</small>}
  </div>
}
