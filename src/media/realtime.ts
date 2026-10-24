import { Device } from 'mediasoup-client'
import type { types } from 'mediasoup-client'

class Events {
  private handlers = new Map<string, Set<(...args: any[]) => void>>()
  on(event: string, callback: (...args: any[]) => void) { if (!this.handlers.has(event)) this.handlers.set(event, new Set()); this.handlers.get(event)!.add(callback); return this }
  off(event: string, callback: (...args: any[]) => void) { this.handlers.get(event)?.delete(callback); return this }
  once(event: string, callback: (...args: any[]) => void) { const fn = (...args: any[]) => { this.off(event, fn); callback(...args) }; return this.on(event, fn) }
  emit(event: string, ...args: any[]) { this.handlers.get(event)?.forEach(callback => callback(...args)) }
  removeAllListeners() { this.handlers.clear() }
}
export const RoomEvent = Object.fromEntries(['Connected','Disconnected','Reconnecting','Reconnected','ParticipantConnected','ParticipantDisconnected','ParticipantMetadataChanged','ParticipantNameChanged','DataReceived','TrackPublished','TrackUnpublished','LocalTrackPublished','LocalTrackUnpublished','TrackSubscribed','TrackUnsubscribed','TrackMuted','TrackUnmuted','ActiveSpeakersChanged'].map(name => [name,name]))
export type RoomEvent = string
export const ParticipantEvent = { IsSpeakingChanged: 'IsSpeakingChanged' }
export type AudioCaptureOptions = MediaTrackConstraints
export const AudioPresets = { speech: { maxBitrate: 32000 }, musicStereo: { maxBitrate: 128000 } }
export class Track {
  static Source = { Microphone: 'microphone', Camera: 'camera', ScreenShare: 'screen_share', ScreenShareAudio: 'screen_share_audio' } as const
  static Kind = { Audio: 'audio', Video: 'video' } as const
  private elements = new Set<HTMLMediaElement>()
  private context?: AudioContext
  private gain?: GainNode
  private output?: MediaStream
  private volume = 1
  isMuted = false
  onMute?: (muted: boolean) => Promise<void>
  constructor(public mediaStreamTrack: MediaStreamTrack) {}
  get kind() { return this.mediaStreamTrack.kind }
  attach(element?: HTMLMediaElement) {
    const el = element || document.createElement(this.kind === 'audio' ? 'audio' : 'video')
    let stream = new MediaStream([this.mediaStreamTrack])
    if (this.kind === 'audio') {
      if (!this.context) {
        this.context = new AudioContext(); this.gain = this.context.createGain()
        const destination = this.context.createMediaStreamDestination()
        this.context.createMediaStreamSource(stream).connect(this.gain).connect(destination)
        this.output = destination.stream; this.gain.gain.value = this.volume
      }
      stream = this.output!; void this.context.resume()
    }
    el.srcObject = stream; el.autoplay = true
    this.elements.add(el); void el.play().catch(() => {})
    return el
  }
  detach(element?: HTMLMediaElement) { const list = element ? [element] : [...this.elements]; for (const el of list) { el.srcObject = null; this.elements.delete(el) }; return list }
  setVolume(volume: number) { this.volume = Math.max(0,Math.min(2,volume)); if (this.gain) this.gain.gain.value = this.volume }
  async mute() { await this.onMute?.(true); this.isMuted = true; this.mediaStreamTrack.enabled = false }
  async unmute() { await this.onMute?.(false); this.isMuted = false; this.mediaStreamTrack.enabled = true }
  stop() { this.detach().forEach(element => element.remove()); this.mediaStreamTrack.stop(); void this.context?.close(); this.context = undefined }
}
export type RemoteTrack = Track
type Publication = { source: string; track: Track; audioTrack?: Track; isMuted: boolean; producerId: string; options?: any }
export class Participant extends Events {
  identity = ''; name = ''; metadata = ''; isSpeaking = false
  trackPublications = new Map<string, Publication>()
  get audioTrackPublications() { return new Map([...this.trackPublications].filter(([,pub]) => pub.track.kind === 'audio')) }
  getTrackPublication(source: string) { return [...this.trackPublications.values()].find(pub => pub.source === source) }
  get isMicrophoneEnabled() { const pub = this.getTrackPublication(Track.Source.Microphone); return !!pub && !pub.isMuted }
  get isCameraEnabled() { const pub = this.getTrackPublication(Track.Source.Camera); return !!pub && !pub.isMuted }
  get isScreenShareEnabled() { return !!this.getTrackPublication(Track.Source.ScreenShare) }
}
export async function createLocalAudioTrack(options: MediaTrackConstraints) { const stream = await navigator.mediaDevices.getUserMedia({ audio: options, video: false }); return new Track(stream.getAudioTracks()[0]) }
class LocalParticipant extends Participant {
  constructor(private room: Room) { super() }
  async setMetadata(metadata: string) { await this.room.request('profile', { metadata }); this.metadata = metadata }
  async setName(name: string) { await this.room.request('profile', { name }); this.name = name }
  async publishData(payload: Uint8Array, options: { topic?: string; destinationIdentities?: string[]; reliable?: boolean }) { await this.room.request('data', { payload: new TextDecoder().decode(payload), topic: options.topic || '', destinations: options.destinationIdentities }) }
  async publishTrack(input: Track | MediaStreamTrack, options: any) { return this.room.publish(input instanceof Track ? input : new Track(input), options) }
  async unpublishTrack(track: Track | MediaStreamTrack, stop = true) { const pub = [...this.trackPublications.values()].find(pub => pub.track === track || pub.track.mediaStreamTrack === track); if (pub) await this.room.unpublish(pub, stop) }
  async setCameraEnabled(enabled: boolean) {
    const previous = this.getTrackPublication(Track.Source.Camera)
    if (!enabled) { if (previous) await this.unpublishTrack(previous.track); return }
    if (!previous) { const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } }); try { await this.publishTrack(stream.getVideoTracks()[0], { source: Track.Source.Camera }) } catch (error) { stream.getTracks().forEach(track => track.stop()); throw error } }
  }
}
type Authority = { url: string; token: string }
export class Room extends Events {
  state = 'disconnected'
  localParticipant = new LocalParticipant(this)
  remoteParticipants = new Map<string, Participant>()
  private socket?: WebSocket
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>()
  private sequence = 0
  private device?: Device
  private sendTransport?: types.Transport
  private recvTransport?: types.Transport
  private producers = new Map<string, types.Producer>()
  private consumers = new Map<string, types.Consumer>()
  private consuming = new Set<string>()
  private ended = false
  private reconnecting = false
  private reconnectTracks: Publication[] = []
  private outputDevice = 'default'
  private authority?: Authority
  constructor(private options: { presence?: boolean; tokenProvider?: () => Promise<Authority | null> } = {}) { super() }
  request(method: string, data?: unknown): Promise<any> {
    return new Promise((resolve,reject) => {
      if (this.socket?.readyState !== WebSocket.OPEN) { reject(new Error('A sinalização está desconectada.')); return }
      const id = ++this.sequence
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('O servidor de comunicação não respondeu.')) }, 10000)
      this.pending.set(id,{resolve,reject,timer}); this.socket.send(JSON.stringify({id,method,data}))
    })
  }
  async connect(url: string, token: string) {
    this.authority = {url,token}; this.ended = false
    await this.open(this.authority)
    this.state = 'connected'; this.emit(RoomEvent.Connected)
  }
  private async open(authority: Authority) {
    const socket = new WebSocket(authority.url); this.socket = socket
    await new Promise<void>((resolve,reject) => {
      const timer = setTimeout(() => { socket.close(); reject(new Error('WebSocket não respondeu.')) },10000)
      socket.onopen = () => { clearTimeout(timer); resolve() }
      socket.onerror = () => { clearTimeout(timer); reject(new Error('Falha no WebSocket da comunidade.')) }
      socket.onclose = () => { clearTimeout(timer); reject(new Error('Conexão recusada. Verifique sua chave da comunidade.')) }
    })
    if (this.ended) { socket.close(); throw new Error('Conexão cancelada.') }
    socket.onmessage = message => {
      if (this.socket !== socket) return
      try {
        const packet = JSON.parse(message.data)
        if (packet.id && this.pending.has(packet.id)) { const pending = this.pending.get(packet.id)!; this.pending.delete(packet.id); clearTimeout(pending.timer); if (packet.error) pending.reject(new Error(packet.error)); else pending.resolve(packet.data) }
        else if (packet.event) void this.handle(packet.event,packet.data).catch(() => this.emit(RoomEvent.TrackUnpublished))
      } catch { /* Reject malformed frames without logging private data. */ }
    }
    socket.onclose = event => {
      if (this.socket !== socket) return
      for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('Conexão encerrada.')) }; this.pending.clear()
      if (this.ended) return
      if ([4003,4009].includes(event.code)) { void this.disconnect(); return }
      void this.reconnect()
    }
    // Auth uses the first frame; no tickets appear in URLs/proxy access logs.
    const id = ++this.sequence
    const auth = await new Promise<any>((resolve,reject) => { const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Autenticação não respondeu.')) },10000); this.pending.set(id,{resolve,reject,timer}); socket.send(JSON.stringify({id,method:'auth',token:authority.token})) })
    Object.assign(this.localParticipant, auth.self)
    for (const peer of auth.peers) this.addPeer(peer)
    if (!this.options.presence) {
      const capabilities = await this.request('capabilities')
      this.device = new Device(); await this.device.load(capabilities)
      for (const direction of ['send','recv'] as const) {
        const config = await this.request('createTransport',{direction})
        const transport = direction === 'send' ? this.device.createSendTransport(config) : this.device.createRecvTransport(config)
        transport.on('connect',({dtlsParameters},done,fail) => { this.request('connectTransport',{transportId:transport.id,dtlsParameters}).then(() => done()).catch(fail) })
        transport.on('connectionstatechange',state => { if (state === 'failed' && !this.ended) { this.socket?.close(); void this.reconnect() } })
        if (direction === 'send') {
          this.sendTransport = transport
          transport.on('produce',({kind,rtpParameters,appData},done,fail) => { this.request('produce',{transportId:transport.id,kind,rtpParameters,source:appData.source,paused:appData.paused}).then(done).catch(fail) })
        } else this.recvTransport = transport
      }
      for (const producer of await this.request('producers')) await this.consume(producer)
    }
  }
  private addPeer(data: any) { let peer = this.remoteParticipants.get(data.identity); if (!peer) { peer = new Participant(); this.remoteParticipants.set(data.identity,peer) }; Object.assign(peer,data); this.emit(RoomEvent.ParticipantConnected,peer); return peer }
  private async handle(event: string, data: any) {
    if (event === 'joined' && data.identity !== this.localParticipant.identity) this.addPeer(data)
    if (event === 'left') { const peer = this.remoteParticipants.get(data.identity); if (peer) for (const pub of peer.trackPublications.values()) { pub.track.stop(); this.emit(RoomEvent.TrackUnsubscribed,pub.track) }; this.remoteParticipants.delete(data.identity); this.emit(RoomEvent.ParticipantDisconnected,peer) }
    if (event === 'profile') { const peer = data.identity === this.localParticipant.identity ? this.localParticipant : this.remoteParticipants.get(data.identity); if (peer) Object.assign(peer,data); this.emit(RoomEvent.ParticipantMetadataChanged); this.emit(RoomEvent.ParticipantNameChanged) }
    if (event === 'data') this.emit(RoomEvent.DataReceived,new TextEncoder().encode(data.payload),this.remoteParticipants.get(data.participant.identity),undefined,data.topic)
    if (event === 'producer' && data.identity !== this.localParticipant.identity && this.recvTransport) await this.consume(data)
    if (event === 'producerClosed') {
      const local = this.localParticipant.trackPublications.get(data.producerId)
      if (local) { this.producers.get(data.producerId)?.close(); this.producers.delete(data.producerId); local.track.stop(); this.localParticipant.trackPublications.delete(data.producerId); this.emit(RoomEvent.LocalTrackUnpublished,local) }
      for (const peer of this.remoteParticipants.values()) { const pub = peer.trackPublications.get(data.producerId); if (pub) { pub.track.stop(); peer.trackPublications.delete(data.producerId); this.emit(RoomEvent.TrackUnsubscribed,pub.track) } }
      this.emit(RoomEvent.TrackUnpublished)
    }
    if (event === 'consumerClosed') { this.consumers.get(data.consumerId)?.close(); this.consumers.delete(data.consumerId) }
    if (event === 'producerPaused') { for (const peer of [this.localParticipant,...this.remoteParticipants.values()]) { const pub = peer.trackPublications.get(data.producerId); if (pub) pub.isMuted = data.paused }; this.emit(data.paused ? RoomEvent.TrackMuted : RoomEvent.TrackUnmuted) }
    if (event === 'speakers') {
      for (const peer of [this.localParticipant,...this.remoteParticipants.values()]) { const speaking = data.includes(peer.identity); if (peer.isSpeaking !== speaking) { peer.isSpeaking = speaking; peer.emit(ParticipantEvent.IsSpeakingChanged,speaking) } }
      this.emit(RoomEvent.ActiveSpeakersChanged,[this.localParticipant,...this.remoteParticipants.values()].filter(peer => peer.isSpeaking))
    }
  }
  private async consume(info: any) {
    if (!this.recvTransport || !this.device || this.consuming.has(info.producerId) || [...this.consumers.values()].some(consumer => consumer.producerId === info.producerId)) return
    this.consuming.add(info.producerId)
    try {
      const config = await this.request('consume',{transportId:this.recvTransport.id,producerId:info.producerId,rtpCapabilities:this.device.recvRtpCapabilities})
      const consumer = await this.recvTransport.consume(config); this.consumers.set(consumer.id,consumer)
      const peer = this.remoteParticipants.get(config.identity) || this.addPeer({identity:config.identity,name:config.identity})
      const track = new Track(consumer.track)
      const pub = {source:config.source,track,...(track.kind === 'audio'?{audioTrack:track}:{}),isMuted:config.paused,producerId:config.producerId}
      peer.trackPublications.set(config.producerId,pub)
      this.emit(RoomEvent.TrackSubscribed,track,pub,peer)
      await this.switchActiveDevice('audiooutput',this.outputDevice)
      await this.request('resumeConsumer',{consumerId:consumer.id})
    } finally { this.consuming.delete(info.producerId) }
  }
  async publish(track: Track, options: any) {
    if (!this.sendTransport) throw new Error('O transporte de mídia não está conectado.')
    const encoding = options.screenShareEncoding || options.audioPreset
    const producer = await this.sendTransport.produce({ track:track.mediaStreamTrack, stopTracks:false, appData:{source:options.source,paused:track.isMuted}, ...(encoding?{encodings:[encoding]}:{}), ...(track.kind === 'audio'?{codecOptions:{opusStereo:options.forceStereo?true:false,opusDtx:!!options.dtx}}:{}) })
    this.producers.set(producer.id,producer)
    const pub: Publication = {source:options.source,track,producerId:producer.id,isMuted:track.isMuted,options}
    if (track.isMuted) producer.pause()
    track.onMute = async paused => { await this.request('producerControl',{producerId:producer.id,action:paused?'pause':'resume'}); if (paused) producer.pause(); else producer.resume(); pub.isMuted = paused }
    this.localParticipant.trackPublications.set(producer.id,pub)
    this.emit(RoomEvent.LocalTrackPublished,pub); return pub
  }
  async unpublish(pub: Publication, stop: boolean) { this.producers.get(pub.producerId)?.close(); this.producers.delete(pub.producerId); this.localParticipant.trackPublications.delete(pub.producerId); if (stop) pub.track.stop(); if (this.socket?.readyState === WebSocket.OPEN) await this.request('producerControl',{producerId:pub.producerId,action:'close'}).catch(() => {}); this.emit(RoomEvent.LocalTrackUnpublished,pub) }
  async switchActiveDevice(_kind: string, deviceId: string) { this.outputDevice = deviceId; const audio = document.querySelectorAll<HTMLAudioElement>('#contalk-audio-tracks audio'); for (const el of audio) if ('setSinkId' in el) await (el as HTMLAudioElement & {setSinkId:(id:string)=>Promise<void>}).setSinkId(deviceId); return true }
  private clearRemote() { for (const peer of this.remoteParticipants.values()) for (const pub of peer.trackPublications.values()) { pub.track.stop(); this.emit(RoomEvent.TrackUnsubscribed,pub.track) }; this.remoteParticipants.clear(); this.sendTransport?.close(); this.recvTransport?.close(); this.producers.clear(); this.consumers.clear(); this.consuming.clear() }
  private async reconnect() {
    if (this.ended || this.reconnecting) return
    this.reconnecting = true; this.state = 'reconnecting'; this.emit(RoomEvent.Reconnecting)
    const tracks = [...this.localParticipant.trackPublications.values()]; this.reconnectTracks = tracks; this.localParticipant.trackPublications.clear(); this.clearRemote()
    const metadata = this.localParticipant.metadata, name = this.localParticipant.name
    for (let attempt = 0; attempt < 6 && !this.ended; attempt++) {
      await new Promise(resolve => setTimeout(resolve,Math.min(8000,1000 * 2 ** attempt)))
      if (this.ended) break
      try {
        const authority = await this.options.tokenProvider?.()
        if (!authority) throw new Error('Reconecte a comunidade.')
        await this.open(authority)
        if (this.ended) break
        await this.localParticipant.setName(name); await this.localParticipant.setMetadata(metadata)
        for (const pub of tracks) if (pub.track.mediaStreamTrack.readyState === 'live') { try { await this.publish(pub.track,pub.options || {source:pub.source}) } catch { pub.track.stop() } }
        this.state = 'connected'; this.reconnecting = false; this.reconnectTracks = []; this.emit(RoomEvent.Reconnected); return
      } catch { this.socket?.close(); this.clearRemote() }
    }
    tracks.forEach(pub => pub.track.stop()); this.reconnecting = false; await this.disconnect()
  }
  async disconnect() { if (this.ended) return; this.ended = true; this.socket?.close(); this.clearRemote(); for (const pub of [...this.localParticipant.trackPublications.values(), ...this.reconnectTracks]) pub.track.stop(); this.reconnectTracks = []; this.localParticipant.trackPublications.clear(); this.state = 'disconnected'; this.emit(RoomEvent.Disconnected) }
}
