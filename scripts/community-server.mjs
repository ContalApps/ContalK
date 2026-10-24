// Node 24+ runs the shared permission kernel through built-in type stripping.
import path from 'node:path'
import { createCommunityService, jsonCommunityStorage } from './community/service.mjs'
import { createCommunityVoice } from './community/voice.mjs'
import { createFileReferenceClient } from './community/files.mjs'

const host = process.env.CONTALK_COMMUNITY_HOST || '127.0.0.1'
const port = Number(process.env.CONTALK_COMMUNITY_PORT || 8789)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Porta do serviço inválida.')
const tokens = JSON.parse(process.env.CONTALK_COMMUNITY_TOKENS || '{}')
const voice = process.env.CONTALK_COMMUNITY_LIVEKIT_URL ? createCommunityVoice({ url:process.env.CONTALK_COMMUNITY_LIVEKIT_URL, apiKey:process.env.CONTALK_COMMUNITY_LIVEKIT_API_KEY, apiSecret:process.env.CONTALK_COMMUNITY_LIVEKIT_API_SECRET }) : undefined
const internalToken=process.env.CONTALK_COMMUNITY_INTERNAL_TOKEN
const files=process.env.CONTALK_COMMUNITY_STORAGE_URL?createFileReferenceClient({url:process.env.CONTALK_COMMUNITY_STORAGE_URL,token:internalToken}):undefined
const service = createCommunityService({
  tokens,
  voice,
  files,
  internalToken,
  storage: jsonCommunityStorage(path.join(process.env.CONTALK_COMMUNITY_DATA || '.community-data', 'community.json')),
})
service.server.listen(port, host, () => console.log(`Serviço de comunidade ConTALK em http://${host}:${port}`))
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { service.server.closeAllConnections(); service.server.close(() => process.exit(0)) })
