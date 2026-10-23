import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { loadTypescript } from './load-typescript.mjs'

function fixture({downloadFailure=false,installFailure=false}={}) {
  const handlers = new Map()
  const updater = new EventEmitter()
  let checks = 0; let downloads = 0; let installs = 0; let installArgs; let nativeStarts = 0; let nativeCanceled = 0
  updater.checkForUpdates = async () => { checks++; updater.emit('update-available', { version: '0.1.3' }) }
  updater.downloadUpdate = async () => { downloads++; if(downloadFailure)throw new Error('Download failed'); updater.emit('download-progress', { percent: 50 }); updater.emit('update-downloaded', { version: '0.1.3' }) }
  updater.quitAndInstall = (...args) => { installs++; installArgs=args }
  const window = new EventEmitter()
  window.webContents = new EventEmitter(); window.webContents.mainFrame = {}; window.webContents.send=()=>{}
  window.setProgressBar=()=>{};window.hide=()=>{};window.show=()=>{}
  window.isDestroyed = () => false
  const { setupUpdates } = loadTypescript('electron/updates.ts', {
    electron: { app: { isPackaged: true }, ipcMain: { handle: (name, handler) => handlers.set(name, handler), removeHandler: name => handlers.delete(name) } },
    './update-progress': {createUpdateProgress:()=>({send(){},destroy(){}}),finishInstallProgress(){},startInstallProgress:async()=>{nativeStarts++;if(installFailure)throw new Error('Splash failed');return ()=>{nativeCanceled++}}},
    'node:module': { createRequire: () => () => ({ autoUpdater: updater }) },
  })
  setupUpdates(window)
  const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame }
  return { window, updater, call: (name, ev = event) => handlers.get(name)(ev), get checks() { return checks }, get downloads() { return downloads }, get installs() { return installs }, get installArgs(){return installArgs}, get nativeStarts(){return nativeStarts}, get nativeCanceled(){return nativeCanceled} }
}
test('user-authorized download automatically installs silently and restarts', async () => {
  const f = fixture()
  try {
    assert.equal(f.updater.autoDownload, false)
    assert.equal(f.updater.autoInstallOnAppQuit, false)
    assert.equal(f.updater.allowDowngrade, false)
    await assert.rejects(f.call('update-install'), /ainda não está pronta/)
    await f.call('update-check')
    assert.equal(f.checks, 1); assert.equal(f.downloads, 0)
    assert.equal(f.call('update-get-state').status, 'available')
    await f.call('update-download')
    assert.equal(f.downloads, 1)
    assert.equal(f.call('update-get-state').status, 'installing')
    await f.call('update-install')
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(f.installs, 1)
    assert.deepEqual(f.installArgs,[true,true]);assert.equal(f.nativeStarts,1)
  } finally { f.window.emit('closed') }
})
test('rejects updater calls from untrusted frames and removes IPC on close', async () => {
  const f = fixture()
  try { await assert.rejects(f.call('update-download', { sender: {}, senderFrame: {} }), /Origem inválida/) }
  finally { f.window.emit('closed') }
})

test('failed downloads do not close the app or launch the installer',async()=>{const f=fixture({downloadFailure:true});try{await f.call('update-check');await assert.rejects(f.call('update-download'),/Download failed/);assert.equal(f.installs,0);assert.equal(f.nativeStarts,0);assert.equal(f.call('update-get-state').status,'error')}finally{f.window.emit('closed')}})
test('failed installation handoff keeps the application open',async()=>{const f=fixture({installFailure:true});try{await f.call('update-check');await assert.rejects(f.call('update-download'),/Splash failed/);assert.equal(f.installs,0);assert.equal(f.call('update-get-state').status,'error')}finally{f.window.emit('closed')}})
