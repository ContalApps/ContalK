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
  addGitHubAccount: (tokenOrUser: string, tokenType?: 'token' | 'user') => Promise<void>
  removeGitHubAccount: (id: string) => void
  setActiveGitHubAccount: (id: string) => void
  refreshRepositories: () => Promise<void>

  connectAtlassian: (siteUrl: string, email: string, apiToken: string) => Promise<boolean>
  disconnectAtlassian: () => void
  syncAtlassianData: () => Promise<void>

  addKanbanCard: (card: Omit<KanbanCard, 'id' | 'createdAt'>) => void
  moveKanbanCard: (id: string, newColumn: KanbanColumn) => void
  updateKanbanCard: (id: string, patch: Partial<KanbanCard>) => void
  deleteKanbanCard: (id: string) => void

  addTodoTask: (title: string, priority?: PriorityLevel, assignee?: string) => void
  toggleTodoTask: (id: string) => void
  deleteTodoTask: (id: string) => void
  updateTodoTask: (id: string, patch: Partial<TodoTask>) => void

  createDevDoc: (title: string, category?: string) => string
  updateDevDoc: (id: string, patch: Partial<DevDoc>) => void
  deleteDevDoc: (id: string) => void
  setActiveDocId: (id: string | null) => void
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
        accountId: 'gh-contal'
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
        accountId: 'gh-contal'
      }
    ],
    loadingRepos: false,
    githubError: null,

    atlassian: saved.atlassian || null,
    atlassianSyncing: false,
    atlassianError: null,

    kanbanCards: saved.kanbanCards || initialKanban,
    todoTasks: saved.todoTasks || initialTasks,
    devDocs: saved.devDocs || initialDocs,
    activeDocId: saved.activeDocId || 'doc-arch',

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

    refreshRepositories: async () => {
      const { activeAccountId, githubAccounts } = get()
      const account = githubAccounts.find(a => a.id === activeAccountId)
      if (!account) return

      set({ loadingRepos: true, githubError: null })
      try {
        let repoList: GitHubRepo[] = []

        if (account.token) {
          const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
            headers: {
              Authorization: `Bearer ${account.token}`,
              Accept: 'application/vnd.github.v3+json'
            }
          })
          if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data)) {
              repoList = data.map((item: any) => ({
                id: item.id,
                name: item.name,
                fullName: item.full_name,
                owner: item.owner?.login || account.username,
                isPrivate: !!item.private,
                description: item.description || '',
                htmlUrl: item.html_url,
                defaultBranch: item.default_branch || 'main',
                updatedAt: item.updated_at || new Date().toISOString(),
                accountId: account.id
              }))
            }
          }
        } else {
          const res = await fetch(`https://api.github.com/users/${account.username}/repos?per_page=100&sort=updated`)
          if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data)) {
              repoList = data.map((item: any) => ({
                id: item.id,
                name: item.name,
                fullName: item.full_name,
                owner: item.owner?.login || account.username,
                isPrivate: !!item.private,
                description: item.description || '',
                htmlUrl: item.html_url,
                defaultBranch: item.default_branch || 'main',
                updatedAt: item.updated_at || new Date().toISOString(),
                accountId: account.id
              }))
            }
          }
        }

        if (repoList.length > 0) {
          const others = get().repositories.filter(r => r.accountId !== account.id)
          set({ repositories: [...repoList, ...others], loadingRepos: false })
          persistState(get())
        } else {
          set({ loadingRepos: false })
        }
      } catch (err) {
        set({
          loadingRepos: false,
          githubError: err instanceof Error ? err.message : 'Falha ao buscar repositórios.'
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

    moveKanbanCard: (id, newColumn) => {
      set({
        kanbanCards: get().kanbanCards.map(c => c.id === id ? { ...c, column: newColumn } : c)
      })
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
    }
  }
})
