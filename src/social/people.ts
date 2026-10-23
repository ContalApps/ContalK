import type { Member } from '../store/useCommunityStore'
import type { Friendship } from '../store/useFriendStore'
import type { Message } from '../store/useAppStore'

export function friendPeople(members: Member[], relations: Record<string, Friendship>, owner: string): Member[] {
  return Object.values(relations).filter(r => r.status === 'friend' && r.username !== owner).map(r => members.find(m => m.username === r.username) || { username: r.username, display_name: r.display_name, online: false })
}

export function directPeople(members: Member[], friends: Member[], messages: Record<string, Message[]>, owner: string, selected: string | null): Member[] {
  const contacts = new Map(friends.map(member => [member.username, member]))
  for (const [id, history] of Object.entries(messages)) {
    const parts = id.split(':')
    if (parts.length !== 3 || parts[0] !== 'dm' || !parts.slice(1).includes(owner) || !history.length) continue
    const username = parts.slice(1).find(name => name !== owner)
    if (!username) continue
    const author = history.find(message => message.userId === username)
    contacts.set(username, members.find(m => m.username === username) || { username, display_name: author?.userName || username, online: false })
  }
  const peer = members.find(member => member.username === selected && member.username !== owner)
  if (peer) contacts.set(peer.username, peer)
  return [...contacts.values()]
}
