import { create } from 'zustand'
import { useAuthStore } from './useAuthStore'
import { getCollaboratorColor } from './useDevCollaborationStore'

export interface CollaboratorCursor {
  id: string
  name: string
  color: string
  xPercent: number
  yPercent: number
  lastSeen: number
  lastClick?: { xPercent: number; yPercent: number; time: number }
}

export interface SharedBrowserSession {
  roomId: string
  hostId: string
  hostName: string
  url: string
  title: string
  screenshot: string
  hasPasswordField: boolean
  allowCollaboration: boolean
  lastUpdated: number
}

interface SharedBrowserState {
  activeSession: SharedBrowserSession | null
  isHost: boolean
  isSharing: boolean
  collaborators: Record<string, CollaboratorCursor>
  lastCursorBroadcast: number

  startSharing: (roomId: string, initialUrl?: string) => Promise<void>
  stopSharing: () => Promise<void>
  setAllowCollaboration: (allow: boolean) => void
  navigate: (url: string) => Promise<void>
  sendClick: (xPercent: number, yPercent: number) => Promise<void>
  sendCursor: (xPercent: number, yPercent: number) => void
  goBack: () => Promise<void>
  goForward: () => Promise<void>
  reload: () => Promise<void>
  cleanupStaleCollaborators: () => void
}

let sharedChannel: BroadcastChannel | null = null
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    sharedChannel = new BroadcastChannel('contalk-shared-browser-v1')
  }
} catch {
  // BroadcastChannel unavailable
}

let syncIntervalTimer: ReturnType<typeof setInterval> | null = null

export const useSharedBrowserStore = create<SharedBrowserState>((set, get) => {
  // Listen for broadcast messages from other peers/windows
  if (sharedChannel) {
    sharedChannel.onmessage = async (event) => {
      const data = event.data
      if (!data || typeof data !== 'object') return
      const currentUser = useAuthStore.getState().user
      const currentUsername = currentUser?.username

      switch (data.type) {
        case 'SESSION_SYNC': {
          if (get().isHost) return // Host maintains source of truth
          const session = data.session as SharedBrowserSession
          if (!session) return
          set({
            activeSession: {
              ...session,
              lastUpdated: Date.now()
            }
          })
          break
        }

        case 'SESSION_CONFIG': {
          if (get().isHost) return
          const cur = get().activeSession
          if (cur && cur.roomId === data.roomId) {
            set({
              activeSession: {
                ...cur,
                allowCollaboration: Boolean(data.allowCollaboration),
                lastUpdated: Date.now()
              }
            })
          }
          break
        }

        case 'SESSION_STOP': {
          const cur = get().activeSession
          if (cur && cur.roomId === data.roomId && !get().isHost) {
            set({ activeSession: null, collaborators: {} })
          }
          break
        }

        case 'COLLAB_CURSOR': {
          if (data.fromId === currentUsername) return
          const userColor = getCollaboratorColor(data.fromId)
          set((state) => ({
            collaborators: {
              ...state.collaborators,
              [data.fromId]: {
                id: data.fromId,
                name: data.fromName || data.fromId,
                color: data.color || userColor,
                xPercent: data.xPercent,
                yPercent: data.yPercent,
                lastSeen: Date.now(),
                lastClick: state.collaborators[data.fromId]?.lastClick
              }
            }
          }))
          break
        }

        case 'COLLAB_CLICK': {
          const userColor = getCollaboratorColor(data.fromId)
          // Registra clique visual em todos os clientes
          set((state) => ({
            collaborators: {
              ...state.collaborators,
              [data.fromId]: {
                id: data.fromId,
                name: data.fromName || data.fromId,
                color: data.color || userColor,
                xPercent: data.xPercent,
                yPercent: data.yPercent,
                lastSeen: Date.now(),
                lastClick: {
                  xPercent: data.xPercent,
                  yPercent: data.yPercent,
                  time: Date.now()
                }
              }
            }
          }))

          // Se for o host e colaboração estiver permitida, executa o clique no navegador interno do host
          if (get().isHost && get().activeSession?.allowCollaboration) {
            const desktop = window.contalkDesktop
            if (desktop?.browserClickAt) {
              await desktop.browserClickAt(data.xPercent, data.yPercent)
              // Captura quadro atualizado logo após o clique
              setTimeout(async () => {
                if (get().isHost && desktop.browserSanitizedScreenshot) {
                  const res = await desktop.browserSanitizedScreenshot()
                  const cur = get().activeSession
                  if (cur) {
                    const updated = {
                      ...cur,
                      url: res.url,
                      title: res.title,
                      screenshot: res.src,
                      hasPasswordField: res.hasPasswordField,
                      lastUpdated: Date.now()
                    }
                    set({ activeSession: updated })
                    sharedChannel?.postMessage({ type: 'SESSION_SYNC', session: updated })
                  }
                }
              }, 250)
            }
          }
          break
        }

        case 'COLLAB_NAVIGATE': {
          if (get().isHost && get().activeSession?.allowCollaboration) {
            const desktop = window.contalkDesktop
            if (desktop?.browserNavigate) {
              await desktop.browserNavigate(data.url)
            }
          }
          break
        }

        case 'REQUEST_SYNC': {
          if (get().isHost && get().activeSession) {
            sharedChannel?.postMessage({
              type: 'SESSION_SYNC',
              session: get().activeSession
            })
          }
          break
        }
      }
    }
  }

  // Periodic cleanup of stale collaborators (>10s)
  if (typeof window !== 'undefined') {
    setInterval(() => {
      get().cleanupStaleCollaborators()
    }, 4000)
  }

  return {
    activeSession: null,
    isHost: false,
    isSharing: false,
    collaborators: {},
    lastCursorBroadcast: 0,

    startSharing: async (roomId: string, initialUrl = 'https://www.google.com') => {
      const desktop = window.contalkDesktop
      const user = useAuthStore.getState().user
      const hostId = user?.username || 'user'
      const hostName = user?.display_name || user?.username || 'Anfitrião'

      // Abre janela interna do navegador
      if (desktop?.browserOpen) {
        await desktop.browserOpen(initialUrl, true)
      }

      // Captura inicial protegida
      let initialShot = { src: '', url: initialUrl, title: 'Navegador Web', hasPasswordField: false }
      if (desktop?.browserSanitizedScreenshot) {
        try {
          initialShot = await desktop.browserSanitizedScreenshot()
        } catch {
          // ignore
        }
      }

      const session: SharedBrowserSession = {
        roomId,
        hostId,
        hostName,
        url: initialShot.url || initialUrl,
        title: initialShot.title || 'Navegador Web',
        screenshot: initialShot.src,
        hasPasswordField: initialShot.hasPasswordField,
        allowCollaboration: false,
        lastUpdated: Date.now()
      }

      set({
        activeSession: session,
        isHost: true,
        isSharing: true,
        collaborators: {}
      })

      // Anuncia sessão para os integrantes da sala
      sharedChannel?.postMessage({ type: 'SESSION_SYNC', session })

      // Inicia loop de sincronização periódico (quadros sanitizados sem senhas)
      if (syncIntervalTimer) clearInterval(syncIntervalTimer)
      syncIntervalTimer = setInterval(async () => {
        if (!get().isHost || !get().isSharing) {
          if (syncIntervalTimer) clearInterval(syncIntervalTimer)
          return
        }

        if (desktop?.browserSanitizedScreenshot) {
          try {
            const shot = await desktop.browserSanitizedScreenshot()
            const cur = get().activeSession
            if (cur) {
              const updated: SharedBrowserSession = {
                ...cur,
                url: shot.url || cur.url,
                title: shot.title || cur.title,
                screenshot: shot.src || cur.screenshot,
                hasPasswordField: shot.hasPasswordField,
                lastUpdated: Date.now()
              }
              set({ activeSession: updated })
              sharedChannel?.postMessage({ type: 'SESSION_SYNC', session: updated })
            }
          } catch {
            // ignore
          }
        }
      }, 750)
    },

    stopSharing: async () => {
      const cur = get().activeSession
      if (syncIntervalTimer) {
        clearInterval(syncIntervalTimer)
        syncIntervalTimer = null
      }

      if (cur) {
        sharedChannel?.postMessage({ type: 'SESSION_STOP', roomId: cur.roomId })
      }

      set({
        activeSession: null,
        isHost: false,
        isSharing: false,
        collaborators: {}
      })
    },

    setAllowCollaboration: (allow: boolean) => {
      const cur = get().activeSession
      if (!cur || !get().isHost) return

      const updated = {
        ...cur,
        allowCollaboration: allow,
        lastUpdated: Date.now()
      }
      set({ activeSession: updated })
      sharedChannel?.postMessage({
        type: 'SESSION_CONFIG',
        roomId: cur.roomId,
        allowCollaboration: allow
      })
    },

    navigate: async (url: string) => {
      const cur = get().activeSession
      if (!cur) return

      if (get().isHost) {
        const desktop = window.contalkDesktop
        if (desktop?.browserNavigate) {
          await desktop.browserNavigate(url)
          if (desktop.browserSanitizedScreenshot) {
            const shot = await desktop.browserSanitizedScreenshot()
            const updated = {
              ...cur,
              url: shot.url,
              title: shot.title,
              screenshot: shot.src,
              hasPasswordField: shot.hasPasswordField,
              lastUpdated: Date.now()
            }
            set({ activeSession: updated })
            sharedChannel?.postMessage({ type: 'SESSION_SYNC', session: updated })
          }
        }
      } else if (cur.allowCollaboration) {
        // Envia solicitação de navegação ao host
        sharedChannel?.postMessage({
          type: 'COLLAB_NAVIGATE',
          roomId: cur.roomId,
          url
        })
      }
    },

    sendClick: async (xPercent: number, yPercent: number) => {
      const cur = get().activeSession
      if (!cur) return

      const user = useAuthStore.getState().user
      const currentUsername = user?.username || 'user'
      const currentName = user?.display_name || user?.username || 'Você'
      const color = getCollaboratorColor(currentUsername)

      // Se for o host:
      if (get().isHost) {
        const desktop = window.contalkDesktop
        if (desktop?.browserClickAt) {
          await desktop.browserClickAt(xPercent, yPercent)
        }
        // Broadcast visual do clique para os participantes
        sharedChannel?.postMessage({
          type: 'COLLAB_CLICK',
          roomId: cur.roomId,
          fromId: currentUsername,
          fromName: currentName,
          color,
          xPercent,
          yPercent
        })
      } else if (cur.allowCollaboration) {
        // Participante com permissão de interagir
        sharedChannel?.postMessage({
          type: 'COLLAB_CLICK',
          roomId: cur.roomId,
          fromId: currentUsername,
          fromName: currentName,
          color,
          xPercent,
          yPercent
        })
      }
    },

    sendCursor: (xPercent: number, yPercent: number) => {
      const cur = get().activeSession
      if (!cur) return

      const now = Date.now()
      if (now - get().lastCursorBroadcast < 90) return // Throttled to ~11fps

      set({ lastCursorBroadcast: now })
      const user = useAuthStore.getState().user
      const currentUsername = user?.username || 'user'
      const currentName = user?.display_name || user?.username || 'Você'
      const color = getCollaboratorColor(currentUsername)

      sharedChannel?.postMessage({
        type: 'COLLAB_CURSOR',
        roomId: cur.roomId,
        fromId: currentUsername,
        fromName: currentName,
        color,
        xPercent,
        yPercent
      })
    },

    goBack: async () => {
      const cur = get().activeSession
      if (!cur) return
      if (get().isHost || cur.allowCollaboration) {
        const desktop = window.contalkDesktop
        if (desktop?.browserGoBack) {
          await desktop.browserGoBack()
        }
      }
    },

    goForward: async () => {
      const cur = get().activeSession
      if (!cur) return
      if (get().isHost || cur.allowCollaboration) {
        const desktop = window.contalkDesktop
        if (desktop?.browserGoForward) {
          await desktop.browserGoForward()
        }
      }
    },

    reload: async () => {
      const cur = get().activeSession
      if (!cur) return
      if (get().isHost || cur.allowCollaboration) {
        const desktop = window.contalkDesktop
        if (desktop?.browserReload) {
          await desktop.browserReload()
        }
      }
    },

    cleanupStaleCollaborators: () => {
      const now = Date.now()
      const collabs = get().collaborators
      let changed = false
      const next: Record<string, CollaboratorCursor> = {}
      for (const [id, c] of Object.entries(collabs)) {
        if (now - c.lastSeen < 10000) {
          next[id] = c
        } else {
          changed = true
        }
      }
      if (changed) {
        set({ collaborators: next })
      }
    }
  }
})
