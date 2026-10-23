import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { loadTypescript } from './load-typescript.mjs'

function fixture() {
  const handlers = new Map()
  const updater = new EventEmitter()
  let checks = 0; let downloads = 0; let installs = 0
  updater.checkForUpdates = async () => { checks++; updater.emit('update-available', { version: '0.1.3' }) }
  updater.downloadUpdate = async () => { downloads++; updater.emit('download-progress', { percent: 50 }); updater.emit('update-downloaded', { version: '0.1.3' }) }
  updater.quitAndInstall = () => { installs++ }
  const window = new EventEmitter()
  window.webContents = { mainFrame: {}, send() {} }
  window.isDestroyed = () => false
  const { setupUpdates } = loadTypescript('electron/updates.ts', {
    electron: { app: { isPackaged: true }, ipcMain: { handle: (name, handler) => handlers.set(name, handler), removeHandler: name => handlers.delete(name) } },
    'node:module': { createRequire: () => () => ({ autoUpdater: updater }) },
  })
  setupUpdates(window)
  const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame }
  return { window, updater, call: (name, ev = event) => handlers.get(name)(ev), get checks() { return checks }, get downloads() { return downloads }, get installs() { return installs } }
}
test('updates require explicit download and completed download before installation', async () => {
  const f = fixture()
  try {
    assert.equal(f.updater.autoDownload, false)
    assert.equal(f.updater.autoInstallOnAppQuit, false)
    assert.equal(f.updater.allowDowngrade, false)
    assert.throws(() => f.call('update-install'), /ainda não está pronta/)
    await f.call('update-check')
    assert.equal(f.checks, 1); assert.equal(f.downloads, 0)
    assert.equal(f.call('update-get-state').status, 'available')
    await f.call('update-download')
    assert.equal(f.downloads, 1)
    assert.equal(f.call('update-get-state').status, 'ready')
    f.call('update-install')
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(f.installs, 1)
  } finally { f.window.emit('closed') }
})
test('rejects updater calls from untrusted frames and removes IPC on close', async () => {
  const f = fixture()
  try { await assert.rejects(f.call('update-download', { sender: {}, senderFrame: {} }), /Origem inválida/) }
  finally { f.window.emit('closed') }
})
