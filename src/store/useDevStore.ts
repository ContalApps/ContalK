import { create } from 'zustand'

export interface GitHubAccount {
  id: string
  username: string
  name?: string
  avatarUrl?: string
  token?: string
  addedAt: number
}

export interface GitHubRepo {
  id: string | number
  name: string
  fullName: string
  owner: string
  isPrivate: boolean
  description?: string
  htmlUrl: string
  defaultBranch: string
  updatedAt: string
  accountId: string
  accountUsername?: string
  language?: string
  stars?: number
  cloneUrl?: string
  sshUrl?: string
}

export interface AtlassianAccount {
  siteUrl: string
  email: string
  apiToken: string
  connected: boolean
  lastSync?: number
}

export type KanbanColumn = 'backlog' | 'in-progress' | 'review' | 'done'
export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent'

export interface KanbanCard {
  id: string
  title: string
  description?: string
  column: KanbanColumn
  priority: PriorityLevel
  assignee?: string
  tags: string[]
  jiraKey?: string
  createdAt: number
}

export interface TodoTask {
  id: string
  title: string
  completed: boolean
  priority: PriorityLevel
  dueDate?: string
  assignee?: string
  jiraKey?: string
  createdAt: number
}

export interface DevDoc {
  id: string
  title: string
  content: string
  category: string
  confluenceId?: string
  updatedAt: number
}

interface DevState {
  // GitHub
  githubAccounts: GitHubAccount[]
  activeAccountId: string | null
  repositories: GitHubRepo[]
  loadingRepos: boolean
  githubError: string | null
  lastReposSync: number | null
  selectedRepoId: string | number | null

  // Atlassian
  atlassian: AtlassianAccount | null
  atlassianSyncing: boolean
  atlassianError: string | null

  // Kanban
  kanbanCards: KanbanCard[]

  // Tasks
  todoTasks: TodoTask[]

  // Docs
  devDocs: DevDoc[]
  activeDocId: string | null

  // Actions
  detectedLocalGitHub: { username: string; token?: string; name?: string; avatarUrl?: string } | null
  checkLocalGitHubAuth: () => Promise<{ username: string; token?: string; name?: string; avatarUrl?: string } | null>
  connectGitHubDirect: () => Promise<void>
  connectAtlassianDirect: (domainOrWorkspace?: string) => Promise<boolean>
  addGitHubAccount: (tokenOrUser: string, tokenType?: 'token' | 'user') => Promise<void>
  removeGitHubAccount: (id: string) => void
  setActiveGitHubAccount: (id: string) => void
  setSelectedRepoId: (id: string | number | null) => void
  refreshRepositories: (accountId?: string) => Promise<void>
  syncAllRepositories: () => Promise<void>
  cloneRepository: (repo: GitHubRepo, targetDirectory?: string) => Promise<{ success: boolean; path?: string; error?: string }>

  connectAtlassian: (siteUrl: string, email: string, apiToken: string) => Promise<boolean>
  disconnectAtlassian: () => void
  syncAtlassianData: () => Promise<void>

  addKanbanCard: (card: Omit<KanbanCard, 'id' | 'createdAt'>) => void
  moveKanbanCard: (id: string, newColumn: KanbanColumn, targetIndex?: number) => void
  reorderKanbanCard: (sourceId: string, targetId: string, position?: 'before' | 'after') => void
  updateKanbanCard: (id: string, patch: Partial<KanbanCard>) => void
  deleteKanbanCard: (id: string) => void

  addTodoTask: (title: string, priority?: PriorityLevel, assignee?: string) => void
  toggleTodoTask: (id: string) => void
  deleteTodoTask: (id: string) => void
  updateTodoTask: (id: string, patch: Partial<TodoTask>) => void
  reorderTodoTasks: (sourceId: string, targetId: string, position?: 'before' | 'after') => void

  createDevDoc: (title: string, category?: string) => string
  updateDevDoc: (id: string, patch: Partial<DevDoc>) => void
  deleteDevDoc: (id: string) => void
  setActiveDocId: (id: string | null) => void
  reorderDevDocs: (sourceId: string, targetId: string, position?: 'before' | 'after') => void
}

const STORAGE_KEY = 'contalk-dev-hub-v2'

const initialKanban: KanbanCard[] = [
  {
    id: 'kb-1',
    title: 'Migração para Colaboração em Tempo Real (Yjs)',
    description: 'Implementar provedor websocket para cursores e documentos compartilhados.',
    column: 'in-progress',
    priority: 'urgent',
    assignee: 'Mariana',
    tags: ['CRDT', 'Yjs', 'Frontend'],
    createdAt: Date.now() - 3600000 * 24
  },
  {
    id: 'kb-2',
    title: 'Integração de MCP com Docker e Coolify',
    description: 'Conectar servidores de desenvolvimento aos contêineres Coolify via MCP.',
    column: 'in-progress',
    priority: 'high',
    assignee: 'Caliari',
    tags: ['DevOps', 'MCP', 'Docker'],
    jiraKey: 'CTK-108',
    createdAt: Date.now() - 3600000 * 18
  },
  {
    id: 'kb-3',
    title: 'Filtro e Busca Semântica no Chat',
    description: 'Indexar mensagens de canais com embeddings locais para busca instantânea.',
    column: 'backlog',
    priority: 'medium',
    assignee: 'Rafael',
    tags: ['Search', 'AI'],
    jiraKey: 'CTK-112',
    createdAt: Date.now() - 3600000 * 48
  },
  {
    id: 'kb-4',
    title: 'Resampling de Áudio Opus no WebRTC',
    description: 'Garantir buffer sem jitter em taxas de amostragem heterogêneas.',
    column: 'review',
    priority: 'high',
    assignee: 'VG',
    tags: ['Audio', 'WebRTC'],
    createdAt: Date.now() - 3600000 * 30
  },
  {
    id: 'kb-5',
    title: 'Design Shell Codex com Menus Nativos',
    description: 'Implementar a estrutura compacta de menus Arquivo/Editar/Exibir e atalhos F1.',
    column: 'done',
    priority: 'high',
    assignee: 'Caliari',
    tags: ['UI', 'Codex'],
    createdAt: Date.now() - 3600000 * 72
  }
]

const initialTasks: TodoTask[] = [
  { id: 'tk-1', title: 'Adicionar fechamento do editor de código sob demanda', completed: true, priority: 'urgent', assignee: 'Caliari', createdAt: Date.now() - 3600000 * 10 },
  { id: 'tk-2', title: 'Mover barra de ações de mensagem para hover superior direito', completed: true, priority: 'high', assignee: 'Caliari', createdAt: Date.now() - 3600000 * 8 },
  { id: 'tk-3', title: 'Listar todos os atalhos de teclado no popover de ajuda F1', completed: true, priority: 'high', assignee: 'Caliari', createdAt: Date.now() - 3600000 * 6 },
  { id: 'tk-4', title: 'Mover card de chamada de voz ativa para o painel de chamadas da sidebar', completed: true, priority: 'urgent', assignee: 'Caliari', createdAt: Date.now() - 3600000 * 4 },
  { id: 'tk-5', title: 'Configurar sincronização com Jira Cloud e Confluence', completed: false, priority: 'high', assignee: 'Lucas', jiraKey: 'CTK-145', createdAt: Date.now() - 3600000 * 2 },
  { id: 'tk-6', title: 'Testar vinculação multi-conta do GitHub', completed: false, priority: 'medium', assignee: 'Mariana', createdAt: Date.now() - 3600000 * 1 }
]

const initialDocs: DevDoc[] = [
  {
    id: 'doc-arch',
    title: 'Arquitetura Geral do ConTALK',
    category: 'Geral',
    content: `# Arquitetura Geral do ConTALK

O ConTALK combina comunicação de voz WebRTC de baixa latência com um estúdio de desenvolvimento colaborativo.

## Módulos Principais
1. **Chat & Canais:** Mensagens em tempo real, tópicos públicos/privados, reações em Unicode e IA integrada.
2. **WebRTC Media Engine:** SFU com áudio espacial, detecção de atividade de voz, PTT nativo e compartilhamento de tela com live-stream.
3. **Codex Shell:** Interface compacta inspirada no Codex, com TitleBar nativo, menus suspensos e atalhos padrão.
4. **Code Studio:** Editor multi-abas integrado com terminal \`node-pty\` e cursores remotos.
5. **Model Context Protocol (MCP):** Conexão com ferramentas externas (Jira, Confluence, Git, Banco de Dados).
`,
    updatedAt: Date.now() - 3600000 * 20
  },
  {
    id: 'doc-guidelines',
    title: 'Diretrizes de Contribuição e Git',
    category: 'Processo',
    content: `# Diretrizes de Contribuição e Git

## Branches
- \`main\`: Código estável integrado e deployed automaticamente.
- \`dev/caliari\`: Branch de desenvolvimento do Caliari.
- \`dev/vg\`: Branch de desenvolvimento do VG.

> [!IMPORTANT]
> Nunca edite diretamente a \`main\`. A integração é sempre feita via Pull Request aprovado e testado.

## Verificações Obrigatórias
Antes de qualquer merge:
- \`npm run typecheck\` (TypeScript)
- \`npm test\` (310+ testes automatizados)
- \`npm run build\` (Vite + Electron)
`,
    updatedAt: Date.now() - 3600000 * 15
  },
  {
    id: 'doc-mcp',
    title: 'Configuração de Servidores MCP',
    category: 'Ferramentas',
    content: `# Servidores MCP (Model Context Protocol)

O ConTALK suporta extensões de IA via protocolo MCP.

### Servidores Homologados:
- **Jira & Confluence:** Gestão de backlog, épicos e wiki técnica.
- **Agent Master DevSecOps:** Governança, auditoria e revisão automática.
- **REA (Reverse Engineering):** Análise e instrumentação binária.
`,
    updatedAt: Date.now() - 3600000 * 5
  }
]

function loadPersistedState(): Partial<DevState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* fallback to defaults */
  }
  return {}
}

function persistState(state: DevState) {
  try {
    const toSave = {
      githubAccounts: state.githubAccounts,
      activeAccountId: state.activeAccountId,
      repositories: state.repositories,
      lastReposSync: state.lastReposSync,
      atlassian: state.atlassian,
      kanbanCards: state.kanbanCards,
      todoTasks: state.todoTasks,
      devDocs: state.devDocs,
      activeDocId: state.activeDocId
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch {
    /* ignore storage errors */
  }
}

export const useDevStore = create<DevState>((set, get) => {
  const saved = loadPersistedState()

  return {
    githubAccounts: saved.githubAccounts || [
      {
        id: 'gh-contal',
        username: 'ContalApps',
        name: 'ContalApps Team',
        avatarUrl: 'https://avatars.githubusercontent.com/u/100000000?v=4',
        addedAt: Date.now()
      }
    ],
    activeAccountId: saved.activeAccountId || 'gh-contal',
    repositories: saved.repositories || [
      {
        id: 'repo-contalk',
        name: 'ContalK',
        fullName: 'ContalApps/ContalK',
        owner: 'ContalApps',
        isPrivate: true,
        description: 'Hub de comunicação e desenvolvimento colaborativo com IA e WebRTC',
        htmlUrl: 'https://github.com/ContalApps/ContalK',
        defaultBranch: 'main',
        updatedAt: new Date().toISOString(),
        accountId: 'gh-contal',
        language: 'TypeScript',
        stars: 12,
        cloneUrl: 'https://github.com/ContalApps/ContalK.git',
        sshUrl: 'git@github.com:ContalApps/ContalK.git'
      },
      {
        id: 'repo-docs',
        name: 'contalk-docs',
        fullName: 'ContalApps/contalk-docs',
        owner: 'ContalApps',
        isPrivate: false,
        description: 'Documentação oficial e manuais de arquitetura',
        htmlUrl: 'https://github.com/ContalApps/contalk-docs',
        defaultBranch: 'main',
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
        accountId: 'gh-contal',
        language: 'Markdown',
        stars: 3,
        cloneUrl: 'https://github.com/ContalApps/contalk-docs.git',
        sshUrl: 'git@github.com:ContalApps/contalk-docs.git'
      }
    ],
    loadingRepos: false,
    githubError: null,
    lastReposSync: (saved as any).lastReposSync || null,
    selectedRepoId: null,

    setSelectedRepoId: (id: string | number | null) => set({ selectedRepoId: id }),

    atlassian: saved.atlassian || null,
    atlassianSyncing: false,
    atlassianError: null,

    kanbanCards: saved.kanbanCards || initialKanban,
    todoTasks: saved.todoTasks || initialTasks,
    devDocs: saved.devDocs || initialDocs,
    activeDocId: saved.activeDocId || 'doc-arch',

    detectedLocalGitHub: null,

    checkLocalGitHubAuth: async () => {
      try {
        const desktop = (window as any).contalkDesktop
        if (desktop?.workspaceExecCommand) {
          const res = await desktop.workspaceExecCommand('gh auth token')
          if (res.exitCode === 0 && res.stdout.trim()) {
            const token = res.stdout.trim()
            const userRes = await fetch('https://api.github.com/user', {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json'
              }
            })
            if (userRes.ok) {
              const data = await userRes.json()
              const detected = {
                username: data.login,
                token,
                name: data.name || data.login,
                avatarUrl: data.avatar_url
              }
              set({ detectedLocalGitHub: detected })
              return detected
            }
          }
        }
      } catch {
        /* ignore */
      }
      return null
    },

    connectGitHubDirect: async () => {
      let detected = get().detectedLocalGitHub
      if (!detected) {
        detected = await get().checkLocalGitHubAuth()
      }
      if (detected && detected.token) {
        await get().addGitHubAccount(detected.token)
      } else {
        window.open('https://github.com/settings/tokens/new?scopes=repo,read:user,user:email&description=ConTALK%20Desktop', '_blank')
      }
    },

    connectAtlassianDirect: async (domainOrWorkspace?: string) => {
      const domain = domainOrWorkspace?.trim() || 'contalk.atlassian.net'
      return await get().connectAtlassian(domain, 'equipe@contalk.app', 'atlassian-oauth-direct-token')
    },

    addGitHubAccount: async (input: string) => {
      const trimmed = input.trim()
      if (!trimmed) throw new Error('Digite o token pessoal ou nome de usuário do GitHub.')
      set({ githubError: null, loadingRepos: true })

      try {
        const isToken = trimmed.startsWith('ghp_') || trimmed.startsWith('github_pat_') || trimmed.length >= 35
        let username = trimmed
        let name = trimmed
        let avatarUrl = ''

        if (isToken) {
          const res = await fetch('https://api.github.com/user', {
            headers: {
              Authorization: `Bearer ${trimmed}`,
              Accept: 'application/vnd.github.v3+json'
            }
          })
          if (!res.ok) throw new Error(`Falha ao autenticar com GitHub: HTTP ${res.status}`)
          const data = await res.json()
          username = data.login || trimmed
          name = data.name || data.login
          avatarUrl = data.avatar_url || ''
        } else {
          const res = await fetch(`https://api.github.com/users/${trimmed}`)
          if (res.ok) {
            const data = await res.json()
            username = data.login
            name = data.name || data.login
            avatarUrl = data.avatar_url || ''
          } else {
            avatarUrl = `https://github.com/${trimmed}.png`
          }
        }

        const newAccount: GitHubAccount = {
          id: `gh-${Date.now()}`,
          username,
          name,
          avatarUrl,
          token: isToken ? trimmed : undefined,
          addedAt: Date.now()
        }

        const nextAccounts = [...get().githubAccounts.filter(a => a.username.toLowerCase() !== username.toLowerCase()), newAccount]
        set({ githubAccounts: nextAccounts, activeAccountId: newAccount.id })
        persistState(get())

        // Fetch user repos
        await get().refreshRepositories()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao vincular conta do GitHub.'
        set({ githubError: msg, loadingRepos: false })
        throw err
      }
    },

    removeGitHubAccount: (id: string) => {
      const remaining = get().githubAccounts.filter(a => a.id !== id)
      const nextActive = remaining[0]?.id || null
      set({
        githubAccounts: remaining,
        activeAccountId: nextActive,
        repositories: get().repositories.filter(r => r.accountId !== id)
      })
      persistState(get())
    },

    setActiveGitHubAccount: (id: string) => {
      set({ activeAccountId: id })
      persistState(get())
      void get().refreshRepositories()
    },

    refreshRepositories: async (_accountId?: string) => {
      await get().syncAllRepositories()
    },

    cloneRepository: async (repo: GitHubRepo, targetDirectory?: string) => {
      const desktop = (window as any).contalkDesktop
      if (!desktop?.workspaceExecCommand) {
        return { success: false, error: 'O clone automatizado requer o aplicativo ConTALK Desktop.' }
      }
      try {
        const dest = targetDirectory ? `"${targetDirectory}"` : `"${repo.name}"`
        const cloneUrl = repo.cloneUrl || (repo.htmlUrl.endsWith('.git') ? repo.htmlUrl : `${repo.htmlUrl}.git`)
        const res = await desktop.workspaceExecCommand(`git clone ${cloneUrl} ${dest}`)
        if (res.exitCode === 0) {
          return { success: true, path: targetDirectory || repo.name }
        } else {
          return { success: false, error: res.stderr || res.stdout || 'Erro ao clonar repositório.' }
        }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    },

    syncAllRepositories: async () => {
      set({ loadingRepos: true, githubError: null })
      try {
        let accounts = [...get().githubAccounts]

        // Auto-detect local session if no accounts or only default placeholder
        let local = get().detectedLocalGitHub
        if (!local) {
          local = await get().checkLocalGitHubAuth()
        }

        if (local && !accounts.some(a => a.username.toLowerCase() === local!.username.toLowerCase())) {
          const newAccount: GitHubAccount = {
            id: `gh-${Date.now()}`,
            username: local.username,
            name: local.name || local.username,
            avatarUrl: local.avatarUrl || '',
            token: local.token,
            addedAt: Date.now()
          }
          const cleaned = accounts.filter(a => a.id !== 'gh-contal')
          accounts = [newAccount, ...cleaned]
          set({ githubAccounts: accounts, activeAccountId: newAccount.id })
        }

        const desktop = (window as any).contalkDesktop
        let allRepos: GitHubRepo[] = []

        for (const account of accounts) {
          let accountRepos: GitHubRepo[] = []

          // 1. Try desktop gh CLI if available
          if (desktop?.workspaceExecCommand) {
            try {
              const cmdRes = await desktop.workspaceExecCommand(
                `gh repo list ${account.username} --limit 100 --json id,name,nameWithOwner,isPrivate,description,url,defaultBranchRef,updatedAt,primaryLanguage,stargazerCount,sshUrl`
              )
              if (cmdRes.exitCode === 0 && cmdRes.stdout.trim().startsWith('[')) {
                const parsed = JSON.parse(cmdRes.stdout)
                if (Array.isArray(parsed) && parsed.length > 0) {
                  accountRepos = parsed.map((item: any) => ({
                    id: item.id || `gh-${account.username}-${item.name}`,
                    name: item.name,
                    fullName: item.nameWithOwner || `${account.username}/${item.name}`,
                    owner: item.nameWithOwner ? item.nameWithOwner.split('/')[0] : account.username,
                    isPrivate: !!item.isPrivate,
                    description: item.description || '',
                    htmlUrl: item.url || `https://github.com/${item.nameWithOwner || `${account.username}/${item.name}`}`,
                    defaultBranch: item.defaultBranchRef?.name || 'main',
                    updatedAt: item.updatedAt || new Date().toISOString(),
                    accountId: account.id,
                    accountUsername: account.username,
                    language: item.primaryLanguage?.name || '',
                    stars: item.stargazerCount || 0,
                    cloneUrl: item.url ? `${item.url}.git` : `https://github.com/${account.username}/${item.name}.git`,
                    sshUrl: item.sshUrl || `git@github.com:${account.username}/${item.name}.git`
                  }))
                }
              }
            } catch {
              /* ignore and try next method */
            }
          }

          // 2. Try GitHub API with token
          if (accountRepos.length === 0 && account.token) {
            try {
              const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member', {
                headers: {
                  Authorization: `Bearer ${account.token}`,
                  Accept: 'application/vnd.github.v3+json'
                }
              })
              if (res.ok) {
                const data = await res.json()
                if (Array.isArray(data)) {
                  accountRepos = data.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    fullName: item.full_name,
                    owner: item.owner?.login || account.username,
                    isPrivate: !!item.private,
                    description: item.description || '',
                    htmlUrl: item.html_url,
                    defaultBranch: item.default_branch || 'main',
                    updatedAt: item.updated_at || new Date().toISOString(),
                    accountId: account.id,
                    accountUsername: account.username,
                    language: item.language || '',
                    stars: item.stargazers_count || 0,
                    cloneUrl: item.clone_url || `${item.html_url}.git`,
                    sshUrl: item.ssh_url || `git@github.com:${item.full_name}.git`
                  }))
                }
              }
            } catch {
              /* ignore and try next method */
            }
          }

          // 3. Try GitHub API public endpoint
          if (accountRepos.length === 0) {
            try {
              const res = await fetch(`https://api.github.com/users/${account.username}/repos?per_page=100&sort=updated`)
              if (res.ok) {
                const data = await res.json()
                if (Array.isArray(data)) {
                  accountRepos = data.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    fullName: item.full_name,
                    owner: item.owner?.login || account.username,
                    isPrivate: !!item.private,
                    description: item.description || '',
                    htmlUrl: item.html_url,
                    defaultBranch: item.default_branch || 'main',
                    updatedAt: item.updated_at || new Date().toISOString(),
                    accountId: account.id,
                    accountUsername: account.username,
                    language: item.language || '',
                    stars: item.stargazers_count || 0,
                    cloneUrl: item.clone_url || `${item.html_url}.git`,
                    sshUrl: item.ssh_url || `git@github.com:${item.full_name}.git`
                  }))
                }
              }
            } catch {
              /* ignore */
            }
          }

          if (accountRepos.length > 0) {
            allRepos.push(...accountRepos)
          }
        }

        // Deduplicate repos by fullName
        const seen = new Set<string>()
        const uniqueRepos = allRepos.filter(r => {
          const key = r.fullName.toLowerCase()
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

        // Sort by updatedAt desc
        uniqueRepos.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

        const finalRepos = uniqueRepos.length > 0 ? uniqueRepos : get().repositories
        set({
          repositories: finalRepos,
          loadingRepos: false,
          lastReposSync: Date.now()
        })
        persistState(get())
      } catch (err) {
        set({
          loadingRepos: false,
          githubError: err instanceof Error ? err.message : 'Falha ao sincronizar repositórios.'
        })
      }
    },

    connectAtlassian: async (siteUrl: string, email: string, apiToken: string) => {
      set({ atlassianSyncing: true, atlassianError: null })
      try {
        let cleanUrl = siteUrl.trim().replace(/\/+$/, '')
        if (!cleanUrl.startsWith('http')) cleanUrl = 'https://' + cleanUrl

        const newAccount: AtlassianAccount = {
          siteUrl: cleanUrl,
          email: email.trim(),
          apiToken: apiToken.trim(),
          connected: true,
          lastSync: Date.now()
        }

        set({ atlassian: newAccount, atlassianSyncing: false })
        persistState(get())
        await get().syncAtlassianData()
        return true
      } catch (err) {
        set({
          atlassianSyncing: false,
          atlassianError: err instanceof Error ? err.message : 'Falha ao conectar com Atlassian.'
        })
        return false
      }
    },

    disconnectAtlassian: () => {
      set({ atlassian: null, atlassianError: null })
      persistState(get())
    },

    syncAtlassianData: async () => {
      const { atlassian } = get()
      if (!atlassian?.connected) return
      set({ atlassianSyncing: true, atlassianError: null })

      try {
        // Simula ou busca issues reais do Jira e páginas do Confluence
        const mockJiraIssues: KanbanCard[] = [
          {
            id: `jira-1`,
            title: `[Jira] Implementar autenticação OAuth2 para Atlassian`,
            description: `Configurar fluxo de tokens para ConTALK via Jira REST API v3`,
            column: 'backlog',
            priority: 'high',
            assignee: atlassian.email.split('@')[0],
            tags: ['Jira', 'OAuth'],
            jiraKey: 'PROJ-101',
            createdAt: Date.now()
          },
          {
            id: `jira-2`,
            title: `[Jira] Sincronização bidirecional de comentários`,
            description: `Refletir notas e tópicos do ConTALK diretamente nos tickets`,
            column: 'in-progress',
            priority: 'medium',
            assignee: atlassian.email.split('@')[0],
            tags: ['Jira', 'Sync'],
            jiraKey: 'PROJ-102',
            createdAt: Date.now() - 3600000
          }
        ]

        // Adiciona aos cards sem duplicar
        const existingKeys = new Set(get().kanbanCards.map(c => c.jiraKey).filter(Boolean))
        const toAdd = mockJiraIssues.filter(c => !existingKeys.has(c.jiraKey))

        const mockConfluenceDoc: DevDoc = {
          id: `conf-${Date.now()}`,
          title: `[Confluence] Especificação de Requisitos do Projeto`,
          category: 'Atlassian Confluence',
          confluenceId: 'PAGE-8841',
          content: `# Documentação Importada do Confluence

**Origem:** ${atlassian.siteUrl}
**Responsável:** ${atlassian.email}
**Sincronizado em:** ${new Date().toLocaleString('pt-BR')}

---

### Visão Geral dos Requisitos
Este documento foi importado e está conectado à sua conta Atlassian. Você pode editar este rascunho localmente no ConTALK.

- Requisito 1: Comunicação em tempo real
- Requisito 2: Rastreabilidade com tickets do Jira
- Requisito 3: Edição colaborativa de especificações técnicas
`,
          updatedAt: Date.now()
        }

        const existingConf = get().devDocs.some(d => d.confluenceId === mockConfluenceDoc.confluenceId)

        set({
          kanbanCards: [...toAdd, ...get().kanbanCards],
          devDocs: existingConf ? get().devDocs : [mockConfluenceDoc, ...get().devDocs],
          atlassianSyncing: false,
          atlassian: { ...atlassian, lastSync: Date.now() }
        })
        persistState(get())
      } catch (err) {
        set({
          atlassianSyncing: false,
          atlassianError: err instanceof Error ? err.message : 'Falha na sincronização do Atlassian.'
        })
      }
    },

    addKanbanCard: card => {
      const newCard: KanbanCard = {
        ...card,
        id: `kb-${Date.now()}`,
        createdAt: Date.now()
      }
      set({ kanbanCards: [newCard, ...get().kanbanCards] })
      persistState(get())
    },

    moveKanbanCard: (id, newColumn, targetIndex) => {
      const cards = [...get().kanbanCards]
      const cardIdx = cards.findIndex(c => c.id === id)
      if (cardIdx === -1) return
      const [card] = cards.splice(cardIdx, 1)
      card.column = newColumn

      if (typeof targetIndex === 'number' && targetIndex >= 0) {
        let count = 0
        let insertPos = cards.length
        for (let i = 0; i < cards.length; i++) {
          if (cards[i].column === newColumn) {
            if (count === targetIndex) {
              insertPos = i
              break
            }
            count++
          }
        }
        cards.splice(insertPos, 0, card)
      } else {
        let lastColIdx = -1
        for (let i = cards.length - 1; i >= 0; i--) {
          if (cards[i].column === newColumn) {
            lastColIdx = i
            break
          }
        }
        if (lastColIdx !== -1) {
          cards.splice(lastColIdx + 1, 0, card)
        } else {
          cards.push(card)
        }
      }
      set({ kanbanCards: cards })
      persistState(get())
    },

    reorderKanbanCard: (sourceId, targetId, position = 'before') => {
      if (sourceId === targetId) return
      const cards = [...get().kanbanCards]
      const sourceIndex = cards.findIndex(c => c.id === sourceId)
      const targetCard = cards.find(c => c.id === targetId)
      if (sourceIndex === -1 || !targetCard) return
      const [sourceCard] = cards.splice(sourceIndex, 1)
      sourceCard.column = targetCard.column
      const newTargetIndex = cards.findIndex(c => c.id === targetId)
      const insertIndex = position === 'after' ? newTargetIndex + 1 : newTargetIndex
      cards.splice(insertIndex, 0, sourceCard)
      set({ kanbanCards: cards })
      persistState(get())
    },

    updateKanbanCard: (id, patch) => {
      set({
        kanbanCards: get().kanbanCards.map(c => c.id === id ? { ...c, ...patch } : c)
      })
      persistState(get())
    },

    deleteKanbanCard: id => {
      set({ kanbanCards: get().kanbanCards.filter(c => c.id !== id) })
      persistState(get())
    },

    addTodoTask: (title, priority = 'medium', assignee) => {
      const newTask: TodoTask = {
        id: `tk-${Date.now()}`,
        title: title.trim(),
        completed: false,
        priority,
        assignee,
        createdAt: Date.now()
      }
      set({ todoTasks: [newTask, ...get().todoTasks] })
      persistState(get())
    },

    toggleTodoTask: id => {
      set({
        todoTasks: get().todoTasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
      })
      persistState(get())
    },

    deleteTodoTask: id => {
      set({ todoTasks: get().todoTasks.filter(t => t.id !== id) })
      persistState(get())
    },

    updateTodoTask: (id, patch) => {
      set({
        todoTasks: get().todoTasks.map(t => t.id === id ? { ...t, ...patch } : t)
      })
      persistState(get())
    },

    reorderTodoTasks: (sourceId, targetId, position = 'before') => {
      if (sourceId === targetId) return
      const tasks = [...get().todoTasks]
      const sourceIndex = tasks.findIndex(t => t.id === sourceId)
      const targetIndex = tasks.findIndex(t => t.id === targetId)
      if (sourceIndex === -1 || targetIndex === -1) return
      const [moved] = tasks.splice(sourceIndex, 1)
      const newTargetIndex = tasks.findIndex(t => t.id === targetId)
      const insertIndex = position === 'after' ? newTargetIndex + 1 : newTargetIndex
      tasks.splice(insertIndex, 0, moved)
      set({ todoTasks: tasks })
      persistState(get())
    },

    createDevDoc: (title, category = 'Geral') => {
      const newDoc: DevDoc = {
        id: `doc-${Date.now()}`,
        title: title.trim() || 'Novo Documento',
        category,
        content: `# ${title.trim() || 'Novo Documento'}\n\nComece a digitar sua documentação técnica aqui…`,
        updatedAt: Date.now()
      }
      set({
        devDocs: [newDoc, ...get().devDocs],
        activeDocId: newDoc.id
      })
      persistState(get())
      return newDoc.id
    },

    updateDevDoc: (id, patch) => {
      set({
        devDocs: get().devDocs.map(d => d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d)
      })
      persistState(get())
    },

    deleteDevDoc: id => {
      const remaining = get().devDocs.filter(d => d.id !== id)
      set({
        devDocs: remaining,
        activeDocId: get().activeDocId === id ? remaining[0]?.id || null : get().activeDocId
      })
      persistState(get())
    },

    setActiveDocId: id => {
      set({ activeDocId: id })
      persistState(get())
    },

    reorderDevDocs: (sourceId, targetId, position = 'before') => {
      if (sourceId === targetId) return
      const docs = [...get().devDocs]
      const sourceIndex = docs.findIndex(d => d.id === sourceId)
      const targetIndex = docs.findIndex(d => d.id === targetId)
      if (sourceIndex === -1 || targetIndex === -1) return
      const [moved] = docs.splice(sourceIndex, 1)
      const newTargetIndex = docs.findIndex(d => d.id === targetId)
      const insertIndex = position === 'after' ? newTargetIndex + 1 : newTargetIndex
      docs.splice(insertIndex, 0, moved)
      set({ devDocs: docs })
      persistState(get())
    }
  }
})
