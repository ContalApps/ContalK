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
  const announcedVersions = useRef(new Set<string>())
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!version || !['available', 'ready'].includes(status) || announcedVersions.current.has(version)) return
    announcedVersions.current.add(version)
    setDismissed(false)
  }, [version, status])

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



  return (
    <div ref={container} className="ct-update-bell"><button aria-label="Notificações e atualizações" aria-expanded={!dismissed} aria-controls="ct-update-popup" onClick={()=>setDismissed(!dismissed)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>{['available','ready','error'].includes(status)&&<i/>}{unread>0&&<span className="ct-notification-badge">{unread>99?'99+':unread}</span>}</button>{!dismissed&&<div id="ct-update-popup" role="dialog" aria-label="Atualizações" className="ct-update-popup">
      <section className="ct-notification-center" aria-label="Atividade no ConTALK"><header><strong>Notificações</strong><button disabled={!unread} onClick={activity.markAllRead}>Marcar tudo como lido</button></header><div className="ct-notification-items">{activity.entries.length?activity.entries.map(entry=><button key={entry.id} className={entry.read?'read':'unread'} onClick={()=>{activity.markRead(entry.id);onOpenNotification?.(entry.id);setDismissed(true)}}><strong>{entry.title}</strong><span>{entry.body}</span><small>{new Date(entry.createdAt).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</small></button>):<p>Nenhuma atividade por enquanto. Mensagens, amizades e chamadas aparecerão aqui.</p>}</div>{activity.entries.length>0&&<button onClick={activity.clear}>Limpar histórico</button>}</section><div className="flex items-start justify-between gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0 text-xl">
          {status === 'ready' ? '🎉' : status === 'downloading' ? '⏳' : status === 'error' ? '⚠️' : '🚀'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Atualizações do ConTALK</span>
              {version && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                  v{version}
                </span>
              )}
            </h4>
            <button
              onClick={() => setDismissed(true)}
              className="text-gray-400 hover:text-white text-xs p-1 transition"
              title="Fechar aviso"
            >
              ✕
            </button>
          </div>

          {(status==='idle'||status==='checking')&&<p>{status==='checking'?'Buscando atualizações…':'Você está em dia.'}<button onClick={()=>void checkForUpdates(true)}>Verificar agora</button></p>}
          {status === 'available' && (
            <p className="text-xs text-gray-300 mt-1">
              Uma nova versão está disponível. Ao atualizar, as chamadas serão encerradas e o ConTALK reiniciará automaticamente.
            </p>
          )}
          {version && ['available', 'downloading', 'ready', 'installing'].includes(status) && <section className="ct-update-notes" aria-label="Melhorias da versão">
            <strong>O que há de novo</strong>
            <p>{notesText || 'As notas desta versão não foram disponibilizadas.'}</p>
          </section>}

          {status === 'downloading' && (
            <div className="mt-2 space-y-1.5">
              <div className="flex justify-between text-xs text-gray-300">
                <span>Baixando atualização...</span>
                <span className="font-mono text-purple-400">{progress}%</span>
              </div>
              <div className="w-full bg-[#0a0812] h-2 rounded-full overflow-hidden border border-purple-900/50">
                <div
                  className="bg-gradient-to-r from-purple-500 to-indigo-400 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {status === 'ready' && (
            <p className="text-xs text-emerald-400 mt-1">
              ✓ Download concluído! Reiniciar aplica a atualização e encerra chamadas em andamento.
            </p>
          )}

          {status === 'error' && (
            <p className="text-xs text-rose-400 mt-1">
              {errorMsg || 'Erro ao processar atualização.'}
            </p>
          )}

          {/* Botões de Ação */}
          <div className="mt-3 flex gap-2">
            {status === 'available' && (
              <button
                onClick={startDownloadAndInstall}
                className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-xs shadow-md shadow-purple-900/40 transition active:scale-95 flex items-center justify-center gap-1.5"
              >
                <span>Atualizar e reiniciar automaticamente</span>
              </button>
            )}

            {status === 'ready' && (
              <button
                onClick={restartApp}
                className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/40 transition active:scale-95 flex items-center justify-center gap-1.5"
              >
                <span>Reiniciar o ConTALK</span>
              </button>
            )}

            {status === 'error' && (
              <button
                onClick={() => checkForUpdates(true)}
                className="py-1 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition"
              >
                Tentar Novamente
              </button>
            )}
          </div>
        </div>
      </div>
    </div>}</div>
  )
}
