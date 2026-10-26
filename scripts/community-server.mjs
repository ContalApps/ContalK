// Node 24+ runs the shared permission kernel through built-in type stripping.
import fs from 'node:fs'
import path from 'node:path'
import { createCommunityService, jsonCommunityStorage } from './community/service.mjs'
import { createCommunityVoice } from './community/realtime.mjs'
import { createAccounts } from './community/accounts.mjs'
import { createLocalFiles } from './community/local-files.mjs'

const host = process.env.CONTALK_COMMUNITY_HOST || '127.0.0.1'
const port = Number(process.env.CONTALK_COMMUNITY_PORT || 8789)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Porta do serviço inválida.')
const voice = process.env.CONTALK_REALTIME_URL ? createCommunityVoice({ url:process.env.CONTALK_REALTIME_URL, announcedAddress:process.env.CONTALK_MEDIA_PUBLIC_IP, mediaPort:Number(process.env.CONTALK_MEDIA_PORT || 40000), turnUrls:(process.env.CONTALK_TURN_URLS || '').split(',').filter(Boolean), turnSecret:process.env.CONTALK_TURN_SECRET, exposeInternalIp:process.env.CONTALK_MEDIA_EXPOSE_INTERNAL_IP === 'true' }) : undefined
// Fresh start: accounts, servers, messages and files live in this subfolder of the volume.
// Data written by earlier versions stays untouched in the parent folder as a backup.
const dataDirectory = path.join(process.env.CONTALK_COMMUNITY_DATA || '.community-data', 'contalk-v2')
fs.mkdirSync(dataDirectory, { recursive: true })
const service = createCommunityService({
  // Everyone signs in with an account; personal keys are no longer read from the environment.
  tokens: {},
  voice,
  localFiles: createLocalFiles({ directory: path.join(dataDirectory, 'files'), quotaBytes: Number(process.env.CONTALK_FILE_QUOTA_MB || 5120) * 1024 * 1024 }),
  accounts: createAccounts({ file: path.join(dataDirectory, 'accounts.json') }),
  storage: jsonCommunityStorage(path.join(dataDirectory, 'community.json')),
})
service.server.listen(port, host, () => console.log(`Serviço de comunidade ConTALK em http://${host}:${port}`))
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { voice?.close(); service.server.closeAllConnections(); service.server.close(() => process.exit(0)) })
