import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { test } from 'node:test'

test('Windows isolated loopback helper initializes and streams aligned stereo PCM', { skip: process.platform !== 'win32' || !existsSync('native/bin/contalk-audio.exe'), timeout: 12000 }, async () => {
  await new Promise((resolve, reject) => {
    const child = spawn('native/bin/contalk-audio.exe', ['--probe', String(process.pid)], { windowsHide: true })
    let ready = false
    let bytes = 0
    let diagnostics = ''
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Capture timeout: ' + diagnostics)) }, 10000)
    child.stderr.on('data', data => { diagnostics += data; if (diagnostics.includes('"ready":true')) ready = true })
    child.stdout.on('data', data => {
      bytes += data.length
      if (bytes >= 38400) child.kill()
    })
    child.on('error', reject)
    child.on('exit', () => {
      clearTimeout(timeout)
      try { assert.ok(ready, diagnostics); assert.ok(bytes >= 38400); assert.equal(bytes % 8, 0); resolve() }
      catch (error) { reject(error) }
    })
  })
})

test('invalid source is rejected without emitting any audio', { skip: process.platform !== 'win32' || !existsSync('native/bin/contalk-audio.exe'), timeout: 10000 }, async () => {
  await new Promise((resolve, reject) => {
    const child = spawn('native/bin/contalk-audio.exe', ['--window', '0', '--exclude', String(process.pid)], { windowsHide: true })
    let bytes = 0
    child.stdout.on('data', data => { bytes += data.length })
    child.stderr.resume()
    child.on('error', reject)
    child.on('exit', code => { try { assert.notEqual(code, 0); assert.equal(bytes, 0); resolve() } catch (error) { reject(error) } })
  })
})
