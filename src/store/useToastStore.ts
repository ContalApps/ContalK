import { create } from 'zustand'

// Avisos rápidos que somem sozinhos (alguém entrou na chamada, começou a transmitir...).
// Não vão para o histórico do sino nem pedem para marcar como lido.
export interface Toast { id: string; title: string; body: string; kind: 'voice' | 'live' | 'info' }

const TOAST_MS = 4500
const timers = new Map<string, ReturnType<typeof setTimeout>>()

export const useToastStore = create<{ toasts: Toast[]; push: (toast: Toast) => void; dismiss: (id: string) => void }>((set, get) => ({
  toasts: [],
  push: toast => {
    if (get().toasts.some(item => item.id === toast.id)) return
    set({ toasts: [...get().toasts, toast].slice(-3) })
    timers.set(toast.id, setTimeout(() => get().dismiss(toast.id), TOAST_MS))
  },
  dismiss: id => {
    clearTimeout(timers.get(id))
    timers.delete(id)
    set({ toasts: get().toasts.filter(item => item.id !== id) })
  }
}))
