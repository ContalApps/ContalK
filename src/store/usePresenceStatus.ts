import { create } from 'zustand'

// Status escolhido pela pessoa, como no Discord. Vai para os outros pelos metadados de presença.
export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible'
export const PRESENCE_STATUSES: PresenceStatus[] = ['online', 'idle', 'dnd', 'invisible']
export const statusLabel: Record<PresenceStatus, string> = { online: 'Disponível', idle: 'Ausente', dnd: 'Não perturbar', invisible: 'Invisível' }
export const statusHint: Record<PresenceStatus, string> = {
  online: '',
  idle: '',
  dnd: 'Você não vai receber notificações na área de trabalho nem avisos dentro do app.',
  invisible: 'Você aparece como offline para os outros, mas continua com acesso a tudo.'
}
export const isPresenceStatus = (value: unknown): value is PresenceStatus => typeof value === 'string' && (PRESENCE_STATUSES as string[]).includes(value)

const key = (owner: string) => `contalk-status-v1:${owner}`

export const usePresenceStatus = create<{ owner: string | null; status: PresenceStatus; activate: (owner: string | null) => void; setStatus: (status: PresenceStatus) => void }>((set, get) => ({
  owner: null,
  status: 'online',
  activate: owner => {
    if (owner === get().owner) return
    let status: PresenceStatus = 'online'
    try { const saved = owner ? localStorage.getItem(key(owner)) : null; if (isPresenceStatus(saved)) status = saved } catch { /* Usa o padrão. */ }
    set({ owner, status })
  },
  setStatus: status => {
    const owner = get().owner
    if (owner) try { localStorage.setItem(key(owner), status) } catch { /* Vale só nesta sessão. */ }
    set({ status })
  }
}))

// Liga o status à presença: publica nos metadados e republica quando muda.
export function setupPresenceStatus(source: { setPresenceStatusSource: (read: () => string) => void; republish: () => void }) {
  source.setPresenceStatusSource(() => usePresenceStatus.getState().status)
  return usePresenceStatus.subscribe((state, previous) => { if (state.status !== previous.status) source.republish() })
}
