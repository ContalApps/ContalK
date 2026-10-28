import { validInputMode,validPushToTalkKey,type VoiceInputMode } from '../media/voice-input'
import { create } from 'zustand'

export type Theme = 'classic' | 'vice-city'
interface Preferences { soundboardVolume:number;speechAuto:boolean;speechVoice:string;speechVolume:number; prioritySpeaker:boolean; voiceInputMode:VoiceInputMode;pushToTalkKey:string; voiceSensitivity:number; voiceAutoSensitivity:boolean; interfaceScale:number; theme: Theme; reducedMotion: boolean; textSize: 100 | 110 | 120; titleBarSearch: boolean; titleBarHelp: boolean; sidebarCollapsed:boolean; membersCollapsed:boolean; systemNotifications:boolean;roleMentionNotifications:boolean; sidebarHidden:boolean; railHidden:boolean; bottomPanelOpen:boolean; bottomPanelHeight:number; workspaceFolder:string }
const defaults: Preferences = { soundboardVolume:50,speechAuto:false,speechVoice:'default',speechVolume:100, prioritySpeaker:false, voiceInputMode:'voice-activity',pushToTalkKey:'F8', voiceSensitivity:20, voiceAutoSensitivity:true, interfaceScale:100, theme: 'classic', reducedMotion: false, textSize: 100, titleBarSearch: true, titleBarHelp: true, sidebarCollapsed:false,membersCollapsed:false,systemNotifications:true,roleMentionNotifications:true, sidebarHidden:false, railHidden:false, bottomPanelOpen:false, bottomPanelHeight:260, workspaceFolder:'' }
const validScale=(value:unknown):value is number=>typeof value==='number'&&Number.isInteger(value)&&value>=80&&value<=120
const validPanelHeight=(value:unknown):value is number=>typeof value==='number'&&Number.isInteger(value)&&value>=120&&value<=900
const validFolder=(value:unknown):value is string=>typeof value==='string'&&value.length<=1000&&(value===''||/^([a-zA-Z]:[\\/]|\\\\|\/)/.test(value))
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
    set({ owner,soundboardVolume:typeof saved.soundboardVolume==='number'&&Number.isInteger(saved.soundboardVolume)&&saved.soundboardVolume>=0&&saved.soundboardVolume<=100?saved.soundboardVolume:50,speechAuto:saved.speechAuto===true,speechVoice:typeof saved.speechVoice==='string'&&saved.speechVoice.length<=200?saved.speechVoice:'default',speechVolume:typeof saved.speechVolume==='number'&&Number.isInteger(saved.speechVolume)&&saved.speechVolume>=0&&saved.speechVolume<=100?saved.speechVolume:100,prioritySpeaker:saved.prioritySpeaker===true,voiceInputMode:validInputMode(saved.voiceInputMode)?saved.voiceInputMode:'voice-activity',pushToTalkKey:validPushToTalkKey(saved.pushToTalkKey)?saved.pushToTalkKey:'F8', voiceSensitivity:typeof saved.voiceSensitivity==='number'&&saved.voiceSensitivity>=0&&saved.voiceSensitivity<=100?saved.voiceSensitivity:20, voiceAutoSensitivity:saved.voiceAutoSensitivity!==false, interfaceScale: validScale(saved.interfaceScale) ? saved.interfaceScale : typeof saved.interfaceScale==='number'&&saved.interfaceScale>120&&saved.interfaceScale<=125 ? 120 : 100, theme: saved.theme === 'vice-city' ? 'vice-city' : 'classic', reducedMotion: saved.reducedMotion === true, textSize: saved.textSize === 110 || saved.textSize === 120 ? saved.textSize : 100, titleBarSearch: saved.titleBarSearch !== false, titleBarHelp: saved.titleBarHelp !== false,sidebarCollapsed:saved.sidebarCollapsed===true,membersCollapsed:saved.membersCollapsed===true,systemNotifications:saved.systemNotifications!==false,roleMentionNotifications:saved.roleMentionNotifications!==false, sidebarHidden:saved.sidebarHidden===true, railHidden:saved.railHidden===true, bottomPanelOpen:saved.bottomPanelOpen===true, bottomPanelHeight:validPanelHeight(saved.bottomPanelHeight)?saved.bottomPanelHeight:260, workspaceFolder:validFolder(saved.workspaceFolder)?saved.workspaceFolder:'' })
  },
  update: patch => {
    const owner = get().owner
    if (!owner) return
    const current = get()
    if(patch.interfaceScale!==undefined&&!validScale(patch.interfaceScale))throw new Error('Escala inválida.')
    if(patch.voiceInputMode!==undefined&&!validInputMode(patch.voiceInputMode)||patch.pushToTalkKey!==undefined&&!validPushToTalkKey(patch.pushToTalkKey))throw new Error('Configuração de voz inválida.')
    if(patch.speechVoice!==undefined&&(typeof patch.speechVoice!=='string'||patch.speechVoice.length>200)||patch.speechVolume!==undefined&&(!Number.isInteger(patch.speechVolume)||patch.speechVolume<0||patch.speechVolume>100))throw new Error('Configuração de leitura inválida.')
    if(patch.soundboardVolume!==undefined&&(!Number.isInteger(patch.soundboardVolume)||patch.soundboardVolume<0||patch.soundboardVolume>100))throw new Error('Volume de sons inválido.')
    if(patch.bottomPanelHeight!==undefined&&!validPanelHeight(patch.bottomPanelHeight)||patch.workspaceFolder!==undefined&&!validFolder(patch.workspaceFolder))throw new Error('Configuração de painel inválida.')
    const next = { soundboardVolume:patch.soundboardVolume??current.soundboardVolume,speechAuto:patch.speechAuto??current.speechAuto,speechVoice:patch.speechVoice??current.speechVoice,speechVolume:patch.speechVolume??current.speechVolume,prioritySpeaker:patch.prioritySpeaker??current.prioritySpeaker,voiceInputMode:patch.voiceInputMode??current.voiceInputMode,pushToTalkKey:patch.pushToTalkKey??current.pushToTalkKey, voiceSensitivity:patch.voiceSensitivity!==undefined&&patch.voiceSensitivity>=0&&patch.voiceSensitivity<=100?patch.voiceSensitivity:current.voiceSensitivity, voiceAutoSensitivity:patch.voiceAutoSensitivity!==undefined?patch.voiceAutoSensitivity:current.voiceAutoSensitivity, interfaceScale:patch.interfaceScale??current.interfaceScale, theme: patch.theme ?? current.theme, reducedMotion: patch.reducedMotion ?? current.reducedMotion, textSize: patch.textSize ?? current.textSize, titleBarSearch: patch.titleBarSearch ?? current.titleBarSearch, titleBarHelp: patch.titleBarHelp ?? current.titleBarHelp,sidebarCollapsed:patch.sidebarCollapsed??current.sidebarCollapsed,membersCollapsed:patch.membersCollapsed??current.membersCollapsed,systemNotifications:patch.systemNotifications??current.systemNotifications,roleMentionNotifications:patch.roleMentionNotifications??current.roleMentionNotifications, sidebarHidden:patch.sidebarHidden??current.sidebarHidden, railHidden:patch.railHidden??current.railHidden, bottomPanelOpen:patch.bottomPanelOpen??current.bottomPanelOpen, bottomPanelHeight:patch.bottomPanelHeight??current.bottomPanelHeight, workspaceFolder:patch.workspaceFolder??current.workspaceFolder }
    localStorage.setItem(storageKey(owner), JSON.stringify(next))
    set(next)
  },
}))
