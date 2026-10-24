import { ipcRenderer, contextBridge, webFrame } from 'electron'
import type { DesktopBridge } from '../src/types/desktop'

function subscribe<T>(channel: string, listener: (event: T) => void) {
  const handler = (_event: Electron.IpcRendererEvent, value: T) => listener(value)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}
const desktop: DesktopBridge = {
  getSession: token => ipcRenderer.invoke('auth-session', token),
  listAccounts: () => ipcRenderer.invoke('auth-accounts'),
  updateProfile: profile => ipcRenderer.invoke('auth-profile', profile),
  logout: () => ipcRenderer.invoke('auth-logout'),
  isElectron: true,
  setTitleBarAppearance: (theme, scale) => ipcRenderer.send('window-titlebar-appearance', theme, scale),
  setInterfaceScale: percent => {
    if(!Number.isInteger(percent)||percent<80||percent>120)throw new Error('Escala inválida.')
    webFrame.setZoomFactor(percent/100)
  },
  uploadInlineAttachment:attachment=>ipcRenderer.invoke('storage-inline',attachment),
  claimMessageView:id=>ipcRenderer.invoke('storage-view',id),
  storageStatus:()=>ipcRenderer.invoke('storage-status'),
  configureStorage:config=>ipcRenderer.invoke('storage-configure',config),
  selectStorageFile:()=>ipcRenderer.invoke('storage-select'),
  uploadStorageFile:id=>ipcRenderer.invoke('storage-upload',id),
  openStorageFile:id=>ipcRenderer.invoke('storage-open',id),
  shareStorageFile:(id,recipient)=>ipcRenderer.invoke('storage-share',id,recipient),
  setSpeaking: speaking => ipcRenderer.send('voice-speaking',speaking),
  setTrayState: state => ipcRenderer.send('tray-voice-state',state),
  onTrayAction: listener => subscribe('tray-action',listener),
  notifyActivity: notice => ipcRenderer.send('activity-notify',notice),
  onNotificationOpen: listener => subscribe('notification-open',listener),
  communityStatus:()=>ipcRenderer.invoke('community-status'),
  configureCommunity:value=>ipcRenderer.invoke('community-configure',value),
  communitySnapshot:serverId=>ipcRenderer.invoke('community-snapshot',serverId),
  communityHistory:(serverId,channelId,before)=>ipcRenderer.invoke('community-history',serverId,channelId,before),
  communityCommand:(serverId,revision,action)=>ipcRenderer.invoke('community-command',serverId,revision,action),
  communityVoiceToken:(serverId,channelId)=>ipcRenderer.invoke('community-voice-token',serverId,channelId),
  communityPresenceToken:name=>ipcRenderer.invoke('community-presence-token',name),
  communityOccupants:serverId=>ipcRenderer.invoke('community-occupants',serverId),
  subscribeCommunity:serverId=>ipcRenderer.invoke('community-subscribe',serverId),
  unsubscribeCommunity:()=>ipcRenderer.invoke('community-unsubscribe'),
  onCommunityState:listener=>subscribe('community-state',listener),
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  login: params => ipcRenderer.invoke('auth-login', params),
  register: params => ipcRenderer.invoke('auth-register', params),
  getUpdateState: () => ipcRenderer.invoke('update-get-state'),
  checkForUpdates: () => ipcRenderer.invoke('update-check'),
  downloadUpdate: () => ipcRenderer.invoke('update-download'),
  installUpdate: () => ipcRenderer.invoke('update-install'),
  onUpdateState: listener => subscribe('update-state', listener),
  startCaptureAudio: sourceId => ipcRenderer.invoke('capture-audio-start', sourceId),
  stopCaptureAudio: sessionId => ipcRenderer.invoke('capture-audio-stop', sessionId),
  onCaptureAudioData: listener => subscribe('capture-audio-data', listener),
  onCaptureAudioError: listener => subscribe('capture-audio-error', listener),
}
contextBridge.exposeInMainWorld('contalkDesktop', desktop)
