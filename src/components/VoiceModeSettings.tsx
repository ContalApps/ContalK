import { useState } from 'react'
import { useRoleStore } from '../store/useRoleStore'
import { can } from '../roles/permissions'
import { ControlIcon } from './ControlIcon'

export function VoiceModeSettings({ channelId }: { channelId: string }) {
  const state = useRoleStore()
  const snapshot = state.snapshot
  const channel = snapshot?.channels.find(channel => channel.id === channelId)
  const mode = channel?.voiceMode || 'conversation'
  const [draft, setDraft] = useState(mode)
  const [base, setBase] = useState(mode)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')

  if (!snapshot || channel?.type !== 'voice') return null

  const allowed = state.status === 'connected' && can(snapshot.policy, snapshot.actor, 'MANAGE_CHANNELS', channelId)
  const conflict = base !== mode
  const isDirty = draft !== mode

  const save = async () => {
    setError('')
    try {
      await state.command({ type: 'channel-voice-mode', channelId, mode: draft })
      setBase(draft)
      setConfirm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível alterar o modo.')
    }
  }

  return (
    <section className="ct-voice-mode-card" aria-label="Modo do canal de voz">
      <div className="ct-voice-mode-header">
        <div>
          <h3>Modo do canal de voz</h3>
          <p>Alterne entre conversa livre com microfone aberto ou apresentação moderada em palco e plateia.</p>
        </div>
        <span className={`ct-badge-mode ${mode === 'stage' ? 'stage' : 'conversation'}`}>
          {mode === 'stage' ? 'Palco e Plateia' : 'Conversa Livre'}
        </span>
      </div>

      <div className="ct-voice-mode-selector">
        <label htmlFor="ct-voice-mode-select">Tipo de participação:</label>
        <select
          id="ct-voice-mode-select"
          aria-label="Modo do canal de voz"
          disabled={!allowed || state.busy}
          value={draft}
          onChange={event => {
            setDraft(event.target.value as typeof draft)
            setConfirm(false)
          }}
        >
          <option value="conversation">Conversa livre (todos os membros podem falar)</option>
          <option value="stage">Palco e plateia (apenas moderadores e palestrantes convidados)</option>
        </select>
      </div>

      <p className="ct-voice-mode-explanation">
        {draft === 'stage'
          ? 'No formato palco e plateia, os participantes entram ouvindo como ouvintes. Moderadores podem convidar pessoas para falar ou autorizar pedidos da plateia.'
          : 'No formato conversa livre, todos que entram na sala transmitem e conversam normalmente sem precisar de autorização.'}
      </p>

      {conflict && (
        <div className="ct-conflict-notice" role="status">
          <span>O modo foi alterado por outro moderador.</span>
          <button
            type="button"
            className="ct-secondary"
            onClick={() => { setBase(mode); setDraft(mode); setConfirm(false) }}
          >
            Carregar modo atual
          </button>
        </div>
      )}

      <div className="ct-voice-mode-actions">
        <button
          type="button"
          className="ct-primary ct-mode-apply-btn"
          disabled={!allowed || state.busy || conflict || !isDirty}
          onClick={() => setConfirm(true)}
        >
          <ControlIcon name="check" size={14} />
          <span>
            {!isDirty
              ? `Modo "${mode === 'stage' ? 'Palco e plateia' : 'Conversa livre'}" já está ativo`
              : `Aplicar modo: ${draft === 'stage' ? 'Palco e plateia' : 'Conversa livre'}`}
          </span>
        </button>
      </div>

      {confirm && (
        <div className="ct-confirm-box" role="alertdialog" aria-label="Confirmar alteração do modo de voz">
          <div className="ct-confirm-box-header">
            <ControlIcon name="alert" size={15} />
            <strong>Confirmar alteração do canal</strong>
          </div>
          <p>
            Deseja alterar este canal para <strong>{draft === 'stage' ? 'Palco e plateia' : 'Conversa livre'}</strong>?
            {draft === 'stage' && ' Transmissões de áudio em andamento serão interrompidas e os membros deverão subir ao palco para falar.'}
          </p>
          <div className="ct-confirm-actions">
            <button
              type="button"
              className="ct-secondary"
              disabled={state.busy}
              onClick={() => setConfirm(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="ct-primary"
              disabled={!allowed || state.busy || conflict}
              onClick={() => void save()}
            >
              {state.busy ? 'Aplicando…' : 'Confirmar e Alterar Modo'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="ct-error-message" role="alert">{error}</p>}
    </section>
  )
}
