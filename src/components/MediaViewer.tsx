import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ControlIcon } from './ControlIcon'
import './media-viewer.css'

export type MediaSource = {
  src: string
  name: string
  // Arquivo no armazenamento da comunidade: baixar e abrir no navegador usam um link assinado novo.
  storageId?: string
  caption?: string
}

export function downloadMedia(media: MediaSource) {
  if (media.storageId) {
    void window.contalkDesktop?.downloadStorageFile?.(media.storageId).catch(() => {})
    return
  }
  const link = document.createElement('a')
  link.href = media.src
  link.download = media.name || 'arquivo'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function MediaViewer({ media, onClose }: { media: MediaSource; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false)
  const [rotation, setRotation] = useState(0)
  const closeButton = useRef<HTMLButtonElement>(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeButton.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); close.current() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('keydown', onKey, true); previous?.focus?.() }
  }, [])

  const canOpenExternally = !!media.storageId && !!window.contalkDesktop?.openStorageFile

  return createPortal(
    <div className="ct-viewer" role="dialog" aria-modal="true" aria-label={media.name} onClick={onClose}>
      <div className="ct-viewer-toolbar" onClick={event => event.stopPropagation()}>
        <div className="ct-viewer-actions">
          <button type="button" title={zoomed ? 'Reduzir' : 'Ampliar'} aria-label={zoomed ? 'Reduzir' : 'Ampliar'} aria-pressed={zoomed} onClick={() => setZoomed(value => !value)}>
            <ControlIcon name={zoomed ? 'zoomOut' : 'zoomIn'} size={18} />
          </button>
          <button type="button" title="Girar" aria-label="Girar" onClick={() => setRotation(value => (value + 90) % 360)}>
            <ControlIcon name="rotate" size={18} />
          </button>
          <button type="button" title="Baixar" aria-label="Baixar" onClick={() => downloadMedia(media)}>
            <ControlIcon name="download" size={18} />
          </button>
          {canOpenExternally && (
            <button type="button" title="Abrir no navegador" aria-label="Abrir no navegador" onClick={() => void window.contalkDesktop?.openStorageFile(media.storageId!).catch(() => {})}>
              <ControlIcon name="external" size={18} />
            </button>
          )}
        </div>
        <button ref={closeButton} type="button" className="ct-viewer-close" title="Fechar (Esc)" aria-label="Fechar" onClick={onClose}>
          <ControlIcon name="close" size={18} />
        </button>
      </div>
      <div className={`ct-viewer-stage ${zoomed ? 'is-zoomed' : ''}`} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
        <img
          src={media.src}
          alt={media.name}
          draggable={false}
          style={{ transform: `rotate(${rotation}deg)` }}
          onClick={event => { event.stopPropagation(); setZoomed(value => !value) }}
        />
      </div>
      {media.caption && <p className="ct-viewer-caption" onClick={event => event.stopPropagation()}>{media.caption}</p>}
    </div>,
    document.body
  )
}

// Imagem do chat no estilo do Discord: só a mídia, sem nome nem botão. Clique abre o visualizador.
export function ChatImage({ media, onError }: { media: MediaSource; onError?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="ct-media ct-media-image" aria-label={`Abrir imagem ${media.name}`} onClick={() => setOpen(true)}>
        <img src={media.src} alt={media.name} loading="lazy" referrerPolicy="no-referrer" draggable={false} onError={onError} />
      </button>
      {open && <MediaViewer media={media} onClose={() => setOpen(false)} />}
    </>
  )
}

// Vídeo do chat: só o player; o download fica num botão discreto que aparece ao passar o mouse.
export function ChatVideo({ media, poster }: { media: MediaSource; poster?: string }) {
  return (
    <div className="ct-media ct-media-video">
      <video controls preload="metadata" src={media.src} poster={poster} />
      <div className="ct-media-hover-actions">
        <button type="button" title="Baixar" aria-label={`Baixar ${media.name}`} onClick={() => downloadMedia(media)}>
          <ControlIcon name="download" size={16} />
        </button>
      </div>
    </div>
  )
}
