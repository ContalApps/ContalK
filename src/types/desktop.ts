export type UpdateState = {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'
  version: string
  progress: number
  error?: string
}
export interface DesktopSource {
  id: string
  name: string
  thumbnail: string
  appIcon: string | null
  display_id: string
  isScreen: boolean
  width: number
  height: number
  isPrimary: boolean
}
export interface DesktopBridge {
  getSession: (token: string) => Promise<import('../store/useAuthStore').User | null>
  listAccounts: () => Promise<import('../store/useAuthStore').User[]>
  updateProfile: (profile: {display_name: string; bio: string; avatar: string}) => Promise<import('../store/useAuthStore').User>
  logout: () => Promise<void>
  isElectron: true
  getDesktopSources: () => Promise<DesktopSource[]>
  getLiveKitToken: (params: { room: string; identity: string; name: string }) => Promise<string>
  login: (params: { identifier: string; password: string }) => Promise<any>
  register: (params: { username: string; email: string; password: string }) => Promise<any>
  getUpdateState: () => Promise<UpdateState>
  checkForUpdates: () => Promise<UpdateState>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
  onUpdateState: (listener: (state: UpdateState) => void) => () => void
  startCaptureAudio: (sourceId: string) => Promise<{ sessionId: string; sampleRate: number; channels: number }>
  stopCaptureAudio: (sessionId: string) => Promise<void>
  onCaptureAudioData: (listener: (event: { sessionId: string; data: Uint8Array }) => void) => () => void
  onCaptureAudioError: (listener: (event: { sessionId: string; error: string }) => void) => () => void
}
declare global {
  interface Window { contalkDesktop?: DesktopBridge }
}
