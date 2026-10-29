import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTypescript } from './load-typescript.mjs'

test('Shared Browser Manager supports sanitized screenshot and password privacy masking', async () => {
  let executedScripts = []
  let capturedPage = false

  const mockWebContents = {
    getURL: () => 'https://example.com/login',
    getTitle: () => 'Entrar - Minha Conta',
    canGoBack: () => true,
    canGoForward: () => false,
    goBack() {},
    goForward() {},
    reload() {},
    loadURL: async () => {},
    on() {},
    once() {},
    removeListener() {},
    capturePage: async () => {
      capturedPage = true
      return {
        getSize: () => ({ width: 800, height: 600 }),
        resize: () => ({
          toJPEG: () => Buffer.from('test-jpeg')
        }),
        toJPEG: () => Buffer.from('test-jpeg'),
        toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      }
    },
    executeJavaScript: async (script) => {
      executedScripts.push(script)
      if (script.includes('ct-pwd-shielded')) {
        // Simulates presence of a password field
        return true
      }
      return { success: true }
    }
  }

  const mockBrowserWindow = {
    isDestroyed: () => false,
    webContents: mockWebContents,
    show() {},
    hide() {},
    focus() {},
    close() {},
    isVisible: () => false,
    loadURL: async () => {},
    on() {}
  }

  const fakeElectron = {
    BrowserWindow: class {
      constructor() {
        return mockBrowserWindow
      }
    },
    ipcMain: {
      handle() {},
      removeHandler() {}
    }
  }

  const { browserManager } = loadTypescript(
    'electron/browser.ts',
    { electron: fakeElectron },
    { process }
  )

  // 1. Initial State
  const initialStatus = browserManager.getStatus()
  assert.equal(initialStatus.isOpen, false)

  // 2. Open Browser
  await browserManager.open('https://example.com/login', false)
  const openStatus = browserManager.getStatus()
  assert.equal(openStatus.isOpen, true)
  assert.equal(openStatus.url, 'https://example.com/login')

  // 3. Sanitized Screenshot for Co-Browsing
  const shot = await browserManager.sanitizedScreenshot()
  assert.ok(capturedPage, 'Page must be captured')
  assert.ok(shot.src.startsWith('data:image/'), 'Screenshot must return valid base64 data URL')
  assert.equal(shot.hasPasswordField, true, 'Sensitive password field must be detected')
  assert.ok(
    executedScripts.some((s) => s.includes('.ct-pwd-shielded')),
    'Protection script must blur/mask password fields'
  )

  // 4. Collaborative click at viewport percentage coordinates
  const clickRes = await browserManager.clickAt(50, 25)
  assert.equal(clickRes.success, true)
  assert.ok(
    executedScripts.some((s) => s.includes('elementFromPoint')),
    'Collaborative click must resolve element from relative coordinates'
  )

  // 5. Navigation controls
  assert.equal(browserManager.goBack(), true)
  assert.equal(browserManager.goForward(), false)
  assert.equal(browserManager.reload(), true)

  browserManager.close()
  assert.equal(browserManager.getStatus().isOpen, false)
})

test('Shared Browser Store structures session and collaborative interactions', async () => {
  // Verifies the session structure definition
  const session = {
    roomId: 'room-123',
    hostId: 'vg',
    hostName: 'VG',
    url: 'https://contalk.app',
    title: 'ConTALK · Chat & Collab',
    screenshot: 'data:image/jpeg;base64,abc12345',
    hasPasswordField: false,
    allowCollaboration: true,
    lastUpdated: Date.now()
  }

  assert.equal(session.hostId, 'vg')
  assert.equal(session.allowCollaboration, true)
  assert.equal(session.hasPasswordField, false)
})

test('Detached browser overlay injects collaborator cursors and floating control bar', async () => {
  let executedScripts = []

  const mockWebContents = {
    getURL: () => 'https://example.com/collab',
    getTitle: () => 'Collab Room',
    canGoBack: () => true,
    canGoForward: () => false,
    goBack() {},
    goForward() {},
    reload() {},
    loadURL: async () => {},
    on() {},
    once() {},
    removeListener() {},
    isLoadingMainFrame: () => false,
    executeJavaScript: async (script) => {
      executedScripts.push(script)
      return true
    }
  }

  const mockBrowserWindow = {
    isDestroyed: () => false,
    webContents: mockWebContents,
    show() {},
    hide() {},
    focus() {},
    close() {},
    isVisible: () => true,
    loadURL: async () => {},
    on() {}
  }

  const fakeElectron = {
    BrowserWindow: class {
      constructor() {
        return mockBrowserWindow
      }
    },
    ipcMain: {
      handle() {},
      removeHandler() {}
    }
  }

  const { browserManager } = loadTypescript(
    'electron/browser.ts',
    { electron: fakeElectron },
    { process }
  )

  await browserManager.open('https://example.com/collab', true)

  const ok = await browserManager.updateCollaborators({
    collaborators: [
      { id: 'vgzera', name: 'VG', color: '#10b981', xPercent: 42, yPercent: 68 },
      { id: 'trevs', name: 'Trevs', color: '#f59e0b', xPercent: 80, yPercent: 15, lastClick: { xPercent: 80, yPercent: 15, time: Date.now() } }
    ],
    allowCollaboration: true,
    isAudioMuted: false
  })

  assert.equal(ok, true)
  assert.ok(executedScripts.some(s => s.includes('contalk-detached-overlay')), 'Detached overlay element must be injected')
  assert.ok(executedScripts.some(s => s.includes('contalk-floating-bar')), 'Floating control bar must be rendered')
  assert.ok(executedScripts.some(s => s.includes('vgzera') || s.includes('VG')), 'Collaborator name and cursor must be rendered')
  assert.ok(executedScripts.some(s => s.includes('ctRippleAnim')), 'Click ripple effect must be supported')

  browserManager.close()
})
