import assert from 'node:assert/strict'
import { test } from 'node:test'
import os from 'node:os'
import { createRequire } from 'node:module'
import { loadTypescript } from './load-typescript.mjs'

const require = createRequire(import.meta.url)
const { createTerminalManager } = loadTypescript('electron/terminal.ts', { electron: {} }, { process })
const strip = text => text.replace(/\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07]*\x07/g, '')

test('terminal runs a real shell, resizes, and is killed on demand', { skip: process.platform !== 'win32' && !process.env.SHELL }, async () => {
  const output = new Map(), exits = []
  const manager = createTerminalManager(require('node-pty').spawn, { data: (id, data) => output.set(id, (output.get(id) || '') + data), exit: (id, code) => exits.push([id, code]) })
  const session = manager.create(os.tmpdir(), 100, 30)
  assert.equal(manager.count, 1)
  manager.resize(session.id, 120, 40)
  manager.input(session.id, 'echo contalk-terminal-ok\r')
  const deadline = Date.now() + 20000
  while (!strip(output.get(session.id) || '').includes('contalk-terminal-ok') && Date.now() < deadline) await new Promise(r => setTimeout(r, 100))
  assert.match(strip(output.get(session.id)), /contalk-terminal-ok/)
  manager.kill(session.id)
  assert.equal(manager.count, 0)
  assert.throws(() => manager.input(session.id, 1), /Entrada inválida/)
})

test('killAll closes every session and invalid sizes and folders fall back to safe defaults', async () => {
  const spawned = []
  const fake = (file, args, options) => { const pty = { options, killed: false, write() {}, resize(c, r) { pty.size = [c, r] }, kill() { pty.killed = true }, onData() {}, onExit() {} }; spawned.push(pty); return pty }
  const manager = createTerminalManager(fake, { data() {}, exit() {} })
  const a = manager.create('relative/path', -1, 99999), b = manager.create('C:\\definitely\\missing\\folder', 'x', null)
  assert.equal(spawned[0].options.cwd, os.homedir())
  assert.equal(spawned[1].options.cwd, os.homedir())
  assert.deepEqual([spawned[0].options.cols, spawned[0].options.rows], [80, 24])
  manager.resize(a.id, 1, 9000)
  assert.deepEqual(spawned[0].size, [80, 24])
  for (let i = 2; i < 8; i++) manager.create(os.tmpdir(), 80, 24)
  assert.throws(() => manager.create(os.tmpdir(), 80, 24), /Limite de terminais/)
  manager.killAll()
  assert.equal(manager.count, 0)
  assert.ok(spawned.every(pty => pty.killed))
  assert.ok(b.id && a.id !== b.id)
})
