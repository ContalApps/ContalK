import { useState, useMemo } from 'react'
import type { Server } from '../store/useAppStore'
import { useCommunityStore } from '../store/useCommunityStore'
import { uploadDroppedFile } from '../utils/dropUpload'
import { ControlIcon } from './ControlIcon'

interface DropChannelSelectModalProps {
  files: File[]
  servers: Server[]
  activeServerId: string
  activeChannelId?: string
  onClose: () => void
  onSuccess: (serverId: string, channelId: string) => void
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export function DropChannelSelectModal({
  files,
  servers,
  activeServerId,
  activeChannelId,
  onClose,
  onSuccess,
}: DropChannelSelectModalProps) {
  const community = useCommunityStore()

  // Collect all text channels
  const textChannels = useMemo(() => {
    const list: Array<{ serverId: string; serverName: string; channelId: string; channelName: string }> = []
    for (const s of servers) {
      for (const ch of s.channels) {
        if (ch.type === 'text') {
          list.push({ serverId: s.id, serverName: s.name, channelId: ch.id, channelName: ch.name })
        }
      }
    }
    return list
  }, [servers])

  // Initial selection
  const initialTarget = useMemo(() => {
    const current = textChannels.find(c => c.channelId === activeChannelId)
    if (current) return { serverId: current.serverId, channelId: current.channelId }
    const serverDefault = textChannels.find(c => c.serverId === activeServerId)
    if (serverDefault) return { serverId: serverDefault.serverId, channelId: serverDefault.channelId }
    if (textChannels.length > 0) return { serverId: textChannels[0].serverId, channelId: textChannels[0].channelId }
    return { serverId: '', channelId: '' }
  }, [textChannels, activeChannelId, activeServerId])

  const [selectedChannelId, setSelectedChannelId] = useState(initialTarget.channelId)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleSend = async () => {
    if (!selectedChannelId) {
      setError('Selecione um canal para enviar o arquivo.')
      return
    }
    const target = textChannels.find(c => c.channelId === selectedChannelId)
    if (!target) {
      setError('Canal selecionado inválido.')
      return
    }

    setBusy(true)
    setError('')

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const attachment = await uploadDroppedFile(file)
        // Send comment with first file, or empty string for subsequent files
        const msgText = i === 0 ? comment.trim() : ''
        await community.sendMessage(target.channelId, msgText, undefined, attachment)
      }
      onSuccess(target.serverId, target.channelId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar arquivo.')
      setBusy(false)
    }
  }

  return (
    <div className="ct-modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="ct-drop-modal" role="dialog" aria-modal="true" aria-labelledby="ct-drop-title">
        <header className="ct-drop-modal-header">
          <div className="ct-drop-modal-title-row">
            <ControlIcon name="file" size={20} />
            <h2 id="ct-drop-title">Enviar arquivo para um canal</h2>
          </div>
          <button
            type="button"
            className="ct-modal-close"
            aria-label="Fechar"
            onClick={onClose}
            disabled={busy}
          >
            <ControlIcon name="close" size={16} />
          </button>
        </header>

        <div className="ct-drop-modal-body">
          <div className="ct-drop-files-list">
            {files.map((file, idx) => (
              <div key={idx} className="ct-drop-file-item">
                <span className="ct-drop-file-icon">
                  <ControlIcon name="file" size={18} />
                </span>
                <div className="ct-drop-file-details">
                  <strong className="ct-drop-file-name" title={file.name}>{file.name}</strong>
                  <span className="ct-drop-file-size">{formatBytes(file.size)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="ct-drop-field">
            <label htmlFor="ct-drop-channel-select" className="ct-drop-label">
              Em qual canal você deseja enviar?
            </label>
            {textChannels.length === 0 ? (
              <p className="ct-drop-empty">Nenhum canal de texto disponível.</p>
            ) : (
              <select
                id="ct-drop-channel-select"
                className="ct-drop-select"
                value={selectedChannelId}
                disabled={busy}
                onChange={e => {
                  setSelectedChannelId(e.target.value)
                  setError('')
                }}
              >
                {servers.map(s => {
                  const chs = s.channels.filter(c => c.type === 'text')
                  if (!chs.length) return null
                  return (
                    <optgroup key={s.id} label={s.name}>
                      {chs.map(c => (
                        <option key={c.id} value={c.id}>
                          #{c.name}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
            )}
          </div>

          <div className="ct-drop-field">
            <label htmlFor="ct-drop-comment-input" className="ct-drop-label">
              Mensagem (opcional)
            </label>
            <textarea
              id="ct-drop-comment-input"
              className="ct-drop-textarea"
              placeholder="Adicione um comentário ou legenda..."
              value={comment}
              maxLength={2000}
              disabled={busy}
              onChange={e => setComment(e.target.value)}
              rows={2}
            />
          </div>

          {error && <p className="ct-drop-error" role="alert">{error}</p>}
        </div>

        <footer className="ct-drop-modal-footer">
          <button
            type="button"
            className="ct-btn ct-btn-secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="ct-btn ct-primary"
            onClick={() => void handleSend()}
            disabled={busy || !selectedChannelId || textChannels.length === 0}
          >
            {busy ? 'Enviando...' : `Enviar ${files.length > 1 ? `(${files.length})` : ''}`}
          </button>
        </footer>
      </div>
    </div>
  )
}
