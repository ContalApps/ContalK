import { create } from 'zustand'
import { invoke, isTauri } from '@tauri-apps/api/core'

export type SocialProvider = 'google' | 'instagram' | 'linkedin'

export interface LinkedSocialAccount {
  provider: SocialProvider
  accountId: string
  email?: string
  username?: string
  displayName?: string
  avatarUrl?: string
  linkedAt: string
}

export interface User {
  id: string
  username: string
  email: string
  display_name: string
  avatar?: string
  bio?: string
  created_at: string
  linkedAccounts?: Record<string, LinkedSocialAccount>
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
  linkSocialAccount: (provider: SocialProvider, accountData: Partial<LinkedSocialAccount>) => Promise<void>
  unlinkSocialAccount: (provider: SocialProvider) => Promise<void>
  loginWithSocial: (provider: SocialProvider, accountData?: Partial<LinkedSocialAccount>) => Promise<boolean>
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

  linkSocialAccount: async (provider: SocialProvider, accountData: Partial<LinkedSocialAccount>) => {
    const current = get().user
    if (!current) throw new Error('Entre na sua conta para vincular redes sociais.')
    const electron = (window as any).contalkDesktop
    if (electron?.socialLink) {
      const updatedUser = await electron.socialLink(provider, accountData)
      localStorage.setItem('contalspeak_current_user', JSON.stringify(updatedUser))
      set({ user: updatedUser })
      return
    }
    const linked = current.linkedAccounts || {}
    const updatedUser: User = {
      ...current,
      linkedAccounts: {
        ...linked,
        [provider]: {
          provider,
          accountId: accountData.accountId || accountData.email || accountData.username || `id_${Date.now()}`,
          email: accountData.email,
          username: accountData.username,
          displayName: accountData.displayName || accountData.username || accountData.email,
          avatarUrl: accountData.avatarUrl,
          linkedAt: new Date().toISOString()
        }
      }
    }
    localStorage.setItem('contalspeak_current_user', JSON.stringify(updatedUser))
    set({ user: updatedUser })
  },

  unlinkSocialAccount: async (provider: SocialProvider) => {
    const current = get().user
    if (!current) throw new Error('Entre na sua conta.')
    const electron = (window as any).contalkDesktop
    if (electron?.socialUnlink) {
      const updatedUser = await electron.socialUnlink(provider)
      localStorage.setItem('contalspeak_current_user', JSON.stringify(updatedUser))
      set({ user: updatedUser })
      return
    }
    if (current.linkedAccounts && current.linkedAccounts[provider]) {
      const copy = { ...current.linkedAccounts }
      delete copy[provider]
      const updatedUser: User = { ...current, linkedAccounts: copy }
      localStorage.setItem('contalspeak_current_user', JSON.stringify(updatedUser))
      set({ user: updatedUser })
    }
  },

  loginWithSocial: async (provider: SocialProvider, accountData?: Partial<LinkedSocialAccount>) => {
    set({ isLoading: true, error: null })
    const electron = (window as any).contalkDesktop
    if (electron?.socialLogin) {
      try {
        const res = await electron.socialLogin(provider, accountData || {})
        if (res.type === 'Success') {
          localStorage.setItem('contalspeak_token', res.data.token)
          localStorage.setItem('contalspeak_current_user', JSON.stringify(res.data.user))
          set({
            user: res.data.user,
            token: res.data.token,
            isAuthenticated: true,
            isLoading: false
          })
          return true
        } else {
          set({ error: res.data || 'Falha ao autenticar com rede social', isLoading: false })
          return false
        }
      } catch (err: any) {
        set({ error: err.message || 'Falha ao autenticar com rede social', isLoading: false })
        return false
      }
    }
    try {
      const email = accountData?.email || `user@${provider}.com`
      const username = (accountData?.username || accountData?.email?.split('@')[0] || `user_${provider}`).toLowerCase().replace(/[^a-z0-9_-]/g, '')
      const user: User = {
        id: `social-${provider}-${Date.now()}`,
        username,
        email,
        display_name: accountData?.displayName || username,
        created_at: new Date().toISOString(),
        linkedAccounts: {
          [provider]: {
            provider,
            accountId: accountData?.accountId || email,
            email: accountData?.email,
            username: accountData?.username,
            displayName: accountData?.displayName || username,
            linkedAt: new Date().toISOString()
          }
        }
      }
      const token = `social-token-${provider}-${Date.now()}`
      localStorage.setItem('contalspeak_token', token)
      localStorage.setItem('contalspeak_current_user', JSON.stringify(user))
      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false
      })
      return true
    } catch (err: any) {
      set({ error: err.message || 'Falha no login social', isLoading: false })
      return false
    }
  },
}))
