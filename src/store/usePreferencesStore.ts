import { create } from 'zustand'

export type Theme = 'classic' | 'vice-city'
interface Preferences { theme: Theme; reducedMotion: boolean; textSize: 100 | 110 | 120 }
const defaults: Preferences = { theme: 'classic', reducedMotion: false, textSize: 100 }
const storageKey = (owner: string) => `contalk-preferences-v1:${owner}`

export const usePreferencesStore = create<Preferences & {
  owner: string | null
  activate: (owner: string | null) => void
  update: (patch: Partial<Preferences>) => void
}>((set, get) => ({
  ...defaults, owner: null,
  activate: owner => {
    let saved: Partial<Preferences> = {}
    try { saved = JSON.parse(owner ? localStorage.getItem(storageKey(owner)) || '{}' : '{}') || {} } catch { /* Use defaults. */ }
    set({ owner, theme: saved.theme === 'vice-city' ? 'vice-city' : 'classic', reducedMotion: saved.reducedMotion === true, textSize: saved.textSize === 110 || saved.textSize === 120 ? saved.textSize : 100 })
  },
  update: patch => {
    const owner = get().owner
    if (!owner) return
    const current = get()
    const next = { theme: patch.theme ?? current.theme, reducedMotion: patch.reducedMotion ?? current.reducedMotion, textSize: patch.textSize ?? current.textSize }
    localStorage.setItem(storageKey(owner), JSON.stringify(next))
    set(next)
  },
}))
