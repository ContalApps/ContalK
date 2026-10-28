import { create } from 'zustand'
import { useAuthStore } from './useAuthStore'
import { useCommunityStore } from './useCommunityStore'

export interface LiveCursor {
  id: string
  name: string
  color: string
  fileId: string
  filePath?: string
  line: number
  ch: number
  lastSeen: number
}

const CURSOR_COLORS = [
  '#ff4081', // pink
  '#00e5ff', // cyan
  '#7c4dff', // purple
  '#00e676', // neon green
  '#ff9100', // orange
  '#ffea00', // bright yellow
  '#2979ff', // royal blue
  '#f50057', // rose
  '#00b0ff', // sky blue
  '#1de9b6'  // teal
]

export function getCollaboratorColor(identity: string): string {
  if (!identity) return CURSOR_COLORS[0]
  let hash = 0
  for (let i = 0; i < identity.length; i++) {
    hash = identity.charCodeAt(i) + ((hash << 5) - hash)
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

interface DevCollaborationState {
  remoteCursors: Record<string, LiveCursor>
  activeFileId: string
  lastLocalBroadcast: number
  broadcastCursor: (fileId: string, filePath: string, line: number, ch: number) => void
  broadcastCode: (fileId: string, code: string) => void
  handleRemoteCursor: (cursor: LiveCursor) => void
  handleRemoteCode: (fileId: string, code: string, timestamp: number, authorId: string) => void
  setActiveFileId: (fileId: string) => void
  cleanupStaleCursors: () => void
}

let collabChannel: BroadcastChannel | null = null
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    collabChannel = new BroadcastChannel('contalk-dev-collab-v1')
  }
} catch {
  // BroadcastChannel unavailable
}

export const useDevCollaborationStore = create<DevCollaborationState>((set, get) => {
  // Listen for local cross-window / cross-tab broadcast
  if (collabChannel) {
    collabChannel.onmessage = (event) => {
      const data = event.data
      if (!data || typeof data !== 'object') return
      const currentUsername = useAuthStore.getState().user?.username
      if (data.type === 'cursor' && data.id !== currentUsername) {
        get().handleRemoteCursor({
          id: data.id,
          name: data.name || data.id,
          color: data.color || getCollaboratorColor(data.id),
          fileId: data.fileId,
          filePath: data.filePath,
          line: data.line,
          ch: data.ch,
          lastSeen: data.lastSeen || Date.now()
        })
      } else if (data.type === 'code' && data.id !== currentUsername) {
        get().handleRemoteCode(data.fileId, data.code, data.timestamp, data.id)
      }
    }
  }

  // Periodic cleanup of stale cursors (>15 seconds without activity)
  if (typeof window !== 'undefined') {
    setInterval(() => {
      get().cleanupStaleCursors()
    }, 5000)
  }

  return {
    remoteCursors: {},
    activeFileId: '',
    lastLocalBroadcast: 0,

    setActiveFileId: (fileId: string) => set({ activeFileId: fileId }),

    cleanupStaleCursors: () => {
      const now = Date.now()
      const cursors = get().remoteCursors
      let changed = false
      const next: Record<string, LiveCursor> = {}
      for (const [id, c] of Object.entries(cursors)) {
        if (now - c.lastSeen < 15000) {
          next[id] = c
        } else {
          changed = true
        }
      }
      if (changed) {
        set({ remoteCursors: next })
      }
    },

    handleRemoteCursor: (cursor: LiveCursor) => {
      set((state) => ({
        remoteCursors: {
          ...state.remoteCursors,
          [cursor.id]: {
            ...cursor,
            lastSeen: Date.now()
          }
        }
      }))
    },

    handleRemoteCode: (fileId: string, code: string, timestamp: number, authorId: string) => {
      // Dispatched to custom window event so layout can update tabCodes without circular dependencies
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('contalk-remote-code-update', {
            detail: { fileId, code, timestamp, authorId }
          })
        )
      }
    },

    broadcastCursor: (fileId: string, filePath: string, line: number, ch: number) => {
      const now = Date.now()
      // Throttle broadcasts to at most once every 60ms
      if (now - get().lastLocalBroadcast < 60) return
      set({ lastLocalBroadcast: now })

      const user = useAuthStore.getState().user
      if (!user) return

      const payload = {
        type: 'cursor',
        id: user.username,
        name: user.display_name || user.username,
        color: getCollaboratorColor(user.username),
        fileId,
        filePath,
        line,
        ch,
        lastSeen: now
      }

      // 1. Broadcast locally (cross-window/cross-tab)
      try {
        collabChannel?.postMessage(payload)
      } catch { /* ignore */ }

      // 2. Broadcast to community room (WebSocket network)
      void useCommunityStore.getState().broadcastDevCursor(fileId, filePath, line, ch)
    },

    broadcastCode: (fileId: string, code: string) => {
      const user = useAuthStore.getState().user
      if (!user) return

      const payload = {
        type: 'code',
        id: user.username,
        fileId,
        code,
        timestamp: Date.now()
      }

      try {
        collabChannel?.postMessage(payload)
      } catch { /* ignore */ }

      void useCommunityStore.getState().broadcastDevCode(fileId, code)
    }
  }
})
