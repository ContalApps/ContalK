/**
 * ConTALK auditory cues for voice channels.
 * Synthesized using Web Audio API: 0 network bytes, zero latency, pleasant harmonic profile.
 * Each cue creates an interactive AudioContext that is closed upon sound completion
 * to ensure hardware streams are fully closed, preventing DAC idle hiss on analog/USB headsets.
 */

/**
 * Soft, elegant two-tone chime when another participant joins the voice channel.
 * Plays ascending fourth: Eb5 (622.25 Hz) -> Ab5 (830.61 Hz) with gentle exponential decay.
 */
export function playChannelJoinSound(outputDeviceId?: string): void {
  if (typeof window === 'undefined') return
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioCtx) return

  try {
    const ctx = new AudioCtx({ latencyHint: 'interactive' })
    if (outputDeviceId && outputDeviceId !== 'default' && 'setSinkId' in ctx) {
      void (ctx as any).setSinkId(outputDeviceId).catch(() => {})
    }

    const now = ctx.currentTime
    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.18, now)
    masterGain.connect(ctx.destination)

    // Tone 1: Eb5 (622.25 Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(622.25, now)
    gain1.gain.setValueAtTime(0.001, now)
    gain1.gain.exponentialRampToValueAtTime(0.7, now + 0.02)
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    osc1.connect(gain1).connect(masterGain)
    osc1.start(now)
    osc1.stop(now + 0.2)

    // Tone 2: Ab5 (830.61 Hz)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(830.61, now + 0.09)
    gain2.gain.setValueAtTime(0.001, now + 0.09)
    gain2.gain.exponentialRampToValueAtTime(0.9, now + 0.11)
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.38)
    osc2.connect(gain2).connect(masterGain)
    osc2.start(now + 0.09)
    osc2.stop(now + 0.4)

    // Close the audio context completely when playback is done so no residual stream/hardware hiss remains
    setTimeout(() => {
      masterGain.disconnect()
      void ctx.close().catch(() => {})
    }, 450)
  } catch {
    // Audio synthesis failure should never crash the application
  }
}

/**
 * Subtle confirmation tone when local user joins a voice channel.
 * Gentle rising triad: C5 (523.25 Hz) -> E5 (659.25 Hz) -> G5 (783.99 Hz).
 */
export function playSelfJoinSound(outputDeviceId?: string): void {
  if (typeof window === 'undefined') return
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioCtx) return

  try {
    const ctx = new AudioCtx({ latencyHint: 'interactive' })
    if (outputDeviceId && outputDeviceId !== 'default' && 'setSinkId' in ctx) {
      void (ctx as any).setSinkId(outputDeviceId).catch(() => {})
    }

    const now = ctx.currentTime
    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.12, now)
    masterGain.connect(ctx.destination)

    const notes = [
      { freq: 523.25, time: 0.0, dur: 0.14 },
      { freq: 659.25, time: 0.07, dur: 0.16 },
      { freq: 783.99, time: 0.14, dur: 0.26 },
    ]

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + time)
      gain.gain.setValueAtTime(0.001, now + time)
      gain.gain.exponentialRampToValueAtTime(0.6, now + time + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur)
      osc.connect(gain).connect(masterGain)
      osc.start(now + time)
      osc.stop(now + time + dur + 0.02)
    })

    // Close the audio context completely when playback is done so no residual stream/hardware hiss remains
    setTimeout(() => {
      masterGain.disconnect()
      void ctx.close().catch(() => {})
    }, 450)
  } catch {
    // Audio synthesis failure should never crash the application
  }
}
