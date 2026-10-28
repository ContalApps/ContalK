import { useState, useRef, useEffect, useCallback } from 'react'
import { ControlIcon } from './ControlIcon'

export type DevEditorTab = {
  id: string
  name: string
  path: string
  active?: boolean
  isDirty?: boolean
}

export type RemoteCursor = {
  id: string
  name: string
  color: string
  line: number
  ch: number
}

interface DevEditorProps {
  tabs: DevEditorTab[]
  activeTabId: string
  onSelectTab: (id: string) => void
  onCloseTab: (id: string) => void
  branch: string
  fileName?: string
  filePath: string
  code: string
  onChangeCode?: (newCode: string) => void
  onSave?: () => Promise<void> | void
  cursors?: RemoteCursor[]
  isSaving?: boolean
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  switch (ext) {
    case 'tsx': return 'TypeScript React'
    case 'ts': return 'TypeScript'
    case 'jsx': return 'JavaScript React'
    case 'js':
    case 'mjs':
    case 'cjs': return 'JavaScript'
    case 'json': return 'JSON'
    case 'css': return 'CSS'
    case 'html': return 'HTML'
    case 'md': return 'Markdown'
    case 'rs': return 'Rust'
    case 'py': return 'Python'
    case 'go': return 'Go'
    case 'cpp':
    case 'c':
    case 'h': return 'C/C++'
    case 'yml':
    case 'yaml': return 'YAML'
    default: return 'TypeScript'
  }
}

export function DevCodeEditor({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  branch,
  filePath,
  code,
  onChangeCode,
  onSave,
  cursors = [],
  isSaving = false
}: DevEditorProps) {
  const [copied, setCopied] = useState(false)
  const [saveToast, setSaveToast] = useState(false)
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)

  const lines = code.split('\n')
  const lineCount = Math.max(1, lines.length)
  const language = detectLanguage(filePath)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  const handleSave = useCallback(async () => {
    if (onSave) {
      await onSave()
      setSaveToast(true)
      setTimeout(() => setSaveToast(false), 2000)
    }
  }, [onSave])

  const updateCursorPosition = () => {
    const el = textareaRef.current
    if (!el) return
    const selStart = el.selectionStart || 0
    const textBefore = code.slice(0, selStart)
    const textLines = textBefore.split('\n')
    const currentLine = textLines.length
    const currentCol = (textLines[textLines.length - 1]?.length || 0) + 1
    setCursorPos({ line: currentLine, col: currentCol })
  }

  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      void handleSave()
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      const el = textareaRef.current
      if (!el || !onChangeCode) return
      const start = el.selectionStart
      const end = el.selectionEnd
      const newCode = code.substring(0, start) + '  ' + code.substring(end)
      onChangeCode(newCode)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2
        updateCursorPosition()
      })
    }
  }

  useEffect(() => {
    handleScroll()
  }, [code])

  return (
    <div className="ct-dev-editor">
      {/* Abas superiores do editor */}
      <div className="ct-dev-editor-tabs" role="tablist">
        {tabs.map(tab => (
          <div
            key={tab.id}
            role="tab"
            aria-selected={tab.id === activeTabId}
            className={`ct-dev-editor-tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
          >
            <ControlIcon name="git-code" size={13} />
            <span className="ct-dev-tab-name">{tab.name}</span>
            {tab.isDirty && <span className="ct-dev-tab-dirty" title="Não salvo">•</span>}
            <button
              type="button"
              className="ct-dev-tab-close"
              aria-label={`Fechar ${tab.name}`}
              onClick={e => {
                e.stopPropagation()
                onCloseTab(tab.id)
              }}
            >
              <ControlIcon name="close" size={11} />
            </button>
          </div>
        ))}
      </div>

      {/* Breadcrumb e Status da Branch */}
      <div className="ct-dev-editor-subbar">
        <div className="ct-dev-breadcrumb">
          {filePath.split('/').map((seg, i, arr) => (
            <span key={i} className="ct-dev-crumb">
              {seg}
              {i < arr.length - 1 && <span className="ct-dev-sep">/</span>}
            </span>
          ))}
        </div>
        <div className="ct-dev-editor-actions">
          <div className="ct-dev-branch-tag" title="Branch ativa">
            <ControlIcon name="git-branch" size={12} />
            <span>{branch}</span>
          </div>
          <button
            type="button"
            className="ct-dev-editor-sync"
            title={saveToast ? 'Arquivo salvo!' : isSaving ? 'Salvando…' : 'Salvar arquivo (Ctrl+S)'}
            aria-label="Salvar arquivo"
            onClick={() => void handleSave()}
          >
            <ControlIcon name={saveToast ? 'check' : isSaving ? 'refresh' : 'git-commit'} size={13} />
          </button>
          <button
            type="button"
            className="ct-dev-editor-sync"
            title="Copiar código"
            aria-label="Copiar código"
            onClick={copy}
          >
            <ControlIcon name={copied ? 'check' : 'copy'} size={13} />
          </button>
        </div>
      </div>

      {/* Área de Linhas e Código com Cursores Remotos */}
      <div className="ct-dev-editor-body">
        <div className="ct-dev-gutter" ref={gutterRef} aria-hidden="true">
          {Array.from({ length: lineCount }).map((_, i) => {
            const lineNum = i + 1
            const isCurrent = lineNum === cursorPos.line
            return (
              <div
                key={i}
                className={`ct-dev-line-num ${isCurrent ? 'active' : ''}`}
              >
                {lineNum}
              </div>
            )
          })}
        </div>

        <div className="ct-dev-code-container">
          {/* Overlay de cursores remotos colaborativos */}
          <div className="ct-dev-cursors-overlay" aria-hidden="true">
            {cursors.map(cursor => {
              if (cursor.line > lineCount) return null
              const topPx = (cursor.line - 1) * 20 + 12
              const leftPx = Math.min(cursor.ch * 7.4 + 16, 750)
              return (
                <div
                  key={cursor.id}
                  className="ct-dev-remote-cursor-anchor"
                  style={{ top: `${topPx}px`, left: `${leftPx}px` }}
                >
                  <span
                    className="ct-dev-remote-cursor-bar"
                    style={{ backgroundColor: cursor.color }}
                  />
                  <span
                    className="ct-dev-cursor-tag"
                    style={{ backgroundColor: cursor.color }}
                  >
                    {cursor.name}
                  </span>
                </div>
              )
            })}
          </div>

          <textarea
            ref={textareaRef}
            className="ct-dev-textarea"
            value={code}
            onChange={e => {
              onChangeCode?.(e.target.value)
              updateCursorPosition()
            }}
            onKeyDown={handleKeyDown}
            onKeyUp={updateCursorPosition}
            onClick={updateCursorPosition}
            onSelect={updateCursorPosition}
            onScroll={handleScroll}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
          />
        </div>

        {/* Minimap representativo lateral */}
        <div className="ct-dev-minimap" aria-hidden="true">
          <div
            className="ct-dev-minimap-slider"
            style={{
              top: `${Math.min(200, ((cursorPos.line - 1) / lineCount) * 160 + 8)}px`
            }}
          />
          {lines.slice(0, 45).map((l, idx) => (
            <div
              key={idx}
              className={`ct-dev-minimap-line ${idx + 1 === cursorPos.line ? 'active' : ''}`}
              style={{ width: `${Math.min(100, Math.max(12, l.trim().length * 2.1))}%` }}
            />
          ))}
        </div>
      </div>

      {/* Barra de status inferior do editor */}
      <div className="ct-dev-editor-statusbar">
        <div className="ct-dev-status-group">
          <span className="ct-dev-status-item">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span className="ct-dev-status-item">
            {lineCount} linhas
          </span>
        </div>
        <div className="ct-dev-status-group">
          <span className="ct-dev-status-item">UTF-8</span>
          <span className="ct-dev-status-item">{language}</span>
          <span className="ct-dev-status-item">Espaços: 2</span>
          <span className="ct-dev-status-item" style={{ color: saveToast ? '#4ade80' : isSaving ? '#facc15' : 'inherit' }}>
            {saveToast ? 'Salvo ✓' : isSaving ? 'Gravando…' : 'Pronto'}
          </span>
        </div>
      </div>
    </div>
  )
}
