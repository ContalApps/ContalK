// Read-only probes. Never print credentials, response bodies or tokenized URLs.
const base = process.env.CONTALK_VERIFY_COMMUNITY_URL || 'https://comunidade.contalapps.com.br'
const token = process.env.CONTALK_VERIFY_TOKEN
const channelId = process.env.CONTALK_VERIFY_CHANNEL || 'vc-general'
const request = async (route, body) => {
  const response = await fetch(new URL(route, base), {
    method: body ? 'POST' : 'GET',
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`Community ${route}: HTTP ${response.status}`)
  return response.json()
}
try {
  const health = await request('/health')
  if (health.status !== 'ok') throw new Error('Community health failed')
  console.log('PASS community HTTPS /health')
  if (!token) {
    console.log('SKIP authenticated probes: set CONTALK_VERIFY_TOKEN to your individual key')
  } else {
    await request('/identity'); console.log('PASS authenticated identity')
    await request('/servers/srv-1'); console.log('PASS authorized snapshot')
    const authority = await request('/servers/srv-1/voice-token', { channelId })
    const target = new URL(authority.url)
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(target)
      const timer = setTimeout(() => { socket.close(); reject(new Error('Voice WebSocket timeout')) }, 10000)
      socket.addEventListener('open', () => socket.send(JSON.stringify({id:1,method:'auth',token:authority.token})), {once:true})
      socket.addEventListener('message', message => { try { const response=JSON.parse(message.data); if(response.id===1 && response.data?.self) {clearTimeout(timer);socket.close();resolve()} } catch {} })
      socket.addEventListener('close', () => { clearTimeout(timer); reject(new Error('Voice authentication failed')) }, { once: true })
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Voice WebSocket failed: check DNS, TLS and proxy')) }, { once: true })
    })
    console.log('PASS authenticated voice WebSocket upgrade (media not tested)')
  }
} catch (error) {
  console.error(error instanceof Error && /^(Community|Voice)/.test(error.message) ? error.message : 'FAIL endpoint unreachable or invalid configuration; inspect DNS/TLS and services')
  process.exitCode = 1
}
