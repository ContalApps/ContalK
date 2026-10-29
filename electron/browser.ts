import { BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'

export interface BrowserActionStatus {
  isOpen: boolean
  url: string
  title: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  isDetached?: boolean
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

let lastCollaboratorsState: {
  collaborators: any[]
  allowCollaboration: boolean
  isAudioMuted?: boolean
} = {
  collaborators: [],
  allowCollaboration: false,
  isAudioMuted: false
}

function handleDetachedBrowserAction(actionStr: string) {
  const [action, ...rest] = actionStr.split(':')
  const payload = rest.join(':')

  if (action === 'toggle-audio') {
    const nextMuted = !browserManager.isAudioMuted()
    browserManager.setAudioMuted(nextMuted)
    lastCollaboratorsState.isAudioMuted = nextMuted
    void applyDetachedOverlay()
  } else if (action === 'toggle-detach') {
    browserManager.hide()
  } else if (action === 'stop-sharing') {
    browserManager.hide()
  }

  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    try {
      const url = browserWindow && !browserWindow.isDestroyed() ? browserWindow.webContents.getURL() : ''
      const title = browserWindow && !browserWindow.isDestroyed() ? browserWindow.webContents.getTitle() : ''
      mainWindowRef.webContents.send('browser-action-from-detached', { action, payload, url, title })
    } catch {
      // ignore
    }
  }
}

export async function applyDetachedOverlay(data?: {
  collaborators?: any[]
  allowCollaboration?: boolean
  isAudioMuted?: boolean
}): Promise<boolean> {
  if (data) {
    if (Array.isArray(data.collaborators)) lastCollaboratorsState.collaborators = data.collaborators
    if (typeof data.allowCollaboration === 'boolean') lastCollaboratorsState.allowCollaboration = data.allowCollaboration
    if (typeof data.isAudioMuted === 'boolean') lastCollaboratorsState.isAudioMuted = data.isAudioMuted
  }

  if (!browserWindow || browserWindow.isDestroyed()) return false
  if (typeof (browserWindow.webContents as any).isLoadingMainFrame === 'function' && (browserWindow.webContents as any).isLoadingMainFrame()) return false

  const script = `
    (() => {
      try {
        const data = ${JSON.stringify(lastCollaboratorsState)};
        let overlay = document.getElementById('contalk-detached-overlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'contalk-detached-overlay';
          overlay.setAttribute('style', 'position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;pointer-events:none!important;z-index:2147483647!important;overflow:hidden!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;');
          (document.body || document.documentElement).appendChild(overlay);
        }

        let style = document.getElementById('contalk-detached-style');
        if (!style) {
          style = document.createElement('style');
          style.id = 'contalk-detached-style';
          style.textContent = \`
            @keyframes ctPulseDot {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.35; transform: scale(0.85); }
            }
            @keyframes ctRippleAnim {
              0% { transform: translate(-50%, -50%) scale(0.2); opacity: 1; }
              100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
            }
            .ct-bar-btn {
              background: rgba(255, 255, 255, 0.08);
              border: 1px solid rgba(255, 255, 255, 0.16);
              color: #f1f5f9;
              font-size: 11px;
              font-weight: 500;
              padding: 4px 10px;
              border-radius: 9999px;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              gap: 5px;
              transition: all 0.15s ease;
              user-select: none;
            }
            .ct-bar-btn:hover {
              background: rgba(255, 255, 255, 0.18);
              border-color: rgba(255, 255, 255, 0.3);
            }
            .ct-bar-btn-active {
              background: rgba(16, 185, 129, 0.22) !important;
              border-color: rgba(16, 185, 129, 0.5) !important;
              color: #34d399 !important;
            }
            .ct-bar-btn-danger {
              background: rgba(239, 68, 68, 0.22) !important;
              border-color: rgba(239, 68, 68, 0.45) !important;
              color: #fca5a5 !important;
            }
            .ct-bar-btn-danger:hover {
              background: rgba(239, 68, 68, 0.35) !important;
            }
            .ct-ai-item {
              padding: 7px 10px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 11px;
              color: #e2e8f0;
              display: flex;
              align-items: center;
              gap: 6px;
              transition: background 0.12s ease;
            }
            .ct-ai-item:hover {
              background: rgba(255, 255, 255, 0.12);
              color: #fff;
            }
          \`;
          (document.head || document.documentElement).appendChild(style);
        }

        let bar = document.getElementById('contalk-floating-bar');
        if (!bar) {
          bar = document.createElement('div');
          bar.id = 'contalk-floating-bar';
          bar.setAttribute('style', 'position:fixed;top:10px;left:50%;transform:translateX(-50%);pointer-events:auto;display:flex;align-items:center;gap:7px;background:rgba(18,18,18,0.94);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.14);box-shadow:0 10px 30px rgba(0,0,0,0.6);padding:5px 12px;border-radius:9999px;color:#e2e8f0;z-index:2147483647;');
          overlay.appendChild(bar);
        }

        const allowCollab = Boolean(data.allowCollaboration);
        const isMuted = Boolean(data.isAudioMuted);

        bar.innerHTML = \`
          <div style="display:flex;align-items:center;gap:6px;padding-right:4px;">
            <span style="width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e;animation:ctPulseDot 2s infinite ease-in-out;"></span>
            <strong style="font-size:11px;font-weight:700;letter-spacing:0.3px;color:#fff;">ConTALK</strong>
          </div>
          <div style="width:1px;height:14px;background:rgba(255,255,255,0.16);"></div>
          <button id="ct-act-collab" class="ct-bar-btn \${allowCollab ? 'ct-bar-btn-active' : ''}">
            \${allowCollab ? '👥 Colaboração Ativa' : '🔒 Colaboração Pausada'}
          </button>
          <button id="ct-act-audio" class="ct-bar-btn \${isMuted ? 'ct-bar-btn-danger' : ''}">
            \${isMuted ? '🔇 Mudo' : '🔊 Áudio'}
          </button>
          <div style="position:relative;">
            <button id="ct-act-ai-toggle" class="ct-bar-btn" style="background:rgba(168,85,247,0.18);border-color:rgba(168,85,247,0.4);color:#d8b4fe;">
              ✦ Automação IA ▾
            </button>
            <div id="ct-ai-menu" style="display:none;position:absolute;top:calc(100% + 8px);left:50%;transform:translateX(-50%);background:#181818;border:1px solid rgba(255,255,255,0.18);border-radius:10px;padding:6px;box-shadow:0 12px 32px rgba(0,0,0,0.8);min-width:215px;z-index:2147483647;">
              <div class="ct-ai-item" id="ct-ai-action-summarize">
                <span>✦</span> <strong>Resumir página no chat</strong>
              </div>
              <div class="ct-ai-item" id="ct-ai-action-automate">
                <span>⚡</span> <strong>Automatizar ações na página</strong>
              </div>
              <div class="ct-ai-item" id="ct-ai-action-read">
                <span>📄</span> <strong>Extrair dados e formulários</strong>
              </div>
            </div>
          </div>
          <div style="width:1px;height:14px;background:rgba(255,255,255,0.16);"></div>
          <button id="ct-act-hide" class="ct-bar-btn" title="Minimizar navegador para o ConTALK">
            ⤓ Recolher ao App
          </button>
          <button id="ct-act-stop" class="ct-bar-btn ct-bar-btn-danger" title="Encerrar compartilhamento">
            ✕ Parar
          </button>
        \`;

        const btnCollab = document.getElementById('ct-act-collab');
        if (btnCollab) btnCollab.onclick = () => console.log('CONTALK_ACTION:toggle-collab');

        const btnAudio = document.getElementById('ct-act-audio');
        if (btnAudio) btnAudio.onclick = () => console.log('CONTALK_ACTION:toggle-audio');

        const btnAi = document.getElementById('ct-act-ai-toggle');
        const aiMenu = document.getElementById('ct-ai-menu');
        if (btnAi && aiMenu) {
          btnAi.onclick = (e) => {
            e.stopPropagation();
            aiMenu.style.display = aiMenu.style.display === 'none' ? 'block' : 'none';
          };
          document.addEventListener('click', () => {
            if (aiMenu) aiMenu.style.display = 'none';
          });
        }

        const aiSummarize = document.getElementById('ct-ai-action-summarize');
        if (aiSummarize) aiSummarize.onclick = () => console.log('CONTALK_ACTION:ai-summarize');

        const aiAutomate = document.getElementById('ct-ai-action-automate');
        if (aiAutomate) aiAutomate.onclick = () => console.log('CONTALK_ACTION:ai-automate');

        const aiRead = document.getElementById('ct-ai-action-read');
        if (aiRead) aiRead.onclick = () => console.log('CONTALK_ACTION:ai-read');

        const btnHide = document.getElementById('ct-act-hide');
        if (btnHide) btnHide.onclick = () => console.log('CONTALK_ACTION:toggle-detach');

        const btnStop = document.getElementById('ct-act-stop');
        if (btnStop) btnStop.onclick = () => console.log('CONTALK_ACTION:stop-sharing');

        let cursorsContainer = document.getElementById('contalk-cursors-container');
        if (!cursorsContainer) {
          cursorsContainer = document.createElement('div');
          cursorsContainer.id = 'contalk-cursors-container';
          cursorsContainer.setAttribute('style', 'position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;pointer-events:none!important;overflow:hidden!important;');
          overlay.appendChild(cursorsContainer);
        }

        const collabs = Array.isArray(data.collaborators) ? data.collaborators : [];
        let html = '';
        const now = Date.now();

        for (const c of collabs) {
          if (!c || !c.id) continue;
          const x = Math.max(0, Math.min(100, c.xPercent || 0));
          const y = Math.max(0, Math.min(100, c.yPercent || 0));
          const color = c.color || '#38bdf8';
          const name = String(c.name || c.id).replace(/[<>&"]/g, '');

          html += \`
            <div style="position:absolute;left:\${x}%;top:\${y}%;transform:translate(-2px,-2px);pointer-events:none;transition:left 0.06s linear,top 0.06s linear;display:flex;flex-direction:column;align-items:flex-start;z-index:2147483640;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="\${color}" stroke="#000" stroke-width="1.5" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6));">
                <path d="M3 3l7 18 3-7 7-3L3 3z"/>
              </svg>
              <span style="background:\${color};color:#ffffff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,0.5);margin-top:-4px;margin-left:12px;white-space:nowrap;font-family:-apple-system,sans-serif;">
                \${name}
              </span>
            </div>
          \`;

          if (c.lastClick && (now - c.lastClick.time < 700)) {
            const cx = Math.max(0, Math.min(100, c.lastClick.xPercent));
            const cy = Math.max(0, Math.min(100, c.lastClick.yPercent));
            html += \`
              <div style="position:absolute;left:\${cx}%;top:\${cy}%;width:34px;height:34px;border-radius:50%;border:2px solid \${color};background:\${color}33;pointer-events:none;animation:ctRippleAnim 0.6s cubic-bezier(0,0.2,0.8,1) forwards;z-index:2147483639;"></div>
            \`;
          }
        }

        cursorsContainer.innerHTML = html;
      } catch (err) {
        // Overlay update error suppressed
      }
    })();
  `

  try {
    await browserWindow.webContents.executeJavaScript(script)
    return true
  } catch {
    return false
  }
}

function notifyStatus(actionDesc?: string) {
  if (actionDesc) currentStatus.lastAction = actionDesc
  if (browserWindow && !browserWindow.isDestroyed()) {
    currentStatus.isOpen = true
    currentStatus.url = browserWindow.webContents.getURL()
    currentStatus.title = browserWindow.webContents.getTitle() || 'Página Web'
    currentStatus.canGoBack = browserWindow.webContents.canGoBack()
    currentStatus.canGoForward = browserWindow.webContents.canGoForward()
    currentStatus.isDetached = (typeof browserWindow.isVisible === 'function' ? browserWindow.isVisible() : false)
  } else {
    currentStatus.isOpen = false
    currentStatus.isDetached = false
  }

  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    try {
      mainWindowRef.webContents.send('browser-status-changed', currentStatus)
    } catch { /* ignore */ }
  }
}

export function createBrowserWindow(initialUrl = 'https://www.google.com', show = false): BrowserWindow {
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
      javascript: true,
      backgroundThrottling: false
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
    void applyDetachedOverlay()
  })

  browserWindow.webContents.on('console-message', (_e, _level, message) => {
    if (typeof message === 'string' && message.startsWith('CONTALK_ACTION:')) {
      const raw = message.replace('CONTALK_ACTION:', '').trim()
      handleDetachedBrowserAction(raw)
    }
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

  async open(url = 'https://www.google.com', show = false): Promise<BrowserActionStatus> {
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
    const isDetached = Boolean(browserWindow && !browserWindow.isDestroyed() && (typeof browserWindow.isVisible === 'function' ? browserWindow.isVisible() : false))
    const win = createBrowserWindow(formattedUrl, isDetached)
    
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

  async sanitizedScreenshot(): Promise<{
    src: string
    url: string
    title: string
    hasPasswordField: boolean
  }> {
    if (!browserWindow || browserWindow.isDestroyed()) {
      return {
        src: '',
        url: 'about:blank',
        title: '',
        hasPasswordField: false
      }
    }
    const win = browserWindow

    let hasPasswordField = false
    try {
      hasPasswordField = await win.webContents.executeJavaScript(`
        (() => {
          try {
            const pwdInputs = Array.from(document.querySelectorAll(
              'input[type="password"], input[autocomplete*="password"], input[name*="password" i], input[id*="password" i]'
            ));
            if (pwdInputs.length === 0) return false;

            // Insere estilo de proteção visual contra vazamento
            let styleEl = document.getElementById('contalk-pwd-shield-style');
            if (!styleEl) {
              styleEl = document.createElement('style');
              styleEl.id = 'contalk-pwd-shield-style';
              styleEl.textContent = \`
                .ct-pwd-shielded {
                  filter: blur(14px) !important;
                  background-color: #020617 !important;
                  color: transparent !important;
                  caret-color: transparent !important;
                  text-shadow: 0 0 16px rgba(0,0,0,0.9) !important;
                  user-select: none !important;
                }
              \`;
              document.head.appendChild(styleEl);
            }

            pwdInputs.forEach(el => el.classList.add('ct-pwd-shielded'));
            return true;
          } catch {
            return false;
          }
        })()
      `)
    } catch {
      // Ignora erro de script se a página não permitir
    }

    let src = ''
    try {
      const image = await win.webContents.capturePage()
      if (typeof (image as any).toJPEG === 'function') {
        const size = typeof image.getSize === 'function' ? image.getSize() : { width: 0, height: 0 }
        const targetImage = size.width > 1280 && typeof image.resize === 'function' ? image.resize({ width: 1280 }) : image
        const jpeg = (targetImage as any).toJPEG(68)
        src = `data:image/jpeg;base64,${jpeg.toString('base64')}`
      } else {
        src = image.toDataURL()
      }
    } catch {
      src = ''
    }

    // Remove imediatamente a classe de proteção no host para que ele continue usando normalmente se desejar
    try {
      if (hasPasswordField && !win.isDestroyed()) {
        await win.webContents.executeJavaScript(`
          (() => {
            try {
              document.querySelectorAll('.ct-pwd-shielded').forEach(el => el.classList.remove('ct-pwd-shielded'));
            } catch {}
          })()
        `)
      }
    } catch {
      // ignore
    }

    return {
      src,
      url: win.webContents.getURL(),
      title: win.webContents.getTitle(),
      hasPasswordField: Boolean(hasPasswordField)
    }
  },

  async clickAt(xPercent: number, yPercent: number): Promise<{ success: boolean; tag?: string; text?: string; message?: string }> {
    if (!browserWindow || browserWindow.isDestroyed()) {
      return { success: false, message: 'Navegador não está aberto.' }
    }
    const win = browserWindow

    const jsCode = `
      (() => {
        try {
          const x = Math.round((window.innerWidth * ${Math.max(0, Math.min(100, xPercent))}) / 100);
          const y = Math.round((window.innerHeight * ${Math.max(0, Math.min(100, yPercent))}) / 100);
          const rawEl = document.elementFromPoint(x, y);

          if (!rawEl) {
            return { success: false, message: 'Nenhum elemento no ponto' };
          }

          if (rawEl.tagName === 'INPUT' && (rawEl as HTMLInputElement).type === 'password') {
            return { success: false, message: 'Campo de senha protegido contra interação' };
          }

          const el = rawEl.closest('button, a, input, textarea, select, [role="button"], [role="link"], [tabindex]') || rawEl;

          // Wave visual indicator
          const wave = document.createElement('div');
          wave.style.position = 'fixed';
          wave.style.left = (x - 14) + 'px';
          wave.style.top = (y - 14) + 'px';
          wave.style.width = '28px';
          wave.style.height = '28px';
          wave.style.borderRadius = '50%';
          wave.style.border = '2px solid #38bdf8';
          wave.style.backgroundColor = 'rgba(56, 189, 248, 0.35)';
          wave.style.boxShadow = '0 0 15px rgba(56, 189, 248, 0.6)';
          wave.style.pointerEvents = 'none';
          wave.style.zIndex = '2147483647';
          wave.style.transition = 'all 0.45s cubic-bezier(0.1, 0.9, 0.2, 1)';
          document.body.appendChild(wave);
          requestAnimationFrame(() => {
            wave.style.transform = 'scale(2.2)';
            wave.style.opacity = '0';
          });
          setTimeout(() => wave.remove(), 500);

          if (!el) {
            return { success: false, message: 'Nenhum elemento no ponto' };
          }

          // Se for campo de senha, não permite que participantes cliquem para focar/interagir
          if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'password') {
            return { success: false, message: 'Campo de senha protegido contra interação' };
          }

          // Disparar mousedown, mouseup, click
          try {
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window }));
          } catch {}
          el.click();
          if (typeof el.focus === 'function') {
            el.focus();
          }

          return {
            success: true,
            tag: el.tagName,
            text: (el.innerText || el.textContent || (el as HTMLInputElement).value || '').slice(0, 50).trim()
          };
        } catch (err) {
          return { success: false, message: String(err) };
        }
      })()
    `
    try {
      if (typeof (win.webContents as any).sendInputEvent === 'function') {
        const bounds = typeof win.getContentBounds === 'function' ? win.getContentBounds() : { width: 1080, height: 720 };
        const pixelX = Math.round((bounds.width * Math.max(0, Math.min(100, xPercent))) / 100);
        const pixelY = Math.round((bounds.height * Math.max(0, Math.min(100, yPercent))) / 100);
        (win.webContents as any).sendInputEvent({ type: 'mouseDown', x: pixelX, y: pixelY, button: 'left', clickCount: 1 });
        (win.webContents as any).sendInputEvent({ type: 'mouseUp', x: pixelX, y: pixelY, button: 'left', clickCount: 1 });
      }
    } catch {}

    const res = await win.webContents.executeJavaScript(jsCode)
    notifyStatus(`Clique colaborativo em (${xPercent.toFixed(1)}%, ${yPercent.toFixed(1)}%)`)
    return res
  },

  goBack(): boolean {
    if (browserWindow && !browserWindow.isDestroyed() && browserWindow.webContents.canGoBack()) {
      browserWindow.webContents.goBack()
      notifyStatus('Voltou página')
      return true
    }
    return false
  },

  goForward(): boolean {
    if (browserWindow && !browserWindow.isDestroyed() && browserWindow.webContents.canGoForward()) {
      browserWindow.webContents.goForward()
      notifyStatus('Avançou página')
      return true
    }
    return false
  },

  reload(): boolean {
    if (browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.webContents.reload()
      notifyStatus('Recarregou página')
      return true
    }
    return false
  },

  async insertText(text: string): Promise<{ success: boolean; message?: string }> {
    if (!browserWindow || browserWindow.isDestroyed()) {
      return { success: false, message: 'Navegador não está aberto.' }
    }
    const win = browserWindow
    if (typeof (win.webContents as any).insertText === 'function') {
      (win.webContents as any).insertText(text)
      notifyStatus(`Digitou "${text.slice(0, 30)}"`)
      return { success: true }
    }
    return { success: false }
  },

  setAudioMuted(muted: boolean): boolean {
    if (browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.webContents.setAudioMuted(muted)
      notifyStatus(muted ? 'Áudio do navegador silenciado' : 'Áudio do navegador ativado')
      return true
    }
    return false
  },

  isAudioMuted(): boolean {
    if (browserWindow && !browserWindow.isDestroyed()) {
      return browserWindow.webContents.isAudioMuted()
    }
    return false
  },

  async sendKey(key: string): Promise<{ success: boolean }> {
    if (!browserWindow || browserWindow.isDestroyed()) {
      return { success: false }
    }
    const win = browserWindow
    if (typeof (win.webContents as any).sendInputEvent === 'function') {
      const keyCode = key === 'Enter' ? 'Return' : key
      ;(win.webContents as any).sendInputEvent({ type: 'keyDown', keyCode })
      ;(win.webContents as any).sendInputEvent({ type: 'char', keyCode })
      ;(win.webContents as any).sendInputEvent({ type: 'keyUp', keyCode })
      notifyStatus(`Tecla "${key}" acionada`)
      return { success: true }
    }
    return { success: false }
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
  },

  async updateCollaborators(data: { collaborators: any[]; allowCollaboration: boolean; isAudioMuted?: boolean }): Promise<boolean> {
    return applyDetachedOverlay(data)
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
    return browserManager.open(typeof url === 'string' ? url : undefined, Boolean(show))
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

  ipcMain.handle('browser-sanitized-screenshot', async (event) => {
    trusted(event)
    return browserManager.sanitizedScreenshot()
  })

  ipcMain.handle('browser-click-at', async (event, xPercent: unknown, yPercent: unknown) => {
    trusted(event)
    return browserManager.clickAt(Number(xPercent), Number(yPercent))
  })

  ipcMain.handle('browser-insert-text', async (event, text: unknown) => {
    trusted(event)
    return browserManager.insertText(String(text || ''))
  })

  ipcMain.handle('browser-set-audio-muted', async (event, muted: unknown) => {
    trusted(event)
    return browserManager.setAudioMuted(Boolean(muted))
  })

  ipcMain.handle('browser-is-audio-muted', async (event) => {
    trusted(event)
    return browserManager.isAudioMuted()
  })

  ipcMain.handle('browser-send-key', async (event, key: unknown) => {
    trusted(event)
    return browserManager.sendKey(String(key || ''))
  })

  ipcMain.handle('browser-go-back', async (event) => {
    trusted(event)
    return browserManager.goBack()
  })

  ipcMain.handle('browser-go-forward', async (event) => {
    trusted(event)
    return browserManager.goForward()
  })

  ipcMain.handle('browser-reload', async (event) => {
    trusted(event)
    return browserManager.reload()
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

  ipcMain.handle('browser-update-collaborators', async (event, data: unknown) => {
    trusted(event)
    return applyDetachedOverlay(data as any)
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
      'browser-sanitized-screenshot',
      'browser-click-at',
      'browser-go-back',
      'browser-go-forward',
      'browser-reload',
      'browser-scroll',
      'browser-evaluate',
      'browser-get-status',
      'browser-show',
      'browser-hide',
      'browser-close',
      'browser-insert-text',
      'browser-set-audio-muted',
      'browser-is-audio-muted',
      'browser-send-key',
      'browser-update-collaborators'
    ]) {
      ipcMain.removeHandler(channel)
    }
  })

  return browserManager
}
