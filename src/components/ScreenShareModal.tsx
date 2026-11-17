import { ControlIcon } from './ControlIcon'
import { useEffect, useState } from 'react'
import type { ShareOptions } from '../media/screenShare'
import type { CaptureAudioMode } from '../types/desktop'

export interface CaptureSource {
  id: string
  source_type: 'monitor' | 'window'
  name: string
  title: string
  app_name: string
  width: number
  height: number
  is_primary: boolean
  thumbnail?: string
}

interface ScreenShareModalProps {
  isOpen: boolean
  onClose: () => void
  onStartShare: (source: CaptureSource | null, options: ShareOptions) => Promise<void>
}

export function ScreenShareModal({ isOpen, onClose, onStartShare }: ScreenShareModalProps) {
  const [activeTab, setActiveTab] = useState<'screens' | 'windows'>('screens')
  const [sources, setSources] = useState<CaptureSource[]>([])
  const [selectedSource, setSelectedSource] = useState<CaptureSource | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Opções de áudio e qualidade
  const [audioMode, setAudioMode] = useState<CaptureAudioMode | 'off'>('isolated')
  const [fps, setFps] = useState<number>(30)
  const [resolution, setResolution] = useState<'720' | '1080' | 'source'>('1080')
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const useBrowserPicker = !window.contalkDesktop

  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    setIsLoading(true)
    setStartError(null)
    setActiveTab('screens')
    setSelectedSource(null)
    setAudioMode(mode => mode === 'all-apps' ? 'isolated' : mode)

    const fetchSources = async () => {
      try {
        // 1. Tentar via Electron Desktop (desktopCapturer - Arquitetura Oficial do Discord)
        const electron = (window as any).contalkDesktop
        if (electron?.getDesktopSources) {
          const res = await electron.getDesktopSources()
          if (isMounted && Array.isArray(res) && res.length > 0) {
            const mapped: CaptureSource[] = res.map((s: any) => ({
              id: s.id,
              source_type: s.isScreen ? 'monitor' : 'window',
              name: s.name,
              title: s.name,
              app_name: s.name,
              thumbnail: s.thumbnail,
              width: s.width || 1920,
              height: s.height || 1080,
              is_primary: s.isPrimary === true,
            }))
            setSources(mapped)
            const firstMonitor = mapped.find((s) => s.source_type === 'monitor')
            setSelectedSource(firstMonitor || mapped[0])
            setIsLoading(false)
            return
          }
        }

        // 2. Tentar via Tauri backend nativo (xcap)
        const tauri = (window as any).__TAURI__
        if (tauri && tauri.core) {
          const res = await tauri.core.invoke('get_capture_sources')
          if (isMounted && Array.isArray(res) && res.length > 0) {
            setSources(res)
            // Pré-selecionar o primeiro monitor
            const firstMonitor = res.find((s: CaptureSource) => s.source_type === 'monitor')
            setSelectedSource(firstMonitor || res[0])
            setIsLoading(false)
            return
          }
        }
      } catch (err) {
        if (isMounted) setStartError(err instanceof Error ? err.message : 'Não foi possível listar as fontes de captura.')
      }

      if (isMounted) {
        setSources([])
        setSelectedSource(null)
        setIsLoading(false)
      }
    }

    fetchSources()

    return () => {
      isMounted = false
    }
  }, [isOpen])

  if (!isOpen) return null

  const screens = sources.filter((s) => s.source_type === 'monitor')
  const windows = sources.filter((s) => s.source_type === 'window')
  const displayedSources = activeTab === 'screens' ? screens : windows

  const handleStart = async () => {
    setIsStarting(true)
    setStartError(null)
    try {
      await onStartShare(selectedSource, {
        audio: audioMode !== 'off',
        audioMode: audioMode === 'off' ? undefined : audioMode,
        fps,
        resolution,
      })
      onClose()
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Falha ao iniciar transmissão.')
    } finally {
      setIsStarting(false)
    }
  }

  const audioHint = audioMode === 'all-apps'
    ? 'Inclui notificações e o som de outros monitores. O áudio do ConTalk fica de fora.'
    : audioMode === 'isolated'
    ? (useBrowserPicker ? 'Escolha uma aba com áudio no seletor do navegador.' : 'Captura o som do aplicativo escolhido. Janelas do mesmo programa podem compartilhar o áudio.')
    : 'A transmissão vai sem som.'

  return (
    <div className="ct-modal-backdrop ct-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !isStarting) onClose() }}>
      <section
        className="ct-dialog ct-share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ct-share-title"
        onKeyDown={event => { if (event.key === 'Escape' && !isStarting) { event.stopPropagation(); onClose() } }}
      >
        <header className="ct-dialog-header">
          <div>
            <h2 id="ct-share-title">Compartilhar tela</h2>
            <p>Escolha um monitor ou um aplicativo para transmitir na chamada.</p>
          </div>
          <button type="button" className="ct-dialog-close" disabled={isStarting} aria-label="Fechar seletor de transmissão" title="Fechar (Esc)" onClick={onClose} autoFocus>
            <ControlIcon name="close" />
          </button>
        </header>

        <nav className="ct-share-tabs" role="tablist" aria-label="Tipo de fonte">
          <button type="button" role="tab" aria-selected={activeTab === 'screens'} onClick={() => { setActiveTab('screens'); setSelectedSource(screens[0] || null) }}>
            Telas <span>{screens.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'windows'} onClick={() => { setActiveTab('windows'); setSelectedSource(windows[0] || null) }}>
            Aplicativos <span>{windows.length}</span>
          </button>
        </nav>

        <div className="ct-share-sources">
          {isLoading ? (
            <p className="ct-share-empty" role="status"><ControlIcon name="refresh" size={18} />Procurando monitores e janelas…</p>
          ) : displayedSources.length === 0 ? (
            <p className="ct-share-empty">{useBrowserPicker ? 'O navegador abre o seletor de tela, janela ou aba quando você continuar.' : 'Nenhuma fonte encontrada nesta categoria.'}</p>
          ) : (
            <div className="ct-share-grid" role="listbox" aria-label="Fontes de captura">
              {displayedSources.map(source => {
                const isSelected = selectedSource?.id === source.id
                return (
                  <button type="button" role="option" aria-selected={isSelected} key={source.id} className="ct-share-source" onClick={() => setSelectedSource(source)} onDoubleClick={() => { setSelectedSource(source); void handleStart() }}>
                    <span className="ct-share-thumb">
                      {source.thumbnail ? <img src={source.thumbnail} alt="" /> : <ControlIcon name={source.source_type === 'monitor' ? 'screen' : 'sidebar'} size={28} />}
                      {source.is_primary && <span className="ct-share-primary">Principal</span>}
                    </span>
                    <span className="ct-share-name">{source.name}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="ct-share-options">
          <label className="ct-field">
            <span>Áudio da transmissão</span>
            <select aria-label="Áudio da transmissão" value={audioMode} onChange={event => setAudioMode(event.target.value as typeof audioMode)} disabled={isStarting}>
              <option value="off">Sem áudio</option>
              <option value="isolated">{useBrowserPicker ? 'Áudio da aba' : selectedSource?.source_type === 'monitor' ? 'Aplicativos desta tela' : 'Aplicativo selecionado'}</option>
              {!useBrowserPicker && <option value="all-apps">Todos os aplicativos</option>}
            </select>
            <small>{audioHint}</small>
          </label>
          <div className="ct-share-quality">
            <div className="ct-field">
              <span>Resolução</span>
              <div className="ct-segmented" role="group" aria-label="Resolução">
                {(['720', '1080', 'source'] as const).map(value => (
                  <button key={value} type="button" aria-pressed={resolution === value} onClick={() => setResolution(value)}>{value === 'source' ? 'Original' : `${value}p`}</button>
                ))}
              </div>
            </div>
            <div className="ct-field">
              <span>Quadros por segundo</span>
              <div className="ct-segmented" role="group" aria-label="Quadros por segundo">
                {([30, 60] as const).map(value => (
                  <button key={value} type="button" aria-pressed={fps === value} onClick={() => setFps(value)}>{value} FPS</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {startError && <p className="ct-vs-error" role="alert">{startError}</p>}

        <footer className="ct-dialog-footer ct-share-footer">
          <span className="ct-share-selected">{selectedSource ? <>Selecionado: <strong>{selectedSource.name}</strong></> : 'Nenhuma fonte selecionada'}</span>
          <button type="button" className="ct-button-secondary" onClick={onClose} disabled={isStarting}>Cancelar</button>
          <button type="button" className="ct-button-primary ct-share-start" onClick={() => void handleStart()} disabled={(!selectedSource && !useBrowserPicker) || isStarting || isLoading}>
            <span className="ct-share-live-dot" aria-hidden="true" />{isStarting ? 'Conectando…' : 'Transmitir ao vivo'}
          </button>
        </footer>
      </section>
    </div>
  )
}
