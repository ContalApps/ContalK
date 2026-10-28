import { useState } from 'react'
import { ControlIcon } from './ControlIcon'

export interface ChangedFile {
  path: string
  status: 'modified' | 'added' | 'deleted'
  additions: number
  deletions: number
  diff?: string
}

interface ReviewPanelProps {
  onClose: () => void
  branch?: string
  files?: ChangedFile[]
  onCommit?: (message: string) => Promise<void> | void
}

const DEFAULT_CHANGED_FILES: ChangedFile[] = [
  {
    path: 'src/components/ChatComposer.tsx',
    status: 'modified',
    additions: 42,
    deletions: 12,
    diff: `@@ -120,8 +120,12 @@
-  const [oldLayout, setOldLayout] = useState(false)
+  const [composerElevation, setComposerElevation] = useState('prominent')
+  // Alinhamento ao sistema de elevação do Codex
+  const codexTokens = useCodexTokens()
@@ -145,4 +149,8 @@
+  // Renderização em card flutuante com toolbar interna
+  return <div className="ct-composer-card">`
  },
  {
    path: 'src/components/DevCodeEditor.tsx',
    status: 'modified',
    additions: 68,
    deletions: 15,
    diff: `@@ -50,6 +50,14 @@
+  // Cursores reais transmitidos via WebSocket
+  const liveCursors = useDevCollaborationStore(s => s.remoteCursors)
+  // Compensação precisa de rolagem vertical e horizontal`
  },
  {
    path: 'src/components/CommandMenuModal.tsx',
    status: 'added',
    additions: 185,
    deletions: 0,
    diff: `@@ -0,0 +1,24 @@
+export function CommandMenuModal({ onClose }: Props) {
+  // Paleta universal de comandos estilo Codex (Ctrl+K)
+  return <div className="ct-command-palette-dialog">`
  }
]

export function ReviewPanel({
  onClose,
  branch = 'dev/caliari',
  files = DEFAULT_CHANGED_FILES,
  onCommit
}: ReviewPanelProps) {
  const [selectedPath, setSelectedPath] = useState<string>(files[0]?.path || '')
  const [commitMessage, setCommitMessage] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)
  const [commitSuccess, setCommitSuccess] = useState(false)

  const activeFile = files.find(f => f.path === selectedPath) || files[0]

  const totalAdditions = files.reduce((acc, f) => acc + f.additions, 0)
  const totalDeletions = files.reduce((acc, f) => acc + f.deletions, 0)

  const handleCommit = async () => {
    if (!commitMessage.trim()) return
    setIsCommitting(true)
    try {
      if (onCommit) {
        await onCommit(commitMessage)
      }
      setCommitSuccess(true)
      setCommitMessage('')
      setTimeout(() => setCommitSuccess(false), 2500)
    } finally {
      setIsCommitting(false)
    }
  }

  return (
    <aside className="ct-review-panel" aria-label="Painel de Alterações do Projeto">
      <header className="ct-review-header">
        <div className="ct-review-title">
          <ControlIcon name="git-pr" size={15} />
          <h2>Painel de Alterações (Review)</h2>
          <span className="ct-review-branch-badge">{branch}</span>
        </div>
        <div className="ct-review-header-actions">
          <div className="ct-review-stat-summary">
            <span className="ct-stat-add">+{totalAdditions}</span>
            <span className="ct-stat-del">-{totalDeletions}</span>
          </div>
          <button
            type="button"
            className="ct-review-close-btn"
            aria-label="Fechar painel de alterações"
            title="Fechar (Ctrl+Alt+R)"
            onClick={onClose}
          >
            <ControlIcon name="close" size={13} />
          </button>
        </div>
      </header>

      <div className="ct-review-body">
        {/* Lista de Arquivos Alterados */}
        <div className="ct-review-file-list">
          <div className="ct-review-section-title">
            <span>Arquivos modificados ({files.length})</span>
          </div>
          {files.map(file => (
            <button
              key={file.path}
              type="button"
              className={`ct-review-file-item ${file.path === selectedPath ? 'active' : ''}`}
              onClick={() => setSelectedPath(file.path)}
            >
              <span className={`ct-file-status-tag ${file.status}`}>
                {file.status === 'modified' ? 'M' : file.status === 'added' ? 'A' : 'D'}
              </span>
              <span className="ct-review-file-name" title={file.path}>
                {file.path.split('/').pop()}
              </span>
              <span className="ct-review-file-diff-counts">
                {file.additions > 0 && <span className="ct-stat-add">+{file.additions}</span>}
                {file.deletions > 0 && <span className="ct-stat-del">-{file.deletions}</span>}
              </span>
            </button>
          ))}
        </div>

        {/* Visualizador de Diff */}
        <div className="ct-review-diff-viewer">
          {activeFile ? (
            <>
              <div className="ct-diff-header">
                <span className="ct-diff-path">{activeFile.path}</span>
                <span className="ct-diff-status-label">{activeFile.status.toUpperCase()}</span>
              </div>
              <div className="ct-diff-content">
                {(activeFile.diff || '// Nenhuma alteração textual disponível').split('\n').map((line, idx) => {
                  const isAdd = line.startsWith('+') && !line.startsWith('+++')
                  const isDel = line.startsWith('-') && !line.startsWith('---')
                  const isHunk = line.startsWith('@@')
                  return (
                    <div
                      key={idx}
                      className={`ct-diff-line ${isAdd ? 'is-add' : isDel ? 'is-del' : isHunk ? 'is-hunk' : ''}`}
                    >
                      <span className="ct-diff-gutter">{idx + 1}</span>
                      <span className="ct-diff-text">{line}</span>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="ct-review-empty">Nenhum arquivo selecionado.</div>
          )}
        </div>
      </div>

      {/* Caixa de Commit */}
      <footer className="ct-review-footer">
        <div className="ct-commit-input-wrapper">
          <input
            type="text"
            className="ct-commit-input"
            placeholder="Mensagem do commit (ex: feat: novo layout do chat)..."
            value={commitMessage}
            onChange={e => setCommitMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                void handleCommit()
              }
            }}
          />
          <button
            type="button"
            className="ct-commit-btn"
            disabled={!commitMessage.trim() || isCommitting}
            onClick={() => void handleCommit()}
          >
            <ControlIcon name={commitSuccess ? 'check' : 'git-commit'} size={13} />
            <span>{isCommitting ? 'Commitando…' : commitSuccess ? 'Salvo!' : 'Commit na branch'}</span>
          </button>
        </div>
      </footer>
    </aside>
  )
}
