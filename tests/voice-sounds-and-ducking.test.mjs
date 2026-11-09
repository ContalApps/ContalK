import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { loadTypescript } from './load-typescript.mjs'

const user = { username: 'test-user', display_name: 'Test User' }

function fixture() {
  const roleState = { status: 'connected', serverId: 'group', owner: user.username }
  let state
  const rooms = []
  const container = { innerHTML: '', appendChild() {}, querySelectorAll: () => [] }
  const soundEvents = []

  const create = (init) => {
    const get = () => state
    const set = (value) => {
      state = { ...state, ...(typeof value === 'function' ? value(state) : value) }
    }
    state = init(set, get)
    return { getState: get }
  }

  const events = new Proxy({}, { get: (_, key) => key })

  class Room extends EventEmitter {
    state = 'disconnected'
    remoteParticipants = new Map()
    prioritySpeakers = new Set()
    localParticipant = Object.assign(new EventEmitter(), {
      identity: user.username,
      name: user.display_name,
      isSpeaking: false,
      isMicrophoneEnabled: false,
      isCameraEnabled: false,
      isScreenShareEnabled: false,
      getTrackPublication: () => undefined,
      setName: async () => {},
      setMetadata: async () => {},
    })
    constructor() {
      super()
      rooms.push(this)
    }
    async connect(url, token) {
      this.endpoint = url
      this.token = token
      this.state = 'connected'
      this.emit('Connected')
    }
    async disconnect() {
      this.state = 'disconnected'
      this.emit('Disconnected')
    }
  }

  const store = loadTypescript(
    'src/store/useVoiceStore.ts',
    {
      '../media/priority-audio': loadTypescript('src/media/priority-audio.ts'),
      './useRoleStore': { useRoleStore: { getState: () => roleState } },
      '../roles/transport': {
        centralEnabled: () => true,
        centralOccupants: async () => ({}),
        centralAllows: () => true,
        centralVoiceToken: async () => ({ url: 'wss://self-hosted.invalid', token: 'test-token' }),
      },
      zustand: { create },
      '../media/realtime': {
        Room,
        RoomEvent: events,
        ParticipantEvent: { IsSpeakingChanged: 'IsSpeakingChanged' },
        Track: {
          Source: {
            Camera: 'camera',
            ScreenShare: 'screen',
            ScreenShareAudio: 'screen-audio',
            Microphone: 'microphone',
          },
          Kind: { Audio: 'audio' },
        },
      },
      '../media/microphone': {
        microphoneOptions: () => ({}),
        setSafeMicrophoneEnabled: async (room, enabled) => {
          room.localParticipant.isMicrophoneEnabled = enabled
          return 'test microphone'
        },
        publishSafeMicrophone: async (room) => {
          room.localParticipant.isMicrophoneEnabled = true
          return 'test microphone'
        },
      },
      '../media/sounds': {
        playChannelJoinSound(id) {
          soundEvents.push({ type: 'channel-join', id })
        },
        playSelfJoinSound(id) {
          soundEvents.push({ type: 'self-join', id })
        },
      },
      '../media/screenShare': { stopScreenShare: async () => {}, startScreenShare: async () => {} },
    },
    {
      window: {},
      localStorage: { getItem: () => null, setItem() {} },
      document: { getElementById: () => container },
      console: { error() {}, warn() {} },
    }
  ).useVoiceStore

  return { store, rooms, soundEvents }
}

test('joining voice channel and peer entry trigger auditory cues', async () => {
  const { store, rooms, soundEvents } = fixture()
  await store.getState().joinChannel('voice-1', 'Voice 1', user)
  assert.ok(soundEvents.some((s) => s.type === 'self-join'), 'self join sound must fire on connect')

  rooms[0].emit('ParticipantJoined', { identity: 'bob', name: 'Bob' })
  assert.ok(soundEvents.some((s) => s.type === 'channel-join'), 'channel join chime must fire when someone enters')

  await store.getState().leaveChannel()
})

test('priority ducking only lowers microphone volume while a priority speaker is actively talking', async () => {
  const { store, rooms } = fixture()
  await store.getState().joinChannel('voice-1', 'Voice 1', user)

  const track = (source) => ({
    kind: 'audio',
    source,
    gain: 1,
    setVolume(value) {
      this.gain = value
    },
    attach: () => ({}),
  })

  const aliceTrack = track('microphone')
  const bobTrack = track('microphone')

  const alicePeer = {
    identity: 'alice',
    audioTrackPublications: new Map([['mic', { source: 'microphone', audioTrack: aliceTrack }]]),
    getTrackPublication: () => undefined,
  }
  const bobPeer = {
    identity: 'bob',
    audioTrackPublications: new Map([['mic', { source: 'microphone', audioTrack: bobTrack }]]),
    getTrackPublication: () => undefined,
  }

  rooms[0].remoteParticipants.set('alice', alicePeer)
  rooms[0].remoteParticipants.set('bob', bobPeer)
  rooms[0].prioritySpeakers = new Set(['bob'])

  // Bob has priority, but Bob is NOT in activeSpeakers: Alice must NOT be ducked (100% gain)
  rooms[0].emit('PrioritySpeakersChanged')
  assert.equal(aliceTrack.gain, 1, 'Alice must not be ducked when priority speaker is silent')

  // Bob starts speaking: Bob is in activeSpeakers -> Alice's microphone is ducked to 0.25 (25%)
  rooms[0].emit('ActiveSpeakersChanged', [{ identity: 'bob' }])
  assert.equal(aliceTrack.gain, 0.25, 'Alice microphone should be ducked while priority speaker talks')

  // Bob stops speaking: activeSpeakers is empty -> Alice's microphone is restored to 1.0 (100%)
  rooms[0].emit('ActiveSpeakersChanged', [])
  assert.equal(aliceTrack.gain, 1, 'Alice microphone must immediately return to full volume')

  await store.getState().leaveChannel()
})

test('grid playback gates each stream audio across volume changes and new publications', async () => {
  const { store, rooms } = fixture()
  await store.getState().joinChannel('voice-1', 'Voice 1', user)
  const room = rooms[0]
  const audioTrack = () => ({
    kind: 'audio',
    gain: 1,
    setVolume(value) { this.gain = value },
    attach() { assert.equal(this.gain, 0); return {} },
  })
  const addPeer = identity => {
    const screen = { detach: () => [] }
    const audio = audioTrack()
    const mic = audioTrack()
    const audioPublication = { source: 'screen-audio', audioTrack: audio }
    const peer = {
      identity,
      isScreenShareEnabled: true,
      screen,
      audioTrackPublications: new Map([['stream', audioPublication], ['mic', { source: 'microphone', audioTrack: mic }]]),
      getTrackPublication(source) { return source === 'screen' && this.screen ? { track: this.screen } : undefined },
    }
    room.remoteParticipants.set(identity, peer)
    return { peer, screen, audio, mic, audioPublication }
  }
  const alice = addPeer('alice')
  const bob = addPeer('bob')

  store.getState().setGridScreenTracks(new Set())
  assert.deepEqual([alice.audio.gain, bob.audio.gain, alice.mic.gain], [0, 0, 1])
  store.getState().setGridScreenTracks(new Set([alice.screen]))
  assert.deepEqual([alice.audio.gain, bob.audio.gain], [1, 0])
  store.getState().setStreamVolume('bob', 150)
  room.emit('ServerModerationChanged')
  assert.equal(bob.audio.gain, 0)

  const carol = addPeer('carol')
  room.emit('TrackSubscribed', carol.audio, carol.audioPublication, carol.peer)
  assert.equal(carol.audio.gain, 0)
  alice.peer.screen = null
  room.emit('TrackUnsubscribed', alice.screen)
  assert.equal(alice.audio.gain, 0)
  assert.equal(store.getState().gridScreenTracks.size, 0)

  store.getState().setGridScreenTracks(new Set([bob.screen]))
  assert.deepEqual([alice.audio.gain, bob.audio.gain, carol.audio.gain], [0, 1.5, 0])
  store.getState().setGridScreenTracks(new Set())
  assert.equal(bob.audio.gain, 0)
  store.getState().setGridScreenTracks(null)
  assert.deepEqual([bob.audio.gain, carol.audio.gain], [1.5, 1])
  await store.getState().leaveChannel()
})
