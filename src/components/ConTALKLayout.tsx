import { CommunityEvents } from './CommunityEvents'
import { ThreadCreate } from './ThreadCreate'
import { ThreadHeader } from './ThreadHeader'
import { threadArchived } from '../roles/permissions'
import { PinnedMessages } from './PinnedMessages'
import { ChatComposer, ChatMessage } from './MessageContent'
import { Fragment, useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo, lazy, Suspense } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import { useVoiceStore } from '../store/useVoiceStore'
import { VoiceStage } from './VoiceStage'
import { AudioSettings } from './AudioSettings'
import { HomeView } from './HomeView'
import { TitleBar } from './TitleBar'
import { visit, step, type NavigationHistory, type Route } from '../navigation/history'
import { Avatar } from './Avatar'
import { EditProfile } from './EditProfile'
import { CreateChannel } from './CreateChannel'
import { ParticipantMenu } from './ParticipantMenu'
import { useCommunityStore } from '../store/useCommunityStore'
import { useFriendStore } from '../store/useFriendStore'
import { friendPeople, directPeople } from '../social/people'
import { FriendButton } from './FriendButton'
import type { VoiceParticipant } from '../store/useVoiceStore'
import type { Channel } from '../store/useAppStore'
import { usePreferencesStore } from '../store/usePreferencesStore'
import { CoastalScene } from './CoastalScene'
import { SettingsView, type SettingsTabId } from './SettingsView'
import { ChannelRow } from './ChannelRow'
import { BrandMark } from './BrandMark'
import { CallTabs, type CallTab } from './CallTabs'
import { CallControls } from './CallControls'
import { MiniPlayer } from './MiniPlayer'
import { VoicePanel } from './VoicePanel'
import { ProfilePopover } from './ProfilePopover'
import { ActivityToasts } from './ActivityToasts'
import { usePresenceStatus } from '../store/usePresenceStatus'
import { ServerIcon } from './ServerIcon'
import { HomeDashboard, type LiveChannel } from './HomeDashboard'
import { ControlIcon, type ControlIconName } from './ControlIcon'
import type { NotepadTab } from './CollaborativeNotepad'
import type { SaveNoteDestination } from './SaveNoteModal'
import { useDevCollaborationStore } from '../store/useDevCollaborationStore'
import { RightPanel } from './RightPanel'
import { UserDock } from './UserDock'
import { ChannelSettings } from './ChannelSettings'
import { canSetNickname, memberDisplayName } from '../roles/nicknames'
import { RoleName, RoleBadge } from './RoleName'
import { MemberRoles } from './MemberRoles'
import { useRoleStore } from '../store/useRoleStore'
import { centralAllows } from '../roles/transport'
import { assignedRoles } from '../roles/permissions'
import { useNotificationStore } from '../store/useNotificationStore'
import { useDevStore } from '../store/useDevStore'
import { PROJECTS_ENABLED } from '../features'
import { uploadDroppedFile } from '../utils/dropUpload'
import '../themes.css'

const TerminalPanel = lazy(() => import('./TerminalPanel').then(m => ({ default: m.TerminalPanel })))
const CollaborativeNotepad = lazy(() => import('./CollaborativeNotepad').then(m => ({ default: m.CollaborativeNotepad })))
const SaveNoteModal = lazy(() => import('./SaveNoteModal').then(m => ({ default: m.SaveNoteModal })))
const CommandMenuModal = lazy(() => import('./CommandMenuModal').then(m => ({ default: m.CommandMenuModal })))
const ScreenShareModal = lazy(() => import('./ScreenShareModal').then(m => ({ default: m.ScreenShareModal })))
const RoleManager = lazy(() => import('./RoleManager').then(m => ({ default: m.RoleManager })))
const ServerDialog = lazy(() => import('./ServerDialog').then(m => ({ default: m.ServerDialog })))
const DevKanbanModal = lazy(() => import('./DevKanbanModal').then(m => ({ default: m.DevKanbanModal })))
const DevTasksModal = lazy(() => import('./DevTasksModal').then(m => ({ default: m.DevTasksModal })))
const DevDocsModal = lazy(() => import('./DevDocsModal').then(m => ({ default: m.DevDocsModal })))
const DevRoadmapModal = lazy(() => import('./DevRoadmapModal').then(m => ({ default: m.DevRoadmapModal })))
const DropChannelSelectModal = lazy(() => import('./DropChannelSelectModal').then(m => ({ default: m.DropChannelSelectModal })))

const iconAlias: Record<string, ControlIconName> = { '#': 'hash', members: 'friends', headphones: 'audio', 'Ω': 'audio', '×': 'close' }
function Icon({ name }: { name: string }) {
  return <span className="ct-icon" aria-hidden="true"><ControlIcon name={iconAlias[name] || (name as ControlIconName)} /></span>
}
function Atmosphere() {
  const theme = usePreferencesStore(s => s.theme)
  return theme === 'vice-city' ? <CoastalScene /> : null
}

export function ConTALKLayout() {
  const { user, logout } = useAuthStore()
  const preferences = usePreferencesStore()
  const activity = useNotificationStore()
  const devStore = useDevStore()

  useLayoutEffect(() => {
    const desktop = window.contalkDesktop
    if (desktop?.setInterfaceScale) {
      desktop.setInterfaceScale(preferences.interfaceScale)
      return
    }
    const root = document.documentElement
    root.style.zoom = String(preferences.interfaceScale / 100)
    root.style.setProperty('--ct-interface-scale', String(preferences.interfaceScale / 100))
  }, [preferences.interfaceScale])

  useLayoutEffect(() => () => {
    window.contalkDesktop?.setInterfaceScale?.(100)
    const root = document.documentElement
    root.style.removeProperty('zoom')
    root.style.removeProperty('--ct-interface-scale')
  }, [])

  useLayoutEffect(() => {
    usePreferencesStore.getState().activate(user?.username || null)
  }, [user?.username])

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [eventsOpen, setEventsOpen] = useState(false)
  const [eventTarget, setEventTarget] = useState<string | undefined>()
  const [rolesOpen, setRolesOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>('appearance')
  const [nicknameFirst, setNicknameFirst] = useState(false)
  const [memberRoles, setMemberRoles] = useState<string | null>(null)
  const roles = useRoleStore()
  const [threadCreate, setThreadCreate] = useState<string | null>(null)
  const [channelSettingsTab, setChannelSettingsTab] = useState<'general' | 'threads' | 'permissions'>('general')
  const [activeDevModal, setActiveDevModal] = useState<string | null>(null)
  const [devEditorOpen, setDevEditorOpen] = useState(false)
  const [saveNoteModalOpen, setSaveNoteModalOpen] = useState(false)
  const [commandMenuOpen, setCommandMenuOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }, [])

  const [isSavingCode, setIsSavingCode] = useState(false)

  const [editorTabs, setEditorTabs] = useState<NotepadTab[]>([
    { id: 'meeting-notes', name: 'Notas da Reunião.md', path: 'workspace/Notas da Reunião.md' },
    { id: 'tasks-ideas', name: 'Planejamento.md', path: 'workspace/Planejamento.md' },
    { id: 'scratchpad', name: 'Rascunho.md', path: 'workspace/Rascunho.md' }
  ])
  const [activeEditorTab, setActiveEditorTab] = useState('meeting-notes')
  const initialCodes: Record<string, string> = {
    'meeting-notes': `# 📝 Notas da Reunião - ConTalk\n\n**Data:** ${new Date().toLocaleDateString('pt-BR')}\n**Participantes:** Equipe de desenvolvimento\n\n---\n\n## Pauta Principal\n1. Qualidade de transmissão de voz e vídeo (WebRTC)\n2. Compartilhamento de tela e baixa latência\n3. Bloco de notas colaborativo em tempo real\n\n## Decisões Tomadas\n- Foco total em comunicação cristalina e compartilhamento de tela.\n- Bloco de notas com cursores simultâneos e markdown.\n`,
    'tasks-ideas': `# 🎯 Metas & Planejamento da Sprint\n\n- [x] Otimizar buffer e taxa de amostragem de áudio\n- [x] Unificar controles na barra de chamada (estilo Discord)\n- [ ] Testar transmissão de vídeo em 60fps 1080p\n- [ ] Adicionar suporte a exportação de notas em PDF\n`,
    'scratchpad': `# 💡 Rascunho Rápido\n\nDigite suas ideias e rascunhos aqui. Qualquer pessoa no canal pode editar em tempo real!\n`
  }
  const [tabCodes, setTabCodes] = useState<Record<string, string>>(initialCodes)

  const devCollab = useDevCollaborationStore()
  const liveRemoteCursors = devCollab.getRemoteCursorsForFile(activeEditorTab)

  const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('contalk:sidebar:hidden-sections')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const toggleSection = (sec: string) => {
    setHiddenSections(prev => {
      const next = { ...prev, [sec]: !prev[sec] }
      try {
        localStorage.setItem('contalk:sidebar:hidden-sections', JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const [terminalRequest, setTerminalRequest] = useState(0)
  const desktop = typeof window !== 'undefined' ? window.contalkDesktop : undefined

  useEffect(() => {
    const handleRemoteCodeUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail || !detail.fileId || typeof detail.code !== 'string') return
      if (detail.authorId === user?.username) return
      setTabCodes(prev => ({
        ...prev,
        [detail.fileId]: detail.code
      }))
    }
    window.addEventListener('contalk-remote-code-update', handleRemoteCodeUpdate)
    return () => window.removeEventListener('contalk-remote-code-update', handleRemoteCodeUpdate)
  }, [user?.username])

  const [pinnedChannel, setPinnedChannel] = useState<string | null>(null)
  const [channelSettings, setChannelSettings] = useState<Channel | null>(null)
  const { servers, activeServerId, activeChannelId, setActiveServer, setActiveChannel, messages } = useAppStore()
  const voice = useVoiceStore()
  const [callTab, setCallTab] = useState<CallTab>('conversa')
  const [selfCard, setSelfCard] = useState(false)
  const [navigation, setNavigation] = useState<NavigationHistory>(() => ({
    entries: [{ view: 'home', serverId: activeServerId, channelId: activeChannelId, peer: null }],
    index: 0
  }))
  const { view, peer: selectedPeer } = navigation.entries[navigation.index]

  const setView = (nextView: Route['view'], peer = selectedPeer) => {
    const state = useAppStore.getState()
    setNavigation(current =>
      visit(current, { view: nextView, peer, serverId: state.activeServerId, channelId: state.activeChannelId })
    )
  }

  const travel = (direction: -1 | 1) => {
    const next = step(navigation, direction)
    if (next === navigation) return
    const route = next.entries[next.index]
    const destination = servers.find(s => s.id === route.serverId) || servers[0]
    if (destination) {
      setActiveServer(destination.id)
      setActiveChannel(destination.channels.find(c => c.id === route.channelId)?.id || destination.channels[0]?.id || '')
    }
    setNavigation(next)
  }

  useEffect(() => {
    if (!servers.length && view === 'server') setView('home')
  }, [servers.length, view])

  const [audioSettings, setAudioSettings] = useState<'input' | 'output' | null>(null)
  const openConversation = (username: string) => setView('messages', username)
  const [search, setSearch] = useState('')
  const [profile, setProfileName] = useState<string | null>(null)
  const [profileIdentity, setProfileIdentity] = useState<string | null>(null)
  const community = useCommunityStore()
  const relations = useFriendStore(s => s.relations)
  const friends = friendPeople(community.members, relations, user?.username || '')
  const directContacts = directPeople(community.members, friends, messages, user?.username || '', selectedPeer)

  const globalName = (identity: string | undefined, fallback: string) =>
    community.members.find(member => member.username === identity)?.display_name ||
    (user && identity === user.username ? user.display_name : undefined) ||
    voice.participants.find(person => person.identity === identity)?.name ||
    relations[identity || '']?.display_name ||
    fallback

  const setProfile = (name: string | null, identity?: string) => {
    setProfileName(name === null ? null : globalName(identity, name))
    setProfileIdentity(
      identity ||
        community.members.find(m => m.display_name === name)?.username ||
        voice.participants.find(p => p.name === name)?.identity ||
        (name === user?.display_name ? user.username : null)
    )
  }

  const [editProfile, setEditProfile] = useState(false)
  const [createType, setCreateType] = useState<'text' | 'voice' | null>(null)
  const [context, setContext] = useState<{ participant: VoiceParticipant; x: number; y: number } | null>(null)

  useEffect(() => {
    if (user) void useCommunityStore.getState().connect(user)
    return () => useCommunityStore.getState().disconnect()
  }, [user?.username, roles.configured, roles.url, roles.connectionVersion])

  const end = useRef<HTMLDivElement>(null)
  const server =
    servers.find(s => s.id === activeServerId) ||
    servers[0] || { id: '', name: 'Sem servidor', channels: [] as (typeof servers)[number]['channels'] }
  const channel =
    server.channels.find(c => c.id === activeChannelId) ||
    server.channels[0] || { id: '', name: '', type: 'text' as const, serverId: server.id }

  const recent = useMemo(() => {
    if (view !== 'home') return []
    return Object.values(messages)
      .flat()
      .sort((a, b) => b.timestamp - a.timestamp)
  }, [messages, view])

  const statusText = (identity: string) =>
    community.members.some(m => m.username === identity && m.online)
      ? 'Online'
      : community.status === 'online'
      ? 'Offline'
      : 'Presença indisponível'
  const serverName = useCallback((identity: string, fallback: string) =>
    memberDisplayName(roles.snapshot, view === 'server' ? server.id : undefined, identity, fallback),
    [roles.snapshot, view, server.id]
  )
  const matchesSearch = useCallback((m: { display_name: string; username: string }) =>
    (serverName(m.username, m.display_name) + ' ' + m.display_name + ' ' + m.username)
      .toLowerCase()
      .includes(search.toLowerCase()),
    [serverName, search]
  )
  const visibleMembers = useMemo(() => community.members.filter(matchesSearch), [community.members, matchesSearch])
  const visibleFriends = useMemo(() => friends.filter(matchesSearch), [friends, matchesSearch])
  const visibleContacts = useMemo(() => directContacts.filter(matchesSearch), [directContacts, matchesSearch])
  const activityMembers = useMemo(() =>
    view === 'server'
      ? roles.snapshot?.id === server.id
        ? visibleMembers.filter(member => roles.snapshot!.policy.members.includes(member.username))
        : visibleMembers
      : visibleFriends,
    [view, roles.snapshot, server.id, visibleMembers, visibleFriends]
  )
  const groupRole = useCallback((identity: string) =>
    view === 'server' && roles.snapshot?.id === server.id
      ? assignedRoles(roles.snapshot.policy, identity)
          .filter(role => role.hoist)
          .sort((a, b) => b.position - a.position)[0]
      : undefined,
    [view, roles.snapshot, server.id]
  )
  const groupedMembers = useMemo(() => [...activityMembers].sort(
    (a, b) =>
      (groupRole(b.username)?.position || 0) - (groupRole(a.username)?.position || 0) ||
      serverName(a.username, a.display_name).localeCompare(serverName(b.username, b.display_name), 'pt-BR')
  ), [activityMembers, groupRole, serverName])
  const profileMember = community.members.find(m => m.username === profileIdentity)
  const isOwnProfile = profileIdentity === user?.username
  const voiceChannels = server.channels.filter(c => c.type === 'voice')
  const liveIdentities = new Set(
    [...voice.participants, ...Object.values(voice.channelOccupants).flat()]
      .filter(person => person.isScreenShareEnabled)
      .map(person => person.identity)
  )
  const voiceKey = voiceChannels.map(c => c.id).join(',')

  useEffect(() => {
    voice.fetchChannelOccupants(voiceChannels)
    const timer = setInterval(() => voice.fetchChannelOccupants(voiceChannels), 4000)
    return () => clearInterval(timer)
  }, [voiceKey, voice.fetchChannelOccupants])

  const lastReadPosition = useRef({ channel: '', tail: '', view: '' })
  useEffect(() => {
    const tail = messages[activeChannelId]?.slice(-1)[0]?.id || ''
    if (
      lastReadPosition.current.view !== view + callTab ||
      lastReadPosition.current.channel !== activeChannelId ||
      lastReadPosition.current.tail !== tail
    )
      end.current?.scrollIntoView({
        behavior: lastReadPosition.current.channel === activeChannelId ? 'smooth' : 'instant'
      })
    lastReadPosition.current = { channel: activeChannelId, tail, view: view + callTab }
  }, [activeChannelId, messages, view, callTab])

  useEffect(() => {
    if (!profile) return
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfile(null)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [profile])

  const openChannel = (id: string) => {
    setActiveChannel(id)
    setView('server')
  }

  useEffect(() => {
    activity.activate(user?.username || null)
    usePresenceStatus.getState().activate(user?.username || null)
  }, [user?.username])

  useEffect(() => {
    activity.setVisibleChannel(
      view === 'server' && channel.type === 'text'
        ? channel.id
        : view === 'messages' && selectedPeer
        ? 'dm:' + [user?.username, selectedPeer].sort().join(':')
        : null
    )
    return () => useNotificationStore.getState().setVisibleChannel(null)
  }, [view, channel.id, selectedPeer, user?.username])

  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [pendingDropFiles, setPendingDropFiles] = useState<File[] | null>(null)
  const dragCounter = useRef(0)

  useEffect(() => {
    const isFileDrag = (e: DragEvent) => {
      return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')
    }
    const onDragEnter = (e: DragEvent) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      dragCounter.current++
      setIsDraggingFiles(true)
    }
    const onDragOver = (e: DragEvent) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy'
      }
    }
    const onDragLeave = (e: DragEvent) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      dragCounter.current--
      if (dragCounter.current <= 0) {
        dragCounter.current = 0
        setIsDraggingFiles(false)
      }
    }
    const onDrop = async (e: DragEvent) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      dragCounter.current = 0
      setIsDraggingFiles(false)

      const dropped = Array.from(e.dataTransfer?.files || [])
      if (!dropped.length) return

      // In open text channel?
      if (view === 'server' && channel?.type === 'text' && channel.id) {
        if (!centralAllows('SEND_MESSAGES', channel.id)) {
          showToast('Seu cargo não permite enviar mensagens neste canal.')
          return
        }
        try {
          showToast(`Enviando ${dropped.length > 1 ? `${dropped.length} arquivos` : dropped[0].name}...`)
          for (const file of dropped) {
            const attachment = await uploadDroppedFile(file)
            await community.sendMessage(channel.id, '', undefined, attachment)
          }
          showToast(dropped.length > 1 ? `${dropped.length} arquivos enviados em #${channel.name}` : `Arquivo enviado em #${channel.name}`)
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Falha ao enviar arquivo arrastado.')
        }
      } else {
        // Outside open text channel: open channel selector modal
        setPendingDropFiles(dropped)
      }
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [view, channel?.id, channel?.name, channel?.type, community, showToast])

  const openNotice = (id: string) => {
    const notice = useNotificationStore.getState().entries.find(entry => entry.id === id)
    if (!notice) return
    useNotificationStore.getState().markRead(id)
    setSettingsOpen(false)
    setChannelSettings(null)
    setProfile(null)
    if (notice.kind === 'event' && notice.serverId) {
      setActiveServer(notice.serverId)
      setView('server')
      setEventTarget(notice.eventId)
      setEventsOpen(true)
      return
    }
    if (notice.kind === 'friendship') {
      setView('friends')
      return
    }
    if (notice.peer) {
      openConversation(notice.peer)
      return
    }
    if (notice.channelId) {
      const targetServer = servers.find(s => s.channels.some(c => c.id === notice.channelId))
      if (targetServer) {
        setActiveServer(targetServer.id)
        openChannel(notice.channelId)
        setView('server')
      }
      return
    }
  }

  useEffect(() => {
    const unsub = window.contalkDesktop?.onNotificationOpen?.(id => {
      openNotice(id)
    })
    return () => unsub?.()
  }, [openNotice, servers])

  const join = async (id: string, name: string) => {
    setCallTab('chamada')
    setMiniCollapsed(false)
    if (user)
      await voice.joinChannel(id, name, {
        username: user.username,
        display_name: user.display_name,
        avatar: user.avatar
      })
  }

  const [miniCollapsed, setMiniCollapsed] = useState(false)
  // Em janelas estreitas o palco fica com a largura toda; o chat abre pelo botão ao lado.
  const [chatDrawerOpen, setChatDrawerOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1200)
  const inCall = !!voice.activeChannelId && ['connected', 'connecting', 'reconnecting'].includes(voice.connectionStatus)
  useEffect(() => { if (!inCall && callTab === 'chamada') setCallTab('conversa') }, [inCall, callTab])
  const openCall = () => { setCallTab('chamada'); setMiniCollapsed(false) }
  const callServer = servers.find(s => s.channels.some(c => c.id === voice.activeChannelId))
  const drawerChannel = callServer
    ? (callServer.id === server.id && channel.type === 'text' ? channel : callServer.channels.find(c => c.type === 'text'))
    : undefined
  // Canais de voz não abrem mais como página: clicar entra na chamada. Um canal de voz salvo como ativo volta para o texto.
  useEffect(() => {
    if (channel.type === 'voice') setActiveChannel(server.channels.find(c => c.type === 'text')?.id || '')
  }, [channel.id, channel.type, server.id])
  const liveChannels: LiveChannel[] = [
    ...voiceChannels.map(c => ({ channel: c, server, occupants: voice.activeChannelId === c.id ? voice.participants : voice.channelOccupants[c.id] || [], connected: inCall && voice.activeChannelId === c.id })),
    ...(callServer && callServer.id !== server.id ? callServer.channels.filter(c => c.id === voice.activeChannelId).map(c => ({ channel: c, server: callServer, occupants: voice.participants, connected: true })) : [])
  ].filter(item => item.occupants.length > 0 || item.connected)
  const openRecent = (message: { channelId: string; userId: string }) => {
    if (message.channelId.startsWith('dm:')) {
      const peer = message.channelId.slice(3).split(':').find(name => name !== user?.username)
      if (peer) openConversation(peer)
      return
    }
    const destination = servers.find(item => item.channels.some(c => c.id === message.channelId))
    if (destination) setActiveServer(destination.id)
    openChannel(message.channelId)
  }

  const togglePanel = (key: 'sidebarHidden' | 'railHidden' | 'bottomPanelOpen' | 'membersCollapsed') =>
    preferences.update({ [key]: !preferences[key] })
  const openVoiceChannel = (id: string) => {
    const destination = servers.find(item => item.channels.some(c => c.id === id))
    if (destination) setActiveServer(destination.id)
    openChannel(id)
  }
  const openFolder = async () => {
    const folder = await desktop?.openFolder?.()
    if (!folder) return
    preferences.update({ workspaceFolder: folder, bottomPanelOpen: true })
    setTerminalRequest(n => n + 1)
  }

  const handleUpdateCode = (newCode: string) => {
    setTabCodes(prev => ({ ...prev, [activeEditorTab]: newCode }))
    setEditorTabs(tabs => tabs.map(tab => (tab.id === activeEditorTab ? { ...tab, isDirty: true } : tab)))
    devCollab.broadcastCode(activeEditorTab, newCode)
  }

  const handleNewTab = () => {
    const num = editorTabs.length + 1
    const newId = `nota-${num}`
    const newName = `Nota ${num}.md`
    const newTab: NotepadTab = {
      id: newId,
      name: newName,
      path: `workspace/${newName}`,
      isDirty: false
    }
    setEditorTabs(tabs => [...tabs, newTab])
    setTabCodes(codes => ({ ...codes, [newId]: `# ${newName}\n\n` }))
    setActiveEditorTab(newId)
  }

  const allTextChannels = useMemo(() => {
    return servers.flatMap(s =>
      s.channels
        .filter(c => c.type === 'text')
        .map(c => ({ id: c.id, name: c.name, serverName: s.name }))
    )
  }, [servers])

  const availablePeers = useMemo(() => {
    const map = new Map<string, { username: string; display_name: string; online?: boolean }>()
    for (const f of friends) {
      map.set(f.username, { username: f.username, display_name: f.display_name, online: f.online })
    }
    for (const m of community.members) {
      if (m.username !== user?.username && !map.has(m.username)) {
        map.set(m.username, { username: m.username, display_name: m.display_name, online: m.online })
      }
    }
    return Array.from(map.values())
  }, [friends, community.members, user?.username])

  const handleSaveActiveCode = () => {
    setSaveNoteModalOpen(true)
  }

  const handleConfirmSaveNote = async (dest: SaveNoteDestination) => {
    const currentTab = editorTabs.find(t => t.id === activeEditorTab)
    if (!currentTab) return
    setIsSavingCode(true)
    try {
      const currentCode = tabCodes[activeEditorTab] ?? ''
      const title = currentTab.name || 'Notas.md'

      if (desktop?.workspaceWriteFile) {
        await desktop.workspaceWriteFile(currentTab.path, currentCode)
      }

      const formatMessage = (heading: string) => {
        if (currentCode.length <= 1800) {
          return `📝 **${heading}**\n\`\`\`markdown\n${currentCode}\n\`\`\``
        }
        return `📝 **${heading}**\n\n${currentCode.slice(0, 1850)}…\n\n*(Documento longo salvo via Bloco de Notas Colaborativo)*`
      }

      const messageContent = formatMessage(title)

      if (dest.sendToChannel && dest.channelId) {
        await community.sendMessage(dest.channelId, messageContent)
      }

      if (dest.sendToDm && dest.friendUsername && user) {
        const dmChannel = 'dm:' + [user.username, dest.friendUsername].sort().join(':')
        await community.sendMessage(dmChannel, messageContent, dest.friendUsername)
      }

      setEditorTabs(tabs => tabs.map(tab => (tab.id === activeEditorTab ? { ...tab, isDirty: false } : tab)))

      let destText = ''
      if (dest.sendToChannel && dest.sendToDm) {
        destText = 'no canal de texto e na mensagem privada'
      } else if (dest.sendToChannel) {
        destText = 'no canal de texto'
      } else if (dest.sendToDm) {
        destText = 'na mensagem privada'
      } else {
        destText = 'com sucesso'
      }
      showToast(`Documento ${title} salvo ${destText}!`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao salvar documento.')
      throw err
    } finally {
      setIsSavingCode(false)
    }
  }

  const quit = async () => {
    await voice.leaveChannel().catch(() => {})
    await desktop?.quitApp?.()
  }
  const signOut = () =>
    void (async () => {
      await voice.leaveChannel()
      await logout()
    })()
  const handleCopyDiagnostics = useCallback(async () => {
    try {
      const diag = {
        app: 'ConTalk',
        version: '0.1.39',
        timestamp: new Date().toISOString(),
        view,
        server: { id: server.id, name: server.name },
        channel: { id: channel.id, name: channel.name, type: channel.type },
        user: user ? { username: user.username, display_name: user.display_name } : null,
        voice: {
          activeChannelId: voice.activeChannelId,
          activeChannelName: voice.activeChannelName,
          connectionStatus: voice.connectionStatus,
          participantsCount: voice.participants.length
        },
        layout: {
          sidebarHidden: preferences.sidebarHidden,
          sidebarCollapsed: preferences.sidebarCollapsed,
          membersCollapsed: preferences.membersCollapsed,
          bottomPanelOpen: preferences.bottomPanelOpen,
          devEditorOpen,
          theme: preferences.theme,
          interfaceScale: preferences.interfaceScale
        },
        platform: typeof navigator !== 'undefined' ? navigator.userAgent : 'desktop'
      }
      const text = '```json\n' + JSON.stringify(diag, null, 2) + '\n```'
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      }
      showToast('Diagnóstico copiado! Cole no chat com a equipe ou suporte.')
    } catch {
      showToast('Falha ao copiar diagnóstico.')
    }
  }, [view, server, channel, user, voice, preferences, devEditorOpen, showToast])

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (settingsOpen || document.querySelector('[aria-modal=true]')) return
      const ctrl = event.ctrlKey || event.metaKey,
        key = event.key.toLowerCase()
      if (event.key === 'F11' && desktop?.toggleFullScreen) {
        event.preventDefault()
        void desktop.toggleFullScreen()
        return
      }
      if (!ctrl) return
      if (key === 'b' && event.altKey) {
        event.preventDefault()
        togglePanel('membersCollapsed')
      } else if (key === 'e' && event.altKey) {
        event.preventDefault()
        setDevEditorOpen(v => !v)
      } else if (key === 'k' && !event.altKey) {
        event.preventDefault()
        setCommandMenuOpen(true)
      } else if (key === 'b' && !event.shiftKey) {
        event.preventDefault()
        togglePanel('sidebarHidden')
      } else if ((key === 'j' || event.key === '`') && !event.shiftKey && !event.altKey) {
        event.preventDefault()
        togglePanel('bottomPanelOpen')
      } else if (key === 'n' && event.shiftKey) {
        event.preventDefault()
        setView('messages')
      } else if (key === 'o' && !event.shiftKey && desktop?.openFolder) {
        event.preventDefault()
        void openFolder()
      } else if (event.key === ',') {
        event.preventDefault()
        setSettingsTab('appearance')
        setSettingsOpen(true)
      }
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  })

  // Mensagens e compositor de um canal de texto (página do canal e gaveta da aba Chamada).
  const renderChatPane = (ch: Channel, compact = false) => (
    <div className={`ct-chat-pane ${compact ? 'is-compact' : ''}`}>
      <div className="ct-messages">
        <div className="ct-chat-welcome">
          <span>#</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1>Este é o #{ch.name}</h1>
          </div>
          <p>O começo de muitas boas conversas.</p>
        </div>
        <div className="ct-date-divider">Hoje</div>
        {(roles.historyMore[ch.id] ?? roles.snapshot?.hasOlder?.[ch.id]) && (
          <button
            className="ct-history-more"
            disabled={roles.historyBusy}
            onClick={() => void roles.loadHistory(ch.id).catch(() => {})}
          >
            {roles.historyBusy ? 'Carregando…' : 'Carregar mensagens anteriores'}
          </button>
        )}
        {(messages[ch.id] || [])
          .filter(
            m =>
              m.content.toLowerCase().includes(search.toLowerCase()) ||
              serverName(m.userId, m.userName).toLowerCase().includes(search.toLowerCase())
          )
          .map(m => (
            <article className="ct-message" data-message-id={m.id} key={m.id}>
              <button
                disabled={!!m.webhook}
                data-profile-identity={m.webhook ? undefined : m.userId}
                data-profile-name={m.userName}
                onClick={() => setProfile(m.userName, m.userId)}
              >
                <Avatar name={m.userName} identity={m.userId} />
              </button>
              <div>
                <header>
                  <button
                    disabled={!!m.webhook}
                    data-profile-identity={m.webhook ? undefined : m.userId}
                    data-profile-name={m.userName}
                    onClick={() => setProfile(m.userName, m.userId)}
                  >
                    <RoleName serverId={server.id} identity={m.userId} name={m.userName} />
                  </button>
                  {m.webhook && <small className="ct-integration-badge">Integração</small>}
                  <time>
                    {new Date(m.timestamp).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </time>
                </header>
                <ChatMessage message={m} onOpenChannel={openChannel} />
              </div>
            </article>
          ))}
        <div ref={end} />
      </div>

      <ChatComposer
        channelId={ch.id}
        disabled={!centralAllows('SEND_MESSAGES', ch.id)}
        key={ch.id}
        placeholder={`Conversar em #${ch.name}`}
        onSend={(text, attachment, options) =>
          community.sendMessage(ch.id, text, undefined, attachment, options)
        }
      />
    </div>
  )


  return (
    <div
      className="ct-app"
      data-theme="classic"
      data-skin={preferences.theme}
      data-reduced-motion={preferences.reducedMotion}
      data-text-size={preferences.textSize}
      onContextMenu={event => {
        if (event.defaultPrevented) return
        const target = (event.target as Element).closest<HTMLElement>('[data-profile-identity]')
        const identity = target?.dataset.profileIdentity
        if (!identity) return
        event.preventDefault()
        const person = voice.participants.find(p => p.identity === identity)
        setContext({
          participant: person || {
            identity,
            name: globalName(identity, target.dataset.profileName || identity),
            serverNickname:
              view === 'server' && roles.snapshot?.id === server.id
                ? roles.snapshot.nicknames?.[identity]
                : undefined,
            isLocal: identity === user?.username,
            isSpeaking: false,
            isAudioEnabled: true,
            isVideoEnabled: false,
            isScreenShareEnabled: false
          },
          x: event.clientX,
          y: event.clientY
        })
      }}
    >
      <TitleBar
        onOpenNotification={openNotice}
        authenticated
        disabled={settingsOpen}
        title={
          view === 'server'
            ? server.name + ' · ' + (channel.name || 'Canais')
            : view === 'friends'
            ? 'Amigos'
            : view === 'messages'
            ? selectedPeer
              ? 'Mensagens · ' +
                (community.members.find(m => m.username === selectedPeer)?.display_name || selectedPeer)
              : 'Mensagens diretas'
            : 'ConTalk'
        }
        canBack={navigation.index > 0}
        canForward={navigation.index < navigation.entries.length - 1}
        onBack={() => travel(-1)}
        onForward={() => travel(1)}
        search={search}
        onSearch={setSearch}
        scope={view === 'server' ? server.name : 'ConTalk'}
        sidebarOpen={!preferences.sidebarHidden}
        onToggleSidebar={() => togglePanel('sidebarHidden')}
        onOpenCommandMenu={() => setCommandMenuOpen(true)}
      />

      <div className="ct-body" inert={settingsOpen}>
        <aside className="ct-rail" aria-label="Servidores" hidden={preferences.railHidden}>
          <div className="ct-rail-item" data-active={view !== 'server'}>
            <span className="ct-rail-pill" aria-hidden="true" />
            <button type="button" className="ct-rail-home" aria-label="Início e mensagens diretas" title="Início e mensagens diretas" aria-current={view !== 'server' ? 'page' : undefined} onClick={() => setView('home')}>
              <BrandMark />
            </button>
          </div>
          <hr />
          {servers.map(s => {
            const unread = s.channels.reduce((sum, c) => sum + (activity.unreadByChannel[c.id] || 0), 0)
            const active = view === 'server' && s.id === server.id
            return (
              <div className="ct-rail-item" data-active={active} data-unread={unread > 0} key={s.id}>
                <span className="ct-rail-pill" aria-hidden="true" />
                <button
                  type="button"
                  title={s.name}
                  aria-label={s.name + (unread ? `, ${unread} não lidas` : '')}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    setActiveServer(s.id)
                    setActiveChannel(s.channels.find(c => c.type === 'text')?.id || '')
                    setView('server')
                  }}
                >
                  <ServerIcon name={s.name} icon={s.icon} />
                </button>
                {inCall && callServer?.id === s.id && (
                  <span className="ct-rail-voice" title={`Em chamada: ${voice.activeChannelName || ''}`}><ControlIcon name="speaker" size={10} /></span>
                )}
                {unread > 0 && !active && <span className="ct-rail-badge">{unread > 99 ? '99+' : unread}</span>}
              </div>
            )
          })}
          <div className="ct-rail-item">
            <span className="ct-rail-pill" aria-hidden="true" />
            <button type="button" className="ct-rail-add" title="Criar ou entrar em uma comunidade" aria-label="Criar ou entrar em uma comunidade" onClick={() => setJoinOpen(true)}>
              <Icon name="plus" />
            </button>
          </div>
        </aside>
        <>
          <nav className="ct-sidebar" data-collapsed={preferences.sidebarCollapsed} hidden={preferences.sidebarHidden}>
            <div className="ct-sidebar-scroll">
              {view !== 'server' || !servers.length ? (
              <>
              <button type="button" className="ct-side-search" onClick={() => setCommandMenuOpen(true)}>
                Encontre ou comece uma conversa
              </button>
              <div className="ct-side-nav">
                <button type="button" className={view === 'home' ? 'active' : ''} aria-current={view === 'home' ? 'page' : undefined} onClick={() => setView('home')}>
                  <Icon name="home" />Início
                </button>
                <button type="button" className={view === 'friends' ? 'active' : ''} aria-current={view === 'friends' ? 'page' : undefined} onClick={() => setView('friends')}>
                  <Icon name="friends" />Amigos
                </button>
              </div>
              <div className="ct-section-label">
                <button type="button" className="ct-section-toggle" aria-expanded={!hiddenSections.dms} onClick={() => toggleSection('dms')}>
                  <ControlIcon name="chevron" size={12} />Mensagens diretas
                </button>
                <button type="button" title="Nova mensagem direta" aria-label="Nova mensagem direta" onClick={() => setView('messages', null)}>+</button>
              </div>
              {!hiddenSections.dms && (
                <div className="ct-people ct-side-dms">
                  {visibleContacts.map(m => (
                    <button
                      type="button"
                      className={`ct-person ${view === 'messages' && selectedPeer === m.username ? 'active' : ''}`}
                      data-profile-identity={m.username}
                      data-profile-name={m.display_name}
                      key={m.username}
                      onClick={() => openConversation(m.username)}
                    >
                      <Avatar name={m.display_name} identity={m.username} live={liveIdentities.has(m.username)} />
                      <span>
                        <strong><RoleName identity={m.username} name={m.display_name} /></strong>
                        <small>{voice.participants.some(p => p.identity === m.username) || Object.values(voice.channelOccupants).some(list => list.some(p => p.identity === m.username)) ? 'Em voz' : statusText(m.username)}</small>
                      </span>
                    </button>
                  ))}
                  {!visibleContacts.length && <p className="ct-friend-hint">Suas conversas aparecem aqui.</p>}
                </div>
              )}
              </>
              ) : (
                <>
                  <header className="ct-server-header" onContextMenu={event => { event.preventDefault(); setRolesOpen(true) }}>
                    <span className="ct-server-header-text">
                      <strong title={server.description || server.name}>{server.name}</strong>
                      <small><i className="ct-online-dot" aria-hidden="true" />{community.status === 'online' ? community.members.filter(m => m.online && (!roles.snapshot || roles.snapshot.id !== server.id || roles.snapshot.policy.members.includes(m.username))).length + ' online' : 'Presença indisponível'}</small>
                    </span>
                    {(!roles.snapshot ||
                      centralAllows('VIEW_GUILD_INSIGHTS') ||
                      centralAllows('MANAGE_GUILD') ||
                      centralAllows('MANAGE_ROLES') ||
                      centralAllows('BAN_MEMBERS') ||
                      !!roles.snapshot.invites?.length ||
                      roles.snapshot.channels.some(item => centralAllows('CREATE_INSTANT_INVITE', item.id))) && (
                      <button type="button" className="ct-server-header-settings" title="Configurações da comunidade" aria-label="Configurações da comunidade" onClick={() => setRolesOpen(true)}>
                        <ControlIcon name="settings" size={16} />
                      </button>
                    )}
                  </header>
                  {/* Projetos: Kanban, Tarefas, Documentação, Roadmap */}
                  {PROJECTS_ENABLED && <>
                  <div className="ct-section-label">
                    <button
                      className="ct-section-toggle"
                      aria-expanded={!hiddenSections.projects}
                      onClick={() => toggleSection('projects')}
                    >
                      <ControlIcon name="chevron" size={12} />
                      <span>Projetos</span>
                      <span className="ct-section-count-badge">
                        {devStore.kanbanCards.length + devStore.todoTasks.filter(t => !t.completed).length}
                      </span>
                    </button>
                    <div className="ct-section-actions">
                      <button
                        title="Abrir Guia de Projetos (Kanban)"
                        aria-label="Abrir Guia de Projetos"
                        onClick={() => setActiveDevModal('overview')}
                      >
                        <ControlIcon name="overview" size={12} />
                      </button>
                    </div>
                  </div>
                  {!hiddenSections.projects && (
                    <div className="ct-side-dev-group">
                      <button
                        className="ct-side-dev-item"
                        onClick={() => setActiveDevModal('overview')}
                        title="Quadro Kanban de Entregas"
                      >
                        <div><ControlIcon name="overview" size={14} /><span>Visão geral (Kanban)</span></div>
                        <span className="ct-side-dev-badge">{devStore.kanbanCards.length}</span>
                      </button>
                      <button
                        className="ct-side-dev-item"
                        onClick={() => setActiveDevModal('tasks')}
                        title="Lista de Tarefas"
                      >
                        <div><ControlIcon name="tasks" size={14} /><span>Tarefas</span></div>
                        <span className="ct-side-dev-badge">
                          {devStore.todoTasks.filter(t => !t.completed).length}
                        </span>
                      </button>
                      <button
                        className="ct-side-dev-item"
                        onClick={() => setActiveDevModal('docs')}
                        title="Central de Documentação"
                      >
                        <div><ControlIcon name="docs" size={14} /><span>Documentação</span></div>
                        <span className="ct-side-dev-badge">{devStore.devDocs.length}</span>
                      </button>
                      <button
                        className="ct-side-dev-item"
                        onClick={() => setActiveDevModal('roadmap')}
                        title="Roadmap do projeto"
                      >
                        <div><ControlIcon name="roadmap" size={14} /><span>Roadmap</span></div>
                      </button>
                    </div>
                  )}
                  </>}

                  {/* Canais de Texto */}
                  <div className="ct-section-label">
                    <button
                      className="ct-section-toggle"
                      aria-expanded={!hiddenSections.text}
                      onClick={() => toggleSection('text')}
                    >
                      <ControlIcon name="chevron" size={12} />Canais
                    </button>
                    <button
                      title="Criar canal de texto"
                      aria-label="Criar canal de texto"
                      onClick={() => setCreateType('text')}
                    >
                      +
                    </button>
                  </div>
                  {!hiddenSections.text &&
                    server.channels
                      .filter(c => c.type === 'text' && !c.parentId)
                      .map(c => (
                        <Fragment key={c.id}>
                          <ChannelRow
                            unread={activity.unreadByChannel[c.id] || 0}
                            channel={c}
                            active={view === 'server' && channel.id === c.id}
                            onOpen={() => openChannel(c.id)}
                            onSettings={() => { setChannelSettingsTab('general'); setChannelSettings(c) }}
                          />
                          {server.channels
                            .filter(
                              child =>
                                child.parentId === c.id &&
                                (child.id === channel.id ||
                                  roles.snapshot?.policy.projects?.[child.id] ||
                                  (roles.snapshot?.policy.threads?.[child.id] &&
                                    !threadArchived(
                                      roles.snapshot.policy.threads[child.id],
                                      roles.snapshot.serverNow
                                    )))
                            )
                            .map(child => (
                              <div className="ct-thread-sidebar" key={child.id}>
                                <ChannelRow
                                  unread={activity.unreadByChannel[child.id] || 0}
                                  channel={child}
                                  active={view === 'server' && channel.id === child.id}
                                  onOpen={() => openChannel(child.id)}
                                  onSettings={() => { setChannelSettingsTab('general'); setChannelSettings(child) }}
                                />
                              </div>
                            ))}
                        </Fragment>
                      ))}

                  {/* Chamadas de Voz */}
                  <div className="ct-section-label">
                    <button
                      className="ct-section-toggle"
                      aria-expanded={!hiddenSections.voice}
                      onClick={() => toggleSection('voice')}
                    >
                      <ControlIcon name="chevron" size={12} />Chamadas
                    </button>
                    <button
                      title="Criar canal de voz"
                      aria-label="Criar canal de voz"
                      onClick={() => setCreateType('voice')}
                    >
                      +
                    </button>
                  </div>
                  {!hiddenSections.voice && (
                    <>
                      {voiceChannels.map(c => {
                        const isConnected = voice.activeChannelId === c.id
                        const occupants = isConnected ? voice.participants : voice.channelOccupants[c.id] || []
                        return (
                          <div className={`ct-voice-group ${isConnected ? 'connected' : ''}`} key={c.id}>
                            <ChannelRow
                              channel={c}
                              active={isConnected}
                              connected={isConnected}
                              count={occupants.length}
                              onOpen={() => isConnected ? openCall() : void join(c.id, c.name)}
                              onSettings={() => { setChannelSettingsTab('general'); setChannelSettings(c) }}
                            />
                            <div className="ct-channel-occupants">
                              {occupants.map(p => (
                                <button
                                  className="ct-occupant"
                                  title={p.name}
                                  key={p.identity}
                                  onClick={() => setProfile(p.name, p.identity)}
                                  onContextMenu={e => {
                                    e.preventDefault()
                                    setContext({ participant: p, x: e.clientX, y: e.clientY })
                                  }}
                                >
                                  <Avatar name={p.name} identity={p.identity} live={p.isScreenShareEnabled} />
                                  <span className="ct-occupant-name">
                                    <RoleName serverId={server.id} identity={p.identity} name={p.name} />
                                  </span>
                                  <span className="ct-occupant-status">
                                    {p.isPrioritySpeaker && (
                                      <span
                                        className="ct-priority-indicator"
                                        role="img"
                                        aria-label="Prioridade de fala ativa"
                                        title="Prioridade de fala ativa"
                                      >
                                        <ControlIcon name="priority" />
                                      </span>
                                    )}
                                    {p.isScreenShareEnabled ? (
                                      <span className="ct-live-badge">LIVE</span>
                                    ) : (
                                      <ControlIcon name="mic" slashed={!p.isAudioEnabled} />
                                    )}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}
                </>
              )}
            </div>
            {inCall && <VoicePanel serverName={callServer?.name} onOpen={openCall} />}
            {selfCard && (
              <ProfilePopover
                serverName={callServer?.name}
                onClose={() => setSelfCard(false)}
                onEditProfile={() => setEditProfile(true)}
                onSettings={() => { setSettingsTab('account'); setSettingsOpen(true) }}
                onOpenCall={openCall}
                onSignOut={signOut}
              />
            )}
            <UserDock
              onProfile={() => setSelfCard(open => !open)}
              onSettings={() => { setSettingsTab('appearance'); setSettingsOpen(true) }}
            />
          </nav>

          <div className="ct-center">
            {inCall && <CallTabs tab={callTab} onTab={setCallTab} />}
            <main className="ct-main">
              {roles.configured && roles.error && <div className="ct-mic-alert" role="status">{roles.error}</div>}
              {(voice.profileError || community.profileError) && (
                <div className="ct-mic-alert" role="status">{voice.profileError || community.profileError}</div>
              )}
              {voice.microphoneError && (
                <div className="ct-mic-alert" role="alert">
                  <span>{voice.microphoneError}</span>
                  <button onClick={() => setAudioSettings('input')}>Escolher microfone</button>
                </div>
              )}
              {inCall && callTab === 'chamada' ? (
                <div className="ct-call-view">
                  <div className="ct-call-stage">
                    <VoiceStage
                      onProfile={person => setProfile(person.name, person.identity)}
                      onParticipantMenu={(participant, event) => setContext({ participant, x: event.clientX, y: event.clientY })}
                      onMinimize={() => setCallTab('conversa')}
                      footer={<CallControls />}
                    />
                  </div>
                  {drawerChannel && (chatDrawerOpen ? (
                    <aside className="ct-chat-drawer" aria-label={`Chat de #${drawerChannel.name}`}>
                      <header>
                        <Icon name="#" />
                        <strong>{drawerChannel.name}</strong>
                        <button type="button" className="ct-icon-button" aria-label="Recolher chat" title="Recolher chat" onClick={() => setChatDrawerOpen(false)}>
                          <ControlIcon name="chevron-right" size={16} />
                        </button>
                      </header>
                      {renderChatPane(drawerChannel, true)}
                    </aside>
                  ) : (
                    <button type="button" className="ct-chat-drawer-open" aria-label={`Mostrar chat de #${drawerChannel.name}`} title={`Mostrar #${drawerChannel.name}`} onClick={() => setChatDrawerOpen(true)}>
                      <ControlIcon name="chat" size={18} />
                    </button>
                  ))}
                </div>
              ) : view === 'friends' || view === 'messages' ? (
                <HomeView
                  key={view}
                  mode={view}
                  searchQuery={search}
                  selected={selectedPeer}
                  onConversation={openConversation}
                  onProfile={setProfile}
                />
              ) : view === 'home' ? (
                <HomeDashboard
                  owner={user?.username || ''}
                  displayName={user?.display_name || 'amigo'}
                  servers={servers}
                  live={liveChannels}
                  friends={friends}
                  recent={recent}
                  onJoin={c => void join(c.id, c.name)}
                  onOpenCall={openCall}
                  onOpenServer={id => {
                    const target = servers.find(item => item.id === id)
                    setActiveServer(id)
                    openChannel(target?.channels.find(c => c.type === 'text')?.id || '')
                  }}
                  onCreateServer={() => setJoinOpen(true)}
                  onMessage={openConversation}
                  onOpenMessage={openRecent}
                />
              ) : !channel.id ? (
                <section className="ct-empty-channels">
                  <span className="ct-eyebrow">Um novo começo</span>
                  <h1>Nenhum canal por aqui ainda</h1>
                  <p>Crie um canal de texto ou voz para começar.</p>
                  <div>
                    <button className="ct-primary" onClick={() => setCreateType('text')}>
                      Criar canal de texto
                    </button>
                    <button className="ct-secondary" onClick={() => setCreateType('voice')}>
                      Criar canal de voz
                    </button>
                  </div>
                </section>
              ) : (
                <>
                  <header className="ct-channel-header">
                    <div>
                      {channel.type === 'voice' ? (
                        <span className="ct-channel-type"><ControlIcon name="mic" /></span>
                      ) : (
                        <Icon name="#" />
                      )}
                      <span>
                        <h2>{channel.name}</h2>
                        <small title={channel.type === 'voice' ? channel.voiceStatus || undefined : undefined}>
                          {channel.type === 'voice'
                            ? channel.voiceStatus || 'Seu espaço para conversar e transmitir conteúdos'
                            : 'Compartilhe ideias e boas conversas com a comunidade.'}
                        </small>
                      </span>
                    </div>
                    <div className="ct-channel-header-actions">
                      {channel.type === 'text' && roles.snapshot?.id === server.id && (
                        <button
                          aria-label="Tópicos do canal"
                          title="Tópicos do canal"
                          onClick={() => {
                          const target = channel.parentId ? server.channels.find(c => c.id === channel.parentId) || channel : channel
                          setChannelSettingsTab('threads')
                          setChannelSettings(target)
                        }}
                        >
                          <ControlIcon name="thread" />
                        </button>
                      )}
                      {channel.type === 'text' &&
                        roles.snapshot?.id === server.id &&
                        centralAllows('READ_MESSAGE_HISTORY', channel.id) && (
                          <button
                            aria-label="Mensagens fixadas"
                            title="Mensagens fixadas"
                            onClick={() => setPinnedChannel(channel.id)}
                          >
                            <ControlIcon name="pin" />
                          </button>
                        )}
                      {channel.type === 'text' && (
                        <button
                          className={`ct-channel-header-dev-toggle ${devEditorOpen ? 'active' : ''}`}
                          aria-label={
                            devEditorOpen
                              ? 'Ocultar bloco de notas colaborativo (Ctrl+Alt+E)'
                              : 'Exibir bloco de notas colaborativo (Ctrl+Alt+E)'
                          }
                          title={
                            devEditorOpen
                              ? 'Ocultar bloco de notas colaborativo (Ctrl+Alt+E)'
                              : 'Exibir bloco de notas colaborativo (Ctrl+Alt+E)'
                          }
                          onClick={() => setDevEditorOpen(v => !v)}
                        >
                          <ControlIcon name="docs" />
                        </button>
                      )}
                      <button
                        className="ct-channel-header-settings"
                        aria-label={`Configurações de ${channel.name}`}
                        title="Configurações do canal"
                        onClick={() => {
                        setChannelSettingsTab('general')
                        setChannelSettings(channel)
                      }}
                      >
                        <Icon name="settings" />
                      </button>
                      <button
                        className="ct-secondary"
                        onClick={() => preferences.update({ membersCollapsed: !preferences.membersCollapsed })}
                        aria-expanded={!preferences.membersCollapsed}
                        title="Recolher ou expandir membros"
                      >
                        <Icon name="members" />
                      </button>
                    </div>
                  </header>

                  {channel.type === 'voice' ? (
                    <section className="ct-empty-channels">
                      <span className="ct-eyebrow">Sem canal de texto</span>
                      <h1>Esta comunidade só tem canais de voz</h1>
                      <p>Entre numa chamada pela barra lateral ou crie um canal de texto.</p>
                      <div>
                        <button className="ct-primary" onClick={() => setCreateType('text')}>Criar canal de texto</button>
                      </div>
                    </section>
                  ) : (
                    <>
                      {channel.parentId && <ThreadHeader id={channel.id} onParent={() => openChannel(channel.parentId!)} />}
                      <div className={`ct-channel-split-workspace ${devEditorOpen ? 'has-editor' : 'chat-only'}`}>
                        {renderChatPane(channel)}

                        {devEditorOpen && (
                          <Suspense fallback={null}>
                            <CollaborativeNotepad
                              tabs={editorTabs}
                              activeTabId={activeEditorTab}
                              onSelectTab={setActiveEditorTab}
                              onCloseTab={id => {
                                setEditorTabs(t => t.filter(tab => tab.id !== id))
                                if (activeEditorTab === id) {
                                  const remaining = editorTabs.filter(tab => tab.id !== id)
                                  if (remaining.length) setActiveEditorTab(remaining[0].id)
                                }
                              }}
                              onCloseEditor={() => setDevEditorOpen(false)}
                              fileName={editorTabs.find(t => t.id === activeEditorTab)?.name || 'Notas.md'}
                              content={tabCodes[activeEditorTab] ?? ''}
                              onChangeContent={handleUpdateCode}
                              onSave={handleSaveActiveCode}
                              isSaving={isSavingCode}
                              cursors={liveRemoteCursors}
                              onCursorChange={pos => {
                                const activeTab = editorTabs.find(t => t.id === activeEditorTab)
                                devCollab.broadcastCursor(activeEditorTab, activeTab?.path || activeEditorTab, pos.line, pos.ch)
                              }}
                              onNewTab={handleNewTab}
                            />
                          </Suspense>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
              {inCall && callTab !== 'chamada' && (
                <MiniPlayer onExpand={openCall} collapsed={miniCollapsed} onCollapse={setMiniCollapsed} />
              )}
            </main>
            {preferences.bottomPanelOpen && (
              <Suspense fallback={null}>
                <TerminalPanel request={terminalRequest} onClose={() => preferences.update({ bottomPanelOpen: false })} />
              </Suspense>
            )}
          </div>

          {view === 'server' && !(inCall && callTab === 'chamada') && !preferences.membersCollapsed && (
            <RightPanel
              activeChannelId={channel.id}
              onOpenChannel={openVoiceChannel}
              members={
                <>
                  <div className="ct-heading">
                    <h2>{view === 'server' ? 'Membros' : 'Seus amigos'}</h2>
                    <span className="ct-online-dot" />
                  </div>
                  <div className="ct-section-label">
                    {community.status === 'online' ? (view === 'server' ? 'Membros' : 'Amigos') : 'Presença indisponível'}{' '}
                    — {activityMembers.length}
                  </div>
                  {groupedMembers.map((m, index) => (
                    <Fragment key={m.username}>
                      {groupRole(m.username) &&
                        groupRole(m.username)?.id !== groupRole(groupedMembers[index - 1]?.username || '')?.id && (
                          <div className="ct-section-label ct-role-group-label">{groupRole(m.username)?.name}</div>
                        )}
                      <button
                        className="ct-person ct-activity-person"
                        data-profile-identity={m.username}
                        data-profile-name={m.display_name}
                        title={serverName(m.username, m.display_name)}
                        key={m.username}
                        onClick={() => setProfile(m.display_name, m.username)}
                      >
                        <Avatar
                          name={m.display_name}
                          identity={m.username}
                          live={liveIdentities.has(m.username)}
                        />
                        <span>
                          <strong><RoleName serverId={view === 'server' ? server.id : undefined} identity={m.username} name={m.display_name} /></strong>
                          <small
                            className={
                              voice.participants.some(p => p.identity === m.username && p.isScreenShareEnabled)
                                ? 'ct-member-live'
                                : ''
                            }
                          >
                            {voice.participants.some(p => p.identity === m.username && p.isScreenShareEnabled)
                              ? 'Ao vivo na ' + voice.activeChannelName
                              : statusText(m.username)}
                          </small>
                        </span>
                        <i className={m.online ? 'ct-online-dot' : 'ct-offline-dot'} />
                      </button>
                    </Fragment>
                  ))}
                  {!activityMembers.length && (
                    <p className="ct-muted">
                      {view === 'server' ? 'Nenhuma pessoa encontrada.' : 'Adicione alguém da call ou do servidor para aparecer aqui.'}
                    </p>
                  )}
                </>
              }
            />
          )}
        </>
      </div>

      {!settingsOpen && <ActivityToasts onOpenCall={openCall} />}
      {settingsOpen && (
        <SettingsView
          initialTab={settingsTab}
          onClose={() => setSettingsOpen(false)}
          onEditProfile={() => setEditProfile(true)}
        />
      )}
      {memberRoles && (
        <MemberRoles
          member={memberRoles}
          initialSection={nicknameFirst ? 'nickname' : undefined}
          onClose={() => setMemberRoles(null)}
        />
      )}
      {joinOpen && (
        <Suspense fallback={null}>
          <ServerDialog
            onClose={() => setJoinOpen(false)}
            onDone={() => {
              setJoinOpen(false)
              setView('server')
            }}
          />
        </Suspense>
      )}
      {eventsOpen && (
        <CommunityEvents
          key={server.id}
          initialEvent={eventTarget}
          onOpenChannel={openChannel}
          onClose={() => setEventsOpen(false)}
        />
      )}
      {rolesOpen && (
        <Suspense fallback={null}>
          <RoleManager onClose={() => setRolesOpen(false)} />
        </Suspense>
      )}
      {threadCreate && (
        <ThreadCreate parentId={threadCreate} onCreated={openChannel} onClose={() => setThreadCreate(null)} />
      )}
            {pinnedChannel && (
        <PinnedMessages
          channelId={pinnedChannel}
          onOpenChannel={id => {
            setPinnedChannel(null)
            openChannel(id)
          }}
          onClose={() => setPinnedChannel(null)}
        />
      )}
      {channelSettings && (
        <ChannelSettings
          channel={channelSettings}
          initialTab={channelSettingsTab}
          onClose={() => {
            setChannelSettings(null)
            setChannelSettingsTab('general')
          }}
          onOpenChannel={openChannel}
          onCreateThread={id => setThreadCreate(id)}
        />
      )}
      <Suspense fallback={null}>
        <SaveNoteModal
          isOpen={saveNoteModalOpen}
          onClose={() => setSaveNoteModalOpen(false)}
          noteTitle={editorTabs.find(t => t.id === activeEditorTab)?.name || 'Notas.md'}
          noteContent={tabCodes[activeEditorTab] ?? ''}
          availableChannels={allTextChannels}
          defaultChannelId={channel.type === 'text' ? channel.id : (server.channels.find(c => c.type === 'text')?.id || '')}
          availableFriends={availablePeers}
          defaultFriendUsername={selectedPeer || undefined}
          onConfirm={handleConfirmSaveNote}
        />
      </Suspense>
      {profile && (
        <div className="ct-modal-backdrop" onClick={() => setProfile(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Perfil de ${profile}`}
            className="ct-profile"
            onClick={e => e.stopPropagation()}
          >
            <div className="ct-profile-banner">
              <Atmosphere />
              <button
                autoFocus
                className="ct-modal-close"
                onClick={() => setProfile(null)}
                aria-label="Fechar perfil"
              >
                <ControlIcon name="close" />
              </button>
            </div>
            <div className="ct-profile-content">
              <Avatar name={profile} identity={profileIdentity || undefined} large />
              <h1>
                <RoleName
                  serverId={view === 'server' ? server.id : undefined}
                  identity={profileIdentity || undefined}
                  name={profile}
                />
              </h1>
              {roles.snapshot && profileIdentity && (
                <div className="ct-profile-roles">
                  {assignedRoles(roles.snapshot.policy, profileIdentity)
                    .filter(role => role.id !== roles.snapshot!.policy.serverId)
                    .sort((a, b) => b.position - a.position)
                    .map(role => (
                      <RoleBadge key={role.id} role={role} />
                    ))}
                </div>
              )}
              <span className="ct-pill">{profileIdentity ? statusText(profileIdentity) : ''}</span>
              <hr />
              <h3>Sobre mim</h3>
              <p>{profileMember?.bio || (isOwnProfile ? user?.bio : '') || 'Ainda não adicionou uma descrição.'}</p>
              <div className="ct-profile-community">
                <BrandMark />
                <div>
                  <small>Comunidade</small>
                  <strong>{server.name}</strong>
                </div>
              </div>
              {isOwnProfile ? (
                <p className="ct-profile-menu-hint">
                  Clique com o botão direito no seu perfil para editar seus dados, configurar o aplicativo ou sair da conta.
                </p>
              ) : (
                <>
                  {profileIdentity && <FriendButton username={profileIdentity} name={profile} />}
                  <button
                    className="ct-primary"
                    disabled={!profileIdentity}
                    onClick={() => {
                      if (profileIdentity) openConversation(profileIdentity)
                      setProfile(null)
                    }}
                  >
                    Abrir mensagens diretas <Icon name="arrow" />
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
      {audioSettings && <AudioSettings initialMode={audioSettings} onClose={() => setAudioSettings(null)} />}
      {editProfile && <EditProfile onClose={() => setEditProfile(false)} />}
      {createType && <CreateChannel type={createType} serverId={server.id} onClose={() => setCreateType(null)} />}

      {/* Modais de Projetos (Kanban, Tarefas, Documentação, Roadmap) */}
      {PROJECTS_ENABLED && activeDevModal && (
        <Suspense fallback={null}>
          {activeDevModal === 'overview' && (
            <DevKanbanModal onClose={() => setActiveDevModal(null)} onSwitchTab={tab => setActiveDevModal(tab)} />
          )}
          {activeDevModal === 'tasks' && (
            <DevTasksModal onClose={() => setActiveDevModal(null)} onSwitchTab={tab => setActiveDevModal(tab)} />
          )}
          {activeDevModal === 'docs' && (
            <DevDocsModal onClose={() => setActiveDevModal(null)} onSwitchTab={tab => setActiveDevModal(tab)} />
          )}
          {activeDevModal === 'roadmap' && (
            <DevRoadmapModal onClose={() => setActiveDevModal(null)} onSwitchTab={tab => setActiveDevModal(tab)} />
          )}
        </Suspense>
      )}

      {context && (
        <ParticipantMenu
          onNickname={
            view === 'server' &&
            roles.snapshot?.id === server.id &&
            canSetNickname(roles.snapshot.policy, roles.snapshot.actor, context.participant.identity)
              ? () => {
                  setNicknameFirst(true)
                  setMemberRoles(context.participant.identity)
                }
              : undefined
          }
          onRoles={
            roles.snapshot &&
            roles.snapshot.policy.members.includes(context.participant.identity) &&
            (centralAllows('MANAGE_ROLES') ||
              centralAllows('MODERATE_MEMBERS') ||
              centralAllows('KICK_MEMBERS') ||
              centralAllows('BAN_MEMBERS') ||
              roles.snapshot.channels.some(
                ch =>
                  ch.type === 'voice' &&
                  ['MUTE_MEMBERS', 'DEAFEN_MEMBERS', 'MOVE_MEMBERS'].some(permission =>
                    centralAllows(permission as 'MUTE_MEMBERS' | 'DEAFEN_MEMBERS' | 'MOVE_MEMBERS', ch.id)
                  )
              ))
              ? () => {
                  setNicknameFirst(false)
                  setMemberRoles(context.participant.identity)
                }
              : undefined
          }
          onLogout={() =>
            void (async () => {
              await voice.leaveChannel()
              await logout()
            })()
          }
          onSettings={() => setSettingsOpen(true)}
          onEditProfile={() => setEditProfile(true)}
          onAudioSettings={setAudioSettings}
          participant={context.participant}
          position={{ x: context.x, y: context.y }}
          onClose={() => setContext(null)}
          onProfile={() => {
            setProfile(context.participant.name, context.participant.identity)
            setContext(null)
          }}
        />
      )}

      {commandMenuOpen && (
        <Suspense fallback={null}>
          <CommandMenuModal
            onClose={() => setCommandMenuOpen(false)}
            onToggleDevEditor={() => setDevEditorOpen(v => !v)}
            onOpenSettings={tab => {
              if (tab && ['appearance', 'audio', 'account', 'about', 'notifications'].includes(tab)) {
                setSettingsTab(tab as SettingsTabId)
              }
              setSettingsOpen(true)
            }}
            onOpenHelp={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', bubbles: true }))}
            onOpenFolder={() => void openFolder()}
            onOpenDevModal={modal => setActiveDevModal(modal)}
            onCopyDiagnostics={() => void handleCopyDiagnostics()}
            onSignOut={signOut}
            onQuit={desktop?.quitApp ? () => void quit() : undefined}
          />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <ScreenShareModal
          isOpen={voice.screenShareModalOpen && voice.connectionStatus === 'connected'}
          onClose={() => voice.setScreenShareModalOpen(false)}
          onStartShare={(source, options) => voice.startScreenShareWithOptions(source, options)}
        />
      </Suspense>

      {isDraggingFiles && (
        <div className="ct-drag-overlay" aria-hidden="true">
          <div className="ct-drag-overlay-box">
            <ControlIcon name="file" size={40} />
            <h3>
              {view === 'server' && channel?.type === 'text' && channel.name
                ? `Solte para enviar em #${channel.name}`
                : 'Solte para escolher o canal de envio'}
            </h3>
            <p>Arraste e solte para compartilhar arquivos instantaneamente</p>
          </div>
        </div>
      )}

      {pendingDropFiles && (
        <Suspense fallback={null}>
          <DropChannelSelectModal
            files={pendingDropFiles}
            servers={servers}
            activeServerId={server.id}
            activeChannelId={channel?.type === 'text' ? channel.id : undefined}
            onClose={() => setPendingDropFiles(null)}
            onSuccess={(targetServerId, targetChannelId) => {
              setActiveServer(targetServerId)
              setActiveChannel(targetChannelId)
              setView('server')
              showToast('Arquivo enviado com sucesso!')
            }}
          />
        </Suspense>
      )}

      {toastMessage && (
        <div className="ct-toast-notification" role="status">
          <ControlIcon name="check" size={14} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  )
}
