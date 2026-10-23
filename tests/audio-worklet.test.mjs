import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

function processor(rate = 48000) {
  let Constructor
  runInNewContext(readFileSync('public/capture-audio-worklet.js', 'utf8'), {
    AudioWorkletProcessor: class { port = {} },
    Float32Array, Uint8Array, DataView, sampleRate: rate,
    registerProcessor: (_name, value) => { Constructor = value },
  })
  return new Constructor()
}
function pcm(frames, left = 0.25, right = -0.5) {
  const floats = new Float32Array(frames * 2)
  for (let i = 0; i < frames; i++) { floats[i * 2] = left; floats[i * 2 + 1] = right }
  return new Uint8Array(floats.buffer)
}
function output(p, frames = 128) {
  const channels = [new Float32Array(frames), new Float32Array(frames)]
  assert.equal(p.process([], [channels]), true)
  return channels
}
test('prebuffers IPC jitter then preserves stereo channels', () => {
  const p = processor()
  p.enqueue(pcm(480))
  assert.ok(output(p)[0].every(x => x === 0))
  p.enqueue(pcm(1920))
  const [left, right] = output(p)
  assert.ok(left.every(x => x === 0.25))
  assert.ok(right.every(x => x === -0.5))
})
test('reassembles PCM split between IPC messages at non-frame boundaries', () => {
  const p = processor()
  const bytes = pcm(2400)
  p.enqueue(bytes.slice(0, 13)); p.enqueue(bytes.slice(13, 78)); p.enqueue(bytes.slice(78))
  const [left, right] = output(p)
  assert.ok(left.every(x => x === 0.25)); assert.ok(right.every(x => x === -0.5))
})
test('bounds delay after a stalled renderer and discards stale audio', () => {
  const p = processor()
  p.enqueue(pcm(48000, 0.1, 0.1))
  p.enqueue(pcm(48000, 0.75, 0.75))
  assert.ok(p.write - p.read <= 4800)
  assert.ok(output(p)[0].every(x => x === 0.75))
})
test('underruns fade to silence without NaN or stale replay', () => {
  const p = processor()
  p.enqueue(pcm(2000, 0.5, 0.5))
  const [left] = output(p, 4096)
  assert.ok(left.every(Number.isFinite))
  assert.ok(Math.abs(left.at(-1)) < 0.00001)
  assert.equal(p.started, false)
})
test('resamples to the AudioContext sample rate', () => {
  const p = processor(44100)
  p.enqueue(pcm(4000))
  output(p, 441)
  assert.ok(Math.abs(p.read - 480) < 0.001)
})
test('rejects non-finite samples and clamps damaged PCM', () => {
  const p = processor()
  p.enqueue(pcm(2400, NaN, 10))
  const [left, right] = output(p)
  assert.ok(left.every(x => x === 0)); assert.ok(right.every(x => x === 1))
})
