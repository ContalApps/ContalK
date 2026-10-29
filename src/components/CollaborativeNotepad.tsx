import { useState, useRef, useEffect, useCallback } from 'react'
import { ControlIcon } from './ControlIcon'

export type NotepadTab = {
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

interface CollaborativeNotepadProps {
  tabs: NotepadTab[]
  activeTabId: string
  onSelectTab: (id: string) => void
  onCloseTab: (id: string) => void
  onNewTab?: () => void
  fileName?: string
  content: string
  onChangeContent?: (newContent: string) => void
  onSave?: () => Promise<void> | void
  cursors?: RemoteCursor[]
  onCursorChange?: (pos: { line: number; ch: number }) => void
  isSaving?: boolean
  onCloseNotepad?: () => void
  onCloseEditor?: () => void
}

export function CollaborativeNotepad({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  fileName = 'Bloco de Notas',
  content,
  onChangeContent,
  onSave,
  cursors = [],
  onCursorChange,
  isSaving = false,
  onCloseNotepad
}: CollaborativeNotepadProps) {
  const [copied, setCopied] = useState(false)
  const [saveToast, setSaveToast] = useState(false)
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })
  const [wordWrap, setWordWrap] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)

  const lines = content.split('\n')
  const lineCount = Math.max(1, lines.length)
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0
  const charCount = content.length

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName.replace(/\.[^/.]+$/, '') || 'notas'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSave = useCallback(async () => {
    if (onSave) {
      await onSave()
      setSaveToast(true)
      setTimeout(() => setSaveToast(false), 2000)
    }
  }, [onSave])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      void handleSave()
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const next = content.substring(0, start) + '  ' + content.substring(end)
      onChangeContent?.(next)
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      })
    }
  }

  const handleCursorActivity = () => {
    const ta = textareaRef.current
    if (!ta) return
    const selStart = ta.selectionStart
    const textBefore = ta.value.substring(0, selStart)
    const lineArr = textBefore.split('\n')
    const line = lineArr.length
    const col = lineArr[lineArr.length - 1].length + 1
    setCursorPos({ line, col })
    onCursorChange?.({ line, ch: col })
  }

  const handleScroll = () => {
    const ta = textareaRef.current
    if (!ta || !gutterRef.current) return
    gutterRef.current.scrollTop = ta.scrollTop
  }

  useEffect(() => {
    const ta = textareaRef.current
    if (ta) ta.focus()
  }, [activeTabId])

  return (
    <div className="ct-dev-editor ct-collaborative-notepad flex flex-col flex-1 h-full min-h-0 bg-[#121214] border-l border-neutral-800 relative select-none">
      {/* Header com Abas de Notas e Controles de Colaboração */}
      <div className="flex items-center justify-between px-2.5 h-10 bg-[#161618] border-b border-neutral-800 flex-shrink-0 gap-2">
        {/* Abas de Documentos / Notas */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 py-1">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`group flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition select-none ${
                  isActive
                    ? 'bg-[#222226] text-white shadow-sm border border-neutral-700/60'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                }`}
                title={tab.name}
              >
                <ControlIcon name="docs" size={12} />
                <span className="truncate max-w-[130px]">{tab.name}</span>
                {tab.isDirty && (
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" title="Alterações não salvas" />
                )}
                {tabs.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onCloseTab(tab.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 rounded transition"
                    title="Fechar aba"
                  >
                    <ControlIcon name="close" size={10} />
                  </button>
                )}
              </div>
            )
          })}

          {onNewTab && (
            <button
              type="button"
              onClick={onNewTab}
              className="w-6 h-6 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition flex-shrink-0"
              title="Nova página de anotações"
            >
              <ControlIcon name="plus" size={12} />
            </button>
          )}
        </div>

        {/* Indicador de Colaboradores Conectados e Ações */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {cursors.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-600/40 text-[11px] text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{cursors.length} editando ao vivo</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setWordWrap(!wordWrap)}
            className={`w-7 h-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-white transition ${
              wordWrap ? 'bg-neutral-800 text-sky-400' : 'hover:bg-neutral-800'
            }`}
            title={wordWrap ? 'Quebra de linha ativada' : 'Quebra de linha desativada'}
          >
            <ControlIcon name="chat" size={12} />
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            title={copied ? 'Copiado!' : 'Copiar texto completo'}
          >
            <ControlIcon name={copied ? 'check' : 'copy'} size={12} />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            title="Exportar anotação (.md)"
          >
            <ControlIcon name="folder" size={12} />
          </button>

          {onSave && (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition"
              title="Salvar notas (Ctrl+S)"
            >
              <ControlIcon name="check" size={11} />
              <span>{isSaving ? 'Salvando…' : 'Salvar'}</span>
            </button>
          )}

          {onCloseNotepad && (
            <button
              type="button"
              onClick={onCloseNotepad}
              className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition ml-1"
              title="Fechar Bloco de Notas"
            >
              <ControlIcon name="close" size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Área Central de Edição com Gutter de Linhas e Cursores */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden bg-[#101012]">
        {/* Coluna de Números de Linha */}
        <div
          ref={gutterRef}
          className="w-11 py-3 bg-[#131316] text-right pr-2.5 text-neutral-600 font-mono text-xs select-none border-r border-neutral-800/80 overflow-hidden flex-shrink-0 leading-5"
          aria-hidden="true"
        >
          {Array.from({ length: lineCount }).map((_, i) => (
            <div key={i} className={i + 1 === cursorPos.line ? 'text-neutral-400 font-semibold' : ''}>
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea e Camada de Cursores Remotos */}
        <div className="flex-1 relative h-full min-w-0">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onChangeContent?.(e.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={handleCursorActivity}
            onClick={handleCursorActivity}
            onScroll={handleScroll}
            wrap={wordWrap ? 'soft' : 'off'}
            spellCheck={false}
            placeholder="Digite aqui as anotações do time, pautas da reunião ou rascunhos compartilhados em tempo real..."
            className="w-full h-full bg-transparent text-neutral-200 font-mono text-xs leading-5 p-3 outline-none resize-none selection:bg-sky-500/30 overflow-auto"
          />

          {/* Bandeiras de Cursores Remotos em Tempo Real */}
          {cursors.map((c) => (
            <div
              key={c.id}
              className="pointer-events-none absolute z-30 flex items-center gap-1 transition-all duration-75"
              style={{
                top: `${(c.line - 1) * 20 + 12}px`,
                left: `${c.ch * 7.2 + 12}px`
              }}
            >
              <span
                className="w-0.5 h-4 rounded-full animate-pulse shadow-sm"
                style={{ backgroundColor: c.color }}
              />
              <span
                className="text-[9px] font-bold text-white px-1 py-0.2 rounded shadow -mt-4 whitespace-nowrap"
                style={{ backgroundColor: c.color }}
              >
                {c.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Barra de Status do Rodapé */}
      <div className="flex items-center justify-between px-3 h-6 bg-[#141416] border-t border-neutral-800/80 text-[10px] text-neutral-400 font-medium select-none flex-shrink-0">
        <div className="flex items-center gap-3">
          <span>Linha {cursorPos.line}, Coluna {cursorPos.col}</span>
          <span>{wordCount} palavras</span>
          <span>{charCount} caracteres</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Sincronização em tempo real ativa
          </span>
          {saveToast && <span className="text-sky-300 font-semibold animate-fade-in">✓ Salvo</span>}
        </div>
      </div>
    </div>
  )
}
