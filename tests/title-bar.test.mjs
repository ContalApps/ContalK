import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EventEmitter } from 'node:events'
import { loadTypescript } from './load-typescript.mjs'

test('title bar accepts appearance only from the main frame, scales native controls and cleans up', () => {
  const ipcMain = new EventEmitter(), window = new EventEmitter(), appearances = []
  window.webContents = {mainFrame:{}}
  window.setTitleBarOverlay = value => appearances.push(value)
  const {setupTitleBar,titleBarOptions} = loadTypescript('electron/title-bar.ts', {electron:{ipcMain}}, {process:{platform:'win32'}})
  assert.equal(titleBarOptions.titleBarStyle,'hidden')
  setupTitleBar(window)
  const event = {sender:window.webContents,senderFrame:window.webContents.mainFrame}
  ipcMain.emit('window-titlebar-appearance',event,'vice-city',125)
  assert.equal(appearances[0].height,45)
  assert.equal(appearances[0].color,'#172b26')
  ipcMain.emit('window-titlebar-appearance',event,'classic',80)
  assert.equal(appearances[1].height,29)
  ipcMain.emit('window-titlebar-appearance',{...event,senderFrame:{}},'classic',100)
  ipcMain.emit('window-titlebar-appearance',event,'other',100)
  ipcMain.emit('window-titlebar-appearance',event,'classic',1000)
  assert.equal(appearances.length,2)
  window.emit('closed')
  assert.equal(ipcMain.listenerCount('window-titlebar-appearance'),0)
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
