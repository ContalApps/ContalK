import { BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'

export interface BrowserActionStatus {
  isOpen: boolean
  url: string
  title: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  lastAction?: string
}

let browserWindow: BrowserWindow | null = null
let mainWindowRef: BrowserWindow | null = null
let currentStatus: BrowserActionStatus = {
  isOpen: false,
  url: 'about:blank',
  title: 'Navegador Interno',
  isLoading: false,
  canGoBack: false,
  canGoForward: false
}

function notifyStatus(actionDesc?: string) {
  if (actionDesc) currentStatus.lastAction = actionDesc
  if (browserWindow && !browserWindow.isDestroyed()) {
    currentStatus.isOpen = true
    currentStatus.url = browserWindow.webContents.getURL()
    currentStatus.title = browserWindow.webContents.getTitle() || 'Página Web'
    currentStatus.canGoBack = browserWindow.webContents.canGoBack()
    currentStatus.canGoForward = browserWindow.webContents.canGoForward()
  } else {
    currentStatus.isOpen = false
  }

  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    try {
      mainWindowRef.webContents.send('browser-status-changed', currentStatus)
    } catch { /* ignore */ }
  }
}

export function createBrowserWindow(initialUrl = 'https://www.google.com', show = true): BrowserWindow {
  if (browserWindow && !browserWindow.isDestroyed()) {
    if (initialUrl && initialUrl !== 'about:blank' && browserWindow.webContents.getURL() !== initialUrl) {
      void browserWindow.loadURL(initialUrl)
    }
    if (show) {
      browserWindow.show()
      browserWindow.focus()
    }
    notifyStatus(`Navegando para ${initialUrl}`)
    return browserWindow
  }

  const iconPath = process.env.VITE_PUBLIC ? path.join(process.env.VITE_PUBLIC, 'app-icon.png') : undefined

  browserWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 600,
    minHeight: 400,
    show,
    title: 'ConTALK · Navegador Interno',
    icon: iconPath,
    autoHideMenuBar: true,
    backgroundColor: '#181818',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      javascript: true
    }
  })

  currentStatus.isOpen = true
  currentStatus.url = initialUrl
  currentStatus.isLoading = true

  browserWindow.webContents.on('did-start-loading', () => {
    currentStatus.isLoading = true
    notifyStatus('Carregando página...')
  })

  browserWindow.webContents.on('did-finish-load', () => {
    currentStatus.isLoading = false
    notifyStatus('Página carregada com sucesso')
  })

  browserWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription) => {
    currentStatus.isLoading = false
    notifyStatus(`Falha ao carregar (${errorCode}): ${errorDescription}`)
  })

  browserWindow.on('closed', () => {
    browserWindow = null
    currentStatus.isOpen = false
    notifyStatus('Navegador fechado')
  })

  if (initialUrl) {
    void browserWindow.loadURL(initialUrl)
  }

  notifyStatus(`Navegador aberto em ${initialUrl}`)
  return browserWindow
}

export const browserManager = {
  getStatus(): BrowserActionStatus {
    return { ...currentStatus }
  },

  async open(url = 'https://www.google.com', show = true): Promise<BrowserActionStatus> {
    const formattedUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('about:')
      ? url
      : `https://${url}`
    createBrowserWindow(formattedUrl, show)
    return currentStatus
  },

  async navigate(url: string): Promise<{ success: boolean; url: string; title: string }> {
    const formattedUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('about:')
      ? url
      : `https://${url}`
    const win = createBrowserWindow(formattedUrl, true)
    
    await new Promise<void>((resolve) => {
      const onFinish = () => {
        cleanup()
        resolve()
      }
      const timer = setTimeout(() => {
        cleanup()
        resolve()
      }, 12000)

      function cleanup() {
        clearTimeout(timer)
        if (!win.isDestroyed()) {
          win.webContents.removeListener('did-finish-load', onFinish)
          win.webContents.removeListener('did-fail-load', onFinish)
        }
      }

      win.webContents.once('did-finish-load', onFinish)
      win.webContents.once('did-fail-load', onFinish)
      win.loadURL(formattedUrl).catch(() => resolve())
    })

    notifyStatus(`Navegou para ${formattedUrl}`)
    return {
      success: true,
      url: win.isDestroyed() ? formattedUrl : win.webContents.getURL(),
      title: win.isDestroyed() ? '' : win.webContents.getTitle()
    }
  },

  async click(selector: string): Promise<{ success: boolean; message: string; tag?: string; text?: string }> {
    if (!browserWindow || browserWindow.isDestroyed()) {
      createBrowserWindow('https://www.google.com', true)
    }
    const win = browserWindow!

    const jsCode = `
      (() => {
        const sel = ${JSON.stringify(selector)};
        let el = document.querySelector(sel);
        
        // Seletor inteligente por texto se não achar por querySelector direto
        if (!el) {
          const candidates = Array.from(document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"], span, div'));
          el = candidates.find(c => {
            const t = (c.innerText || c.textContent || '').trim().toLowerCase();
            return t === sel.toLowerCase() || (t.length < 50 && t.includes(sel.toLowerCase()));
          });
        }

        if (!el) {
          const available = Array.from(document.querySelectorAll('button, a, input[type="submit"], [role="button"]'))
            .slice(0, 15)
            .map(b => (b.innerText || b.getAttribute('aria-label') || b.id || b.className || '').trim())
            .filter(Boolean);
          return {
            success: false,
            message: 'Elemento "' + sel + '" não encontrado. Botões e links visíveis: ' + available.join(', ')
          };
        }

        // Scroll suave até o elemento
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Highlight animado de interação pelo Agente ConTALK
        const prevOutline = el.style.outline;
        const prevTransition = el.style.transition;
        el.style.transition = 'all 0.2s ease';
        el.style.outline = '3px solid #3b82f6';
        el.style.boxShadow = '0 0 12px rgba(59, 130, 246, 0.6)';

        setTimeout(() => {
          try {
            el.style.outline = prevOutline;
            el.style.transition = prevTransition;
            el.style.boxShadow = '';
          } catch {}
        }, 1200);

        // Disparo robusto de eventos de clique
        try {
          el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
          el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
          el.click();
        } catch {
          el.click();
        }

        return {
          success: true,
          message: 'Elemento clicado com sucesso.',
          tag: el.tagName,
          text: (el.innerText || el.textContent || '').slice(0, 80).trim()
        };
      })()
    `

    const res = await win.webContents.executeJavaScript(jsCode)
    notifyStatus(`Clicou em "${selector}"`)
    return res
  },

  async type(
    selector: string,
    text: string,
    submit = false
  ): Promise<{ success: boolean; message: string; value?: string }> {
    if (!browserWindow || browserWindow.isDestroyed()) {
      createBrowserWindow('https://www.google.com', true)
    }
    const win = browserWindow!

    const jsCode = `
      (() => {
        const sel = ${JSON.stringify(selector)};
        const textToType = ${JSON.stringify(text)};
        const doSubmit = ${Boolean(submit)};

        let el = document.querySelector(sel);
        if (!el) {
          // Busca por name, placeholder, aria-label ou tipo
          el = document.querySelector('input[name="' + sel + '"], input[placeholder*="' + sel + '" i], textarea[placeholder*="' + sel + '" i], input[type="search"], input[type="text"]');
        }

        if (!el) {
          return { success: false, message: 'Campo de texto "' + sel + '" não encontrado.' };
        }

        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        
        // Simular preenchimento com disparo de eventos nativos
        el.value = textToType;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));

        if (doSubmit) {
          const form = el.closest('form');
          if (form) {
            if (typeof form.requestSubmit === 'function') form.requestSubmit();
            else form.submit();
          } else {
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          }
        }

        return { success: true, message: 'Texto digitado com sucesso.', value: textToType };
      })()
    `

    const res = await win.webContents.executeJavaScript(jsCode)
    notifyStatus(`Digitou "${text}" no campo "${selector}"`)
    return res
  },

  async readContent(selector?: string): Promise<{
    title: string
    url: string
    content: string
    links: Array<{ text: string; href: string }>
    forms: Array<{ name: string; type: string; placeholder: string }>
  }> {
    if (!browserWindow || browserWindow.isDestroyed()) {
      return {
        title: 'Navegador Fechado',
        url: 'about:blank',
        content: 'O navegador interno não está aberto no momento.',
        links: [],
        forms: []
      }
    }
    const win = browserWindow

    const jsCode = `
      (() => {
        const sel = ${JSON.stringify(selector || '')};
        let target = sel ? document.querySelector(sel) : document.body;
        if (!target) target = document.body;

        const clone = target.cloneNode(true);
        // Remover elementos de ruído
        clone.querySelectorAll('script, style, noscript, svg, iframe').forEach(n => n.remove());

        const rawText = clone.innerText || clone.textContent || '';
        const cleanContent = rawText
          .split('\\n')
          .map(l => l.trim())
          .filter(Boolean)
          .join('\\n')
          .slice(0, 3500);

        const links = Array.from(document.querySelectorAll('a[href]'))
          .map(a => ({
            text: (a.innerText || a.textContent || '').trim().slice(0, 60),
            href: a.href
          }))
          .filter(l => l.text && l.href && !l.href.startsWith('javascript:'))
          .slice(0, 15);

        const forms = Array.from(document.querySelectorAll('input, textarea, select'))
          .map(i => ({
            name: i.name || i.id || '',
            type: i.type || 'text',
            placeholder: i.placeholder || ''
          }))
          .slice(0, 10);

        return {
          title: document.title,
          url: window.location.href,
          content: cleanContent,
          links,
          forms
        };
      })()
    `

    const res = await win.webContents.executeJavaScript(jsCode)
    notifyStatus('Leitura de conteúdo realizada')
    return res
  },

  async screenshot(): Promise<{ src: string; url: string; title: string }> {
    if (!browserWindow || browserWindow.isDestroyed()) {
      createBrowserWindow('https://www.google.com', true)
    }
    const win = browserWindow!
    const image = await win.webContents.capturePage()
    const dataUrl = image.toDataURL()
    notifyStatus('Captura de tela realizada')
    return {
      src: dataUrl,
      url: win.webContents.getURL(),
      title: win.webContents.getTitle()
    }
  },

  async scroll(direction: 'up' | 'down' = 'down', amount = 400): Promise<{ success: boolean; direction: string }> {
    if (!browserWindow || browserWindow.isDestroyed()) {
      return { success: false, direction }
    }
    const delta = direction === 'down' ? amount : -amount
    await browserWindow.webContents.executeJavaScript(`window.scrollBy({ top: ${delta}, behavior: 'smooth' });`)
    notifyStatus(`Rolou página ${direction}`)
    return { success: true, direction }
  },

  async evaluate(script: string): Promise<any> {
    if (!browserWindow || browserWindow.isDestroyed()) {
      throw new Error('Navegador interno não está aberto.')
    }
    return browserWindow.webContents.executeJavaScript(script)
  },

  show(): void {
    if (browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.show()
      browserWindow.focus()
    } else {
      createBrowserWindow('https://www.google.com', true)
    }
    notifyStatus('Navegador exibido')
  },

  hide(): void {
    if (browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.hide()
    }
    notifyStatus('Navegador ocultado')
  },

  close(): void {
    if (browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.close()
    }
    browserWindow = null
    currentStatus.isOpen = false
    notifyStatus('Navegador fechado')
  }
}

export function setupInternalBrowser(mainWindow: BrowserWindow) {
  mainWindowRef = mainWindow

  const trusted = (event: Electron.IpcMainInvokeEvent) => {
    if (event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) {
      throw new Error('Origem não autorizada.')
    }
  }

  ipcMain.handle('browser-open', async (event, url?: unknown, show?: unknown) => {
    trusted(event)
    return browserManager.open(typeof url === 'string' ? url : undefined, show !== false)
  })

  ipcMain.handle('browser-navigate', async (event, url: unknown) => {
    trusted(event)
    return browserManager.navigate(String(url))
  })

  ipcMain.handle('browser-click', async (event, selector: unknown) => {
    trusted(event)
    return browserManager.click(String(selector))
  })

  ipcMain.handle('browser-type', async (event, selector: unknown, text: unknown, submit?: unknown) => {
    trusted(event)
    return browserManager.type(String(selector), String(text), Boolean(submit))
  })

  ipcMain.handle('browser-read-content', async (event, selector?: unknown) => {
    trusted(event)
    return browserManager.readContent(typeof selector === 'string' ? selector : undefined)
  })

  ipcMain.handle('browser-screenshot', async (event) => {
    trusted(event)
    return browserManager.screenshot()
  })

  ipcMain.handle('browser-scroll', async (event, direction?: unknown, amount?: unknown) => {
    trusted(event)
    return browserManager.scroll(direction === 'up' ? 'up' : 'down', Number(amount) || 400)
  })

  ipcMain.handle('browser-evaluate', async (event, script: unknown) => {
    trusted(event)
    return browserManager.evaluate(String(script))
  })

  ipcMain.handle('browser-get-status', async (event) => {
    trusted(event)
    return browserManager.getStatus()
  })

  ipcMain.handle('browser-show', async (event) => {
    trusted(event)
    browserManager.show()
    return true
  })

  ipcMain.handle('browser-hide', async (event) => {
    trusted(event)
    browserManager.hide()
    return true
  })

  ipcMain.handle('browser-close', async (event) => {
    trusted(event)
    browserManager.close()
    return true
  })

  mainWindow.once('closed', () => {
    browserManager.close()
    for (const channel of [
      'browser-open',
      'browser-navigate',
      'browser-click',
      'browser-type',
      'browser-read-content',
      'browser-screenshot',
      'browser-scroll',
      'browser-evaluate',
      'browser-get-status',
      'browser-show',
      'browser-hide',
      'browser-close'
    ]) {
      ipcMain.removeHandler(channel)
    }
  })

  return browserManager
}
