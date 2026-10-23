import { create } from 'zustand'

export type Theme = 'classic' | 'vice-city'
interface Preferences { interfaceScale:number; theme: Theme; reducedMotion: boolean; textSize: 100 | 110 | 120 }
const defaults: Preferences = { interfaceScale:100, theme: 'classic', reducedMotion: false, textSize: 100 }
const validScale=(value:unknown):value is number=>typeof value==='number'&&Number.isInteger(value)&&value>=80&&value<=125&&value%5===0
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
    set({ owner, interfaceScale: validScale(saved.interfaceScale) ? saved.interfaceScale : 100, theme: saved.theme === 'vice-city' ? 'vice-city' : 'classic', reducedMotion: saved.reducedMotion === true, textSize: saved.textSize === 110 || saved.textSize === 120 ? saved.textSize : 100 })
  },
  update: patch => {
    const owner = get().owner
    if (!owner) return
    const current = get()
    if(patch.interfaceScale!==undefined&&!validScale(patch.interfaceScale))throw new Error('Escala inválida.')
    const next = { interfaceScale:patch.interfaceScale??current.interfaceScale, theme: patch.theme ?? current.theme, reducedMotion: patch.reducedMotion ?? current.reducedMotion, textSize: patch.textSize ?? current.textSize }
    localStorage.setItem(storageKey(owner), JSON.stringify(next))
    set(next)
  },
}))
