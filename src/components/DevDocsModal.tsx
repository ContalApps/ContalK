import { useState, useEffect } from 'react'
import { useDevStore } from '../store/useDevStore'
import { ControlIcon } from './ControlIcon'
import { DevProjectTabs, type DevProjectTabId } from './DevProjectTabs'

export function DevDocsModal({
  onClose,
  onOpenAtlassian,
  onSwitchTab
}: {
  onClose: () => void
  onOpenAtlassian?: () => void
  onSwitchTab?: (tab: DevProjectTabId) => void
}) {
  const {
    devDocs,
    activeDocId,
    setActiveDocId,
    createDevDoc,
    updateDevDoc,
    deleteDevDoc,
    reorderDevDocs,
    atlassian,
    syncAtlassianData,
    atlassianSyncing
  } = useDevStore()

  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('edit')
  const [copied, setCopied] = useState(false)

  // Drag and drop state
  const [draggingDocId, setDraggingDocId] = useState<string | null>(null)
  const [dragOverDocId, setDragOverDocId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('before')

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const activeDoc = devDocs.find(d => d.id === activeDocId) || devDocs[0] || null

  const filteredDocs = devDocs.filter(d => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q) || d.category.toLowerCase().includes(q)
  })

  const handleCreateNew = () => {
    const newId = createDevDoc('Novo Documento Sem Título', 'Geral')
    setActiveDocId(newId)
    setViewMode('edit')
  }

  const handleCopyMarkdown = () => {
    if (!activeDoc) return
    navigator.clipboard.writeText(activeDoc.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  const insertSnippet = (prefix: string, suffix = '') => {
    if (!activeDoc) return
    const textarea = document.getElementById('ct-doc-editor-textarea') as HTMLTextAreaElement | null
    if (!textarea) {
      updateDevDoc(activeDoc.id, { content: activeDoc.content + '\n' + prefix + suffix })
      return
    }
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const sel = activeDoc.content.substring(start, end) || 'texto'
    const newContent = activeDoc.content.substring(0, start) + prefix + sel + suffix + activeDoc.content.substring(end)
    updateDevDoc(activeDoc.id, { content: newContent })
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + sel.length)
    }, 10)
  }

  // Simple, safe Markdown viewer for preview mode
  const renderSimpleMarkdown = (text: string) => {
    const lines = text.split('\n')
    let inCodeBlock = false
    let codeBuffer: string[] = []

    return (
      <div className="ct-doc-preview-content">
        {lines.map((line, idx) => {
          if (line.startsWith('```')) {
            if (inCodeBlock) {
              inCodeBlock = false
              const code = codeBuffer.join('\n')
              codeBuffer = []
              return (
                <pre key={`code-${idx}`} className="ct-doc-code-block">
                  <code>{code}</code>
                </pre>
              )
            } else {
              inCodeBlock = true
              return null
            }
          }

          if (inCodeBlock) {
            codeBuffer.push(line)
            return null
          }

          if (line.startsWith('# ')) {
            return <h1 key={idx} className="ct-doc-h1">{line.replace(/^#\s+/, '')}</h1>
          }
          if (line.startsWith('## ')) {
            return <h2 key={idx} className="ct-doc-h2">{line.replace(/^##\s+/, '')}</h2>
          }
          if (line.startsWith('### ')) {
            return <h3 key={idx} className="ct-doc-h3">{line.replace(/^###\s+/, '')}</h3>
          }
          if (line.startsWith('> ')) {
            return <blockquote key={idx} className="ct-doc-quote">{line.replace(/^>\s+/, '')}</blockquote>
          }
          if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
            return (
              <div key={idx} className="ct-doc-task-line done">
                <input type="checkbox" checked readOnly />
                <span>{line.replace(/^- \[[xX]\]\s*/, '')}</span>
              </div>
            )
          }
          if (line.startsWith('- [ ] ')) {
            return (
              <div key={idx} className="ct-doc-task-line">
                <input type="checkbox" checked={false} readOnly />
                <span>{line.replace(/^- \[ \]\s*/, '')}</span>
              </div>
            )
          }
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <li key={idx} className="ct-doc-bullet">
                {line.replace(/^[-*]\s+/, '')}
              </li>
            )
          }
          if (line.trim() === '---' || line.trim() === '***') {
            return <hr key={idx} className="ct-doc-divider" />
          }
          if (!line.trim()) {
            return <div key={idx} className="ct-doc-empty-line" />
          }

          return <p key={idx} className="ct-doc-p">{line}</p>
        })}
      </div>
    )
  }

  return (
    <div className="ct-modal-backdrop" onClick={onClose}>
      <section className="ct-dev-modal-panel ct-docs-dialog" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <header className="ct-dev-modal-header">
          <div>
            <h2><ControlIcon name="docs" size={16}/> Documentação Técnica — Central de Documentos</h2>
            <p>Escreva, consulte e formate documentações, especificações e artigos técnicos com Markdown nativo.</p>
          </div>
          <div className="ct-dev-header-actions">
            {atlassian?.connected ? (
              <button
                type="button"
                className="ct-atlassian-sync-btn"
                onClick={() => void syncAtlassianData()}
                disabled={atlassianSyncing}
                title="Sincronizar com Confluence & Jira"
              >
                <ControlIcon name="refresh" size={13}/>
                <span>{atlassianSyncing ? 'Sincronizando Confluence…' : 'Confluence Conectado ✓'}</span>
              </button>
            ) : onOpenAtlassian ? (
              <button
                type="button"
                className="ct-atlassian-connect-btn"
                onClick={onOpenAtlassian}
                title="Conectar com Confluence & Jira"
              >
                <span>Conectar Atlassian (Confluence)</span>
              </button>
            ) : null}
            <button type="button" className="ct-close-btn" onClick={onClose} aria-label="Fechar">
              <ControlIcon name="close" size={14}/>
            </button>
          </div>
        </header>

        {/* Tab navigation for Projects Hub */}
        <DevProjectTabs activeTab="docs" onSwitchTab={onSwitchTab} />

        {/* Two-column Container */}
        <div className="ct-docs-body-layout">
          {/* Left Column: Doc List & Search */}
          <aside className="ct-docs-sidebar">
            <div className="ct-docs-sidebar-header">
              <button type="button" className="ct-primary ct-new-doc-btn" onClick={handleCreateNew}>
                <ControlIcon name="plus" size={13}/>
                <span>Novo Documento</span>
              </button>
            </div>

            <div className="ct-docs-search-wrap">
              <input
                type="search"
                placeholder="Pesquisar nos documentos..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                aria-label="Pesquisar documentos"
              />
            </div>

            <div className="ct-docs-nav-list">
              {filteredDocs.length === 0 ? (
                <div className="ct-docs-empty-nav">
                  <p>Nenhum documento encontrado.</p>
                </div>
              ) : (
                filteredDocs.map(doc => {
                  const isActive = activeDoc?.id === doc.id
                  const isDragging = draggingDocId === doc.id
                  const isTargetBefore = dragOverDocId === doc.id && dropPosition === 'before'
                  const isTargetAfter = dragOverDocId === doc.id && dropPosition === 'after'

                  return (
                    <div
                      key={doc.id}
                      className={`ct-docs-nav-item ${isActive ? 'is-active' : ''} ${isDragging ? 'is-dragging' : ''} ${isTargetBefore ? 'is-drop-target-before' : ''} ${isTargetAfter ? 'is-drop-target-after' : ''}`}
                      onClick={() => setActiveDocId(doc.id)}
                      draggable
                      onDragStart={e => {
                        e.dataTransfer.setData('text/plain', doc.id)
                        e.dataTransfer.effectAllowed = 'move'
                        setDraggingDocId(doc.id)
                      }}
                      onDragEnd={() => {
                        setDraggingDocId(null)
                        setDragOverDocId(null)
                      }}
                      onDragOver={e => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        const rect = e.currentTarget.getBoundingClientRect()
                        const isBottom = e.clientY > rect.top + rect.height / 2
                        const nextPos = isBottom ? 'after' : 'before'
                        if (dragOverDocId !== doc.id || dropPosition !== nextPos) {
                          setDragOverDocId(doc.id)
                          setDropPosition(nextPos)
                        }
                      }}
                      onDragLeave={e => {
                        if (e.currentTarget.contains(e.relatedTarget as Node)) return
                        if (dragOverDocId === doc.id) setDragOverDocId(null)
                      }}
                      onDrop={e => {
                        e.preventDefault()
                        const sourceId = e.dataTransfer.getData('text/plain') || draggingDocId
                        if (sourceId && sourceId !== doc.id) {
                          reorderDevDocs(sourceId, doc.id, dropPosition)
                        }
                        setDraggingDocId(null)
                        setDragOverDocId(null)
                      }}
                    >
                      <span className="ct-doc-drag-handle" title="Arraste para reorganizar documentos">
                        <ControlIcon name="grip" size={12}/>
                      </span>
                      <div className="ct-docs-nav-text">
                        <div className="ct-docs-nav-title">{doc.title || 'Sem Título'}</div>
                        <div className="ct-docs-nav-meta">
                          <span className="ct-docs-category-pill">{doc.category || 'Geral'}</span>
                          {doc.confluenceId && (
                            <span className="ct-docs-confluence-pill" title="Sincronizado via Confluence">
                              Confluence
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="ct-docs-item-del-btn"
                        onClick={e => {
                          e.stopPropagation()
                          deleteDevDoc(doc.id)
                        }}
                        title="Excluir documento"
                        aria-label={`Excluir ${doc.title}`}
                      >
                        <ControlIcon name="close" size={12}/>
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </aside>

          {/* Right Column: Editor / Viewer */}
          <main className="ct-docs-main-editor">
            {activeDoc ? (
              <div className="ct-doc-editor-container">
                {/* Top Meta Bar */}
                <div className="ct-doc-top-bar">
                  <div className="ct-doc-title-category-group">
                    <input
                      type="text"
                      className="ct-doc-title-input"
                      value={activeDoc.title}
                      onChange={e => updateDevDoc(activeDoc.id, { title: e.target.value })}
                      placeholder="Título do documento..."
                    />
                    <input
                      type="text"
                      className="ct-doc-category-input"
                      value={activeDoc.category}
                      onChange={e => updateDevDoc(activeDoc.id, { category: e.target.value })}
                      placeholder="Categoria (ex: Arquitetura, API)"
                      title="Categoria"
                    />
                  </div>

                  <div className="ct-doc-mode-toolbar">
                    <div className="ct-mode-toggle-group">
                      <button
                        type="button"
                        className={viewMode === 'edit' ? 'active' : ''}
                        onClick={() => setViewMode('edit')}
                        title="Modo de Edição"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={viewMode === 'split' ? 'active' : ''}
                        onClick={() => setViewMode('split')}
                        title="Modo Dividido (Edição + Prévia)"
                      >
                        Dividido
                      </button>
                      <button
                        type="button"
                        className={viewMode === 'preview' ? 'active' : ''}
                        onClick={() => setViewMode('preview')}
                        title="Visualizar Markdown formatado"
                      >
                        Visualizar
                      </button>
                    </div>

                    <button
                      type="button"
                      className="ct-doc-copy-btn"
                      onClick={handleCopyMarkdown}
                      title="Copiar Markdown para a área de transferência"
                    >
                      <ControlIcon name={copied ? 'check' : 'clipboard'} size={13}/>
                      <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>

                {/* Markdown Formatting Quick Bar */}
                {(viewMode === 'edit' || viewMode === 'split') && (
                  <div className="ct-doc-format-toolbar">
                    <button type="button" onClick={() => insertSnippet('# ')} title="Título 1">H1</button>
                    <button type="button" onClick={() => insertSnippet('## ')} title="Título 2">H2</button>
                    <button type="button" onClick={() => insertSnippet('**', '**')} title="Negrito">
                      <strong>B</strong>
                    </button>
                    <button type="button" onClick={() => insertSnippet('*', '*')} title="Itálico">
                      <em>I</em>
                    </button>
                    <button type="button" onClick={() => insertSnippet('`', '`')} title="Código inline">
                      <code>&lt;/&gt;</code>
                    </button>
                    <button type="button" onClick={() => insertSnippet('```\n', '\n```')} title="Bloco de código">
                      Bloco
                    </button>
                    <button type="button" onClick={() => insertSnippet('- ')} title="Lista com marcadores">
                      • Lista
                    </button>
                    <button type="button" onClick={() => insertSnippet('- [ ] ')} title="Checklist">
                      ☑ Check
                    </button>
                    <button type="button" onClick={() => insertSnippet('> ')} title="Citação">
                      ” Citação
                    </button>
                    <button type="button" onClick={() => insertSnippet('[', '](https://)')} title="Link">
                      Link
                    </button>
                    <span className="ct-doc-autosave-indicator">Salvo automaticamente</span>
                  </div>
                )}

                {/* Editing Area */}
                <div className={`ct-doc-panes-wrapper ct-mode-${viewMode}`}>
                  {(viewMode === 'edit' || viewMode === 'split') && (
                    <div className="ct-doc-editor-pane">
                      <textarea
                        id="ct-doc-editor-textarea"
                        className="ct-doc-textarea"
                        value={activeDoc.content}
                        onChange={e => updateDevDoc(activeDoc.id, { content: e.target.value })}
                        placeholder="Digite sua documentação em Markdown aqui..."
                        spellCheck={false}
                      />
                    </div>
                  )}

                  {(viewMode === 'preview' || viewMode === 'split') && (
                    <div className="ct-doc-preview-pane">
                      {renderSimpleMarkdown(activeDoc.content)}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="ct-docs-no-selection">
                <p>Nenhum documento selecionado.</p>
                <button type="button" className="ct-primary" onClick={handleCreateNew}>
                  Criar primeiro documento
                </button>
              </div>
            )}
          </main>
        </div>
      </section>
    </div>
  )
}
