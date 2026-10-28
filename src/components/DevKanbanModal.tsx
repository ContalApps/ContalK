import { useState } from 'react'
import { useDevStore, type KanbanColumn, type PriorityLevel } from '../store/useDevStore'
import { ControlIcon } from './ControlIcon'

export function DevKanbanModal({ onClose, onOpenAtlassian }: { onClose: () => void; onOpenAtlassian: () => void }) {
  const { kanbanCards, addKanbanCard, moveKanbanCard, deleteKanbanCard, atlassian, syncAtlassianData, atlassianSyncing } = useDevStore()
  const [filterQuery, setFilterQuery] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newCol, setNewCol] = useState<KanbanColumn>('backlog')
  const [newPriority, setNewPriority] = useState<PriorityLevel>('medium')
  const [newTags, setNewTags] = useState('')

  const columns: { id: KanbanColumn; title: string; color: string; icon: string }[] = [
    { id: 'backlog', title: 'A Fazer / Backlog', color: '#8b949e', icon: 'tasks' },
    { id: 'in-progress', title: 'Em Andamento', color: '#58a6ff', icon: 'rocket' },
    { id: 'review', title: 'Em Revisão', color: '#d29922', icon: 'git-pr' },
    { id: 'done', title: 'Concluído', color: '#3fb950', icon: 'check' }
  ]

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    const tags = newTags.split(',').map(t => t.trim()).filter(Boolean)
    addKanbanCard({
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      column: newCol,
      priority: newPriority,
      tags
    })
    setNewTitle('')
    setNewDesc('')
    setNewTags('')
    setIsAdding(false)
  }

  const filteredCards = kanbanCards.filter(c =>
    (c.title + ' ' + (c.description || '') + ' ' + c.tags.join(' ')).toLowerCase().includes(filterQuery.toLowerCase())
  )

  const priorityLabels: Record<PriorityLevel, { text: string; color: string }> = {
    low: { text: 'Baixa', color: '#8b949e' },
    medium: { text: 'Média', color: '#58a6ff' },
    high: { text: 'Alta', color: '#d29922' },
    urgent: { text: 'Urgente', color: '#f85149' }
  }

  const nextColMap: Record<KanbanColumn, KanbanColumn | null> = {
    'backlog': 'in-progress',
    'in-progress': 'review',
    'review': 'done',
    'done': null
  }

  const prevColMap: Record<KanbanColumn, KanbanColumn | null> = {
    'backlog': null,
    'in-progress': 'backlog',
    'review': 'in-progress',
    'done': 'review'
  }

  return (
    <div className="ct-modal-backdrop" onClick={onClose}>
      <section className="ct-dev-modal-panel ct-kanban-dialog" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <header className="ct-dev-modal-header">
          <div>
            <h2><ControlIcon name="overview" size={16}/> Visão Geral — Quadro Kanban do Projeto</h2>
            <p>Gerencie o fluxo de trabalho e acompanhe o progresso das entregas.</p>
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
            ) : (
              <button
                type="button"
                className="ct-atlassian-connect-btn"
                onClick={onOpenAtlassian}
                title="Conectar com Jira & Confluence"
              >
                <span>Conectar Atlassian (Jira)</span>
              </button>
            )}
            <button type="button" className="ct-primary" onClick={() => setIsAdding(true)}>
              <ControlIcon name="plus" size={14}/>
              <span>Novo Card</span>
            </button>
            <button type="button" className="ct-close-btn" onClick={onClose} aria-label="Fechar">
              <ControlIcon name="close" size={14}/>
            </button>
          </div>
        </header>

        <div className="ct-kanban-toolbar">
          <input
            type="search"
            placeholder="Filtrar cards por título, tag ou descrição…"
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            className="ct-kanban-search"
          />
          <div className="ct-kanban-metrics">
            <span>Total: <strong>{filteredCards.length}</strong></span>
            <span>Concluídos: <strong>{filteredCards.filter(c => c.column === 'done').length}</strong></span>
          </div>
        </div>

        {isAdding && (
          <form className="ct-kanban-new-form" onSubmit={handleCreate}>
            <h3>Criar Novo Card no Kanban</h3>
            <div className="ct-kanban-form-grid">
              <label>
                Título do card *
                <input
                  type="text"
                  required
                  placeholder="Ex: Refatorar pipeline de áudio"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  autoFocus
                />
              </label>
              <label>
                Coluna inicial
                <select value={newCol} onChange={e => setNewCol(e.target.value as KanbanColumn)}>
                  {columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </label>
              <label>
                Prioridade
                <select value={newPriority} onChange={e => setNewPriority(e.target.value as PriorityLevel)}>
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </label>
              <label>
                Tags (separadas por vírgula)
                <input
                  type="text"
                  placeholder="Frontend, WebRTC, Bug"
                  value={newTags}
                  onChange={e => setNewTags(e.target.value)}
                />
              </label>
              <label className="ct-full-width">
                Descrição detalhada
                <textarea
                  rows={2}
                  placeholder="Detalhes ou critérios de aceitação…"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                />
              </label>
            </div>
            <div className="ct-kanban-form-actions">
              <button type="button" className="ct-secondary" onClick={() => setIsAdding(false)}>Cancelar</button>
              <button type="submit" className="ct-primary">Salvar Card</button>
            </div>
          </form>
        )}

        <div className="ct-kanban-board">
          {columns.map(col => {
            const colCards = filteredCards.filter(c => c.column === col.id)
            return (
              <div key={col.id} className="ct-kanban-column">
                <header className="ct-kanban-column-header">
                  <div className="ct-kanban-column-title">
                    <span className="ct-kanban-dot" style={{ backgroundColor: col.color }}/>
                    <strong>{col.title}</strong>
                  </div>
                  <span className="ct-kanban-count">{colCards.length}</span>
                </header>

                <div className="ct-kanban-cards">
                  {colCards.map(card => (
                    <article key={card.id} className="ct-kanban-card">
                      <div className="ct-kanban-card-top">
                        <span
                          className="ct-priority-badge"
                          style={{ backgroundColor: `${priorityLabels[card.priority].color}22`, color: priorityLabels[card.priority].color }}
                        >
                          {priorityLabels[card.priority].text}
                        </span>
                        {card.jiraKey && (
                          <span className="ct-jira-badge" title="Importado do Jira">
                            {card.jiraKey}
                          </span>
                        )}
                        <button
                          type="button"
                          className="ct-card-delete"
                          onClick={() => deleteKanbanCard(card.id)}
                          title="Excluir card"
                        >
                          <ControlIcon name="delete" size={11}/>
                        </button>
                      </div>

                      <h4>{card.title}</h4>
                      {card.description && <p>{card.description}</p>}

                      {card.tags.length > 0 && (
                        <div className="ct-card-tags">
                          {card.tags.map(tag => <span key={tag} className="ct-tag-pill">{tag}</span>)}
                        </div>
                      )}

                      <div className="ct-kanban-card-footer">
                        {card.assignee && (
                          <span className="ct-card-assignee" title={`Responsável: ${card.assignee}`}>
                            👤 {card.assignee}
                          </span>
                        )}
                        <div className="ct-card-move-actions">
                          {prevColMap[col.id] && (
                            <button
                              type="button"
                              onClick={() => moveKanbanCard(card.id, prevColMap[col.id]!)}
                              title="Mover para coluna anterior"
                            >
                              ←
                            </button>
                          )}
                          {nextColMap[col.id] && (
                            <button
                              type="button"
                              onClick={() => moveKanbanCard(card.id, nextColMap[col.id]!)}
                              title="Avançar para próxima coluna"
                            >
                              →
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                  {colCards.length === 0 && (
                    <div className="ct-kanban-empty">Nenhum card nesta etapa</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
