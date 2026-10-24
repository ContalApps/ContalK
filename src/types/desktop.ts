export type UpdateState = {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'installing' | 'error'
  version: string
  progress: number
  error?: string
  releaseNotes?: string
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
  communityStatus:()=>Promise<{configured:boolean;url?:string}>
  configureCommunity:(value:{url:string;token:string})=>Promise<void>
  communitySnapshot:(serverId:string)=>Promise<import('../roles/types').CommunitySnapshot>
  communityHistory:(serverId:string,channelId:string,before?:string)=>Promise<import('../roles/types').CommunityHistory>
  communityCommand:(serverId:string,revision:number,action:import('../roles/types').CommunityAction)=>Promise<import('../roles/types').CommunitySnapshot>
  communityVoiceToken:(serverId:string,channelId:string)=>Promise<{url:string;token:string}>
  communityPresenceToken:(name:string)=>Promise<{url:string;token:string}>
  communityOccupants:(serverId:string)=>Promise<Record<string,import('../store/useVoiceStore').VoiceParticipant[]>>
  subscribeCommunity:(serverId:string)=>Promise<void>
  unsubscribeCommunity:()=>Promise<void>
  onCommunityState:(listener:(event:import('../roles/types').CommunityEvent)=>void)=>()=>void
  getSession: (token: string) => Promise<import('../store/useAuthStore').User | null>
  listAccounts: () => Promise<import('../store/useAuthStore').User[]>
  updateProfile: (profile: {display_name: string; bio: string; avatar: string}) => Promise<import('../store/useAuthStore').User>
  logout: () => Promise<void>
  uploadInlineAttachment:(attachment:import('../store/useAppStore').Attachment)=>Promise<import('../store/useAppStore').Attachment>
  claimMessageView:(id:string)=>Promise<boolean>
  storageStatus:()=>Promise<boolean>
  configureStorage:(config:{url:string;token:string})=>Promise<void>
  selectStorageFile:()=>Promise<{id:string;name:string;size:number;type:string;thumbnail?:string}|null>
  uploadStorageFile:(id:string)=>Promise<import('../store/useAppStore').Attachment>
  openStorageFile:(id:string)=>Promise<void>
  shareStorageFile:(id:string,recipient:string)=>Promise<void>
  setSpeaking: (speaking:boolean)=>void
  setTrayState:(state:{connected:boolean;micMuted:boolean;deafened:boolean})=>void
  onTrayAction:(listener:(action:string)=>void)=>()=>void
  notifyActivity:(notice:import('../store/useNotificationStore').ActivityNotice)=>void
  onNotificationOpen:(listener:(id:string)=>void)=>()=>void
  setInterfaceScale:(percent:number)=>void
  setTitleBarAppearance: (theme: 'classic' | 'vice-city', scale: number) => void
  isElectron: true
  getDesktopSources: () => Promise<DesktopSource[]>
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
