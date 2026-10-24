import { useEffect, useRef, useState } from 'react'
import { usePreferencesStore } from '../store/usePreferencesStore'
import { UpdateNotification } from './UpdateNotification'
import { BrandMark } from './BrandMark'

function TitleIcon({name}: {name: 'back' | 'forward' | 'search' | 'help' | 'close'}) {
  const paths = {back: 'm14 6-6 6 6 6M8 12h13', forward: 'm10 6 6 6-6 6M3 12h13', search: 'm21 21-5-5M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0', help: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', close: 'm6 6 12 12M6 18 18 6'}
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>
}

export function TitleBar({title = 'ConTALK', authenticated = false, disabled = false, canBack = false, canForward = false, onBack, onForward, search = '', onSearch,onOpenNotification}: {
  title?: string; authenticated?: boolean; disabled?: boolean; canBack?: boolean; canForward?: boolean; onBack?: () => void; onForward?: () => void; search?: string; onSearch?: (value: string) => void;onOpenNotification?:(id:string)=>void
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
      </>}</nav>
      <div className="ct-titlebar-context" title={title}><BrandMark/><span>{title}</span></div>
      <div className="ct-titlebar-actions">{authenticated && <>
        {preferences.titleBarSearch && <button ref={searchButton} aria-label="Buscar no ConTALK" title="Buscar (Ctrl+K)" aria-expanded={panel==='search'} onClick={()=>setPanel(panel==='search'?null:'search')} data-active={!!search}><TitleIcon name="search"/></button>}
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
      <div><strong>Atalhos e ajuda</strong><button aria-label="Fechar ajuda" title="Fechar ajuda" onClick={closePanel}><TitleIcon name="close"/></button></div>
      <p><kbd>Ctrl+K</kbd> Buscar na área aberta</p><p><kbd>Alt+← / Alt+→</kbd> Voltar e avançar</p><p><kbd>F1</kbd> Abrir esta ajuda</p>
      <p>Microfone, áudio, câmera e compartilhamento ficam no seu card, no canto inferior esquerdo.</p>
      <p>Use a engrenagem de um canal para renomear ou excluir com confirmação. O sino reúne as atualizações.</p>
      <small>Personalize os atalhos da barra em Configurações → Aparência.</small>
    </section>}
  </header>
}
