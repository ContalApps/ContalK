import { useEffect, useState } from 'react'
import type { LinkPreviewData } from '../types/desktop'
import { ControlIcon } from './ControlIcon'

const memoryCache = new Map<string, LinkPreviewData | null>()

export function LinkPreview({ url }: { url: string }) {
  const [data, setData] = useState<LinkPreviewData | null>(() => memoryCache.get(url) || null)
  const [imageFailed, setImageFailed] = useState(false)
  const [faviconFailed, setFaviconFailed] = useState(false)
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    if (memoryCache.has(url)) {
      setData(memoryCache.get(url) || null)
      return
    }

    let active = true

    const fetchMeta = async () => {
      try {
        if (window.contalkDesktop?.fetchLinkPreview) {
          const res = await window.contalkDesktop.fetchLinkPreview(url)
          if (active) {
            memoryCache.set(url, res)
            setData(res)
          }
        } else {
          const target = new URL(url)
          const isDirectImg = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(target.pathname)
          const fallback: LinkPreviewData = {
            url: target.href,
            title: isDirectImg
              ? target.pathname.split('/').filter(Boolean).pop() || target.hostname
              : target.hostname,
            description: target.pathname === '/' ? 'Abrir site' : decodeURI(target.pathname),
            image: isDirectImg ? target.href : undefined,
            siteName: target.hostname,
            favicon: `${target.origin}/favicon.ico`
          }
          if (active) {
            memoryCache.set(url, fallback)
            setData(fallback)
          }
        }
      } catch {
        if (active) {
          try {
            const target = new URL(url)
            const fallback: LinkPreviewData = {
              url: target.href,
              title: target.hostname,
              description: target.pathname === '/' ? 'Abrir site' : decodeURI(target.pathname),
              siteName: target.hostname
            }
            memoryCache.set(url, fallback)
            setData(fallback)
          } catch {
            memoryCache.set(url, null)
            setData(null)
          }
        }
      }
    }

    void fetchMeta()
    return () => {
      active = false
    }
  }, [url])

  try {
    const targetUrl = new URL(url)
    const title = data?.title || targetUrl.hostname
    const desc = data?.description || (targetUrl.pathname === '/' ? 'Abrir site' : decodeURI(targetUrl.pathname))
    const siteName = data?.siteName || targetUrl.hostname
    const image = !imageFailed ? data?.image : undefined
    const favicon = !faviconFailed ? data?.favicon : undefined
    const isDirectImage = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(targetUrl.pathname)

    return (
      <a
        className="ct-link-preview"
        href={targetUrl.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Prévia do link: ${title}`}
      >
        <div className="ct-link-preview-header">
          {favicon ? (
            <img
              src={favicon}
              alt=""
              className="ct-link-preview-favicon"
              onError={() => setFaviconFailed(true)}
            />
          ) : (
            <ControlIcon name="link" size={13} />
          )}
          <span className="ct-link-preview-sitename">{siteName}</span>
        </div>

        <strong className="ct-link-preview-title">{title}</strong>

        {desc && desc !== title && <p className="ct-link-preview-desc">{desc}</p>}

        {image && (
          <div
            className="ct-link-preview-thumb"
            onClick={e => {
              if (isDirectImage) {
                e.preventDefault()
                e.stopPropagation()
                setZoomed(true)
              }
            }}
          >
            <img
              src={image}
              alt={title}
              loading="lazy"
              onError={() => setImageFailed(true)}
            />
          </div>
        )}

        {zoomed && isDirectImage && (
          <div
            role="dialog"
            aria-modal="true"
            className="ct-modal-backdrop"
            onClick={e => {
              e.preventDefault()
              e.stopPropagation()
              setZoomed(false)
            }}
            style={{
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.85)',
              cursor: 'zoom-out'
            }}
          >
            <img
              src={image}
              alt={title}
              style={{
                maxWidth: '90vw',
                maxHeight: '90vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.8)'
              }}
            />
          </div>
        )}
      </a>
    )
  } catch {
    return null
  }
}
