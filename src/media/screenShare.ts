import { Room, Track, AudioPresets } from './realtime'
import { captureIsolatedAudio, type IsolatedAudio } from './isolatedAudio'

export interface ShareOptions { audio: boolean; fps: number; resolution: string }
export interface ShareSource { id: string; source_type: 'monitor' | 'window'; width: number; height: number }
let active: { room: Room; stream: MediaStream; isolated?: IsolatedAudio } | null = null
let busy = false

export async function stopScreenShare(room: Room) {
  const publications = [...room.localParticipant.trackPublications.values()].filter(pub => pub.source === Track.Source.ScreenShare || pub.source === Track.Source.ScreenShareAudio)
  const session = active?.room === room ? active : null
  if (session) {
    active = null
    session.stream.getTracks().forEach(track => { track.onended = null; track.stop() })
    await session.isolated?.stop()
  }
  await Promise.allSettled(publications.map(pub => pub.track ? room.localParticipant.unpublishTrack(pub.track, true) : Promise.resolve()))
}

export async function startScreenShare(room: Room, source: ShareSource | null, options: ShareOptions, onEnded: () => void, onError: (message: string) => void) {
  if (busy) throw new Error('Aguarde a transmissão atual terminar de iniciar.')
  busy = true
  let stream: MediaStream | undefined
  let isolated: IsolatedAudio | undefined
  let cancelled = false
  try {
    await stopScreenShare(room)
    const width = options.resolution === '720' ? 1280 : options.resolution === 'source' ? source?.width || 1920 : 1920
    const height = options.resolution === '720' ? 720 : options.resolution === 'source' ? source?.height || 1080 : 1080
    const fps = options.fps === 60 ? 60 : 30
    const failed = (message: string) => { cancelled = true; onError(message); void stopScreenShare(room).then(onEnded) }
    if (window.contalkDesktop) {
      if (!source?.id) throw new Error('Selecione uma janela ou tela para transmitir.')
      // Video and audio are separate: desktop getUserMedia audio is system-wide.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: source.id, ...(options.resolution === 'source' ? {} : { maxWidth: width, maxHeight: height }), maxFrameRate: fps } } as MediaTrackConstraints,
      })
      if (options.audio) isolated = await captureIsolatedAudio(source.id, failed)
    } else {
      // Browser picker may supply tab audio, but never request the system mix.
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: fps, max: fps } },
        audio: options.audio ? { autoGainControl: false, echoCancellation: false, noiseSuppression: false, channelCount: 2 } : false,
        systemAudio: 'exclude', selfBrowserSurface: 'exclude', surfaceSwitching: 'exclude',
      } as DisplayMediaStreamOptions)
      if (options.audio && stream.getAudioTracks().length === 0) throw new Error('Essa fonte não oferece áudio isolado. Escolha uma aba com áudio ou desative a opção de áudio.')
    }
    if (cancelled || room.state !== 'connected') throw new Error('A transmissão foi interrompida antes de iniciar.')
    const video = stream.getVideoTracks()[0]
    if (!video) throw new Error('A fonte selecionada não forneceu vídeo.')
    video.contentHint = 'detail'
    active = { room, stream, isolated }
    const audio = isolated?.track || stream.getAudioTracks()[0]
    // Publish audio first. Never leave video live after a failed audio publication.
    if (audio) await room.localParticipant.publishTrack(audio, {
      name: 'screen_share_audio', source: Track.Source.ScreenShareAudio,
      audioPreset: AudioPresets.musicStereo, forceStereo: true, dtx: false, red: true,
    })
    if (cancelled || active?.stream !== stream) throw new Error('Transmissão cancelada.')
    await room.localParticipant.publishTrack(video, {
      name: 'screen_share', source: Track.Source.ScreenShare,
      screenShareEncoding: { maxBitrate: fps === 60 ? 6_000_000 : 3_000_000, maxFramerate: fps },
    })
    if (cancelled || active?.stream !== stream) throw new Error('Transmissão cancelada.')
    video.onended = () => { if (active?.stream === stream) void stopScreenShare(room).then(onEnded) }
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop())
    await isolated?.stop()
    await stopScreenShare(room)
    throw error
  } finally { busy = false }
}
