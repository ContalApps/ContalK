import { create } from 'zustand'
import { useAuthStore } from './useAuthStore'

export interface GoogleIntegrationState {
  connected: boolean
  email?: string
  displayName?: string
  accessToken?: string
  apiKey?: string
  enabledServices: {
    gmail: boolean
    youtube: boolean
    calendar: boolean
    drive: boolean
  }
}

export interface AppsStoreState {
  google: GoogleIntegrationState
  isLoading: boolean
  error: string | null
  loadConfig: () => Promise<void>
  saveGoogleConfig: (updates: Partial<GoogleIntegrationState>) => Promise<void>
  toggleService: (service: 'gmail' | 'youtube' | 'calendar' | 'drive') => Promise<void>
  connectGoogleDirect: (email?: string, name?: string) => Promise<void>
  disconnectGoogle: () => Promise<void>
}

const DEFAULT_GOOGLE_STATE: GoogleIntegrationState = {
  connected: true,
  email: 'usuario@gmail.com',
  displayName: 'Conta Google Conectada',
  enabledServices: {
    gmail: true,
    youtube: true,
    calendar: true,
    drive: true
  }
}

export const useAppsStore = create<AppsStoreState>((set, get) => ({
  google: (() => {
    try {
      const saved = localStorage.getItem('contalk:apps:google')
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return DEFAULT_GOOGLE_STATE
  })(),
  isLoading: false,
  error: null,

  loadConfig: async () => {
    set({ isLoading: true, error: null })
    try {
      const desktop = window.contalkDesktop
      if (desktop?.appsGetConfig) {
        const config = await desktop.appsGetConfig()
        if (config?.google) {
          set({ google: config.google })
          try {
            localStorage.setItem('contalk:apps:google', JSON.stringify(config.google))
          } catch { /* ignore */ }
        }
      } else {
        // Sync with linked social account if available
        const user = useAuthStore.getState().user
        const linkedGoogle = user?.linkedAccounts?.google
        if (linkedGoogle) {
          const updated: GoogleIntegrationState = {
            ...get().google,
            connected: true,
            email: linkedGoogle.email || get().google.email,
            displayName: linkedGoogle.displayName || get().google.displayName
          }
          set({ google: updated })
        }
      }
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Falha ao carregar configurações de apps.' })
    } finally {
      set({ isLoading: false })
    }
  },

  saveGoogleConfig: async (updates: Partial<GoogleIntegrationState>) => {
    const nextGoogle = { ...get().google, ...updates }
    set({ google: nextGoogle })
    try {
      localStorage.setItem('contalk:apps:google', JSON.stringify(nextGoogle))
      const desktop = window.contalkDesktop
      if (desktop?.appsSaveConfig) {
        await desktop.appsSaveConfig({ google: nextGoogle })
      }
    } catch { /* ignore */ }
  },

  toggleService: async (service: 'gmail' | 'youtube' | 'calendar' | 'drive') => {
    const current = get().google
    const updatedServices = {
      ...current.enabledServices,
      [service]: !current.enabledServices[service]
    }
    await get().saveGoogleConfig({ enabledServices: updatedServices })
  },

  connectGoogleDirect: async (email?: string, name?: string) => {
    const user = useAuthStore.getState().user
    const linked = user?.linkedAccounts?.google
    const googleEmail = email || linked?.email || user?.email || 'usuario@gmail.com'
    const googleName = name || linked?.displayName || user?.display_name || 'Conta Google'

    const nextGoogle: GoogleIntegrationState = {
      connected: true,
      email: googleEmail,
      displayName: googleName,
      enabledServices: {
        gmail: true,
        youtube: true,
        calendar: true,
        drive: true
      }
    }
    await get().saveGoogleConfig(nextGoogle)
  },

  disconnectGoogle: async () => {
    const nextGoogle: GoogleIntegrationState = {
      ...get().google,
      connected: false
    }
    await get().saveGoogleConfig(nextGoogle)
  }
}))
