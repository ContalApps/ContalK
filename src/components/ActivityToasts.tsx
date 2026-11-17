import { useToastStore } from '../store/useToastStore'
import { ControlIcon } from './ControlIcon'

export function ActivityToasts({ onOpenCall }: { onOpenCall: () => void }) {
  const { toasts, dismiss } = useToastStore()
  if (!toasts.length) return null
  return (
    <div className="ct-toasts" role="status" aria-live="polite">
      {toasts.map(toast => (
        <div className="ct-toast" data-kind={toast.kind} key={toast.id}>
          <span className="ct-toast-icon"><ControlIcon name={toast.kind === 'live' ? 'screen' : toast.kind === 'voice' ? 'voice' : 'info'} size={16} /></span>
          <button type="button" className="ct-toast-text" onClick={() => { dismiss(toast.id); if (toast.kind !== 'info') onOpenCall() }}>
            <strong>{toast.title}</strong>
            <span>{toast.body}</span>
          </button>
          <button type="button" className="ct-toast-close" aria-label="Fechar aviso" onClick={() => dismiss(toast.id)}><ControlIcon name="close" size={14} /></button>
        </div>
      ))}
    </div>
  )
}
