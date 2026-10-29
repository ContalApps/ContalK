import { AudioPresets, createLocalAudioTrack, Room, Track, type AudioCaptureOptions } from './realtime'

// These are loopback/mixer outputs, not physical microphone inputs.
export function isLoopbackInput(label: string): boolean {
  return /stereo\s*mix|mixagem\s*est[eé]reo|what\s*u\s*hear|what\s*you\s*hear|wave\s*out|loopback|monitor\s+of|cable[- ](?:output|out)|voicemeeter.*(?:output|out\s*[ab])|sonar\s*[-:]?\s*stream|stream\s*mix/i.test(label)
}

export function microphoneOptions(deviceId?: string): AudioCaptureOptions {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: false,
    channelCount: 1,
    latency: 0,
    googEchoCancellation: true,
    googExperimentalEchoCancellation: true,
    googNoiseSuppression: true,
    googExperimentalNoiseSuppression: true,
    googHighpassFilter: true,
    googTypingNoiseDetection: true
  } as any
}

export async function publishSafeMicrophone(room: Room, deviceId: string, muted = false): Promise<string> {
  const track = await createLocalAudioTrack(microphoneOptions(deviceId))
  try {
    if (isLoopbackInput(track.mediaStreamTrack.label)) throw new Error('Essa entrada mistura o som do computador. Escolha o microfone físico em Configurações de áudio.')
    // Keep a replacement muted until it has been published; preserve user mute/deafen.
    if (muted || room.inputMode === 'push-to-talk') await track.mute()
    const old = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track
    if (old) await room.localParticipant.unpublishTrack(old, true)
    await room.localParticipant.publishTrack(track, {
      source: Track.Source.Microphone,
      audioPreset: AudioPresets.speech,
      forceStereo: false,
      dtx: true,
      red: true
    })
    return track.mediaStreamTrack.label
  } catch (error) {
    track.stop()
    throw error
  }
}

export async function setSafeMicrophoneEnabled(room: Room, enabled: boolean, deviceId: string): Promise<string> {
  const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone)
  if (!enabled) {
    if (room.inputMode === 'push-to-talk') await room.setPushToTalk(false)
    if (publication?.track) await publication.track.mute()
    return publication?.track?.mediaStreamTrack.label || ''
  }
  if (!publication?.track || publication.track.mediaStreamTrack.readyState === 'ended') return publishSafeMicrophone(room, deviceId)
  if (isLoopbackInput(publication.track.mediaStreamTrack.label)) {
    await room.localParticipant.unpublishTrack(publication.track, true)
    throw new Error('Entrada de loopback bloqueada. Selecione um microfone físico.')
  }
  if (room.inputMode !== 'push-to-talk') await publication.track.unmute()
  return publication.track.mediaStreamTrack.label
}
