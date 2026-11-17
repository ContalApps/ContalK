import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EventEmitter } from 'node:events'
import { loadTypescript } from './load-typescript.mjs'

test('window controls act only for the main frame, follow maximize state and clean up', async () => {
  const handlers = new Map(), listeners = new Map(), ipcMain = { handle: (name, fn) => handlers.set(name, fn), removeHandler: name => handlers.delete(name), on: (name, fn) => listeners.set(name, fn), removeListener: name => listeners.delete(name) }
  const window = new EventEmitter(), calls = [], sent = []
  let maximized = false
  window.webContents = { mainFrame: {}, send: (channel, value) => sent.push([channel, value]) }
  Object.assign(window, { minimize: () => calls.push('minimize'), maximize: () => { maximized = true; calls.push('maximize') }, unmaximize: () => { maximized = false; calls.push('unmaximize') }, close: () => calls.push('close'), isMaximized: () => maximized, isDestroyed: () => false })
  const { setupTitleBar, titleBarOptions } = loadTypescript('electron/title-bar.ts', { electron: { ipcMain } }, { process: { platform: 'win32' } })
  assert.equal(titleBarOptions.titleBarStyle, 'hidden')
  assert.equal(titleBarOptions.titleBarOverlay, undefined)
  setupTitleBar(window)
  const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame }
  const control = handlers.get('window-control')
  assert.equal(control({ ...event, senderFrame: {} }, 'close'), false)
  assert.equal(control(event, 'shutdown'), false)
  assert.deepEqual(calls, [])
  control(event, 'minimize'); assert.equal(control(event, 'maximize'), true); assert.equal(control(event, 'maximize'), false); control(event, 'close')
  assert.deepEqual(calls, ['minimize', 'maximize', 'unmaximize', 'close'])
  window.emit('maximize'); assert.deepEqual(sent.at(-1), ['window-maximized', false])
  window.emit('closed')
  assert.equal(handlers.size, 0); assert.equal(listeners.size, 0)
})

test('navigation restores views, truncates forward history on a new visit and caps stored entries', () => {
  const {visit,step} = loadTypescript('src/navigation/history.ts')
  const home = {view:'home',serverId:'one',channelId:'text',peer:null}
  let history = {entries:[home],index:0}
  assert.equal(visit(history,home),history)
  assert.equal(step(history,-1),history)
  history = visit(history,{...home,view:'server',channelId:'voice'})
  history = visit(history,{...home,view:'messages',peer:'alice'})
  history = step(history,-1)
  assert.equal(history.entries[history.index].channelId,'voice')
  history = step(history,1)
  assert.equal(history.entries[history.index].peer,'alice')
  history = visit(step(history,-1),{...home,view:'friends'})
  assert.equal(step(history,1),history)
  for(let i=0;i<70;i++)history=visit(history,{...home,channelId:'channel-'+i})
  assert.equal(history.entries.length,50)
  assert.equal(history.entries[history.index].channelId,'channel-69')
})
