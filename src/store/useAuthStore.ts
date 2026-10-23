import { create } from 'zustand'
import { invoke, isTauri } from '@tauri-apps/api/core'

export interface User {
  id: string
  username: string
  email: string
  display_name: string
  created_at: string
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
  isAuthenticated: boolean

  // Actions
  login: (identifier: string, password: string) => Promise<boolean>
  register: (username: string, email: string, password: string) => Promise<boolean>
  loginAsDemo: () => void
  logout: () => Promise<void>
  checkSession: () => Promise<boolean>
  clearError: () => void
}

// Contas pré-configuradas para modo Web / Preview
const MOCK_ACCOUNTS: Record<string, { email: string; pass: string; name: string }> = {
  alice: { email: 'alice@contalk.local', pass: 'alice123', name: 'Alice Silva' },
  bob: { email: 'bob@contalk.local', pass: 'bob12345', name: 'Bob Santos' },
  carol: { email: 'carol@contalk.local', pass: 'carol123', name: 'Carol Oliveira' },
  dave: { email: 'dave@contalk.local', pass: 'dave1234', name: 'Dave Lima' },
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('contalspeak_token'),
  isLoading: false,
  error: null,
  isAuthenticated: false,

  login: async (identifier: string, password: string) => {
    set({ isLoading: true, error: null })

    // Se estiver no Electron Desktop (Arquitetura Discord)
    const electron = (window as any).contalkDesktop
    if (electron?.login) {
      try {
        const res = await electron.login({ identifier, password })
        if (res.type === 'Success') {
          localStorage.setItem('contalspeak_token', res.data.token)
          localStorage.setItem('contalspeak_current_user', JSON.stringify(res.data.user))
          set({
            user: res.data.user,
            token: res.data.token,
            isAuthenticated: true,
            isLoading: false,
          })
          return true
        } else {
          set({ error: res.data || 'Credenciais inválidas', isLoading: false })
          return false
        }
      } catch (err: any) {
        set({ error: err.message || 'Falha ao autenticar', isLoading: false })
        return false
      }
    }

    // Se estiver rodando dentro do Tauri Desktop
    if (isTauri()) {
      try {
        const response = await invoke<{ token: string; user: User }>('login', {
          payload: { identifier, password },
        })
        localStorage.setItem('contalspeak_token', response.token)
        set({
          user: response.user,
          token: response.token,
          isAuthenticated: true,
          isLoading: false,
        })
        return true
      } catch (err: any) {
        set({
          error: typeof err === 'string' ? err : 'Credenciais inválidas',
          isLoading: false,
        })
        return false
      }
    }

    // Modo Web / Preview (Fallback navegador)
    const idNorm = identifier.trim().toLowerCase()
    const storedUsers = JSON.parse(localStorage.getItem('contalspeak_web_users') || '{}')
    const allUsers = { ...MOCK_ACCOUNTS, ...storedUsers }

    const foundKey = Object.keys(allUsers).find(
      (u) => u.toLowerCase() === idNorm || allUsers[u].email.toLowerCase() === idNorm
    )

    if (foundKey && allUsers[foundKey].pass === password) {
      const uData = allUsers[foundKey]
      const user: User = {
        id: `web-${foundKey}`,
        username: foundKey,
        email: uData.email,
        display_name: uData.name || foundKey,
        created_at: new Date().toISOString(),
      }
      const token = `web-token-${foundKey}`
      localStorage.setItem('contalspeak_token', token)
      localStorage.setItem('contalspeak_current_user', JSON.stringify(user))

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      })
      return true
    }

    set({
      error: 'Credenciais inválidas. Dica: use alice / alice123 ou crie uma conta!',
      isLoading: false,
    })
    return false
  },

  register: async (username: string, email: string, password: string) => {
    set({ isLoading: true, error: null })

    // Se estiver no Electron Desktop (Arquitetura Discord)
    const electron = (window as any).contalkDesktop
    if (electron?.register) {
      try {
        const res = await electron.register({ username, email, password })
        if (res.type === 'Success') {
          localStorage.setItem('contalspeak_token', res.data.token)
          localStorage.setItem('contalspeak_current_user', JSON.stringify(res.data.user))
          set({
            user: res.data.user,
            token: res.data.token,
            isAuthenticated: true,
            isLoading: false,
          })
          return true
        } else {
          set({ error: res.data || 'Erro ao registrar usuário', isLoading: false })
          return false
        }
      } catch (err: any) {
        set({ error: err.message || 'Erro ao registrar usuário', isLoading: false })
        return false
      }
    }

    if (isTauri()) {
      try {
        const response = await invoke<{ token: string; user: User }>('register', {
          payload: { username, email, password },
        })
        localStorage.setItem('contalspeak_token', response.token)
        set({
          user: response.user,
          token: response.token,
          isAuthenticated: true,
          isLoading: false,
        })
        return true
      } catch (err: any) {
        set({
          error: typeof err === 'string' ? err : 'Erro ao registrar usuário',
          isLoading: false,
        })
        return false
      }
    }

    // Modo Web / Preview
    const storedUsers = JSON.parse(localStorage.getItem('contalspeak_web_users') || '{}')
    const allUsers = { ...MOCK_ACCOUNTS, ...storedUsers }

    if (allUsers[username.toLowerCase()]) {
      set({ error: 'Username já está em uso', isLoading: false })
      return false
    }

    storedUsers[username.toLowerCase()] = {
      email,
      pass: password,
      name: username,
    }
    localStorage.setItem('contalspeak_web_users', JSON.stringify(storedUsers))

    const user: User = {
      id: `web-${username}`,
      username,
      email,
      display_name: username,
      created_at: new Date().toISOString(),
    }
    const token = `web-token-${username}`
    localStorage.setItem('contalspeak_token', token)
    localStorage.setItem('contalspeak_current_user', JSON.stringify(user))

    set({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    })
    return true
  },

  loginAsDemo: () => {
    const user: User = {
      id: 'demo-user-001',
      username: 'visitante',
      email: 'visitante@contalspeak.local',
      display_name: 'Visitante Convidado',
      created_at: new Date().toISOString(),
    }
    set({
      user,
      token: 'demo-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    })
  },

  logout: async () => {
    if (isTauri()) {
      try {
        await invoke('logout')
      } catch {
        // Silencioso
      }
    }
    localStorage.removeItem('contalspeak_token')
    localStorage.removeItem('contalspeak_current_user')
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    })
  },

  checkSession: async () => {
    const token = get().token
    if (!token) return false

    set({ isLoading: true })

    const electron = (window as any).contalkDesktop
    if (electron) {
      const savedUserStr = localStorage.getItem('contalspeak_current_user')
      if (savedUserStr) {
        try {
          const user = JSON.parse(savedUserStr)
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          })
          return true
        } catch {}
      }
    }

    if (isTauri()) {
      try {
        const user = await invoke<User>('check_session', { token })
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        })
        return true
      } catch {
        localStorage.removeItem('contalspeak_token')
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        })
        return false
      }
    }

    // Modo Web
    const stored = localStorage.getItem('contalspeak_current_user')
    if (stored) {
      try {
        const user = JSON.parse(stored)
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        })
        return true
      } catch {
        localStorage.removeItem('contalspeak_token')
        localStorage.removeItem('contalspeak_current_user')
      }
    }

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    })
    return false
  },

  clearError: () => set({ error: null }),
}))
