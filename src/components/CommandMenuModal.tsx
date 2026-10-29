import { useState, useEffect, useRef } from 'react'
import { ControlIcon, type ControlIconName } from './ControlIcon'
import { useAppStore } from '../store/useAppStore'
import { usePreferencesStore } from '../store/usePreferencesStore'

export interface CommandItem {
  id: string
  title: string
  category: 'Ações Rápidas' | 'Canais' | 'Colaboração e Projetos' | 'Ajuda'
  shortcut?: string
  icon?: ControlIconName
  action: () => void
}

interface CommandMenuModalProps {
  onClose: () => void
  onToggleDevEditor?: () => void
  onOpenSettings?: (tab?: string) => void
  onOpenHelp?: () => void
  onOpenFolder?: () => void
  onOpenDevModal?: (modalId: string) => void
  onCopyDiagnostics?: () => void
  onSignOut?: () => void
  onQuit?: () => void
}

export function CommandMenuModal({
  onClose,
  onToggleDevEditor,
  onOpenSettings,
  onOpenHelp,
  onOpenFolder,
  onOpenDevModal,
  onCopyDiagnostics,
  onSignOut,
  onQuit
}: CommandMenuModalProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const { servers, activeServerId, setActiveChannel } = useAppStore()
  const preferences = usePreferencesStore()
  const currentServer = servers.find(s => s.id === activeServerId) || servers[0]

  const allCommands: CommandItem[] = [
    // Ações Rápidas
    {
      id: 'cmd-sign-out',
      title: 'Sair da conta',
      category: 'Ações Rápidas',
      icon: 'user',
      action: () => {
        onClose()
        onSignOut?.()
      }
    },
    ...(onQuit
      ? [
          {
            id: 'cmd-quit-app',
            title: 'Encerrar o ConTALK',
            category: 'Ações Rápidas' as const,
            icon: 'close' as const,
            action: () => {
              onClose()
              onQuit?.()
            }
          }
        ]
      : []),
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

    // Colaboração e Projetos
    {
      id: 'cmd-toggle-editor',
      title: 'Alternar Bloco de Notas Colaborativo',
      category: 'Colaboração e Projetos',
      shortcut: 'Ctrl+Alt+E',
      icon: 'docs',
      action: () => {
        onToggleDevEditor?.()
        onClose()
      }
    },
    {
      id: 'cmd-kanban',
      title: 'Quadro Kanban de Projetos…',
      category: 'Colaboração e Projetos',
      icon: 'overview',
      action: () => {
        onOpenDevModal?.('overview')
        onClose()
      }
    },
    {
      id: 'cmd-tasks',
      title: 'Lista de Tarefas…',
      category: 'Colaboração e Projetos',
      icon: 'tasks',
      action: () => {
        onOpenDevModal?.('tasks')
        onClose()
      }
    },
    {
      id: 'cmd-docs',
      title: 'Central de Documentação…',
      category: 'Colaboração e Projetos',
      icon: 'docs',
      action: () => {
        onOpenDevModal?.('docs')
        onClose()
      }
    },

    // Ajuda
    {
      id: 'cmd-copy-diagnostics',
      title: 'Copiar diagnóstico do sistema',
      category: 'Ajuda',
      icon: 'copy',
      action: () => {
        onCopyDiagnostics?.()
        onClose()
      }
    },
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

  // Filtragem
  const filtered = query.trim()
    ? allCommands.filter(c =>
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        c.category.toLowerCase().includes(query.toLowerCase())
      )
    : allCommands

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % (filtered.length || 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  // Scroll automático do item ativo
  useEffect(() => {
    const listEl = listRef.current
    if (!listEl) return
    const activeItem = listEl.querySelector<HTMLElement>(`[data-cmd-index="${selectedIndex}"]`)
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // Agrupa por categoria
  const categories: CommandItem['category'][] = ['Ações Rápidas', 'Canais', 'Colaboração e Projetos', 'Ajuda']

  return (
    <div className="ct-command-modal-backdrop" onClick={onClose}>
      <div
        className="ct-command-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Menu de Comandos"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="ct-command-search-wrap">
          <ControlIcon name="search" size={16} />
          <input
            ref={inputRef}
            type="text"
            className="ct-command-input"
            placeholder="Digite um comando ou nome de canal…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <kbd className="ct-command-kbd">ESC</kbd>
        </div>

        <div className="ct-command-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="ct-command-empty">Nenhum comando encontrado para "{query}"</div>
          ) : (
            categories.map(cat => {
              const catItems = filtered.filter(item => item.category === cat)
              if (catItems.length === 0) return null

              return (
                <div key={cat} className="ct-command-group">
                  <div className="ct-command-group-title">{cat}</div>
                  {catItems.map(item => {
                    const globalIdx = filtered.indexOf(item)
                    const isSelected = globalIdx === selectedIndex

                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-cmd-index={globalIdx}
                        className={`ct-command-item ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => item.action()}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                      >
                        <div className="ct-command-item-left">
                          {item.icon && <ControlIcon name={item.icon} size={15} />}
                          <span className="ct-command-item-title">{item.title}</span>
                        </div>
                        {item.shortcut && (
                          <kbd className="ct-command-item-shortcut">{item.shortcut}</kbd>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        <div className="ct-command-footer">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> navegar
          </span>
          <span>
            <kbd>↵</kbd> selecionar
          </span>
          <span>
            <kbd>ESC</kbd> fechar
          </span>
        </div>
      </div>
    </div>
  )
}
