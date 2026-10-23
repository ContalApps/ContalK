import { ipcRenderer, contextBridge } from 'electron'

// Expondo a API nativa do ContalK para o frontend React
contextBridge.exposeInMainWorld('contalkDesktop', {
  isElectron: true,
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  getLiveKitToken: (params: { room: string; identity: string; name: string }) =>
    ipcRenderer.invoke('get-livekit-token', params),
  login: (params: { identifier: string; password: string }) =>
    ipcRenderer.invoke('auth-login', params),
  register: (params: { username: string; email: string; password: string }) =>
    ipcRenderer.invoke('auth-register', params),
})
