import { useEffect, useRef } from 'react'
import { FriendButton } from './FriendButton'
import { StreamVolumeControl } from './StreamVolumeControl'

interface ParticipantVolumePopupProps {
  participant: {
    identity: string
    name: string
    isLocal?: boolean
    isScreenShareEnabled?: boolean
  }
  volume: number
  onVolumeChange: (vol: number) => void
  onClose: () => void
  position?: { x: number; y: number }
}

export function ParticipantVolumePopup({
  participant,
  volume,
  onVolumeChange,
  onClose,
  position,
}: ParticipantVolumePopupProps) {
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const isMuted = volume === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none">
      <div
        ref={popupRef}
        className="w-80 max-h-[90dvh] overflow-y-auto bg-[#141022] border border-purple-500/40 rounded-3xl p-5 shadow-2xl shadow-purple-950/60 animate-in fade-in zoom-in-95 duration-150"
        style={
          position
            ? {
                position: 'absolute',
                top: Math.min(position.y, window.innerHeight - 260),
                left: Math.min(position.x, window.innerWidth - 340),
              }
            : undefined
        }
      >
        {!participant.isLocal && <FriendButton username={participant.identity} name={participant.name}/>}
        {/* Header do Card com Avatar do Usuário */}
        <div className="flex items-center justify-between border-b border-purple-900/30 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-black text-base shadow-md">
              {participant.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">{participant.name}</h3>
              <p className="text-[11px] text-purple-300/60 font-medium">
                {participant.isLocal ? 'Seu volume local' : 'Configuração de áudio'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-purple-950/60 hover:bg-purple-900 text-purple-300 hover:text-white flex items-center justify-center text-xs transition"
          >
            ✕
          </button>
        </div>

        {/* Controle Deslizante de Volume (0% a 200%) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-purple-300">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
              {isMuted ? '🔇 Mudo' : volume > 100 ? '🔊 Alto' : volume < 50 ? '🔈 Baixo' : '🔉 Volume'}
            </span>
            <span className="font-mono text-white text-sm font-bold bg-purple-950/60 border border-purple-800/40 px-2 py-0.5 rounded-lg">
              {volume}%
            </span>
          </div>

          <div className="relative flex items-center py-1">
            <input
              type="range"
              min="0"
              max="200"
              step="1"
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="w-full h-2 bg-[#0d0a17] rounded-lg appearance-none cursor-pointer accent-purple-500 border border-purple-900/50"
            />
          </div>

          {/* Atalhos Rápidos: Mudo, 100% e 200% */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              onClick={() => onVolumeChange(0)}
              className={`py-1.5 rounded-xl text-xs font-medium border transition ${
                isMuted
                  ? 'bg-red-600/30 border-red-500 text-red-200'
                  : 'bg-purple-950/40 border-purple-900/40 text-purple-300 hover:bg-purple-900/50 hover:text-white'
              }`}
            >
              🔇 Silenciar
            </button>
            <button
              onClick={() => onVolumeChange(100)}
              className={`py-1.5 rounded-xl text-xs font-medium border transition ${
                volume === 100
                  ? 'bg-purple-600/30 border-purple-400 text-white'
                  : 'bg-purple-950/40 border-purple-900/40 text-purple-300 hover:bg-purple-900/50 hover:text-white'
              }`}
            >
              100% Padrão
            </button>
            <button
              onClick={() => onVolumeChange(200)}
              className={`py-1.5 rounded-xl text-xs font-medium border transition ${
                volume === 200
                  ? 'bg-indigo-600/30 border-indigo-400 text-white'
                  : 'bg-purple-950/40 border-purple-900/40 text-purple-300 hover:bg-purple-900/50 hover:text-white'
              }`}
            >
              🚀 200% Max
            </button>
          </div>
        </div>

        {/* Botão Concluir */}
        {!participant.isLocal && participant.isScreenShareEnabled && <StreamVolumeControl identity={participant.identity} name={participant.name}/>}
        <button
          onClick={onClose}
          className="mt-5 w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-purple-950/40"
        >
          Salvar
        </button>
      </div>
    </div>
  )
}
