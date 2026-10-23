export interface IsolatedAudio {
  track: MediaStreamTrack
  stop: () => Promise<void>
}

export async function captureIsolatedAudio(sourceId: string, onError: (error: string) => void): Promise<IsolatedAudio> {
  const desktop = window.contalkDesktop
  if (!desktop?.startCaptureAudio) throw new Error('Instale a versão mais recente do ConTALK para transmitir áudio isolado.')
  const context = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' })
  let sessionId: string | undefined
  let node: AudioWorkletNode | undefined
  let unsubscribeData = () => {}
  let unsubscribeError = () => {}
  let stopped = false
  const stop = async () => {
    if (stopped) return
    stopped = true
    unsubscribeData(); unsubscribeError()
    node?.disconnect()
    if (sessionId) await desktop.stopCaptureAudio(sessionId).catch(() => {})
    await context.close().catch(() => {})
  }
  try {
    await context.audioWorklet.addModule(new URL('capture-audio-worklet.js', document.baseURI).href)
    node = new AudioWorkletNode(context, 'contalk-pcm', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] })
    const destination = context.createMediaStreamDestination()
    node.connect(destination)
    // Deliberately never connect captured audio to context.destination (speakers).
    unsubscribeData = desktop.onCaptureAudioData(event => {
      if (event.sessionId === sessionId && !stopped) node?.port.postMessage(event.data)
    })
    unsubscribeError = desktop.onCaptureAudioError(event => {
      if (event.sessionId === sessionId && !stopped) { onError(event.error); void stop() }
    })
    const capture = await desktop.startCaptureAudio(sourceId)
    sessionId = capture.sessionId
    if (capture.sampleRate !== 48000 || capture.channels !== 2) throw new Error('Formato de áudio incompatível.')
    await context.resume()
    const track = destination.stream.getAudioTracks()[0]
    if (!track) throw new Error('Não foi possível criar a faixa de áudio da transmissão.')
    return { track, stop }
  } catch (error) { await stop(); throw error }
}
