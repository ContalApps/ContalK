import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { ControlIcon } from './ControlIcon'
import { usePreferencesStore } from '../store/usePreferencesStore'

type Session = { id: string; shell: string; cwd: string; exited?: number }

const theme = { background: '#000000', foreground: '#ededed', cursor: '#ededed', selectionBackground: '#ffffff33', black: '#000000', brightBlack: '#5d5d5d' }

function TerminalView({ session, visible }: { session: Session; visible: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const fit = useRef<FitAddon>(null)
  useEffect(() => {
    const desktop = window.contalkDesktop!
    const term = new Terminal({ theme, fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, monospace', fontSize: 13, cursorBlink: true, scrollback: 5000, allowProposedApi: false })
    const addon = new FitAddon()
    fit.current = addon
    term.loadAddon(addon)
    term.open(host.current!)
    const resize = () => { try { addon.fit(); desktop.terminalResize(session.id, term.cols, term.rows) } catch { /* hidden or detached */ } }
    const observer = new ResizeObserver(resize)
    observer.observe(host.current!)
    const offData = desktop.onTerminalData(event => { if (event.id === session.id) term.write(event.data) })
    const offExit = desktop.onTerminalExit(event => { if (event.id === session.id) term.write(`\r\n\x1b[2mProcesso encerrado (código ${event.code}).\x1b[0m\r\n`) })
    const input = term.onData(data => desktop.terminalInput(session.id, data))
    resize()
    term.focus()
    return () => { observer.disconnect(); offData(); offExit(); input.dispose(); term.dispose() }
  }, [session.id])
  useEffect(() => { if (visible) requestAnimationFrame(() => { try { fit.current?.fit() } catch { /* not measured yet */ } }) }, [visible])
  return <div className="ct-terminal-view" hidden={!visible} ref={host}/>
}

export function TerminalPanel({ onClose, request = 0 }: { onClose: () => void; request?: number }) {
  const preferences = usePreferencesStore()
  const [sessions, setSessions] = useState<Session[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const [error, setError] = useState('')
  const started = useRef(false)
  const desktop = window.contalkDesktop
  const create = async () => {
    setError('')
    try {
      const session = await desktop!.terminalCreate(preferences.workspaceFolder || null, 80, 24)
      setSessions(list => [...list, session]); setCurrent(session.id)
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível abrir o terminal.') }
  }
  const kill = (id: string) => {
    void desktop?.terminalKill(id)
    setSessions(list => { const next = list.filter(s => s.id !== id); if (current === id) setCurrent(next[next.length - 1]?.id || null); return next })
  }
  useEffect(() => { if (desktop?.terminalCreate && !started.current) { started.current = true; void create() } }, [])
  // "Abrir pasta" while the panel is already open adds a terminal in the new folder.
  const seenRequest = useRef(request)
  useEffect(() => { if (request !== seenRequest.current && desktop?.terminalCreate) { seenRequest.current = request; void create() } }, [request, preferences.workspaceFolder])
  useEffect(() => desktop?.onTerminalExit?.(event => setSessions(list => list.map(s => s.id === event.id ? { ...s, exited: event.code } : s))), [])
  const startResize = (event: React.PointerEvent) => {
    const startY = event.clientY, startHeight = preferences.bottomPanelHeight
    const move = (e: PointerEvent) => { const next = Math.round(Math.min(900, Math.max(120, startHeight + startY - e.clientY))); document.documentElement.style.setProperty('--ct-bottom-panel-height', next + 'px') }
    const up = (e: PointerEvent) => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); try { preferences.update({ bottomPanelHeight: Math.round(Math.min(900, Math.max(120, startHeight + startY - e.clientY))) }) } catch { /* keep previous */ } document.documentElement.style.removeProperty('--ct-bottom-panel-height') }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  return <section className="ct-bottom-panel" aria-label="Terminal" style={{ ['--ct-panel-height' as string]: preferences.bottomPanelHeight + 'px' }}>
    <div className="ct-bottom-panel-resize" role="separator" aria-orientation="horizontal" aria-label="Redimensionar painel" onPointerDown={startResize}/>
    <header className="ct-bottom-panel-tabs">
      <span className="ct-bottom-panel-title"><ControlIcon name="terminal" size={14}/>Terminal</span>
      <div role="tablist" aria-label="Terminais abertos">{sessions.map((s, i) => <button key={s.id} role="tab" aria-selected={s.id === current} onClick={() => setCurrent(s.id)} title={s.cwd}>
        <span>{s.shell}{sessions.length > 1 ? ' ' + (i + 1) : ''}{s.exited !== undefined ? ' · encerrado' : ''}</span>
        <span className="ct-bottom-tab-close" role="button" aria-label={`Encerrar ${s.shell}`} onClick={event => { event.stopPropagation(); kill(s.id) }}><ControlIcon name="close" size={12}/></span>
      </button>)}</div>
      <div className="ct-bottom-panel-actions">
        <button aria-label="Novo terminal" title="Novo terminal" disabled={!desktop?.terminalCreate} onClick={() => void create()}><ControlIcon name="plus" size={14}/></button>
        {current && <button aria-label="Encerrar terminal" title="Encerrar terminal" onClick={() => kill(current)}><ControlIcon name="delete" size={14}/></button>}
        <button aria-label="Fechar painel" title="Fechar painel (Ctrl+J)" onClick={onClose}><ControlIcon name="close" size={14}/></button>
      </div>
    </header>
    <div className="ct-bottom-panel-body">
      {!desktop?.terminalCreate ? <p className="ct-muted ct-bottom-panel-empty">O terminal integrado está disponível no aplicativo desktop.</p>
        : error ? <p className="ct-bottom-panel-empty" role="alert">{error}</p>
        : !sessions.length ? <p className="ct-muted ct-bottom-panel-empty">Nenhum terminal aberto. <button className="ct-home-link" onClick={() => void create()}>Abrir terminal</button></p>
        : sessions.map(s => <TerminalView key={s.id} session={s} visible={s.id === current}/>)}
    </div>
  </section>
}
