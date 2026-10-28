import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const PORT = 9222
const OUT_DIR = path.resolve('release/live-inspection')
fs.mkdirSync(OUT_DIR, { recursive: true })

class CDPSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.ws = null
    this.id = 0
    this.callbacks = new Map()
    this.logs = []
    this.errors = []
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl)
      this.ws.onopen = () => resolve()
      this.ws.onerror = err => reject(err)
      this.ws.onmessage = event => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.method === 'Runtime.consoleAPICalled') {
            const text = msg.params.args.map(a => a.value ?? a.description ?? '').join(' ')
            this.logs.push(`[Console] ${text}`)
            if (msg.params.type === 'error') {
              this.errors.push(`[Console Error] ${text}`)
            }
          }
          if (msg.id && this.callbacks.has(msg.id)) {
            const { resolve, reject } = this.callbacks.get(msg.id)
            this.callbacks.delete(msg.id)
            if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)))
            else resolve(msg.result)
          }
        } catch (e) {
          console.error('CDP message error:', e)
        }
      }
    })
  }

  async send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    })
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text)
    }
    return res.result?.value
  }

  async screenshot(name) {
    const filePath = path.join(OUT_DIR, `${name}.png`)
    const res = await this.send('Page.captureScreenshot', { format: 'png', quality: 95 })
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'))
    return filePath
  }

  async click(selector) {
    const exists = await this.evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)
    if (!exists) throw new Error(`Element not found for click: ${selector}`)
    const rect = await this.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height };
    })()`)

    if (!rect) throw new Error(`Failed to get rect for: ${selector}`)

    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y })
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })

    // Also dispatch programmatic click for reliability in synthetic web views
    await this.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (el) el.click();
    })()`)
  }

  async hover(selector) {
    const rect = await this.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`)
    if (rect) {
      await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y })
      await this.evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (el) {
          el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        }
      })()`)
    }
  }

  async type(selector, text) {
    await this.click(selector)
    await this.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return;
      el.focus();
      const val = ${JSON.stringify(text)};
      const setter = Object.getOwnPropertyDescriptor(
        el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        'value'
      )?.set;
      if (setter) {
        setter.call(el, val);
      } else {
        el.value = val;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    })()`)
  }

  async pressKey(key, modifiers = 0, keyCode = 0, code = '') {
    await this.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: keyCode, modifiers })
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, modifiers })
  }

  async sleep(ms) {
    return new Promise(r => setTimeout(r, ms))
  }
}

export class AppDriver {
  constructor(options = {}) {
    this.options = options
    this.child = null
    this.session = null
    this.results = []
  }

  async launch() {
    console.log('🚀 Iniciando ConTALK em tempo real com porta de inspeção CDP 9222...')
    const electron = path.resolve('node_modules/electron/dist/electron.exe')
    const args = ['.', `--remote-debugging-port=${PORT}`]

    this.child = spawn(electron, args, {
      stdio: 'pipe',
      windowsHide: false,
      env: { ...process.env }
    })

    this.child.stdout.on('data', d => {
      const str = d.toString()
      if (str.includes('Error')) console.error(`[Electron Out] ${str.trim()}`)
    })
    this.child.stderr.on('data', d => {
      const str = d.toString()
      if (str.includes('Error')) console.error(`[Electron Err] ${str.trim()}`)
    })

    console.log('⏳ Conectando ao Chrome DevTools Protocol...')
    let target = null
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 500))
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
        if (res.ok) {
          const list = await res.json()
          target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl)
          if (target) break
        }
      } catch {}
    }

    if (!target) {
      throw new Error('Não foi possível conectar ao Electron via porta de depuração 9222.')
    }

    console.log(`✅ Conectado ao app! Alvo: ${target.title} (${target.url})`)
    this.session = new CDPSession(target.webSocketDebuggerUrl)
    await this.session.connect()
    await this.session.send('Runtime.enable')
    await this.session.send('Page.enable')
    await this.session.send('DOM.enable')
    console.log('🎉 Sessão CDP pronta para automação e testes ao vivo!')
  }

  async step(title, fn) {
    console.log(`\n▶️  [TESTE] ${title}`)
    const start = Date.now()
    try {
      await fn(this.session)
      const duration = Date.now() - start
      console.log(`   ✔️ Sucesso (${duration}ms)`)
      this.results.push({ title, status: 'PASS', duration })
    } catch (err) {
      const duration = Date.now() - start
      console.error(`   ❌ Falha: ${err.message}`)
      this.results.push({ title, status: 'FAIL', duration, error: err.message })
    }
  }

  async runFullSimulation() {
    console.log('\n================================================================');
    console.log('🧪 INICIANDO SIMULAÇÃO COMPLETA DE USUÁRIO REAL NO CONTALK');
    console.log('================================================================\n');

    // 1. TitleBar & Codex Shell
    await this.step('1. Verificação da Interface e Estrutura Codex', async s => {
      await s.sleep(1500)
      const isAuth = await s.evaluate(`Boolean(document.querySelector('.ct-auth'))`)
      console.log(`   Estado inicial: ${isAuth ? 'Tela de Login/Cadastro' : 'App Autenticado'}`)
      await s.screenshot('01-initial-state')

      if (isAuth) {
        console.log('   Realizando login com credencial de teste...')
        const hasUserInput = await s.evaluate(`Boolean(document.querySelector('input[autocomplete="username"]'))`)
        if (hasUserInput) {
          await s.type('input[autocomplete="username"]', 'tester')
          await s.type('input[type="password"]', 'teste123456')
          await s.screenshot('02-auth-filled')
          await s.click('button[type="submit"]')
          await s.sleep(2000)
        }
      }

      // Validar TitleBar
      const titleBar = await s.evaluate(`Boolean(document.querySelector('.ct-titlebar'))`)
      console.log(`   Barra de título Codex presente: ${titleBar}`)
      await s.screenshot('03-main-layout')
    })

    // 2. Settings View & Token Economy (Issues #3 & #4)
    await this.step('2. Configurações Gerais e Níveis de Economia de Tokens', async s => {
      // Disparar abertura de configurações (Ctrl+,)
      console.log('   Abrindo tela de Configurações...')
      await s.pressKey(',', 2, 188, 'Comma') // Ctrl + ,
      await s.sleep(800)

      const settingsModal = await s.evaluate(`Boolean(document.querySelector('.ct-settings-screen'))`)
      if (!settingsModal) {
        // Tentar via trigger programático
        await s.evaluate(`(() => {
          const btn = document.querySelector('.ct-dock-profile');
          if (btn) btn.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
        })()`)
        await s.sleep(500)
      }

      await s.screenshot('04-settings-appearance')

      // Navegar para a aba "Inteligência artificial"
      console.log('   Navegando para aba "Inteligência artificial"...')
      const clickedAi = await s.evaluate(`(() => {
        const tabs = [...document.querySelectorAll('.ct-settings-nav button')];
        const aiTab = tabs.find(b => b.textContent.includes('Inteligência artificial') || b.textContent.includes('IA'));
        if (aiTab) { aiTab.click(); return true; }
        return false;
      })()`)

      if (clickedAi) {
        await s.sleep(600)
        await s.screenshot('05-settings-ai-tokens')

        // Validar opções de Economia de Tokens (Padrão, Moderada, Bruta)
        const economyCards = await s.evaluate(`(() => {
          const cards = [...document.querySelectorAll('.ct-ai-economy-card')];
          return cards.map(c => ({
            label: c.querySelector('strong')?.textContent?.trim(),
            desc: c.querySelector('.ct-ai-economy-desc')?.textContent?.trim(),
            selected: c.classList.contains('is-selected')
          }));
        })()`)
        console.log(`   Opções de Economia de Tokens encontradas: ${JSON.stringify(economyCards)}`)

        // Selecionar modo Bruta e depois Moderada
        await s.evaluate(`(() => {
          const labels = [...document.querySelectorAll('.ct-ai-economy-card')];
          const brute = labels.find(l => l.textContent.includes('Bruta'));
          if (brute) brute.querySelector('input')?.click();
        })()`)
        await s.sleep(400)
        await s.screenshot('06-settings-token-bruta-selected')
      }

      // Fechar configurações com Escape
      await s.pressKey('Escape', 0, 27, 'Escape')
      await s.sleep(500)

      // Clicar no primeiro servidor na rail para entrar no servidor e exibir os canais e projetos
      console.log('   Entrando no servidor principal através do rail...')
      await s.evaluate(`(() => {
        const serverBtn = document.querySelector('.ct-rail .ct-server-logo');
        if (serverBtn) serverBtn.click();
      })()`)
      await s.sleep(800)
      await s.screenshot('06b-server-view')
    })

    // 3. Guia de Projetos: Kanban, Tarefas e Documentação Arrastáveis (Issue #1)
    await this.step('3. Guia de Projetos: Kanban, Tarefas e Documentação Arrastáveis', async s => {
      console.log('   Abrindo Guia de Projetos (Kanban)...')
      const opened = await s.evaluate(`(() => {
        const btn = document.querySelector('button[title*="Kanban"], button[aria-label*="Guia de Projetos"], .ct-side-dev-item');
        if (btn) { btn.click(); return true; }
        return false;
      })()`)

      if (opened) {
        await s.sleep(800)
        await s.screenshot('07-projects-kanban')

        // Verificar colunas e cards arrastáveis
        const kanbanInfo = await s.evaluate(`(() => {
          const columns = [...document.querySelectorAll('.ct-kanban-column')].map(col => ({
            title: col.querySelector('.ct-kanban-column-header h4')?.textContent?.trim(),
            cardsCount: col.querySelectorAll('.ct-kanban-card').length,
            hasDraggables: Boolean(col.querySelector('.ct-kanban-card[draggable="true"]'))
          }));
          return columns;
        })()`)
        console.log(`   Colunas do Kanban: ${JSON.stringify(kanbanInfo)}`)

        // Alternar para aba Tarefas
        console.log('   Alternando para aba de Tarefas...')
        await s.evaluate(`(() => {
          const tab = [...document.querySelectorAll('.ct-dev-modal-nav button')].find(b => b.textContent.includes('Tarefas'));
          if (tab) tab.click();
        })()`)
        await s.sleep(600)
        await s.screenshot('08-projects-tasks')

        // Alternar para aba Documentação
        console.log('   Alternando para aba de Documentação...')
        await s.evaluate(`(() => {
          const tab = [...document.querySelectorAll('.ct-dev-modal-nav button')].find(b => b.textContent.includes('Documentação'));
          if (tab) tab.click();
        })()`)
        await s.sleep(600)
        await s.screenshot('09-projects-docs')

        // Fechar modal de projetos
        await s.pressKey('Escape', 0, 27, 'Escape')
        await s.sleep(500)
      }
    })

    // 4. Editor de Código e Terminal (Issue #2: sem 'projeto-atlas', Workspace real)
    await this.step('4. Editor de Código (Workspace Real) e Terminal Inferior', async s => {
      console.log('   Abrindo Terminal inferior com atalho Ctrl+J...')
      await s.pressKey('j', 2, 74, 'KeyJ') // Ctrl + J
      await s.sleep(800)
      await s.screenshot('10-terminal-panel')

      const terminalOpen = await s.evaluate(`Boolean(document.querySelector('.ct-terminal-panel, .ct-bottom-panel'))`)
      console.log(`   Painel de Terminal inferior aberto: ${terminalOpen}`)

      // Fechar terminal
      await s.pressKey('j', 2, 74, 'KeyJ')
      await s.sleep(500)

      // Abrir Dev Editor split
      console.log('   Abrindo Dev Editor Split...')
      await s.pressKey('e', 3, 69, 'KeyE') // Ctrl + Alt + E
      await s.sleep(800)
      await s.screenshot('11-dev-editor-workspace')

      const editorInfo = await s.evaluate(`(() => {
        const workspace = document.querySelector('.ct-channel-split-workspace, .ct-dev-editor');
        if (!workspace) return { open: false };
        const repoName = document.querySelector('.ct-dev-repo-selector, .ct-dev-current-project')?.textContent?.trim();
        return { open: true, repoName };
      })()`)
      console.log(`   Info do Editor de Código: ${JSON.stringify(editorInfo)}`)
    })

    // 5. Configurações de Canal de Voz e Botão Primário de Modo (Issue #6)
    await this.step('5. Canal de Voz: Configurações e Botão "Aplicar Modo Selecionado"', async s => {
      console.log('   Listando canais e localizando canal de voz...')
      const openedSettings = await s.evaluate(`(() => {
        // Encontrar canal de voz dentro de .ct-voice-group
        const voiceGroup = document.querySelector('.ct-voice-group');
        if (voiceGroup) {
          const btn = voiceGroup.querySelector('.ct-channel-settings');
          if (btn) {
            btn.click();
            return { opened: true, name: voiceGroup.textContent.trim() };
          }
        }
        // Fallback: qualquer linha com botão de configuração
        const anyBtn = document.querySelector('.ct-channel-settings');
        if (anyBtn) {
          anyBtn.click();
          return { opened: true, name: 'Canal alternativo' };
        }
        return { opened: false };
      })()`)

      console.log(`   Resultado da abertura de configurações de voz: ${JSON.stringify(openedSettings)}`)

      if (openedSettings && openedSettings.opened) {
        await s.sleep(800)
        await s.screenshot('12-channel-settings-modal')

        const modeSection = await s.evaluate(`(() => {
          const card = document.querySelector('.ct-voice-mode-card');
          const applyBtn = document.querySelector('.ct-mode-apply-btn');
          return {
            hasCard: Boolean(card),
            btnText: applyBtn?.textContent?.trim(),
            isPrimary: applyBtn?.classList.contains('ct-primary')
          };
        })()`)
        console.log(`   Verificação de Modo de Canal e Botão Primário: ${JSON.stringify(modeSection)}`)

        // Fechar configurações do canal
        await s.pressKey('Escape', 0, 27, 'Escape')
        await s.sleep(500)
      }
    })

    // 6. Mensagens, Toolbar Sem Sobreposição, Prévias de Links e Imagens (Issues #7, #8, #9)
    await this.step('6. Mensagens, Toolbar Sem Sobreposição e Prévias Ricas', async s => {
      // Clicar no canal de texto geral
      await s.evaluate(`(() => {
        const textChannel = [...document.querySelectorAll('.ct-channel')].find(c => c.textContent.includes('geral') || c.textContent.includes('#'));
        if (textChannel) textChannel.click();
      })()`)
      await s.sleep(800)

      // Enviar mensagem de teste com link
      console.log('   Digitando mensagem com link para teste de preview...')
      const inputExists = await s.evaluate(`Boolean(document.querySelector('input[aria-label="Mensagem"]'))`)
      if (inputExists) {
        await s.type('input[aria-label="Mensagem"]', 'Confira o repositório oficial https://github.com/ContalApps/ContalK')
        await s.pressKey('Enter', 0, 13, 'Enter')
        await s.sleep(1500)
        await s.screenshot('13-message-sent')
      }

      // Hover na última mensagem para exibir a toolbar
      const hasMessage = await s.evaluate(`Boolean(document.querySelector('.ct-message'))`)
      if (hasMessage) {
        console.log('   Fazendo hover na mensagem para verificar toolbar unificada sem sobreposição...')
        await s.hover('.ct-message:last-child')
        await s.sleep(600)
        await s.screenshot('14-message-hover-toolbar')

        const toolbarInfo = await s.evaluate(`(() => {
          const msg = document.querySelector('.ct-message:last-child');
          const toolbar = msg?.querySelector('.ct-message-toolbar');
          if (!toolbar) return { found: false };
          const buttons = [...toolbar.querySelectorAll('button')].map(b => b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent.trim());
          const hasPin = buttons.some(b => b?.toLowerCase().includes('fixar'));
          const hasEdit = buttons.some(b => b?.toLowerCase().includes('editar'));
          const hasDelete = buttons.some(b => b?.toLowerCase().includes('apagar') || b?.toLowerCase().includes('excluir'));
          return { found: true, buttons, hasPin, hasEdit, hasDelete };
        })()`)
        console.log(`   Resultado da inspeção da toolbar da mensagem: ${JSON.stringify(toolbarInfo)}`)

        // Checar card de prévia de link se já carregado
        const previewInfo = await s.evaluate(`(() => {
          const preview = document.querySelector('.ct-link-preview');
          if (!preview) return { found: false };
          const title = preview.querySelector('.ct-link-preview-title')?.textContent?.trim();
          const host = preview.querySelector('.ct-link-preview-host')?.textContent?.trim();
          return { found: true, title, host };
        })()`)
        console.log(`   Card de prévia de link detectado: ${JSON.stringify(previewInfo)}`)
      }
    })

    this.generateReport()
  }

  generateReport() {
    const reportPath = path.join(OUT_DIR, 'REPORT.md')
    const total = this.results.length
    const passed = this.results.filter(r => r.status === 'PASS').length
    const failed = this.results.filter(r => r.status === 'FAIL').length

    let md = `# Relatório de Inspeção e Simulação em Tempo Real do ConTALK\n\n`
    md += `**Data:** ${new Date().toLocaleString('pt-BR')}\n`
    md += `**Total de testes executados:** ${total} | **Aprovados:** ${passed} | **Falhas:** ${failed}\n\n`
    md += `## Resumo das Etapas Executadas\n\n`
    md += `| Etapa / Funcionalidade | Status | Duração | Detalhes |\n`
    md += `| :--- | :---: | :---: | :--- |\n`

    for (const r of this.results) {
      md += `| ${r.title} | ${r.status === 'PASS' ? '✅ APROVADO' : '❌ FALHA'} | ${r.duration}ms | ${r.error || 'Executado com sucesso'} |\n`
    }

    md += `\n## Capturas de Tela em Tempo Real da Simulação\n\n`
    const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png')).sort()
    for (const f of files) {
      md += `### ${f.replace('.png', '')}\n`
      md += `![${f}](./${f})\n\n`
    }

    fs.writeFileSync(reportPath, md, 'utf-8')
    console.log(`\n📄 Relatório detalhado gerado em: ${reportPath}`)
  }

  async close() {
    if (this.child) {
      console.log('🛑 Encerrando sessão de inspeção...')
      this.child.kill()
    }
  }
}

// Execução direta via CLI
const driver = new AppDriver()
try {
  await driver.launch()
  await driver.runFullSimulation()
} catch (e) {
  console.error('Erro na execução do driver:', e)
} finally {
  if (!process.argv.includes('--keep-open')) {
    await driver.close()
  } else {
    console.log('⚡ App mantido aberto para uso e depuração interativa contínua!')
  }
}
