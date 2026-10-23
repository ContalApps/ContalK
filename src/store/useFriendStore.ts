import { create } from 'zustand'

export interface Friendship {
  username: string
  display_name: string
  status: 'incoming' | 'outgoing' | 'friend'
  requestId: string
}
type Action = 'request' | 'accept' | 'decline' | 'remove'
interface FriendEvent { id: string; action: Action; requestId: string }
interface PendingEvent extends FriendEvent { username: string }
type Packet = FriendEvent | { ack: string }
type Transport = (username: string, packet: Packet) => Promise<void>
interface FriendState {
  owner: string | null
  relations: Record<string, Friendship>
  outbox: PendingEvent[]
  seen: Record<string, string[]>
  activate: (owner: string | null, send?: Transport) => void
  request: (username: string, name: string) => void
  accept: (username: string) => void
  remove: (username: string) => void
  receive: (username: string, name: string, packet: unknown) => Promise<void>
  flush: () => Promise<void>
}
let transport: Transport | undefined
let sending = new Set<string>()
const key = (owner: string) => `contalk-friendships-v1:${owner}`
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(id)

export const useFriendStore = create<FriendState>((set, get) => {
  // Persist before acknowledging so a restart cannot lose a delivered request.
  const save = (patch: Partial<FriendState>) => {
    const next = { ...get(), ...patch }
    if (next.owner) localStorage.setItem(key(next.owner), JSON.stringify({ relations: next.relations, outbox: next.outbox, seen: next.seen }))
    set(patch)
  }
  const queue = (username: string, action: Action, requestId: string) => ({ username, action, requestId, id: crypto.randomUUID() })
  return {
    owner: null, relations: {}, outbox: [], seen: {},
    activate: (owner, send) => {
      transport = send; sending = new Set()
      let saved = { relations: {}, outbox: [], seen: {} }
      if (owner) { try { const value = JSON.parse(localStorage.getItem(key(owner)) || 'null'); if (value?.relations && Array.isArray(value.outbox) && value.seen) saved = value } catch { /* No saved friendships. */ } }
      set({ owner, ...saved })
    },
    request: (username, name) => {
      if (!get().owner || username === get().owner || get().relations[username]) return
      const requestId = crypto.randomUUID()
      save({ relations: { ...get().relations, [username]: { username, display_name: name, status: 'outgoing', requestId } }, outbox: [...get().outbox, queue(username, 'request', requestId)] })
      void get().flush()
    },
    accept: username => {
      const relation = get().relations[username]
      if (relation?.status !== 'incoming') return
      save({ relations: { ...get().relations, [username]: { ...relation, status: 'friend' } }, outbox: [...get().outbox, queue(username, 'accept', relation.requestId)] })
      void get().flush()
    },
    remove: username => {
      const relation = get().relations[username]
      if (!relation) return
      const relations = { ...get().relations }; delete relations[username]
      save({ relations, outbox: [...get().outbox, queue(username, relation.status === 'incoming' ? 'decline' : 'remove', relation.requestId)] })
      void get().flush()
    },
    flush: async () => {
      const owner = get().owner; const send = transport; const activeSending = sending
      if (!owner || !send) return
      // Only the oldest event for each peer is sent until its acknowledgement arrives.
      const peers = new Set(get().outbox.map(event => event.username))
      await Promise.all([...peers].map(async username => {
        if (activeSending.has(username)) return
        const event = get().outbox.find(item => item.username === username)
        if (!event) return
        activeSending.add(username)
        try { await send(username, { id: event.id, action: event.action, requestId: event.requestId }) } catch { /* Retry after presence returns. */ }
        finally { activeSending.delete(username) }
        if (get().owner === owner && !get().outbox.some(item => item.id === event.id) && get().outbox.some(item => item.username === username)) void get().flush()
      }))
    },
    receive: async (username, name, value) => {
      if (!get().owner || username === get().owner || !value || typeof value !== 'object') return
      const packet = value as Partial<FriendEvent> & { ack?: string }
      if (validId(packet.ack)) {
        save({ outbox: get().outbox.filter(event => event.username !== username || event.id !== packet.ack) })
        void get().flush(); return
      }
      if (!validId(packet.id) || !validId(packet.requestId) || !['request', 'accept', 'decline', 'remove'].includes(packet.action || '')) return
      if (!(get().seen[username] || []).includes(packet.id)) {
        const relations = { ...get().relations }; const current = relations[username]
        let outbox = get().outbox
        if (packet.action === 'request' && !current) relations[username] = { username, display_name: name, status: 'incoming', requestId: packet.requestId }
        else if (packet.action === 'request' && current?.status === 'outgoing') {
          relations[username] = { ...current, status: 'friend', requestId: [current.requestId, packet.requestId].sort()[0] }
          outbox = [...outbox, queue(username, 'accept', packet.requestId)]
        } else if (packet.action === 'accept' && current?.status === 'outgoing' && current.requestId === packet.requestId) relations[username] = { ...current, status: 'friend' }
        else if ((packet.action === 'remove' || packet.action === 'decline') && current?.requestId === packet.requestId) delete relations[username]
        save({ relations, outbox, seen: { ...get().seen, [username]: [...(get().seen[username] || []), packet.id].slice(-256) } })
      }
      await transport?.(username, { ack: packet.id }).catch(() => {})
      void get().flush()
    },
  }
})
