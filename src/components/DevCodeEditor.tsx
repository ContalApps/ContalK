import { useState } from 'react'
import { ControlIcon } from './ControlIcon'

export type DevEditorTab = {
  id: string
  name: string
  path: string
  active?: boolean
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
  fileName: string
  filePath: string
  code: string
  cursors?: RemoteCursor[]
}

export function DevCodeEditor({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  branch,
  filePath,
  code,
  cursors = []
}: DevEditorProps) {
  const [copied, setCopied] = useState(false)
  const lines = code.split('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

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
            title="Sincronizar arquivo"
            aria-label="Sincronizar arquivo"
            onClick={copy}
          >
            <ControlIcon name={copied ? 'check' : 'refresh'} size={13} />
          </button>
        </div>
      </div>

      {/* Área de Linhas e Código com Cursores Remotos */}
      <div className="ct-dev-editor-body">
        <div className="ct-dev-gutter" aria-hidden="true">
          {lines.map((_, i) => (
            <div key={i} className="ct-dev-line-num">
              {i + 1}
            </div>
          ))}
        </div>
        <div className="ct-dev-code-container">
          <pre className="ct-dev-code-pre">
            <code>
              {lines.map((line, lineIdx) => {
                const lineNum = lineIdx + 1
                const activeCursors = cursors.filter(c => c.line === lineNum)
                return (
                  <div key={lineIdx} className="ct-dev-code-line">
                    <span>{line || ' '}</span>
                    {activeCursors.map(cursor => (
                      <span
                        key={cursor.id}
                        className="ct-dev-remote-cursor"
                        style={{
                          left: `${Math.min(cursor.ch * 7.8, 600)}px`,
                          borderColor: cursor.color
                        }}
                      >
                        <span
                          className="ct-dev-cursor-tag"
                          style={{ backgroundColor: cursor.color }}
                        >
                          {cursor.name}
                        </span>
                      </span>
                    ))}
                  </div>
                )
              })}
            </code>
          </pre>
        </div>

        {/* Minimap representativo lateral */}
        <div className="ct-dev-minimap" aria-hidden="true">
          <div className="ct-dev-minimap-slider" />
          {lines.slice(0, 35).map((l, idx) => (
            <div
              key={idx}
              className="ct-dev-minimap-line"
              style={{ width: `${Math.min(100, Math.max(15, l.trim().length * 2.2))}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
