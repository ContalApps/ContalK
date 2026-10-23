import { useEffect, useState } from 'react'

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
  onStartShare: (source: CaptureSource | null, options: { audio: boolean; antiEcho: boolean; fps: number; resolution: string }) => Promise<void>
}

// Fallback sources para visualização em modo Web
const MOCK_SOURCES: CaptureSource[] = [
  {
    id: 'monitor:0',
    source_type: 'monitor',
    name: 'Tela 1',
    title: 'Tela 1 (Principal - 1920x1080)',
    app_name: 'Monitor',
    width: 1920,
    height: 1080,
    is_primary: true,
  },
  {
    id: 'monitor:1',
    source_type: 'monitor',
    name: 'Tela 2',
    title: 'Tela 2 (Secundária - 1920x1080)',
    app_name: 'Monitor',
    width: 1920,
    height: 1080,
    is_primary: false,
  },
  {
    id: 'window:vscode',
    source_type: 'window',
    name: 'Visual Studio Code',
    title: 'ContalK - Visual Studio Code',
    app_name: 'Code',
    width: 1600,
    height: 900,
    is_primary: false,
  },
  {
    id: 'window:game',
    source_type: 'window',
    name: 'Rocket League',
    title: 'Rocket League (64-bit, DX11)',
    app_name: 'RocketLeague',
    width: 1920,
    height: 1080,
    is_primary: false,
  },
  {
    id: 'window:spotify',
    source_type: 'window',
    name: 'Spotify',
    title: 'Spotify Free',
    app_name: 'Spotify',
    width: 1280,
    height: 720,
    is_primary: false,
  },
]

export function ScreenShareModal({ isOpen, onClose, onStartShare }: ScreenShareModalProps) {
  const [activeTab, setActiveTab] = useState<'screens' | 'windows'>('screens')
  const [sources, setSources] = useState<CaptureSource[]>([])
  const [selectedSource, setSelectedSource] = useState<CaptureSource | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Opções de áudio e qualidade
  const [shareAudio, setShareAudio] = useState(true)
  const [antiEcho, setAntiEcho] = useState(true)
  const [fps, setFps] = useState<number>(60)
  const [resolution, setResolution] = useState<'720' | '1080' | 'source'>('1080')
  const [isStarting, setIsStarting] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    setIsLoading(true)

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
              width: 1920,
              height: 1080,
              is_primary: s.id.includes('screen:0'),
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
        console.warn('Backend nativo não retornou fontes, usando fallback:', err)
      }

      if (isMounted) {
        setSources(MOCK_SOURCES)
        setSelectedSource(MOCK_SOURCES[0])
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
    try {
      await onStartShare(selectedSource, {
        audio: shareAudio,
        antiEcho,
        fps,
        resolution,
      })
      onClose()
    } catch (err) {
      console.error('Falha ao iniciar transmissão:', err)
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none">
      <div className="w-full max-w-2xl bg-[#141021] border border-purple-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header do Modal */}
        <header className="px-6 py-4 border-b border-purple-900/30 flex items-center justify-between flex-shrink-0 bg-[#0e0b17]">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🖥️</span>
            <div>
              <h2 className="text-base font-black text-white tracking-wide">Compartilhe sua tela</h2>
              <p className="text-[11px] text-purple-300/60 font-medium">
                Escolha o monitor ou aplicativo específico que deseja transmitir
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-purple-950/50 hover:bg-purple-900/50 text-purple-300 hover:text-white flex items-center justify-center transition-colors text-xs font-bold"
          >
            ✕
          </button>
        </header>

        {/* Abas: Telas vs Aplicativos */}
        <div className="px-6 pt-4 flex items-center gap-3 border-b border-purple-900/30 bg-[#120e1e] flex-shrink-0">
          <button
            onClick={() => {
              setActiveTab('screens')
              if (screens.length > 0) setSelectedSource(screens[0])
            }}
            className={`pb-3 text-xs font-bold transition-all relative ${
              activeTab === 'screens' ? 'text-white' : 'text-[#9c97ad] hover:text-white'
            }`}
          >
            <span>Telas ({screens.length})</span>
            {activeTab === 'screens' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('windows')
              if (windows.length > 0) setSelectedSource(windows[0])
            }}
            className={`pb-3 text-xs font-bold transition-all relative ${
              activeTab === 'windows' ? 'text-white' : 'text-[#9c97ad] hover:text-white'
            }`}
          >
            <span>Aplicativos ({windows.length})</span>
            {activeTab === 'windows' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full" />
            )}
          </button>
        </div>

        {/* Conteúdo com Miniaturas */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="text-4xl animate-bounce">🦇</div>
              <p className="text-xs text-purple-300/70 font-medium">Detectando janelas e monitores com DirectX...</p>
            </div>
          ) : displayedSources.length === 0 ? (
            <div className="py-12 text-center text-purple-300/60 text-xs">
              Nenhuma fonte encontrada nesta categoria.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3.5">
              {displayedSources.map((source) => {
                const isSelected = selectedSource?.id === source.id
                return (
                  <div
                    key={source.id}
                    onClick={() => setSelectedSource(source)}
                    className={`cursor-pointer rounded-2xl overflow-hidden border p-2.5 transition-all duration-200 flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-purple-950/60 border-purple-400 ring-2 ring-purple-500/40 shadow-lg shadow-purple-600/20'
                        : 'bg-[#181329] border-purple-900/40 hover:border-purple-500/40 hover:bg-[#1e1733]'
                    }`}
                  >
                    {/* Preview da tela ou miniatura */}
                    <div className="aspect-video w-full rounded-xl overflow-hidden bg-[#0c0a14] border border-white/5 relative flex items-center justify-center">
                      {source.thumbnail ? (
                        <img
                          src={source.thumbnail}
                          alt={source.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-purple-400/60">
                          <span className="text-3xl">
                            {source.source_type === 'monitor' ? '🖥️' : '🪟'}
                          </span>
                          <span className="text-[10px] font-semibold">{source.width}x{source.height}</span>
                        </div>
                      )}

                      {source.is_primary && (
                        <span className="absolute top-2 left-2 bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                          PRINCIPAL
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 px-1">
                      <div className="text-xs font-bold text-white truncate">{source.name}</div>
                      <div className="text-[10px] text-purple-300/60 truncate">{source.title}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Configurações de Transmissão (Áudio & Qualidade) */}
          <div className="p-4 rounded-2xl bg-[#0e0b17] border border-purple-900/40 space-y-3.5">
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <span>⚙️</span>
              <span>Opções de Áudio e Performance</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="flex items-center gap-2.5 p-2 rounded-xl bg-[#161224] border border-purple-900/30 cursor-pointer hover:border-purple-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={shareAudio}
                  onChange={(e) => setShareAudio(e.target.checked)}
                  className="rounded accent-purple-500 w-4 h-4 cursor-pointer"
                />
                <div className="min-w-0">
                  <span className="font-semibold text-white block">Áudio do Aplicativo</span>
                  <span className="text-[10px] text-purple-300/60 block">Transmite o som do jogo/janela</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-xl bg-[#161224] border border-purple-900/30 cursor-pointer hover:border-purple-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={antiEcho}
                  onChange={(e) => setAntiEcho(e.target.checked)}
                  className="rounded accent-purple-500 w-4 h-4 cursor-pointer"
                />
                <div className="min-w-0">
                  <span className="font-semibold text-white block">🛡️ Anti-Eco ContalK</span>
                  <span className="text-[10px] text-purple-300/60 block">Não transmite as vozes da chamada</span>
                </div>
              </label>
            </div>

            {/* Resolução e Taxa de Quadros */}
            <div className="flex items-center justify-between pt-1 border-t border-purple-900/30 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#a49fb5] text-[11px] font-bold">Resolução:</span>
                {(['720', '1080', 'source'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setResolution(r)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                      resolution === r
                        ? 'bg-purple-600 text-white shadow'
                        : 'bg-[#181329] text-purple-300 hover:text-white'
                    }`}
                  >
                    {r === 'source' ? 'Original' : `${r}p`}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[#a49fb5] text-[11px] font-bold">Taxa:</span>
                {([30, 60] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFps(f)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                      fps === f
                        ? 'bg-purple-600 text-white shadow'
                        : 'bg-[#181329] text-purple-300 hover:text-white'
                    }`}
                  >
                    {f} FPS
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer com Botões de Ação */}
        <footer className="px-6 py-4 border-t border-purple-900/30 flex items-center justify-between bg-[#0e0b17] flex-shrink-0">
          <div className="text-xs text-purple-300/70">
            {selectedSource ? (
              <span>Selecionado: <strong className="text-white">{selectedSource.name}</strong></span>
            ) : (
              <span>Nenhuma fonte selecionada</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              disabled={isStarting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-purple-300 hover:text-white hover:bg-purple-950/40 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleStart}
              disabled={!selectedSource || isStarting}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-purple-600/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isStarting ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>Conectando...</span>
                </>
              ) : (
                <>
                  <span>🔴</span>
                  <span>Transmitir ao Vivo</span>
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
