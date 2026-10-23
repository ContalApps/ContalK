import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTypescript } from './load-typescript.mjs'

function fixture({ audioFailure = false, publicationFailure = false } = {}) {
  const tracks = ['video', 'audio'].map(kind => ({ kind, stopped: false, onended: null, stop() { this.stopped = true } }))
  const stream = { getTracks: () => [tracks[0]], getVideoTracks: () => [tracks[0]], getAudioTracks: () => [] }
  let audioStopped = false
  let captureConstraints
  let failed
  const source = { id: 'window:123:0', source_type: 'window', width: 1920, height: 1080 }
  const room = {
    state: 'connected',
    localParticipant: {
      trackPublications: new Map(),
      async publishTrack(track, options) {
        if (publicationFailure && track.kind === 'video') throw new Error('Publication failed')
        this.trackPublications.set(track.kind, { track, source: options.source })
      },
      async unpublishTrack(track) { this.trackPublications.delete(track.kind); track.stop() },
    },
  }
  const api = loadTypescript('src/media/screenShare.ts', {
    'livekit-client': { Track: { Source: { ScreenShare: 'screen', ScreenShareAudio: 'screen-audio' } }, AudioPresets: { musicStereo: {} } },
    './isolatedAudio': { captureIsolatedAudio: async (_id, onError) => { failed = onError; if (audioFailure) throw new Error('Isolated audio unavailable'); return { track: tracks[1], stop: async () => { audioStopped = true; tracks[1].stop() } } } },
  }, { window: { contalkDesktop: {} }, navigator: { mediaDevices: { getUserMedia: async constraints => { captureConstraints = constraints; return stream } } } })
  return { ...api, room, source, tracks, get audioStopped() { return audioStopped }, get constraints() { return captureConstraints }, fail: message => failed(message) }
}
const options = { audio: true, resolution: '1080', fps: 30 }
test('desktop video never requests system audio; stopping removes both publications', async () => {
  const f = fixture()
  let ended = 0
  await f.startScreenShare(f.room, f.source, options, () => ended++, () => {})
  assert.equal(f.constraints.audio, false)
  assert.equal(f.room.localParticipant.trackPublications.size, 2)
  await f.stopScreenShare(f.room)
  assert.ok(f.audioStopped)
  assert.ok(f.tracks.every(track => track.stopped))
  assert.equal(f.room.localParticipant.trackPublications.size, 0)
  assert.equal(ended, 0)
})
test('isolated audio failure aborts without a system-audio fallback', async () => {
  const f = fixture({ audioFailure: true })
  await assert.rejects(f.startScreenShare(f.room, f.source, options, () => {}, () => {}), /Isolated audio unavailable/)
  assert.equal(f.room.localParticipant.trackPublications.size, 0)
  assert.ok(f.tracks[0].stopped)
  assert.equal(f.constraints.audio, false)
})
test('failed video publication rolls back an already published audio track', async () => {
  const f = fixture({ publicationFailure: true })
  await assert.rejects(f.startScreenShare(f.room, f.source, options, () => {}, () => {}), /Publication failed/)
  assert.equal(f.room.localParticipant.trackPublications.size, 0)
  assert.ok(f.tracks.every(track => track.stopped))
  assert.ok(f.audioStopped)
})
test('an ended video stops audio and does not toggle capture back on', async () => {
  const f = fixture()
  let resolveEnded
  const ended = new Promise(resolve => { resolveEnded = resolve })
  await f.startScreenShare(f.room, f.source, options, resolveEnded, () => {})
  f.tracks[0].onended()
  await ended
  assert.equal(f.room.localParticipant.trackPublications.size, 0)
  assert.ok(f.audioStopped)
})
test('helper failure stops the broadcast and reports the cause', async () => {
  const f = fixture()
  let reported
  let resolveEnded
  const ended = new Promise(resolve => { resolveEnded = resolve })
  await f.startScreenShare(f.room, f.source, options, resolveEnded, message => { reported = message })
  f.fail('Audio device lost')
  await ended
  assert.equal(reported, 'Audio device lost')
  assert.equal(f.room.localParticipant.trackPublications.size, 0)
  assert.ok(f.audioStopped)
})
