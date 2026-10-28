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
export interface WorkspaceFileEntry {
  name: string
  path: string
  isDirectory: boolean
  size?: number
}
export interface LinkPreviewData {
  url: string
  title?: string
  description?: string
  image?: string
  siteName?: string
  favicon?: string
}
export interface DesktopBridge {
  fetchLinkPreview?:(url:string)=>Promise<LinkPreviewData|null>
  getStorageFileUrl?:(id:string)=>Promise<string>
  communityAiStatus:()=>Promise<{configured:boolean;providers:import('../roles/ai').AiProviderId[];contextTokens:number;maxOutputTokens:number}>
  communityAiConfigure:(value:{provider?:import('../roles/ai').AiProviderId;key?:string;contextTokens:number;maxOutputTokens:number})=>Promise<{configured:boolean;providers:import('../roles/ai').AiProviderId[];contextTokens:number;maxOutputTokens:number}>
  communityAiRemove:(provider?:import('../roles/ai').AiProviderId)=>Promise<void>
  communityAiModels:(provider:import('../roles/ai').AiProviderId,endpoint?:string)=>Promise<{models:Array<{id:string;name:string}>}>
  communityAiSelectFiles:()=>Promise<Array<{id:string;name:string;size:number;type:string}>>
  communityAiStart:(serverId:string,channelId:string,text:string,fileIds:string[],limits?:{contextTokens:number;maxOutputTokens:number},provider?:import('../roles/ai').AiProviderId,model?:string)=>Promise<{runId:string;promptId:string;model:string}>
  communityAiGenerateImage?:(prompt:string,provider?:import('../roles/ai').AiProviderId,model?:string)=>Promise<{src:string;prompt:string;provider:string;model:string}>
  communityAiStop:(serverId:string,channelId:string,runId?:string)=>Promise<{stopping:boolean;runId:string}>
  communityAiSubscribe:(serverId:string,channelId:string)=>Promise<void>
  communityAiUnsubscribe:()=>Promise<void>
  onCommunityAiEvent:(listener:(event:import('../roles/ai').AiEvent)=>void)=>()=>void
  communityStatus:()=>Promise<{configured:boolean;url?:string;reason?:string}>
  communityServers:()=>Promise<Array<{id:string;name:string}>>
  createCommunityServer:(name:string)=>Promise<import('../roles/types').CommunitySnapshot>
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
  quitApp:()=>Promise<void>
  editCommand:(command:'undo'|'redo'|'cut'|'copy'|'paste'|'delete'|'selectAll')=>Promise<void>
  toggleFullScreen:()=>Promise<boolean>
  openFolder:()=>Promise<string|null>
  workspaceListFiles:(dirPath:string)=>Promise<WorkspaceFileEntry[]>
  workspaceReadFile:(filePath:string)=>Promise<string>
  workspaceWriteFile:(filePath:string,content:string)=>Promise<boolean>
  workspaceExecCommand:(command:string,cwd?:string)=>Promise<{stdout:string;stderr:string;exitCode:number}>
  mcpListServers:()=>Promise<Array<{name:string;command:string;args:string[];env?:Record<string,string>;disabled?:boolean}>>
  mcpSaveServer:(server:{name:string;command:string;args:string[];env?:Record<string,string>;disabled?:boolean})=>Promise<boolean>
  mcpRemoveServer:(name:string)=>Promise<boolean>
  mcpListTools:(serverName:string)=>Promise<{tools:Array<{name:string;description?:string;inputSchema?:Record<string,unknown>}>}>
  mcpCallTool:(serverName:string,toolName:string,args?:Record<string,unknown>)=>Promise<any>
  appsGetConfig?:()=>Promise<any>
  appsSaveConfig?:(config:any)=>Promise<boolean>
  browserOpen?:(url?:string,show?:boolean)=>Promise<any>
  browserNavigate?:(url:string)=>Promise<{success:boolean;url:string;title:string}>
  browserClick?:(selector:string)=>Promise<{success:boolean;message:string;tag?:string;text?:string}>
  browserType?:(selector:string,text:string,submit?:boolean)=>Promise<{success:boolean;message:string;value?:string}>
  browserReadContent?:(selector?:string)=>Promise<{title:string;url:string;content:string;links:Array<{text:string;href:string}>;forms:Array<{name:string;type:string;placeholder:string}>}>
  browserScreenshot?:()=>Promise<{src:string;url:string;title:string}>
  browserScroll?:(direction?:'up'|'down',amount?:number)=>Promise<{success:boolean;direction:string}>
  browserEvaluate?:(script:string)=>Promise<any>
  browserGetStatus?:()=>Promise<any>
  browserShow?:()=>Promise<boolean>
  browserHide?:()=>Promise<boolean>
  browserClose?:()=>Promise<boolean>
  onBrowserStatusChanged?:(listener:(status:any)=>void)=>()=>void
  terminalCreate:(cwd:string|null,cols:number,rows:number)=>Promise<{id:string;shell:string;cwd:string}>
  terminalInput:(id:string,data:string)=>void
  terminalResize:(id:string,cols:number,rows:number)=>void
  terminalKill:(id:string)=>Promise<void>
  onTerminalData:(listener:(event:{id:string;data:string})=>void)=>()=>void
  onTerminalExit:(listener:(event:{id:string;code:number})=>void)=>()=>void
  readSelectedStorageAudio:(id:string)=>Promise<string>
  readStorageAudio:(id:string)=>Promise<string>
  uploadInlineAttachment:(attachment:import('../store/useAppStore').Attachment)=>Promise<import('../store/useAppStore').Attachment>
  claimMessageView:(id:string)=>Promise<boolean>
  storageStatus:()=>Promise<boolean>
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
  notifyActivity: (notice: import('../store/useNotificationStore').ActivityNotice) => void
  onNotificationOpen:(listener:(id:string)=>void)=>()=>void
  setInterfaceScale:(percent:number)=>void
  setTitleBarAppearance: (theme: 'classic' | 'vice-city', scale: number) => void
  isElectron: true
  getDesktopSources: () => Promise<DesktopSource[]>
  socialLink: (provider: 'google' | 'instagram' | 'linkedin', accountData: Record<string, unknown>) => Promise<import('../store/useAuthStore').User>
  socialUnlink: (provider: 'google' | 'instagram' | 'linkedin') => Promise<import('../store/useAuthStore').User>
  socialLogin: (provider: 'google' | 'instagram' | 'linkedin', accountData?: Record<string, unknown>) => Promise<{ type: 'Success'; data: { token: string; user: import('../store/useAuthStore').User } } | { type: 'Error'; data: string }>
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
