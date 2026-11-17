import { useVoiceStore } from '../store/useVoiceStore'
import { useCallClock } from './RightPanel'
import { ControlIcon } from './ControlIcon'

export type CallTab = 'conversa' | 'chamada'

// Abas no topo da área principal enquanto há uma chamada: "Conversa" mostra o que estava aberto
// (canal, Início, mensagens) e "Chamada" mostra o palco com o chat do canal ao lado.
export function CallTabs({ tab, onTab }: { tab: CallTab; onTab: (tab: CallTab) => void }) {
  const voice = useVoiceStore()
  const clock = useCallClock()
  const status = voice.connectionStatus === 'connected' ? clock : voice.connectionStatus === 'reconnecting' ? 'Reconectando…' : 'Conectando…'
  const sharing = voice.participants.find(p => p.isScreenShareEnabled)
  return (
    <nav className="ct-call-tabs" role="tablist" aria-label="Conversa ou chamada">
      <button type="button" role="tab" aria-selected={tab === 'conversa'} onClick={() => onTab('conversa')}>
        <ControlIcon name="chat" size={16} />Conversa
      </button>
      <button type="button" role="tab" aria-selected={tab === 'chamada'} onClick={() => onTab('chamada')}>
        <ControlIcon name="voice" size={16} />Chamada
        {sharing && <span className="ct-call-tabs-live" title={`${sharing.isLocal ? 'Você está' : (sharing.serverNickname || sharing.name) + ' está'} compartilhando a tela`}>AO VIVO</span>}
      </button>
      <span className="ct-call-tabs-status" aria-live="polite">
        <i aria-hidden="true" />{voice.activeChannelName || 'Chamada'}{status && <> · {status}</>}
      </span>
    </nav>
  )
}
