import { useState, useEffect, useRef } from 'react'
import { ControlIcon, type ControlIconName } from './ControlIcon'
import { useAppStore } from '../store/useAppStore'
import { usePreferencesStore } from '../store/usePreferencesStore'

export interface CommandItem {
  id: string
  title: string
  category: 'Ações Rápidas' | 'Canais' | 'Desenvolvimento e IA' | 'Ajuda'
  shortcut?: string
  icon?: ControlIconName
  action: () => void
}

interface CommandMenuModalProps {
  onClose: () => void
  onToggleDevEditor?: () => void
  onToggleReviewPanel?: () => void
  onOpenSettings?: (tab?: 'ai' | 'appearance') => void
  onOpenHelp?: () => void
  onOpenFolder?: () => void
  onOpenDevModal?: (modalId: string) => void
}

export function CommandMenuModal({
  onClose,
  onToggleDevEditor,
  onToggleReviewPanel,
  onOpenSettings,
  onOpenHelp,
  onOpenFolder,
  onOpenDevModal
}: CommandMenuModalProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const { servers, activeServerId, setActiveChannel } = useAppStore()
  const preferences = usePreferencesStore()
  const currentServer = servers.find(s => s.id === activeServerId) || servers[0]

  // Lista consolidada de comandos baseada na árvore oficial do Codex (pt-BR)
  const allCommands: CommandItem[] = [
    // Ações Rápidas
    {
      id: 'cmd-toggle-sidebar',
      title: 'Alternar barra lateral',
      category: 'Ações Rápidas',
      shortcut: 'Ctrl+B',
      icon: 'sidebar',
      action: () => {
        preferences.update({ sidebarHidden: !preferences.sidebarHidden })
        onClose()
      }
    },
    {
      id: 'cmd-toggle-terminal',
      title: 'Alternar terminal integrado',
      category: 'Ações Rápidas',
      shortcut: 'Ctrl+J',
      icon: 'terminal',
      action: () => {
        preferences.update({ bottomPanelOpen: !preferences.bottomPanelOpen })
        onClose()
      }
    },
    {
      id: 'cmd-toggle-right-panel',
      title: 'Alternar painel de membros/chamada',
      category: 'Ações Rápidas',
      shortcut: 'Ctrl+Alt+B',
      icon: 'friends',
      action: () => {
        preferences.update({ membersCollapsed: !preferences.membersCollapsed })
        onClose()
      }
    },
    {
      id: 'cmd-open-folder',
      title: 'Abrir pasta local do projeto…',
      category: 'Ações Rápidas',
      shortcut: 'Ctrl+O',
      icon: 'folder',
      action: () => {
        onOpenFolder?.()
        onClose()
      }
    },
    {
      id: 'cmd-settings',
      title: 'Configurações…',
      category: 'Ações Rápidas',
      shortcut: 'Ctrl+,',
      icon: 'settings',
      action: () => {
        onOpenSettings?.()
        onClose()
      }
    },

    // Desenvolvimento e IA
    {
      id: 'cmd-toggle-editor',
      title: 'Alternar editor de código em abas',
      category: 'Desenvolvimento e IA',
      shortcut: 'Ctrl+Alt+E',
      icon: 'git-code',
      action: () => {
        onToggleDevEditor?.()
        onClose()
      }
    },
    {
      id: 'cmd-toggle-review',
      title: 'Exibir/ocultar painel de alterações (Review)',
      category: 'Desenvolvimento e IA',
      shortcut: 'Ctrl+Alt+R',
      icon: 'git-pr',
      action: () => {
        onToggleReviewPanel?.()
        onClose()
      }
    },
    {
      id: 'cmd-settings-ai',
      title: 'Configurar modelos e chaves de IA…',
      category: 'Desenvolvimento e IA',
      icon: 'ai',
      action: () => {
        onOpenSettings?.('ai')
        onClose()
      }
    },
    {
      id: 'cmd-browser',
      title: 'Abrir Navegador Web Interno…',
      category: 'Desenvolvimento e IA',
      shortcut: 'Ctrl+Shift+B',
      icon: 'globe',
      action: () => {
        onOpenDevModal?.('browser')
        onClose()
      }
    },
    {
      id: 'cmd-mcp',
      title: 'Servidores MCP (Model Context Protocol)…',
      category: 'Desenvolvimento e IA',
      icon: 'ai',
      action: () => {
        onOpenDevModal?.('mcp')
        onClose()
      }
    },
    {
      id: 'cmd-kanban',
      title: 'Guia de Projetos (Kanban)…',
      category: 'Desenvolvimento e IA',
      icon: 'overview',
      action: () => {
        onOpenDevModal?.('overview')
        onClose()
      }
    },
    {
      id: 'cmd-tasks',
      title: 'Lista de Tarefas do Desenvolvedor…',
      category: 'Desenvolvimento e IA',
      icon: 'tasks',
      action: () => {
        onOpenDevModal?.('tasks')
        onClose()
      }
    },
    {
      id: 'cmd-docs',
      title: 'Central de Documentação…',
      category: 'Desenvolvimento e IA',
      icon: 'docs',
      action: () => {
        onOpenDevModal?.('docs')
        onClose()
      }
    },

    // Ajuda
    {
      id: 'cmd-shortcuts',
      title: 'Mostrar atalhos de teclado e ajuda',
      category: 'Ajuda',
      shortcut: 'F1',
      icon: 'help',
      action: () => {
        onOpenHelp?.()
        onClose()
      }
    }
  ]

  // Adiciona os canais existentes como destinos de navegação instantânea
  if (currentServer?.channels) {
    for (const ch of currentServer.channels) {
      allCommands.push({
        id: `channel-${ch.id}`,
        title: `Ir para #${ch.name} (${ch.type === 'voice' ? 'Canal de voz' : 'Canal de texto'})`,
        category: 'Canais',
        icon: ch.type === 'voice' ? 'mic' : 'hash',
        action: () => {
          setActiveChannel(ch.id)
          onClose()
        }
      })
    }
  }

  // Filtragem dos comandos pela query do usuário
  const filtered = allCommands.filter(c =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase()) ||
    (c.shortcut && c.shortcut.toLowerCase().includes(query.toLowerCase()))
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (filtered.length ? (prev + 1) % filtered.length : 0))
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (filtered.length ? (prev - 1 + filtered.length) % filtered.length : 0))
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const selected = filtered[selectedIndex]
      if (selected) {
        selected.action()
      }
    }
  }

  return (
    <div
      className="ct-command-palette-backdrop"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Menu de Comandos do ConTALK"
    >
      <div className="ct-command-palette-dialog" onKeyDown={handleKeyDown}>
        <div className="ct-command-input-row">
          <ControlIcon name="search" size={16} />
          <input
            ref={inputRef}
            type="text"
            className="ct-command-search-input"
            placeholder="Digitar comando ou pesquisar chats… (Esc para fechar)"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="ct-command-clear-btn"
              onClick={() => setQuery('')}
              aria-label="Limpar pesquisa"
            >
              <ControlIcon name="close" size={13} />
            </button>
          )}
          <kbd className="ct-command-kbd">Esc</kbd>
        </div>

        <div className="ct-command-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="ct-command-empty">Nenhum comando encontrado para "{query}".</div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex
              return (
                <div
                  key={item.id}
                  className={`ct-command-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="ct-command-item-left">
                    <span className="ct-command-item-icon">
                      <ControlIcon name={item.icon || 'chat'} size={14} />
                    </span>
                    <span className="ct-command-item-title">{item.title}</span>
                    <span className="ct-command-item-badge">{item.category}</span>
                  </div>
                  {item.shortcut && (
                    <kbd className="ct-command-item-shortcut">{item.shortcut}</kbd>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="ct-command-footer">
          <span>Use <strong>↑</strong> <strong>↓</strong> para navegar</span>
          <span><strong>Enter</strong> para selecionar</span>
          <span><strong>Esc</strong> para fechar</span>
        </div>
      </div>
    </div>
  )
}
