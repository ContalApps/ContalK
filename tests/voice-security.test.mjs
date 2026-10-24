import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
const { load } = createRequire(import.meta.url)('js-yaml')

test('desktop has no server signing SDK, embedded voice secret or old media provider', () => {
  const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
  assert.ok(pkg.dependencies['mediasoup-client'])
  assert.ok(!Object.keys(pkg.dependencies).some(name=>/livekit/i.test(name)))
  for(const file of ['src/store/useVoiceStore.ts','src/store/useCommunityStore.ts','electron/main.ts','electron/preload.ts','src-tauri/src/main.rs']) assert.doesNotMatch(fs.readFileSync(file,'utf8'), /livekit|API_SECRET|AccessToken|jsonwebtoken/i,file)
})

test('Coolify Compose preserves an external volume and keeps the TURN secret runtime-only', () => {
  const community = load(fs.readFileSync('deploy/community/compose.coolify.yml', 'utf8'))
  assert.equal(community.volumes.community_data.external, true)
  assert.equal(community.volumes.community_data.name, '${CONTALK_EXISTING_COMMUNITY_VOLUME}')
  assert.deepEqual(community.services.community.volumes, ['community_data:/app/data'])
  const turn = load(fs.readFileSync('deploy/voice/compose.yml', 'utf8')).services.turn
  assert.equal(turn.environment.CONTALK_TURN_SECRET, '${CONTALK_TURN_SECRET:-}')
  assert.match(turn.command[0], /test -n "\$\$CONTALK_TURN_SECRET" \|\| exit 1/)
  assert.match(turn.command[0], /--relay-ip="\$\$relay_ip"/)
})
