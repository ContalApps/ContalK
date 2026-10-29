import { useState, useEffect } from 'react'
import { ControlIcon } from './ControlIcon'

export interface SaveNoteDestination {
  sendToChannel: boolean
  channelId?: string
  sendToDm: boolean
  friendUsername?: string
}

export interface SaveNoteModalProps {
  isOpen: boolean
  onClose: () => void
  noteTitle: string
  noteContent: string
  availableChannels: Array<{ id: string; name: string; serverName?: string }>
  defaultChannelId?: string
  availableFriends: Array<{ username: string; display_name: string; online?: boolean }>
  defaultFriendUsername?: string
  onConfirm: (dest: SaveNoteDestination) => Promise<void>
}

export function SaveNoteModal({
  isOpen,
  onClose,
  noteTitle,
  noteContent,
  availableChannels,
  defaultChannelId,
  availableFriends,
  defaultFriendUsername,
  onConfirm
}: SaveNoteModalProps) {
  const [sendToChannel, setSendToChannel] = useState(true)
  const [selectedChannelId, setSelectedChannelId] = useState<string>(
    defaultChannelId || (availableChannels[0]?.id ?? '')
  )

  const [sendToDm, setSendToDm] = useState(false)
  const [selectedFriendUsername, setSelectedFriendUsername] = useState<string>(
    defaultFriendUsername || (availableFriends[0]?.username ?? '')
  )

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (defaultChannelId && availableChannels.some(c => c.id === defaultChannelId)) {
      setSelectedChannelId(defaultChannelId)
    } else if (availableChannels.length > 0 && !selectedChannelId) {
      setSelectedChannelId(availableChannels[0].id)
    }
  }, [defaultChannelId, availableChannels])

  useEffect(() => {
    if (defaultFriendUsername && availableFriends.some(f => f.username === defaultFriendUsername)) {
      setSelectedFriendUsername(defaultFriendUsername)
    } else if (availableFriends.length > 0 && !selectedFriendUsername) {
      setSelectedFriendUsername(availableFriends[0].username)
    }
  }, [defaultFriendUsername, availableFriends])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose()
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen) return null

  const canSubmit =
    !isSubmitting &&
    ((sendToChannel && !!selectedChannelId) || (sendToDm && !!selectedFriendUsername))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setIsSubmitting(true)
    setError(null)
    try {
      await onConfirm({
        sendToChannel,
        channelId: sendToChannel ? selectedChannelId : undefined,
        sendToDm,
        friendUsername: sendToDm ? selectedFriendUsername : undefined
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar nota.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={e => {
        if (e.target === e.currentTarget && !isSubmitting) onClose()
      }}
    >
      <div
        className="w-full max-w-md bg-[#16161a] border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col text-neutral-200"
        role="dialog"
        aria-labelledby="save-note-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800/80 bg-[#1a1a1f]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ControlIcon name="docs" size={16} />
            </span>
            <div className="min-w-0">
              <h2 id="save-note-title" className="text-sm font-semibold text-white truncate">
                Salvar Bloco de Notas
              </h2>
              <p className="text-xs text-neutral-400 truncate">
                {noteTitle} · {noteContent.length} caracteres
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            aria-label="Fechar"
          >
            <ControlIcon name="close" size={14} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <p className="text-xs text-neutral-300 leading-relaxed">
            Selecione onde deseja salvar e compartilhar esta nota. Você pode salvar no próprio canal de texto, enviar direto para um amigo por mensagem privada, ou ambos:
          </p>

          {/* Opção 1: Canal de texto */}
          <div
            className={`p-3.5 rounded-lg border transition ${
              sendToChannel
                ? 'bg-neutral-900/90 border-emerald-500/40 shadow-sm'
                : 'bg-neutral-900/30 border-neutral-800 opacity-80'
            }`}
          >
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendToChannel}
                onChange={e => setSendToChannel(e.target.checked)}
                disabled={isSubmitting}
                className="w-4 h-4 rounded border-neutral-700 text-emerald-500 focus:ring-emerald-500/20 bg-neutral-800 cursor-pointer"
              />
              <span className="flex items-center gap-1.5 text-xs font-medium text-white">
                <ControlIcon name="hash" size={13} />
                Salvar no canal de texto
              </span>
            </label>

            {sendToChannel && (
              <div className="mt-2.5 pl-6">
                <label className="block text-[11px] text-neutral-400 mb-1">
                  Canal de texto:
                </label>
                {availableChannels.length > 0 ? (
                  <select
                    value={selectedChannelId}
                    onChange={e => setSelectedChannelId(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-[#111113] border border-neutral-700/80 rounded-md px-2.5 py-1.5 text-xs text-neutral-100 focus:outline-none focus:border-emerald-500 transition"
                  >
                    {availableChannels.map(ch => (
                      <option key={ch.id} value={ch.id}>
                        #{ch.name} {ch.serverName ? `(${ch.serverName})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-amber-400">Nenhum canal de texto disponível.</p>
                )}
              </div>
            )}
          </div>

          {/* Opção 2: Mensagem Direta para Amigo */}
          <div
            className={`p-3.5 rounded-lg border transition ${
              sendToDm
                ? 'bg-neutral-900/90 border-sky-500/40 shadow-sm'
                : 'bg-neutral-900/30 border-neutral-800 opacity-80'
            }`}
          >
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendToDm}
                onChange={e => setSendToDm(e.target.checked)}
                disabled={isSubmitting}
                className="w-4 h-4 rounded border-neutral-700 text-sky-500 focus:ring-sky-500/20 bg-neutral-800 cursor-pointer"
              />
              <span className="flex items-center gap-1.5 text-xs font-medium text-white">
                <ControlIcon name="friends" size={13} />
                Enviar direto para um amigo (Privado)
              </span>
            </label>

            {sendToDm && (
              <div className="mt-2.5 pl-6">
                <label className="block text-[11px] text-neutral-400 mb-1">
                  Amigo ou membro:
                </label>
                {availableFriends.length > 0 ? (
                  <select
                    value={selectedFriendUsername}
                    onChange={e => setSelectedFriendUsername(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-[#111113] border border-neutral-700/80 rounded-md px-2.5 py-1.5 text-xs text-neutral-100 focus:outline-none focus:border-sky-500 transition"
                  >
                    {availableFriends.map(f => (
                      <option key={f.username} value={f.username}>
                        {f.display_name} (@{f.username}) {f.online ? '• Online' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-neutral-400">Nenhum amigo ou membro disponível para envio privado.</p>
                )}
              </div>
            )}
          </div>

          {/* Feedback de erro */}
          {error && (
            <div className="p-2.5 rounded-md bg-red-950/40 border border-red-700/50 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm transition"
            >
              <ControlIcon name="check" size={12} />
              <span>{isSubmitting ? 'Salvando…' : 'Salvar e Compartilhar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
