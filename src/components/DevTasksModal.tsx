import { useState, useId } from 'react'
import { useDevStore, type PriorityLevel } from '../store/useDevStore'
import { ControlIcon } from './ControlIcon'

export function DevTasksModal({ onClose, onOpenAtlassian }: { onClose: () => void; onOpenAtlassian?: () => void }) {
  const { todoTasks, addTodoTask, toggleTodoTask, deleteTodoTask, atlassian, syncAtlassianData, atlassianSyncing } = useDevStore()
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [search, setSearch] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<PriorityLevel>('medium')
  const [newAssignee, setNewAssignee] = useState('')
  const taskInputId = useId()

  const totalCount = todoTasks.length
  const completedCount = todoTasks.filter(t => t.completed).length
  const pendingCount = totalCount - completedCount
  const percentCompleted = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    addTodoTask(newTitle.trim(), newPriority, newAssignee.trim() || undefined)
    setNewTitle('')
    setNewAssignee('')
  }

  const filteredTasks = todoTasks.filter(t => {
    if (filter === 'pending' && t.completed) return false
    if (filter === 'completed' && !t.completed) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const matchTitle = t.title.toLowerCase().includes(q)
      const matchAssignee = t.assignee?.toLowerCase().includes(q)
      const matchJira = t.jiraKey?.toLowerCase().includes(q)
      return matchTitle || matchAssignee || matchJira
    }
    return true
  })

  const priorityMeta: Record<PriorityLevel, { text: string; color: string; bg: string }> = {
    low: { text: 'Baixa', color: '#8b949e', bg: 'rgba(139, 148, 158, 0.15)' },
    medium: { text: 'Média', color: '#58a6ff', bg: 'rgba(88, 166, 255, 0.15)' },
    high: { text: 'Alta', color: '#d29922', bg: 'rgba(210, 153, 34, 0.15)' },
    urgent: { text: 'Urgente', color: '#f85149', bg: 'rgba(248, 81, 73, 0.15)' }
  }

  return (
    <div className="ct-modal-backdrop" onClick={onClose}>
      <section className="ct-dev-modal-panel ct-tasks-dialog" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <header className="ct-dev-modal-header">
          <div>
            <h2><ControlIcon name="tasks" size={16}/> Tarefas — Listas de Acompanhamento</h2>
            <p>Monitore pendências, itens de sprint e tarefas do Jira em formato checklist ágil.</p>
          </div>
          <div className="ct-dev-header-actions">
            {atlassian?.connected ? (
              <button
                type="button"
                className="ct-atlassian-sync-btn"
                onClick={() => void syncAtlassianData()}
                disabled={atlassianSyncing}
                title="Sincronizar com Jira"
              >
                <ControlIcon name="refresh" size={13}/>
                <span>{atlassianSyncing ? 'Sincronizando Jira…' : 'Jira Conectado ✓'}</span>
              </button>
            ) : onOpenAtlassian ? (
              <button
                type="button"
                className="ct-atlassian-connect-btn"
                onClick={onOpenAtlassian}
                title="Conectar com Jira & Confluence"
              >
                <span>Conectar Atlassian (Jira)</span>
              </button>
            ) : null}
            <button type="button" className="ct-close-btn" onClick={onClose} aria-label="Fechar">
              <ControlIcon name="close" size={14}/>
            </button>
          </div>
        </header>

        {/* Progress bar */}
        <div className="ct-tasks-progress-banner">
          <div className="ct-tasks-progress-info">
            <span>Progresso da Sprint / Projeto: <strong>{percentCompleted}%</strong> ({completedCount} de {totalCount} concluídas)</span>
            <span className="ct-tasks-counts-tag">{pendingCount} pendente{pendingCount === 1 ? '' : 's'}</span>
          </div>
          <div className="ct-tasks-progress-track">
            <div className="ct-tasks-progress-fill" style={{ width: `${percentCompleted}%` }} />
          </div>
        </div>

        {/* Filters and search */}
        <div className="ct-tasks-filter-bar">
          <div className="ct-filter-tabs">
            <button
              type="button"
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              Todas ({totalCount})
            </button>
            <button
              type="button"
              className={filter === 'pending' ? 'active' : ''}
              onClick={() => setFilter('pending')}
            >
              Pendentes ({pendingCount})
            </button>
            <button
              type="button"
              className={filter === 'completed' ? 'active' : ''}
              onClick={() => setFilter('completed')}
            >
              Concluídas ({completedCount})
            </button>
          </div>
          <div className="ct-tasks-search-wrap">
            <input
              type="search"
              placeholder="Filtrar tarefas ou tickets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Buscar tarefas"
            />
          </div>
        </div>

        {/* Fast Add Form */}
        <form onSubmit={handleAdd} className="ct-tasks-add-bar">
          <label htmlFor={taskInputId} className="sr-only">Nova tarefa</label>
          <input
            id={taskInputId}
            type="text"
            placeholder="Adicionar nova tarefa... (Pressione Enter)"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            className="ct-task-main-input"
            autoFocus
          />
          <select
            value={newPriority}
            onChange={e => setNewPriority(e.target.value as PriorityLevel)}
            className="ct-priority-select"
            aria-label="Prioridade"
          >
            <option value="low">Baixa</option>
            <option value="medium">Média</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
          <input
            type="text"
            placeholder="Responsável (ex: Caliari)"
            value={newAssignee}
            onChange={e => setNewAssignee(e.target.value)}
            className="ct-assignee-input"
            aria-label="Responsável"
          />
          <button type="submit" className="ct-primary" disabled={!newTitle.trim()}>
            <ControlIcon name="plus" size={13}/>
            <span>Adicionar</span>
          </button>
        </form>

        {/* Task List items */}
        <div className="ct-tasks-scroll-container">
          {filteredTasks.length === 0 ? (
            <div className="ct-empty-state">
              <p>Nenhuma tarefa encontrada neste filtro.</p>
            </div>
          ) : (
            <ul className="ct-tasks-list">
              {filteredTasks.map(task => {
                const p = priorityMeta[task.priority] || priorityMeta.medium
                return (
                  <li key={task.id} className={`ct-task-item ${task.completed ? 'is-completed' : ''}`}>
                    <label className="ct-task-checkbox-label">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleTodoTask(task.id)}
                        aria-label={`Marcar ${task.title} como ${task.completed ? 'pendente' : 'concluída'}`}
                      />
                      <span className="ct-task-custom-check" />
                    </label>

                    <div className="ct-task-content" onClick={() => toggleTodoTask(task.id)}>
                      <span className="ct-task-title">{task.title}</span>
                      <div className="ct-task-badges">
                        {task.jiraKey && (
                          <span className="ct-task-jira-badge" title="Ticket Jira">
                            {task.jiraKey}
                          </span>
                        )}
                        <span
                          className="ct-task-priority-badge"
                          style={{ color: p.color, backgroundColor: p.bg }}
                        >
                          {p.text}
                        </span>
                        {task.assignee && (
                          <span className="ct-task-assignee-badge">
                            @{task.assignee}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="ct-task-del-btn"
                      onClick={() => deleteTodoTask(task.id)}
                      title="Excluir tarefa"
                      aria-label="Excluir tarefa"
                    >
                      <ControlIcon name="close" size={12}/>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
