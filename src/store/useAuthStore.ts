import { create } from 'zustand'
import { invoke, isTauri } from '@tauri-apps/api/core'

export interface User {
  id: string
  username: string
  email: string
  display_name: string
  avatar?: string
  bio?: string
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
  updateProfile: (profile: { display_name: string; bio: string; avatar: string }) => Promise<void>
  logout: () => Promise<void>
  checkSession: () => Promise<boolean>
  clearError: () => void
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
    const allUsers = storedUsers

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
        avatar: uData.avatar, bio: uData.bio,
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
      error: 'Credenciais inválidas. Verifique seus dados ou crie uma conta.',
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
    const allUsers = storedUsers

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

  updateProfile: async profile => {
    const current = get().user
    if (!current) throw new Error('Entre na sua conta.')
    const user = window.contalkDesktop?.updateProfile ? await window.contalkDesktop.updateProfile(profile) : { ...current, ...profile }
    if (!window.contalkDesktop) {
      const accounts = JSON.parse(localStorage.getItem('contalspeak_web_users') || '{}')
      if (accounts[current.username]) Object.assign(accounts[current.username], { name: user.display_name, avatar: user.avatar, bio: user.bio })
      localStorage.setItem('contalspeak_web_users', JSON.stringify(accounts))
    }
    localStorage.setItem('contalspeak_current_user', JSON.stringify(user))
    set({ user })
  },

  logout: async () => {
    await window.contalkDesktop?.logout()
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
    if (electron?.getSession) {
      const user = await electron.getSession(token)
      if (user) { set({ user, token, isAuthenticated: true, isLoading: false }); return true }
      localStorage.removeItem('contalspeak_token')
      set({ user: null, token: null, isAuthenticated: false, isLoading: false })
      return false
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
