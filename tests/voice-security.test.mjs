import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('desktop has no server signing SDK, embedded voice secret or old media provider', () => {
  const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
  assert.ok(pkg.dependencies['mediasoup-client'])
  assert.ok(!Object.keys(pkg.dependencies).some(name=>/livekit/i.test(name)))
  for(const file of ['src/store/useVoiceStore.ts','src/store/useCommunityStore.ts','electron/main.ts','electron/preload.ts','src-tauri/src/main.rs']) assert.doesNotMatch(fs.readFileSync(file,'utf8'), /livekit|API_SECRET|AccessToken|jsonwebtoken/i,file)
})
