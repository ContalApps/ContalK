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
  communityAiStatus:()=>Promise<{configured:boolean;contextTokens:number;maxOutputTokens:number}>
  communityAiConfigure:(value:{key?:string;contextTokens:number;maxOutputTokens:number})=>Promise<{configured:boolean;contextTokens:number;maxOutputTokens:number}>
  communityAiRemove:()=>Promise<void>
  communityAiSelectFiles:()=>Promise<Array<{id:string;name:string;size:number;type:string}>>
  communityAiStart:(serverId:string,channelId:string,text:string,fileIds:string[],limits?:{contextTokens:number;maxOutputTokens:number})=>Promise<{runId:string;promptId:string;model:string}>
  communityAiStop:(serverId:string,channelId:string)=>Promise<{stopping:boolean;runId:string}>
  communityAiSubscribe:(serverId:string,channelId:string)=>Promise<void>
  communityAiUnsubscribe:()=>Promise<void>
  onCommunityAiEvent:(listener:(event:import('../roles/ai').AiEvent)=>void)=>()=>void
  communityStatus:()=>Promise<{configured:boolean;url?:string}>
  configureCommunity:(value:{url:string;token:string})=>Promise<void>
  communitySnapshot:(serverId:string)=>Promise<import('../roles/types').CommunitySnapshot>
  communityInvitePreview:(code:string)=>Promise<import('../roles/invites').InvitePreview>
  communityInviteAccept:(code:string)=>Promise<import('../roles/types').CommunitySnapshot>
  communityInsights:(serverId:string,days:7|30,timeZone:string)=>Promise<import('../roles/insights').CommunityInsights>
  communityPins:(serverId:string,channelId:string)=>Promise<{serverId:string;channelId:string;revision:number;messages:import('../store/useAppStore').Message[]}>
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
  readSelectedStorageAudio:(id:string)=>Promise<string>
  readStorageAudio:(id:string)=>Promise<string>
  uploadInlineAttachment:(attachment:import('../store/useAppStore').Attachment)=>Promise<import('../store/useAppStore').Attachment>
  claimMessageView:(id:string)=>Promise<boolean>
  storageStatus:()=>Promise<boolean>
  configureStorage:(config:{url:string;token:string})=>Promise<void>
  selectStorageFile:()=>Promise<{id:string;name:string;size:number;type:string;thumbnail?:string}|null>
  uploadStorageFile:(id:string)=>Promise<import('../store/useAppStore').Attachment>
  openStorageFile:(id:string)=>Promise<void>
  shareStorageFile:(id:string,recipient:string)=>Promise<void>
  speechVoices:()=>Promise<Array<{id:string;label:string;language:string}>>
  synthesizeSpeech:(text:string,voice:string)=>Promise<string|null>
  cancelSpeech:()=>void
  communityExpressionLibraries:()=>Promise<Array<{id:string;name:string;count:number}>>
  communityExpressions:(serverId:string)=>Promise<import('../roles/expressions').ExpressionLibrary>
  communityWebhook:(serverId:string,revision:number,action:import('../roles/webhooks').WebhookCommand)=>Promise<import('../roles/webhooks').WebhookResult>
  communityMessage:(serverId:string,channelId:string,messageId:string)=>Promise<import('../store/useAppStore').Message>
  configureVoiceInput:(value:{key:string;id:string}|null)=>Promise<void>
  onVoiceInputKey:(listener:(value:{id:string|null;pressed:boolean;error?:string})=>void)=>()=>void
  setSpeaking: (speaking:boolean)=>void
  setTrayState:(state:{connected:boolean;micMuted:boolean;deafened:boolean;micBlocked?:boolean;outputBlocked?:boolean})=>void
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
