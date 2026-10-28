import { useState } from 'react'
import { ControlIcon } from './ControlIcon'

export function AiGeneratedImage({
  src,
  alt = 'Imagem gerada por IA',
  caption
}: {
  src: string
  alt?: string
  caption?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)

  const handleCopy = async () => {
    try {
      if (src.startsWith('data:image/')) {
        const response = await fetch(src)
        const blob = await response.blob()
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      } else {
        await navigator.clipboard.writeText(src)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      try {
        await navigator.clipboard.writeText(src)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div className="ct-ai-generated-image-container">
      <div className="ct-ai-image-card">
        <div className="ct-ai-image-wrapper" onClick={() => setExpanded(!expanded)}>
          {!error ? (
            <img
              src={src}
              alt={alt}
              className={`ct-ai-image ${expanded ? 'is-expanded' : ''}`}
              loading="lazy"
              onError={() => setError(true)}
            />
          ) : (
            <div className="ct-ai-image-error">
              <ControlIcon name="alert" size={24} />
              <span>Não foi possível carregar esta imagem gerada.</span>
            </div>
          )}
        </div>
        <div className="ct-ai-image-toolbar">
          <div className="ct-ai-image-meta">
            <span className="ct-ai-image-badge">
              <ControlIcon name="ai" size={13} />
              <span>Imagem gerada por IA</span>
            </span>
            {caption && <span className="ct-ai-image-caption" title={caption}>{caption}</span>}
          </div>
          <div className="ct-ai-image-actions">
            <button
              type="button"
              className="ct-ai-image-btn"
              title={expanded ? 'Diminuir' : 'Ampliar imagem'}
              aria-label={expanded ? 'Diminuir' : 'Ampliar imagem'}
              onClick={() => setExpanded(!expanded)}
            >
              <ControlIcon name="search" size={13} />
            </button>
            <button
              type="button"
              className="ct-ai-image-btn"
              title={copied ? 'Copiado!' : 'Copiar imagem'}
              aria-label="Copiar imagem"
              onClick={handleCopy}
            >
              <ControlIcon name={copied ? 'check' : 'copy'} size={13} />
            </button>
            <a
              href={src}
              download={`imagem-ia-${Date.now()}.png`}
              className="ct-ai-image-btn"
              title="Baixar imagem"
              aria-label="Baixar imagem"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ControlIcon name="download" size={13} />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
