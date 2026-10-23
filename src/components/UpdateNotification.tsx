import { useState, useEffect } from 'react'
import type { UpdateState } from '../types/desktop'
import { useVoiceStore } from '../store/useVoiceStore'

export function UpdateNotification() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'>('idle')
  const [version, setVersion] = useState<string>('')
  const [progress, setProgress] = useState<number>(0)
  const [updateHandle, setUpdateHandle] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [dismissed, setDismissed] = useState<boolean>(false)

  // Verifica atualizações automaticamente ao iniciar
  useEffect(() => {
    const desktop = window.contalkDesktop
    if (desktop?.onUpdateState) {
      const applyState = (state: UpdateState) => {
        setStatus(state.status)
        setVersion(state.version)
        setProgress(state.progress)
        setErrorMsg(state.error || '')
        if (state.status === 'available' || state.status === 'ready') setDismissed(false)
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
        setUpdateHandle(update)
        setStatus('available')
        setDismissed(false)
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

  if (dismissed || status === 'idle' || status === 'checking') {
    return null
  }

  return (
    <div className="fixed bottom-16 right-6 z-50 max-w-sm w-full bg-[#130f24] border border-purple-500/40 rounded-2xl p-4 shadow-2xl shadow-purple-900/40 animate-slide-up backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0 text-xl">
          {status === 'ready' ? '🎉' : status === 'downloading' ? '⏳' : status === 'error' ? '⚠️' : '🚀'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>ContalK Update</span>
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

          {status === 'available' && (
            <p className="text-xs text-gray-300 mt-1">
              Uma nova versão do ContalK está pronta para ser instalada.
            </p>
          )}

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
                <span>Baixar e Atualizar</span>
              </button>
            )}

            {status === 'ready' && (
              <button
                onClick={restartApp}
                className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/40 transition active:scale-95 flex items-center justify-center gap-1.5"
              >
                <span>Reiniciar o ContalK</span>
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
    </div>
  )
}
