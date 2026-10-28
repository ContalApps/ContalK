import { AudioPresets, createLocalAudioTrack, Room, Track, type AudioCaptureOptions } from './realtime'

// These are loopback/mixer outputs, not physical microphone inputs.
export function isLoopbackInput(label: string): boolean {
  return /stereo\s*mix|mixagem\s*est[eé]reo|what\s*u\s*hear|what\s*you\s*hear|wave\s*out|loopback|monitor\s+of|cable[- ](?:output|out)|voicemeeter.*(?:output|out\s*[ab])|sonar\s*[-:]?\s*stream|stream\s*mix|alto-falantes|speakers(?!\s*mic)|auriculares|headphones(?!\s*mic)|output\s*monitor/i.test(label)
}

export function microphoneOptions(deviceId?: string): AudioCaptureOptions {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: false,
    channelCount: 1,
    googEchoCancellation: true,
    googExperimentalEchoCancellation: true,
    googNoiseSuppression: true,
    googExperimentalNoiseSuppression: true,
    googHighpassFilter: true
  } as any
}

let activeGate: {
  ctx?: AudioContext
  timer?: ReturnType<typeof setInterval>
  stream?: MediaStream
  stop: () => void
} | null = null

export function stopVoiceActivityGate() {
  if (activeGate) {
    activeGate.stop()
    activeGate = null
  }
}

export function setupVoiceActivityGate(room: Room, track: Track) {
  stopVoiceActivityGate()
  if (typeof window === 'undefined' || typeof (window as any).AudioContext === 'undefined') return

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new AudioCtx()
    const stream = new MediaStream([track.mediaStreamTrack])
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)

    const samples = new Uint8Array(analyser.fftSize)
    let holdUntil = 0
    let autoFloor = 8

    const interval = setInterval(() => {
      if (track.mediaStreamTrack.readyState === 'ended' || room.state !== 'connected') {
        stopVoiceActivityGate()
        return
      }

      if (room.inputMode === 'push-to-talk') return

      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (let i = 0; i < samples.length; i++) {
        const v = (samples[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / samples.length)
      const currentLevel = Math.min(100, rms * 250)

      if (currentLevel < autoFloor + 5) {
        autoFloor = autoFloor * 0.96 + currentLevel * 0.04
      }

      let isAuto = true
      let userThreshold = 20
      try {
        if (typeof localStorage !== 'undefined') {
          const owner = localStorage.getItem('contalk-current-user-v1') || ''
          const savedStr = owner ? localStorage.getItem(`contalk-preferences-v1:${owner}`) : null
          if (savedStr) {
            const parsed = JSON.parse(savedStr)
            if (typeof parsed.voiceAutoSensitivity === 'boolean') isAuto = parsed.voiceAutoSensitivity
            if (typeof parsed.voiceSensitivity === 'number') userThreshold = parsed.voiceSensitivity
          }
        }
      } catch {}

      const threshold = isAuto
        ? Math.max(16, Math.min(45, Math.round(autoFloor + 12)))
        : userThreshold

      const now = Date.now()
      if (currentLevel >= threshold) {
        holdUntil = now + 420
        if (!track.mediaStreamTrack.enabled && !track.isMuted) {
          track.mediaStreamTrack.enabled = true
        }
        if (!room.localParticipant.isSpeaking) {
          room.localParticipant.isSpeaking = true
          room.localParticipant.emit('IsSpeakingChanged', true)
        }
      } else if (now > holdUntil) {
        // Abaixo do limiar: SILÊNCIO. Corta vazamento de vídeos, música e som ambiente do PC
        if (track.mediaStreamTrack.enabled && !track.isMuted) {
          track.mediaStreamTrack.enabled = false
        }
        if (room.localParticipant.isSpeaking) {
          room.localParticipant.isSpeaking = false
          room.localParticipant.emit('IsSpeakingChanged', false)
        }
      }
    }, 35)

    const stop = () => {
      clearInterval(interval)
      stream.getTracks().forEach(t => t.stop())
      void ctx.close().catch(() => {})
    }

    activeGate = { ctx, timer: interval, stream, stop }
  } catch {
    // Falha do Web Audio não interrompe o áudio WebRTC padrão
  }
}

export async function publishSafeMicrophone(room: Room, deviceId: string, muted = false): Promise<string> {
  const track = await createLocalAudioTrack(microphoneOptions(deviceId))
  try {
    if (isLoopbackInput(track.mediaStreamTrack.label)) throw new Error('Essa entrada mistura o som do computador. Escolha o microfone físico em Configurações de áudio.')
    // Keep a replacement muted until it has been published; preserve user mute/deafen.
    if (muted||room.inputMode==='push-to-talk') await track.mute()
    const old = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track
    if (old) await room.localParticipant.unpublishTrack(old, true)
    await room.localParticipant.publishTrack(track, { source: Track.Source.Microphone, audioPreset: AudioPresets.speech, forceStereo: false, dtx: true, red: true })
    setupVoiceActivityGate(room, track)
    return track.mediaStreamTrack.label
  } catch (error) { track.stop(); throw error }
}

export async function setSafeMicrophoneEnabled(room: Room, enabled: boolean, deviceId: string): Promise<string> {
  const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone)
  if (!enabled) {
    stopVoiceActivityGate()
    if(room.inputMode==='push-to-talk')await room.setPushToTalk(false);
    if (publication?.track) await publication.track.mute();
    return publication?.track?.mediaStreamTrack.label || ''
  }
  if (!publication?.track || publication.track.mediaStreamTrack.readyState === 'ended') return publishSafeMicrophone(room, deviceId)
  if (isLoopbackInput(publication.track.mediaStreamTrack.label)) {
    stopVoiceActivityGate()
    await room.localParticipant.unpublishTrack(publication.track, true)
    throw new Error('Entrada de loopback bloqueada. Selecione um microfone físico.')
  }
  if(room.inputMode!=='push-to-talk') {
    await publication.track.unmute()
    setupVoiceActivityGate(room, publication.track)
  }
  return publication.track.mediaStreamTrack.label
}
