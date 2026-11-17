import { ControlIcon } from './ControlIcon'
import { useState, useEffect, useRef } from 'react'
import type { UpdateState } from '../types/desktop'
import { useVoiceStore } from '../store/useVoiceStore'
import { useNotificationStore } from '../store/useNotificationStore'

export function UpdateNotification({onOpenNotification}:{onOpenNotification?:(id:string)=>void}) {
  const activity=useNotificationStore()
  const unread=activity.entries.filter(entry=>!entry.read).length
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'installing' | 'error'>('idle')
  const [version, setVersion] = useState<string>('')
  const [progress, setProgress] = useState<number>(0)
  const [updateHandle, setUpdateHandle] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [dismissed, setDismissed] = useState<boolean>(true)
  const [releaseNotes, setReleaseNotes] = useState('')
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const container = useRef<HTMLDivElement>(null)

  // Nova versão não abre o painel sozinha: aparece o botão "Atualizar" ao lado do sino.

  useEffect(() => {
    if (dismissed) return
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setDismissed(true) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setDismissed(true) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [dismissed])

  // Usa somente texto; notas remotas nunca são inseridas como HTML executável.
  const notesDocument = new DOMParser().parseFromString(releaseNotes.replace(/<\/(?:p|li|h[1-6]|div)>|<br\s*\/?>/gi, '\n'), 'text/html')
  const notesText = (notesDocument.body.textContent || '').trim()

  // Verifica atualizações automaticamente ao iniciar
  useEffect(() => {
    const desktop = window.contalkDesktop
    if (desktop?.onUpdateState) {
      const applyState = (state: UpdateState) => {
        setStatus(state.status)
        setVersion(state.version)
        setProgress(state.progress)
        setErrorMsg(state.error || '')
        setReleaseNotes(state.releaseNotes || '')

      }
      const unsubscribe = desktop.onUpdateState(applyState)
      let mounted = true
      desktop.getUpdateState().then(state => { if (mounted) applyState(state) }).catch(console.warn)
      return () => { mounted = false; unsubscribe() }
    }
    // Dá 3 segundos após o app abrir para checar silenciosamente
    const timer = setTimeout(() => {
      checkForUpdates(false)
    }, 3000)

    // E a cada 30 minutos verifica novamente
    const interval = setInterval(() => {
      checkForUpdates(false)
    }, 30 * 60 * 1000)

    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [])

  const checkForUpdates = async (manual = false) => {
    if (window.contalkDesktop?.checkForUpdates) {
      await window.contalkDesktop.checkForUpdates()
      return
    }
    // Se não estiver no ambiente Tauri, ignora silenciosamente
    if (!(window as any).__TAURI_INTERNALS__) {
      return
    }

    try {
      if (manual) setStatus('checking')
      const { check } = await import('@tauri-apps/plugin-updater')
      const update = await check()

      if (update) {
        setVersion(update.version)
        setReleaseNotes(update.body || '')
        setUpdateHandle(update)
        setStatus('available')
      } else {
        if (manual) {
          setStatus('idle')
        }
      }
    } catch (err: any) {
      console.warn('Erro ao verificar atualizações:', err)
      if (manual) {
        setErrorMsg(err?.message || 'Falha ao buscar atualização')
        setStatus('error')
      }
    }
  }

  const startDownloadAndInstall = async () => {
    if (window.contalkDesktop?.downloadUpdate) {
      try { await window.contalkDesktop.downloadUpdate() }
      catch (error) { setStatus('error'); setErrorMsg(error instanceof Error ? error.message : 'Falha ao baixar atualização.') }
      return
    }
    if (!updateHandle) return

    try {
      setStatus('downloading')
      setProgress(0)

      let total = 0
      let downloaded = 0

      await updateHandle.downloadAndInstall((event: any) => {
        if (event.event === 'Started') {
          total = event.data?.contentLength || 0
        } else if (event.event === 'Progress') {
          downloaded += event.data?.chunkLength || 0
          if (total > 0) {
            setProgress(Math.min(100, Math.round((downloaded / total) * 100)))
          }
        } else if (event.event === 'Finished') {
          setProgress(100)
        }
      })

      setStatus('ready')
    } catch (err: any) {
      console.error('Falha no download da atualização:', err)
      setErrorMsg(err?.message || 'Erro ao baixar atualização')
      setStatus('error')
    }
  }

  const restartApp = async () => {
    try {
      if (window.contalkDesktop?.installUpdate) {
        await useVoiceStore.getState().leaveChannel()
        await window.contalkDesktop.installUpdate()
        return
      }
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao reiniciar o aplicativo.')
    }
  }



  const open = () => {
    // Abrir o sino já conta como lido; os itens novos continuam destacados enquanto o painel estiver aberto.
    setFresh(new Set(activity.entries.filter(entry => !entry.read).map(entry => entry.id)))
    activity.markEntriesRead()
    setDismissed(false)
  }
  const updateText = status === 'checking' ? 'Procurando atualizações…'
    : status === 'available' ? `Versão ${version} disponível`
    : status === 'downloading' ? `Baixando ${version}… ${progress}%`
    : status === 'ready' ? `Versão ${version} pronta para instalar`
    : status === 'installing' ? 'Instalando…'
    : status === 'error' ? (errorMsg || 'Não foi possível verificar.')
    : 'Você está na versão mais recente.'
  const when = (value: number) => new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <div ref={container} className="ct-update-bell">
      {['available', 'downloading', 'ready'].includes(status) && (
        <button
          type="button"
          className="ct-update-chip"
          data-state={status}
          disabled={status === 'downloading'}
          title={status === 'ready' ? 'Reiniciar e instalar a atualização (encerra a chamada)' : status === 'available' ? `Baixar a versão ${version}` : 'Baixando a atualização'}
          onClick={() => { if (status === 'ready') void restartApp(); else if (status === 'available') void startDownloadAndInstall() }}
        >
          <ControlIcon name="download" size={15} />
          <span>{status === 'ready' ? 'Reiniciar' : status === 'downloading' ? `${progress}%` : 'Atualizar'}</span>
        </button>
      )}
      <button type="button" className="ct-bell-button" aria-label="Notificações e atualizações" aria-expanded={!dismissed} aria-controls="ct-update-popup" onClick={() => dismissed ? open() : setDismissed(true)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
        {unread > 0 && <span className="ct-notification-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {!dismissed && (
        <div id="ct-update-popup" role="dialog" aria-label="Notificações" className="ct-inbox">
          <header className="ct-inbox-header">
            <strong>Notificações</strong>
            {activity.entries.length > 0 && <button type="button" onClick={() => { activity.clear(); setFresh(new Set()) }}>Limpar tudo</button>}
          </header>
          <div className="ct-inbox-list">
            {activity.entries.length ? activity.entries.map(entry => (
              <button type="button" key={entry.id} className="ct-inbox-item" data-fresh={fresh.has(entry.id)} onClick={() => { onOpenNotification?.(entry.id); setDismissed(true) }}>
                <span className="ct-inbox-icon"><ControlIcon name={entry.kind === 'friendship' ? 'friends' : entry.kind === 'event' ? 'event' : entry.kind === 'thread' ? 'thread' : 'chat'} size={16} /></span>
                <span className="ct-inbox-text">
                  <strong>{entry.title}</strong>
                  <span>{entry.body}</span>
                </span>
                <time>{when(entry.createdAt)}</time>
              </button>
            )) : (
              <div className="ct-inbox-empty">
                <ControlIcon name="bell" size={22} />
                <p>Tudo em dia. Mensagens diretas, menções, pedidos de amizade e eventos aparecem aqui.</p>
              </div>
            )}
          </div>
          <footer className="ct-inbox-update" data-state={status}>
            <span className="ct-inbox-update-icon"><ControlIcon name={status === 'ready' ? 'check' : status === 'downloading' ? 'download' : status === 'error' ? 'warning' : 'rocket'} size={15} /></span>
            <span className="ct-inbox-update-text">
              <strong>ConTalk{version && !['idle', 'checking'].includes(status) ? '' : ''}</strong>
              <small>{updateText}</small>
            </span>
            {(status === 'idle' || status === 'error') && <button type="button" onClick={() => void checkForUpdates(true)}>{status === 'error' ? 'Tentar de novo' : 'Verificar'}</button>}
            {status === 'available' && <button type="button" className="ct-inbox-update-primary" onClick={() => void startDownloadAndInstall()}>Atualizar</button>}
            {status === 'ready' && <button type="button" className="ct-inbox-update-primary" onClick={() => void restartApp()}>Reiniciar</button>}
          </footer>
          {status === 'downloading' && <div className="ct-inbox-progress"><i style={{ width: `${progress}%` }} /></div>}
          {version && ['available', 'downloading', 'ready'].includes(status) && notesText && (
            <details className="ct-inbox-notes"><summary>O que há de novo na {version}</summary><p>{notesText}</p></details>
          )}
        </div>
      )}
    </div>
  )
}
