import { useEffect, useRef, useState } from 'react'
import { usePreferencesStore } from '../store/usePreferencesStore'
import { UpdateNotification } from './UpdateNotification'
import { BrandMark } from './BrandMark'
import { ControlIcon } from './ControlIcon'
function TitleIcon({name}: {name: 'back' | 'forward' | 'search' | 'help' | 'close'}) {
  return <ControlIcon name={name}/>
}

export function TitleBar({title = 'ConTALK', authenticated = false, disabled = false, canBack = false, canForward = false, onBack, onForward, search = '', onSearch,onOpenNotification,scope,onToggleSidebar,sidebarOpen=true,onOpenCommandMenu}: {
  title?: string; authenticated?: boolean; disabled?: boolean; canBack?: boolean; canForward?: boolean; onBack?: () => void; onForward?: () => void; search?: string; onSearch?: (value: string) => void;onOpenNotification?:(id:string)=>void
  scope?: string; onToggleSidebar?: () => void; sidebarOpen?: boolean; onOpenCommandMenu?: () => void
}) {
  const preferences = usePreferencesStore()
  const [panel, setPanel] = useState<'search' | 'help' | null>(null)
  const ref = useRef<HTMLElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const searchButton = useRef<HTMLButtonElement>(null)
  const helpButton = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const theme = authenticated ? preferences.theme : 'classic'
  const scale = authenticated ? preferences.interfaceScale : 100
  useEffect(() => { window.contalkDesktop?.setTitleBarAppearance?.(theme, scale) }, [theme, scale])
  useEffect(() => { if (disabled) setPanel(null) }, [disabled])
  const closePanel = () => { setPanel(null); previousFocus.current?.focus() }
  useEffect(() => {
    if (!panel) return
    previousFocus.current = document.activeElement as HTMLElement
    if (panel === 'search') input.current?.focus()
    else ref.current?.querySelector<HTMLButtonElement>('.ct-titlebar-help button')?.focus()
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setPanel(null) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [panel])
  useEffect(() => {
    if (!authenticated || disabled) return
    const keys = (event: KeyboardEvent) => {
      if (document.querySelector('[aria-modal=true]')) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (onOpenCommandMenu) onOpenCommandMenu()
        else setPanel('search')
      }
      if (event.key === 'F1') { event.preventDefault(); setPanel('help') }
      const editing = event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable=true],[role=dialog]')
      if (event.altKey && !editing) {
        if (event.key === 'ArrowLeft') { event.preventDefault(); if (canBack) onBack?.() }
        if (event.key === 'ArrowRight') { event.preventDefault(); if (canForward) onForward?.() }
      }
    }
    document.addEventListener('keydown', keys)
    return () => document.removeEventListener('keydown', keys)
  }, [authenticated, disabled, canBack, canForward, onBack, onForward])

  return <header ref={ref} className="ct-topbar ct-titlebar" data-native-controls={!!window.contalkDesktop?.isElectron} data-theme={theme} inert={disabled}
    onKeyDown={event => { if (event.key === 'Escape' && panel) { event.stopPropagation(); closePanel() } }}>
    <div className="ct-titlebar-safe">
      <nav className="ct-titlebar-navigation" aria-label="Histórico de navegação">{authenticated && <>
        <button aria-label="Voltar" title="Voltar (Alt+←)" disabled={!canBack} onClick={onBack}><TitleIcon name="back"/></button>
        <button aria-label="Avançar" title="Avançar (Alt+→)" disabled={!canForward} onClick={onForward}><TitleIcon name="forward"/></button>
        {onToggleSidebar && <button aria-label={sidebarOpen ? 'Ocultar barra lateral' : 'Mostrar barra lateral'} title="Barra lateral (Ctrl+B)" aria-pressed={sidebarOpen} onClick={onToggleSidebar}><ControlIcon name="sidebar"/></button>}
        </>}{!authenticated && <span className="ct-titlebar-brand"><BrandMark/>ConTALK</span>}</nav>
      <div className="ct-titlebar-context" title={title}>{authenticated && preferences.titleBarSearch ? <button className="ct-titlebar-search-trigger" ref={searchButton} aria-label="Buscar no ConTALK" aria-expanded={panel==='search'} onClick={()=>onOpenCommandMenu ? onOpenCommandMenu() : setPanel(panel==='search'?null:'search')} data-active={!!search}><TitleIcon name="search"/><span>{search || `Pesquisar em ${scope || title}…`}</span><kbd>Ctrl K</kbd></button> : authenticated ? <><BrandMark/><span>{title}</span></> : null}</div>
      <div className="ct-titlebar-actions">{authenticated && <>
        <UpdateNotification onOpenNotification={onOpenNotification}/>
        {preferences.titleBarHelp && <button ref={helpButton} aria-label="Ajuda do ConTALK" title="Ajuda (F1)" aria-expanded={panel==='help'} onClick={()=>setPanel(panel==='help'?null:'help')}><TitleIcon name="help"/></button>}
      </>}</div>
    </div>
    {panel==='search' && <section className="ct-titlebar-popover ct-titlebar-search" aria-label="Busca" role="search">
      <label htmlFor="ct-global-search">Buscar pessoas e mensagens</label>
      <div><input ref={input} id="ct-global-search" aria-label="Buscar pessoas" placeholder="Digite para filtrar a tela atual…" value={search} onChange={event=>onSearch?.(event.target.value)}/><button title="Limpar busca" aria-label="Limpar busca" onClick={()=>{onSearch?.('');input.current?.focus()}}><TitleIcon name="close"/></button></div>
      <small>A busca filtra o conteúdo da área aberta. <kbd>Esc</kbd> fecha este painel.</small>
    </section>}
    {panel==='help' && <section className="ct-titlebar-popover ct-titlebar-help" role="dialog" aria-label="Ajuda do ConTALK">
      <div className="ct-titlebar-help-header">
        <strong>Atalhos do teclado e ajuda</strong>
        <button aria-label="Fechar ajuda" title="Fechar ajuda" onClick={closePanel}><TitleIcon name="close"/></button>
      </div>

      <div className="ct-help-section">
        <h4>Navegação e Layout</h4>
        <div className="ct-shortcut-row"><kbd>Ctrl+K</kbd><span>Menu de comandos universal (Command Palette)</span></div>
        <div className="ct-shortcut-row"><kbd>Ctrl+Alt+R</kbd><span>Painel de alterações e diffs (Review Panel)</span></div>
        <div className="ct-shortcut-row"><kbd>Alt+← / Alt+→</kbd><span>Voltar e avançar no histórico</span></div>
        <div className="ct-shortcut-row"><kbd>Ctrl+B</kbd><span>Alternar barra lateral</span></div>
        <div className="ct-shortcut-row"><kbd>Ctrl+Alt+B</kbd><span>Alternar painel direito (membros)</span></div>
        <div className="ct-shortcut-row"><kbd>Ctrl+Alt+E</kbd><span>Alternar editor de código colaborativo (Split)</span></div>
        <div className="ct-shortcut-row"><kbd>Ctrl+J</kbd> ou <kbd>Ctrl+`</kbd><span>Alternar terminal inferior</span></div>
        <div className="ct-shortcut-row"><kbd>F11</kbd><span>Alternar tela cheia</span></div>
        <div className="ct-shortcut-row"><kbd>Ctrl+,</kbd><span>Abrir Configurações</span></div>
        <div className="ct-shortcut-row"><kbd>F1</kbd><span>Abrir esta ajuda</span></div>
        <div className="ct-shortcut-row"><kbd>Esc</kbd><span>Fechar modal, painel ou perfil</span></div>
      </div>

      <div className="ct-help-section">
        <h4>Conversas e Mensagens</h4>
        <div className="ct-shortcut-row"><kbd>Ctrl+Shift+N</kbd><span>Nova conversa direta</span></div>
        <div className="ct-shortcut-row"><kbd>Enter</kbd><span>Enviar mensagem</span></div>
        <div className="ct-shortcut-row"><kbd>Shift+Enter</kbd><span>Nova linha na mensagem</span></div>
      </div>

      <div className="ct-help-section">
        <h4>Código e Workspace</h4>
        <div className="ct-shortcut-row"><kbd>Ctrl+O</kbd><span>Abrir pasta do repositório…</span></div>
        <div className="ct-shortcut-row"><kbd>Ctrl+S</kbd><span>Salvar arquivo no editor</span></div>
        <div className="ct-shortcut-row"><kbd>Tab / Shift+Tab</kbd><span>Indentar / desindentar código</span></div>
      </div>

      <div className="ct-help-section">
        <h4>Edição Geral</h4>
        <div className="ct-shortcut-row"><kbd>Ctrl+Z / Ctrl+Y</kbd><span>Desfazer / Refazer</span></div>
        <div className="ct-shortcut-row"><kbd>Ctrl+X / C / V</kbd><span>Recortar / Copiar / Colar</span></div>
        <div className="ct-shortcut-row"><kbd>Ctrl+A</kbd><span>Selecionar tudo</span></div>
      </div>

      <div className="ct-help-footer">
        <p>Microfone, áudio, câmera e compartilhamento ficam no seu card no canto inferior esquerdo.</p>
        <p>Use a engrenagem de um canal para renomear ou excluir com confirmação.</p>
        <small>Personalize itens da barra de título em Configurações → Aparência.</small>
      </div>
    </section>}
  </header>
}
