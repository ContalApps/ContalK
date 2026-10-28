import { BrowserWindow, ipcMain } from 'electron'
import { URL } from 'node:url'
import type { LinkPreviewData } from '../src/types/desktop'

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .trim()
}

function isPrivateHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true
  if (/^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname)) return true
  return false
}

function extractMeta(html: string, urlStr: string): LinkPreviewData {
  const targetUrl = new URL(urlStr)
  let title = ''
  let description = ''
  let image = ''
  let siteName = ''
  let favicon = ''

  const metaRegex = /<meta\s+([^>]*?)>/gi
  let match: RegExpExecArray | null

  while ((match = metaRegex.exec(html)) !== null) {
    const attrs = match[1]
    const propMatch = /(?:property|name)=["']([^"']*)["']/i.exec(attrs)
    const contentMatch = /content=["']([^"']*)["']/i.exec(attrs)
    if (!propMatch || !contentMatch) continue

    const prop = propMatch[1].toLowerCase()
    const content = contentMatch[1]

    if (!title && (prop === 'og:title' || prop === 'twitter:title')) {
      title = decodeHtmlEntities(content)
    } else if (!description && (prop === 'og:description' || prop === 'twitter:description' || prop === 'description')) {
      description = decodeHtmlEntities(content)
    } else if (!image && (prop === 'og:image' || prop === 'twitter:image' || prop === 'og:image:url' || prop === 'og:image:secure_url')) {
      image = content
    } else if (!siteName && (prop === 'og:site_name' || prop === 'application-name')) {
      siteName = decodeHtmlEntities(content)
    }
  }

  if (!title) {
    const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html)
    if (titleMatch) {
      title = decodeHtmlEntities(titleMatch[1])
    }
  }

  const linkRegex = /<link\s+([^>]*?)>/gi
  while ((match = linkRegex.exec(html)) !== null) {
    const attrs = match[1]
    const relMatch = /rel=["']([^"']*)["']/i.exec(attrs)
    const hrefMatch = /href=["']([^"']*)["']/i.exec(attrs)
    if (relMatch && hrefMatch) {
      const rel = relMatch[1].toLowerCase()
      if (rel.includes('icon')) {
        favicon = hrefMatch[1]
        break
      }
    }
  }

  if (image) {
    try {
      image = new URL(image, targetUrl.href).href
    } catch {
      image = ''
    }
  }
  if (favicon) {
    try {
      favicon = new URL(favicon, targetUrl.href).href
    } catch {
      favicon = ''
    }
  } else {
    favicon = `${targetUrl.origin}/favicon.ico`
  }

  return {
    url: targetUrl.href,
    title: title || targetUrl.hostname,
    description: description.slice(0, 300),
    image,
    siteName: siteName || targetUrl.hostname,
    favicon
  }
}

const previewCache = new Map<string, LinkPreviewData>()

export function setupLinkPreview(window: BrowserWindow) {
  const trusted = (event: Electron.IpcMainInvokeEvent) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
      throw new Error('Origem inválida.')
    }
  }

  ipcMain.handle('link-preview', async (event, urlStr: unknown): Promise<LinkPreviewData | null> => {
    trusted(event)
    if (typeof urlStr !== 'string' || !urlStr.trim() || urlStr.length > 2000) return null

    let targetUrl: URL
    try {
      targetUrl = new URL(urlStr)
      if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') return null
    } catch {
      return null
    }

    if (previewCache.has(targetUrl.href)) {
      return previewCache.get(targetUrl.href)!
    }

    // Direct image file extension
    if (/\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(targetUrl.pathname)) {
      const result: LinkPreviewData = {
        url: targetUrl.href,
        title: targetUrl.pathname.split('/').filter(Boolean).pop() || targetUrl.hostname,
        image: targetUrl.href,
        siteName: targetUrl.hostname,
        favicon: `${targetUrl.origin}/favicon.ico`
      }
      previewCache.set(targetUrl.href, result)
      return result
    }

    if (isPrivateHost(targetUrl.hostname)) {
      const fallback: LinkPreviewData = {
        url: targetUrl.href,
        title: targetUrl.hostname,
        description: targetUrl.pathname === '/' ? 'Abrir site' : decodeURI(targetUrl.pathname),
        siteName: targetUrl.hostname,
        favicon: `${targetUrl.origin}/favicon.ico`
      }
      previewCache.set(targetUrl.href, fallback)
      return fallback
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 6000)

      const response = await fetch(targetUrl.href, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ConTALK/1.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        },
        redirect: 'follow'
      })
      clearTimeout(timeout)

      const contentType = response.headers.get('content-type') || ''
      if (contentType.startsWith('image/')) {
        const result: LinkPreviewData = {
          url: targetUrl.href,
          title: targetUrl.pathname.split('/').filter(Boolean).pop() || targetUrl.hostname,
          image: targetUrl.href,
          siteName: targetUrl.hostname,
          favicon: `${targetUrl.origin}/favicon.ico`
        }
        previewCache.set(targetUrl.href, result)
        return result
      }

      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        const fallback: LinkPreviewData = {
          url: targetUrl.href,
          title: targetUrl.hostname,
          description: targetUrl.pathname === '/' ? 'Abrir site' : decodeURI(targetUrl.pathname),
          siteName: targetUrl.hostname,
          favicon: `${targetUrl.origin}/favicon.ico`
        }
        previewCache.set(targetUrl.href, fallback)
        return fallback
      }

      const reader = response.body?.getReader()
      let html = ''
      if (!reader) {
        const full = await response.text()
        html = full.slice(0, 262144)
      } else {
        let received = 0
        const chunks: Uint8Array[] = []
        while (received < 262144) {
          const { done, value } = await reader.read()
          if (done || !value) break
          chunks.push(value)
          received += value.length
        }
        reader.cancel().catch(() => {})
        html = Buffer.concat(chunks).toString('utf-8')
      }

      const preview = extractMeta(html, response.url || targetUrl.href)

      // Keep cache size bounded
      if (previewCache.size > 200) {
        const firstKey = previewCache.keys().next().value
        if (firstKey) previewCache.delete(firstKey)
      }

      previewCache.set(targetUrl.href, preview)
      return preview
    } catch {
      const fallback: LinkPreviewData = {
        url: targetUrl.href,
        title: targetUrl.hostname,
        description: targetUrl.pathname === '/' ? 'Abrir site' : decodeURI(targetUrl.pathname),
        siteName: targetUrl.hostname,
        favicon: `${targetUrl.origin}/favicon.ico`
      }
      previewCache.set(targetUrl.href, fallback)
      return fallback
    }
  })

  window.once('closed', () => {
    ipcMain.removeHandler('link-preview')
  })
}
