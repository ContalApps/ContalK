import { ControlIcon } from './ControlIcon'
import { useDevStore } from '../store/useDevStore'

export type DevProjectTabId = 'overview' | 'tasks' | 'docs' | 'roadmap' | 'github'

export function DevProjectTabs({
  activeTab,
  onSwitchTab
}: {
  activeTab: DevProjectTabId
  onSwitchTab?: (tab: DevProjectTabId) => void
}) {
  const { kanbanCards, todoTasks, devDocs, githubAccounts } = useDevStore()
  const pendingTasks = todoTasks.filter(t => !t.completed).length

  if (!onSwitchTab) return null

  return (
    <nav className="ct-project-tabs-nav" aria-label="Navegação de Projetos">
      <button
        type="button"
        className={`ct-project-tab-btn ${activeTab === 'overview' ? 'is-active' : ''}`}
        onClick={() => onSwitchTab('overview')}
        title="Quadro Kanban interativo de entregas e sprints (arraste os cards entre colunas)"
      >
        <ControlIcon name="overview" size={13} />
        <span>Kanban</span>
        <span className="ct-project-tab-badge">{kanbanCards.length}</span>
      </button>

      <button
        type="button"
        className={`ct-project-tab-btn ${activeTab === 'tasks' ? 'is-active' : ''}`}
        onClick={() => onSwitchTab('tasks')}
        title="Lista de tarefas, pendências e sprint backlog (arraste para priorizar)"
      >
        <ControlIcon name="tasks" size={13} />
        <span>Tarefas</span>
        <span className="ct-project-tab-badge">{pendingTasks}</span>
      </button>

      <button
        type="button"
        className={`ct-project-tab-btn ${activeTab === 'docs' ? 'is-active' : ''}`}
        onClick={() => onSwitchTab('docs')}
        title="Central de documentação técnica (arraste para organizar os documentos)"
      >
        <ControlIcon name="docs" size={13} />
        <span>Documentação</span>
        <span className="ct-project-tab-badge">{devDocs.length}</span>
      </button>

      <button
        type="button"
        className={`ct-project-tab-btn ${activeTab === 'roadmap' ? 'is-active' : ''}`}
        onClick={() => onSwitchTab('roadmap')}
        title="Roadmap e marcos de versão do projeto"
      >
        <ControlIcon name="roadmap" size={13} />
        <span>Roadmap</span>
      </button>

      <button
        type="button"
        className={`ct-project-tab-btn ${activeTab === 'github' ? 'is-active' : ''}`}
        onClick={() => onSwitchTab('github')}
        title="Vincular contas do GitHub e sincronizar repositórios para conexão com chats e IA"
      >
        <ControlIcon name="git" size={13} />
        <span>GitHub & Repositórios</span>
        <span className="ct-project-tab-badge">{githubAccounts.length}</span>
      </button>
    </nav>
  )
}
