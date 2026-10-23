export type Route = { view: 'home' | 'server' | 'friends' | 'messages'; serverId: string; channelId: string; peer: string | null }
export type NavigationHistory = { entries: Route[]; index: number }
export function visit(history: NavigationHistory, route: Route): NavigationHistory {
  const current = history.entries[history.index]
  if (current && Object.keys(route).every(key => route[key as keyof Route] === current[key as keyof Route])) return history
  const entries = [...history.entries.slice(0, history.index + 1), route].slice(-50)
  return { entries, index: entries.length - 1 }
}
export function step(history: NavigationHistory, direction: -1 | 1): NavigationHistory {
  const index = history.index + direction
  return index < 0 || index >= history.entries.length ? history : { ...history, index }
}
