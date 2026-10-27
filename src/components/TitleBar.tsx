import { useEffect, useRef, useState } from 'react'
import { usePreferencesStore } from '../store/usePreferencesStore'
import { UpdateNotification } from './UpdateNotification'
import { BrandMark } from './BrandMark'
import { ControlIcon } from './ControlIcon'
import { TitleMenus, type MenuGroup } from './TitleMenus'
import { Avatar } from './Avatar'
import { useAuthStore } from '../store/useAuthStore'

function TitleIcon({name}: {name: 'back' | 'forward' | 'search' | 'help' | 'close'}) {
  return <ControlIcon name={name}/>
}

export function TitleBar({title = 'ConTALK', authenticated = false, disabled = false, canBack = false, canForward = false, onBack, onForward, search = '', onSearch,onOpenNotification,menus,scope,onToggleSidebar,sidebarOpen=true,onToggleRightPanel,rightPanelOpen=false,onProfile}: {
  title?: string; authenticated?: boolean; disabled?: boolean; canBack?: boolean; canForward?: boolean; onBack?: () => void; onForward?: () => void; search?: string; onSearch?: (value: string) => void;onOpenNotification?:(id:string)=>void
  menus?: MenuGroup[]; scope?: string; onToggleSidebar?: () => void; sidebarOpen?: boolean; onToggleRightPanel?: () => void; rightPanelOpen?: boolean; onProfile?: () => void
}) {
  const user = useAuthStore(s => s.user)
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
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPanel('search') }
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
        {menus && <TitleMenus menus={menus}/>}
      </>}{!authenticated && <span className="ct-titlebar-brand"><BrandMark/>ConTALK</span>}</nav>
      <div className="ct-titlebar-context" title={title}>{authenticated && preferences.titleBarSearch ? <button className="ct-titlebar-search-trigger" ref={searchButton} aria-label="Buscar no ConTALK" aria-expanded={panel==='search'} onClick={()=>setPanel(panel==='search'?null:'search')} data-active={!!search}><TitleIcon name="search"/><span>{search || `Pesquisar em ${scope || title}…`}</span><kbd>Ctrl K</kbd></button> : authenticated ? <><BrandMark/><span>{title}</span></> : null}</div>
      <div className="ct-titlebar-actions">{authenticated && <>
        <UpdateNotification onOpenNotification={onOpenNotification}/>
        {onToggleRightPanel && <button aria-label={rightPanelOpen ? 'Ocultar painel direito' : 'Mostrar painel direito'} title="Painel direito (Ctrl+Alt+B)" aria-pressed={rightPanelOpen} onClick={onToggleRightPanel}><ControlIcon name="friends"/></button>}
        {preferences.titleBarHelp && <button ref={helpButton} aria-label="Ajuda do ConTALK" title="Ajuda (F1)" aria-expanded={panel==='help'} onClick={()=>setPanel(panel==='help'?null:'help')}><TitleIcon name="help"/></button>}
        {onProfile && user && <button className="ct-top-profile" aria-label="Seu perfil" title={user.display_name} onClick={onProfile}><Avatar name={user.display_name} identity={user.username}/></button>}
      </>}</div>
    </div>
    {panel==='search' && <section className="ct-titlebar-popover ct-titlebar-search" aria-label="Busca" role="search">
      <label htmlFor="ct-global-search">Buscar pessoas e mensagens</label>
      <div><input ref={input} id="ct-global-search" aria-label="Buscar pessoas" placeholder="Digite para filtrar a tela atual…" value={search} onChange={event=>onSearch?.(event.target.value)}/><button title="Limpar busca" aria-label="Limpar busca" onClick={()=>{onSearch?.('');input.current?.focus()}}><TitleIcon name="close"/></button></div>
      <small>A busca filtra o conteúdo da área aberta. <kbd>Esc</kbd> fecha este painel.</small>
    </section>}
    {panel==='help' && <section className="ct-titlebar-popover ct-titlebar-help" role="dialog" aria-label="Ajuda do ConTALK">
      <div><strong>Atalhos e ajuda</strong><button aria-label="Fechar ajuda" title="Fechar ajuda" onClick={closePanel}><TitleIcon name="close"/></button></div>
      <p><kbd>Ctrl+K</kbd> Buscar na área aberta</p><p><kbd>Alt+← / Alt+→</kbd> Voltar e avançar</p><p><kbd>F1</kbd> Abrir esta ajuda</p>
      <p>Microfone, áudio, câmera e compartilhamento ficam no seu card, no canto inferior esquerdo.</p>
      <p>Use a engrenagem de um canal para renomear ou excluir com confirmação. O sino reúne as atualizações.</p>
      <small>Personalize os atalhos da barra em Configurações → Aparência.</small>
    </section>}
  </header>
}
