import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'

// A renamed channel in preload.ts fails silently at runtime ("No handler registered"), so check both sides match.
test('every channel the preload calls has a handler in the Electron main process', () => {
  const preload = fs.readFileSync('electron/preload.ts', 'utf8')
  const main = fs.readdirSync('electron').filter(f => f.endsWith('.ts') && f !== 'preload.ts').map(f => fs.readFileSync('electron/' + f, 'utf8')).join('\n')
  const handled = new Set([...main.matchAll(/ipcMain\.(?:handle|on|once)\('([^']+)'/g)].map(m => m[1]))
  for (const m of main.matchAll(/'([a-z-]+)'\s*:\s*(?:async\s*)?\(/g)) handled.add(m[1])
  const used = [...new Set([...preload.matchAll(/ipcRenderer\.(?:invoke|send)\('([^']+)'/g)].map(m => m[1]))]
  assert.ok(used.length > 40)
  assert.deepEqual(used.filter(channel => !handled.has(channel)), [])
})

test('every event the preload listens to is sent by the Electron main process', () => {
  const preload = fs.readFileSync('electron/preload.ts', 'utf8')
  const main = fs.readdirSync('electron').filter(f => f.endsWith('.ts') && f !== 'preload.ts').map(f => fs.readFileSync('electron/' + f, 'utf8')).join('\n')
  const listened = [...new Set([...preload.matchAll(/subscribe\('([^']+)'/g)].map(m => m[1]))]
  assert.deepEqual(listened.filter(channel => !main.includes(`'${channel}'`)), [])
})
