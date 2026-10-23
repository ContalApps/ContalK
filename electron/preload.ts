import { ipcRenderer, contextBridge } from 'electron'
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
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  getLiveKitToken: params => ipcRenderer.invoke('get-livekit-token', params),
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
