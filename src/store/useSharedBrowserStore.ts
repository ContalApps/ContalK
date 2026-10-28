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
  isDetached: boolean
  collaborators: Record<string, CollaboratorCursor>
  lastCursorBroadcast: number

  startSharing: (roomId: string, initialUrl?: string) => Promise<void>
  stopSharing: () => Promise<void>
  toggleDetach: () => Promise<void>
  setAllowCollaboration: (allow: boolean) => void
  navigate: (url: string) => Promise<void>
  sendClick: (xPercent: number, yPercent: number) => Promise<void>
  sendCursor: (xPercent: number, yPercent: number) => void
  goBack: () => Promise<void>
  goForward: () => Promise<void>
  reload: () => Promise<void>
  cleanupStaleCollaborators: () => void
  sendType: (text: string) => Promise<void>
  sendKey: (key: string) => Promise<void>
  handleRemoteMessage: (data: unknown, senderIdentity?: string) => Promise<void> | void
  requestSync: () => void
}

let sharedChannel: BroadcastChannel | null = null
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    sharedChannel = new BroadcastChannel('contalk-shared-browser-v1')
  }
} catch {
  // BroadcastChannel unavailable
}

async function broadcastBrowserMessage(msg: unknown) {
  try {
    sharedChannel?.postMessage(msg)
  } catch {
    // Local broadcast error ignored
  }
  try {
    const { useCommunityStore } = await import('./useCommunityStore')
    await useCommunityStore.getState().broadcastSharedBrowser(msg)
  } catch {
    // Remote network broadcast error ignored
  }
}

let syncIntervalTimer: ReturnType<typeof setInterval> | null = null

export const useSharedBrowserStore = create<SharedBrowserState>((set, get) => {
  // Listen for broadcast messages from local BroadcastChannel
  if (sharedChannel) {
    sharedChannel.onmessage = async (event) => {
      await get().handleRemoteMessage(event.data)
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
    isDetached: false,
    collaborators: {},
    lastCursorBroadcast: 0,

    handleRemoteMessage: async (rawData: unknown, senderIdentity?: string) => {
      if (!rawData || typeof rawData !== 'object') return
      const data = rawData as Record<string, any>
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
          const collabId = data.fromId || senderIdentity || 'user'
          if (collabId === currentUsername) return
          const userColor = getCollaboratorColor(collabId)
          set((state) => ({
            collaborators: {
              ...state.collaborators,
              [collabId]: {
                id: collabId,
                name: data.fromName || collabId,
                color: data.color || userColor,
                xPercent: data.xPercent,
                yPercent: data.yPercent,
                lastSeen: Date.now(),
                lastClick: state.collaborators[collabId]?.lastClick
              }
            }
          }))
          break
        }

        case 'COLLAB_CLICK': {
          const collabId = data.fromId || senderIdentity || 'user'
          const userColor = getCollaboratorColor(collabId)
          // Registra clique visual em todos os clientes
          set((state) => ({
            collaborators: {
              ...state.collaborators,
              [collabId]: {
                id: collabId,
                name: data.fromName || collabId,
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
                    void broadcastBrowserMessage({ type: 'SESSION_SYNC', session: updated })
                  }
                }
              }, 250)
            }
          }
          break
        }

        case 'COLLAB_TYPE': {
          if (get().isHost && get().activeSession?.allowCollaboration) {
            const desktop = window.contalkDesktop
            if (desktop?.browserInsertText) {
              await desktop.browserInsertText(data.text)
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
                    void broadcastBrowserMessage({ type: 'SESSION_SYNC', session: updated })
                  }
                }
              }, 200)
            }
          }
          break
        }

        case 'COLLAB_KEY': {
          if (get().isHost && get().activeSession?.allowCollaboration) {
            const desktop = window.contalkDesktop
            if (desktop?.browserSendKey) {
              await desktop.browserSendKey(data.key)
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
                    void broadcastBrowserMessage({ type: 'SESSION_SYNC', session: updated })
                  }
                }
              }, 200)
            }
          }
          break
        }

        case 'COLLAB_NAVIGATE': {
          if (get().isHost && get().activeSession?.allowCollaboration) {
            const desktop = window.contalkDesktop
            if (desktop?.browserNavigate) {
              await desktop.browserNavigate(data.url)
              if (desktop.browserSanitizedScreenshot) {
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
                  void broadcastBrowserMessage({ type: 'SESSION_SYNC', session: updated })
                }
              }
            }
          }
          break
        }

        case 'REQUEST_SYNC': {
          if (get().isHost && get().activeSession) {
            void broadcastBrowserMessage({
              type: 'SESSION_SYNC',
              session: get().activeSession
            })
          }
          break
        }
      }
    },

    requestSync: () => {
      if (!get().isHost) {
        void broadcastBrowserMessage({ type: 'REQUEST_SYNC' })
      }
    },

    startSharing: async (roomId: string, initialUrl = 'https://www.google.com') => {
      const desktop = window.contalkDesktop
      const user = useAuthStore.getState().user
      const hostId = user?.username || 'user'
      const hostName = user?.display_name || user?.username || 'Anfitrião'

      // Abre janela interna do navegador (embutida por padrão, sem destacar no SO)
      if (desktop?.browserOpen) {
        await desktop.browserOpen(initialUrl, false)
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
        isDetached: false,
        collaborators: {}
      })

      void broadcastBrowserMessage({ type: 'SESSION_SYNC', session })

      // Inicia loop de streaming / sincronização periódica a ~1.3fps (750ms)
      if (syncIntervalTimer) clearInterval(syncIntervalTimer)
      syncIntervalTimer = setInterval(async () => {
        if (!get().isHost || !get().isSharing) return
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
              void broadcastBrowserMessage({ type: 'SESSION_SYNC', session: updated })
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
        void broadcastBrowserMessage({ type: 'SESSION_STOP', roomId: cur.roomId })
      }

      set({
        activeSession: null,
        isHost: false,
        isSharing: false,
        collaborators: {}
      })
    },

    toggleDetach: async () => {
      const desktop = window.contalkDesktop
      if (!desktop) return
      if (get().isDetached) {
        await desktop.browserHide?.()
        set({ isDetached: false })
      } else {
        await desktop.browserShow?.()
        set({ isDetached: true })
      }
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
      void broadcastBrowserMessage({
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
            void broadcastBrowserMessage({ type: 'SESSION_SYNC', session: updated })
          }
        }
      } else if (cur.allowCollaboration) {
        // Envia solicitação de navegação ao host
        void broadcastBrowserMessage({
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
        void broadcastBrowserMessage({
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
        void broadcastBrowserMessage({
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

      void broadcastBrowserMessage({
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

    sendType: async (text: string) => {
      const cur = get().activeSession
      if (!cur) return

      if (get().isHost) {
        const desktop = window.contalkDesktop
        if (desktop?.browserInsertText) {
          await desktop.browserInsertText(text)
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
            void broadcastBrowserMessage({ type: 'SESSION_SYNC', session: updated })
          }
        }
      } else if (cur.allowCollaboration) {
        void broadcastBrowserMessage({
          type: 'COLLAB_TYPE',
          roomId: cur.roomId,
          text
        })
      }
    },

    sendKey: async (key: string) => {
      const cur = get().activeSession
      if (!cur) return

      if (get().isHost) {
        const desktop = window.contalkDesktop
        if (desktop?.browserSendKey) {
          await desktop.browserSendKey(key)
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
            void broadcastBrowserMessage({ type: 'SESSION_SYNC', session: updated })
          }
        }
      } else if (cur.allowCollaboration) {
        void broadcastBrowserMessage({
          type: 'COLLAB_KEY',
          roomId: cur.roomId,
          key
        })
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
