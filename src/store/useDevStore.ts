import { create } from 'zustand'

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
  createdAt: number
}

export interface TodoTask {
  id: string
  title: string
  completed: boolean
  priority: PriorityLevel
  dueDate?: string
  assignee?: string
  createdAt: number
}

export interface DevDoc {
  id: string
  title: string
  content: string
  category: string
  updatedAt: number
}

interface DevState {
  // Kanban
  kanbanCards: KanbanCard[]

  // Tasks
  todoTasks: TodoTask[]

  // Docs
  devDocs: DevDoc[]
  activeDocId: string | null

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

const STORAGE_KEY = 'contalk-dev-hub-v3'

const initialKanban: KanbanCard[] = [
  {
    id: 'kb-1',
    title: 'Comunicação WebRTC de Baixa Latência',
    description: 'Estabilidade de áudio, VAD local e redução de ruído nativo.',
    column: 'done',
    priority: 'urgent',
    assignee: 'Caliari',
    tags: ['WebRTC', 'Audio', 'Core'],
    createdAt: Date.now() - 3600000 * 24
  },
  {
    id: 'kb-2',
    title: 'Transmissão de Tela em Alta Fidelidade',
    description: 'Captura de monitores e janelas com baixa latência e 60 FPS.',
    column: 'in-progress',
    priority: 'high',
    assignee: 'VG',
    tags: ['ScreenShare', 'Streaming'],
    createdAt: Date.now() - 3600000 * 18
  },
  {
    id: 'kb-3',
    title: 'Bloco de Notas Colaborativo em Tempo Real',
    description: 'Edição simultânea de texto com cursores e presença de usuários.',
    column: 'in-progress',
    priority: 'high',
    assignee: 'Caliari',
    tags: ['Notepad', 'Realtime'],
    createdAt: Date.now() - 3600000 * 12
  },
  {
    id: 'kb-4',
    title: 'Cargos e Permissões de Comunidade',
    description: 'Políticas de permissão granular por canal e cargo estilo Discord.',
    column: 'review',
    priority: 'medium',
    assignee: 'Rafael',
    tags: ['Roles', 'Permissions'],
    createdAt: Date.now() - 3600000 * 30
  }
]

const initialTasks: TodoTask[] = [
  { id: 'tk-1', title: 'Testar transmissão de tela com múltiplos participantes', completed: true, priority: 'urgent', assignee: 'Caliari', createdAt: Date.now() - 3600000 * 10 },
  { id: 'tk-2', title: 'Otimizar indicador de voz na bandeja do sistema', completed: true, priority: 'high', assignee: 'Caliari', createdAt: Date.now() - 3600000 * 8 },
  { id: 'tk-3', title: 'Revisar bloco de notas colaborativo nos canais de texto', completed: false, priority: 'high', assignee: 'Caliari', createdAt: Date.now() - 3600000 * 4 },
  { id: 'tk-4', title: 'Validar atalhos de PTT e silenciamento global', completed: false, priority: 'medium', assignee: 'VG', createdAt: Date.now() - 3600000 * 2 }
]

const initialDocs: DevDoc[] = [
  {
    id: 'doc-arch',
    title: 'Visão Geral do ConTALK',
    category: 'Geral',
    content: `# ConTALK — Comunicação e Colaboração em Tempo Real

O ConTALK é um aplicativo moderno de comunicação por voz, vídeo e transmissão de tela, inspirado na experiência e simplicidade do Discord.

## Pilares Fundamentais
1. **Comunicação de Alta Performance:** Áudio cristalino com WebRTC, cancelamento de eco acústico e VAD ultra-rápido.
2. **Transmissão de Tela:** Compartilhamento fluido de janelas e telas inteiras em tempo real.
3. **Comunidades e Canais:** Estrutura completa de canais de texto e voz com cargos e tópicos.
4. **Bloco de Notas Colaborativo:** Edição de texto e anotações compartilhadas entre o time em tempo real.
5. **Gestão de Projetos:** Quadros Kanban, listas de tarefas, documentação e roadmap integrados.
`,
    updatedAt: Date.now() - 3600000 * 20
  },
  {
    id: 'doc-guidelines',
    title: 'Diretrizes de Desenvolvimento',
    category: 'Processo',
    content: `# Diretrizes do Projeto

## Branches
- \`main\`: Código estável integrado e deployado automaticamente.
- \`dev/caliari\`: Branch de desenvolvimento do Caliari.
- \`dev/vg\`: Branch de desenvolvimento do VG.

## Verificações Obrigatórias
Antes de qualquer integração:
- \`npm run typecheck\` (TypeScript)
- \`npm test\` (Suíte de testes automatizados)
- \`npm run build\` (Vite + Electron)
`,
    updatedAt: Date.now() - 3600000 * 15
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
    kanbanCards: saved.kanbanCards || initialKanban,
    todoTasks: saved.todoTasks || initialTasks,
    devDocs: saved.devDocs || initialDocs,
    activeDocId: saved.activeDocId || 'doc-arch',

    addKanbanCard: (card) => {
      const newCard: KanbanCard = {
        ...card,
        id: `kb-${Date.now()}`,
        createdAt: Date.now()
      }
      set(state => ({ kanbanCards: [newCard, ...state.kanbanCards] }))
      persistState(get())
    },

    moveKanbanCard: (id, newColumn, targetIndex) => {
      set(state => {
        const card = state.kanbanCards.find(c => c.id === id)
        if (!card) return state
        const remaining = state.kanbanCards.filter(c => c.id !== id)
        const updated = { ...card, column: newColumn }
        if (typeof targetIndex === 'number' && targetIndex >= 0) {
          remaining.splice(targetIndex, 0, updated)
          return { kanbanCards: remaining }
        }
        return { kanbanCards: [...remaining, updated] }
      })
      persistState(get())
    },

    reorderKanbanCard: (sourceId, targetId, position = 'before') => {
      set(state => {
        const sourceIndex = state.kanbanCards.findIndex(c => c.id === sourceId)
        const targetIndex = state.kanbanCards.findIndex(c => c.id === targetId)
        if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return state

        const card = state.kanbanCards[sourceIndex]
        const targetCard = state.kanbanCards[targetIndex]
        const remaining = state.kanbanCards.filter(c => c.id !== sourceId)
        const updated = { ...card, column: targetCard.column }
        const newTargetIndex = remaining.findIndex(c => c.id === targetId)
        const insertIndex = position === 'before' ? newTargetIndex : newTargetIndex + 1
        remaining.splice(insertIndex, 0, updated)
        return { kanbanCards: remaining }
      })
      persistState(get())
    },

    updateKanbanCard: (id, patch) => {
      set(state => ({
        kanbanCards: state.kanbanCards.map(c => c.id === id ? { ...c, ...patch } : c)
      }))
      persistState(get())
    },

    deleteKanbanCard: (id) => {
      set(state => ({
        kanbanCards: state.kanbanCards.filter(c => c.id !== id)
      }))
      persistState(get())
    },

    addTodoTask: (title, priority = 'medium', assignee) => {
      const newTask: TodoTask = {
        id: `tk-${Date.now()}`,
        title,
        completed: false,
        priority,
        assignee,
        createdAt: Date.now()
      }
      set(state => ({ todoTasks: [newTask, ...state.todoTasks] }))
      persistState(get())
    },

    toggleTodoTask: (id) => {
      set(state => ({
        todoTasks: state.todoTasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
      }))
      persistState(get())
    },

    deleteTodoTask: (id) => {
      set(state => ({
        todoTasks: state.todoTasks.filter(t => t.id !== id)
      }))
      persistState(get())
    },

    updateTodoTask: (id, patch) => {
      set(state => ({
        todoTasks: state.todoTasks.map(t => t.id === id ? { ...t, ...patch } : t)
      }))
      persistState(get())
    },

    reorderTodoTasks: (sourceId, targetId, position = 'before') => {
      set(state => {
        const sourceIndex = state.todoTasks.findIndex(t => t.id === sourceId)
        const targetIndex = state.todoTasks.findIndex(t => t.id === targetId)
        if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return state

        const task = state.todoTasks[sourceIndex]
        const remaining = state.todoTasks.filter(t => t.id !== sourceId)
        const newTargetIndex = remaining.findIndex(t => t.id === targetId)
        const insertIndex = position === 'before' ? newTargetIndex : newTargetIndex + 1
        remaining.splice(insertIndex, 0, task)
        return { todoTasks: remaining }
      })
      persistState(get())
    },

    createDevDoc: (title, category = 'Geral') => {
      const id = `doc-${Date.now()}`
      const newDoc: DevDoc = {
        id,
        title,
        content: `# ${title}\n\nEscreva sua documentação aqui...`,
        category,
        updatedAt: Date.now()
      }
      set(state => ({
        devDocs: [newDoc, ...state.devDocs],
        activeDocId: id
      }))
      persistState(get())
      return id
    },

    updateDevDoc: (id, patch) => {
      set(state => ({
        devDocs: state.devDocs.map(d => d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d)
      }))
      persistState(get())
    },

    deleteDevDoc: (id) => {
      set(state => {
        const remaining = state.devDocs.filter(d => d.id !== id)
        return {
          devDocs: remaining,
          activeDocId: state.activeDocId === id ? (remaining[0]?.id || null) : state.activeDocId
        }
      })
      persistState(get())
    },

    setActiveDocId: (id) => set({ activeDocId: id }),

    reorderDevDocs: (sourceId, targetId, position = 'before') => {
      set(state => {
        const sourceIndex = state.devDocs.findIndex(d => d.id === sourceId)
        const targetIndex = state.devDocs.findIndex(d => d.id === targetId)
        if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return state

        const doc = state.devDocs[sourceIndex]
        const remaining = state.devDocs.filter(d => d.id !== sourceId)
        const newTargetIndex = remaining.findIndex(d => d.id === targetId)
        const insertIndex = position === 'before' ? newTargetIndex : newTargetIndex + 1
        remaining.splice(insertIndex, 0, doc)
        return { devDocs: remaining }
      })
      persistState(get())
    }
  }
})
