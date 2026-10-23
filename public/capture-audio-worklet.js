/* A bounded PCM queue keeps IPC scheduling jitter out of the published track. */
class ContalkPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.capacity = 24000
    this.left = new Float32Array(this.capacity)
    this.right = new Float32Array(this.capacity)
    this.write = 0
    this.read = 0
    this.started = false
    this.carry = new Uint8Array(0)
    this.last = [0, 0]
    this.port.onmessage = ({ data }) => this.enqueue(data)
  }
  enqueue(data) {
    if (!(data instanceof Uint8Array)) return
    const bytes = new Uint8Array(this.carry.length + data.length)
    bytes.set(this.carry); bytes.set(data, this.carry.length)
    const frames = Math.floor(bytes.length / 8)
    const view = new DataView(bytes.buffer)
    for (let i = 0; i < frames; i++) {
      const offset = this.write % this.capacity
      const left = view.getFloat32(i * 8, true)
      const right = view.getFloat32(i * 8 + 4, true)
      this.left[offset] = Number.isFinite(left) ? Math.max(-1, Math.min(1, left)) : 0
      this.right[offset] = Number.isFinite(right) ? Math.max(-1, Math.min(1, right)) : 0
      this.write++
    }
    this.carry = bytes.slice(frames * 8)
    // Drop stale samples after a suspended renderer instead of growing delay.
    if (this.write - this.read > 4800) { this.read = this.write - 2400; this.started = false }
  }
  process(_inputs, outputs) {
    const output = outputs[0]
    if (!output || !output[0]) return true
    if (!this.started && this.write - this.read >= 1920) this.started = true
    const step = 48000 / sampleRate
    for (let i = 0; i < output[0].length; i++) {
      if (this.started && this.read + 1 < this.write) {
        const first = Math.floor(this.read) % this.capacity
        const second = (first + 1) % this.capacity
        const fraction = this.read - Math.floor(this.read)
        this.last[0] = this.left[first] * (1 - fraction) + this.left[second] * fraction
        this.last[1] = this.right[first] * (1 - fraction) + this.right[second] * fraction
        this.read += step
      } else {
        this.started = false
        this.last[0] *= 0.95
        this.last[1] *= 0.95
      }
      output[0][i] = this.last[0]
      if (output[1]) output[1][i] = this.last[1]
    }
    return true
  }
}
registerProcessor('contalk-pcm', ContalkPcmProcessor)
