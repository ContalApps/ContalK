import { useEffect, useState } from 'react'

// Minimizar, maximizar/restaurar e fechar desenhados pelo app (a barra nativa do Windows foi desligada).
export function WindowControls() {
  const desktop = window.contalkDesktop
  const [maximized, setMaximized] = useState(false)
  useEffect(() => {
    if (!desktop?.onWindowMaximized) return
    void desktop.isWindowMaximized?.().then(setMaximized).catch(() => {})
    return desktop.onWindowMaximized(setMaximized)
  }, [desktop])
  if (!desktop?.windowControl) return null
  const act = (action: 'minimize' | 'maximize' | 'close') => { void desktop.windowControl!(action).then(value => { if (action === 'maximize') setMaximized(value) }).catch(() => {}) }
  return (
    <div className="ct-window-controls">
      <button type="button" aria-label="Minimizar" title="Minimizar" onClick={() => act('minimize')}>
        <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 5h8" /></svg>
      </button>
      <button type="button" aria-label={maximized ? 'Restaurar' : 'Maximizar'} title={maximized ? 'Restaurar' : 'Maximizar'} onClick={() => act('maximize')}>
        {maximized
          ? <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2.5 3.5h4v4h-4z M3.5 2.5h4v4" /></svg>
          : <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 1.5h7v7h-7z" /></svg>}
      </button>
      <button type="button" className="ct-window-close" aria-label="Fechar" title="Fechar" onClick={() => act('close')}>
        <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" /></svg>
      </button>
    </div>
  )
}
