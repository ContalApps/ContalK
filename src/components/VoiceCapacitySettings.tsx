import { useEffect, useState } from 'react'
import { can } from '../roles/permissions'
import { DEFAULT_VOICE_CAPACITY, MAX_VOICE_CAPACITY } from '../roles/voice-capacity'
import { useRoleStore } from '../store/useRoleStore'

export function VoiceCapacitySettings({ channelId, serverId }: { channelId: string; serverId: string }) {
  const { snapshot, status, busy, command } = useRoleStore()
  const channel = snapshot?.channels.find(channel => channel.id === channelId)
  const current = channel?.voiceCapacity ?? DEFAULT_VOICE_CAPACITY
  const [draft, setDraft] = useState(String(current))
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => setDraft(String(current)), [channelId, serverId, current])

  if (snapshot?.id !== serverId || channel?.type !== 'voice' || !can(snapshot.policy, snapshot.actor, 'ADMINISTRATOR')) return null

  const capacity = Number(draft)
  const ready = status === 'connected' && !busy
  const valid = Number.isInteger(capacity) && capacity >= 1 && capacity <= MAX_VOICE_CAPACITY && capacity !== current

  return (
    <section className="ct-voice-mode-card" aria-label="Limite de participantes">
      <div className="ct-voice-mode-header">
        <div>
          <h3>Limite de participantes</h3>
          <p>De 1 a {MAX_VOICE_CAPACITY} pessoas. Reduzir o limite mantém quem já está na chamada.</p>
        </div>
      </div>
      <form onSubmit={async event => {
        event.preventDefault()
        if (!ready || !valid) return
        setError('')
        setSaved(false)
        try {
          await command({ type: 'channel-voice-capacity', channelId, capacity })
          setSaved(true)
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Não foi possível salvar o limite.')
        }
      }}>
        <label htmlFor="voice-capacity">Máximo de pessoas</label>
        <input id="voice-capacity" type="number" min={1} max={MAX_VOICE_CAPACITY} step={1} required
          value={draft} disabled={!ready} onChange={event => {
            setDraft(event.target.value)
            setSaved(false)
            setError('')
          }} />
        <button className="ct-primary" disabled={!ready || !valid}>Salvar limite</button>
      </form>
      {saved && <p role="status">Limite atualizado.</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
