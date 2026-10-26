import assert from 'node:assert/strict'
import { test } from 'node:test'
import { once } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createCommunityService, createCommunityState, jsonCommunityStorage } from '../scripts/community/service.mjs'
import { createAccounts } from '../scripts/community/accounts.mjs'
import { createLocalFiles } from '../scripts/community/local-files.mjs'

const admin = 'a'.repeat(40)
async function fixture(t, { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-accounts-')), reserveBytes = 0 } = {}) {
  const service = createCommunityService({
    tokens: { [admin]: 'vitor' },
    initialState: createCommunityState(['vitor']),
    accounts: createAccounts({ file: path.join(directory, 'accounts.json') }),
    localFiles: createLocalFiles({ directory: path.join(directory, 'files'), quotaBytes: 1000, reserveBytes }),
  })
  service.server.listen(0, '127.0.0.1'); await once(service.server, 'listening')
  t.after(async () => { service.server.closeAllConnections(); await new Promise(resolve => service.server.close(resolve)) })
  const base = 'http://127.0.0.1:' + service.server.address().port
  const call = async (route, { token, body, method, headers = {}, raw } = {}) => {
    const response = await fetch(base + route, { method: method || (body === undefined && raw === undefined ? 'GET' : 'POST'), headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(body === undefined ? raw === undefined ? {} : { body: raw } : { body: JSON.stringify(body) }) })
    const type = response.headers.get('content-type') || ''
    return { status: response.status, data: type.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer()) }
  }
  const register = async (username, password = 'senha-forte-1', email = username.toLowerCase() + '@teste.dev') => (await call('/register', { body: { username, email, password } }))
  return { ...service, base, call, register, directory }
}

test('registering needs no key: a new account gets a session, no server and cannot take an existing identity', async t => {
  const f = await fixture(t)
  const ana = await f.register('Ana')
  assert.equal(ana.status, 200); assert.equal(ana.data.username, 'ana'); assert.match(ana.data.token, /^[a-f0-9]{64}$/)
  assert.deepEqual((await f.call('/identity', { token: ana.data.token })).data, { username: 'ana', serverIds: [], servers: [] })
  assert.equal((await f.register('ANA')).status, 409)
  assert.equal((await f.register('vitor')).status, 409)
  assert.equal((await f.register('x')).status, 400)
  assert.equal((await f.register('bia', 'curta')).status, 400)
  assert.equal((await f.register('bia', 'senha-forte-1', 'sem-arroba')).status, 400)
  assert.equal((await f.register('bia', 'senha-forte-1', 'ANA@teste.dev')).status, 409)
  assert.equal((await f.call('/servers/srv-1', { token: ana.data.token })).status, 403)
  assert.equal((await f.call('/identity', { token: 'e'.repeat(64) })).status, 401)
  assert.equal((await f.call('/identity', { token: admin })).data.username, 'vitor')
})

test('login checks the password, tells a missing account apart and throttles guesses', async t => {
  const f = await fixture(t)
  await f.register('ana', 'senha-forte-1')
  const ok = await f.call('/login', { body: { identifier: 'ana', password: 'senha-forte-1' } })
  assert.equal(ok.status, 200); assert.equal((await f.call('/identity', { token: ok.data.token })).data.username, 'ana')
  assert.equal((await f.call('/login', { body: { identifier: 'ANA@teste.dev', password: 'senha-forte-1' } })).data.username, 'ana')
  assert.equal((await f.call('/login', { body: { identifier: 'ana', password: 'senha-errada-1' } })).status, 401)
  assert.equal((await f.call('/login', { body: { identifier: 'zed', password: 'senha-forte-1' } })).status, 404)
  const statuses = []
  for (let attempt = 0; attempt < 10; attempt++) statuses.push((await f.call('/login', { body: { identifier: 'ana', password: 'errada-' + attempt + '-xx' } })).status)
  assert.equal(statuses.at(-1), 429)
  await f.call('/logout', { token: ok.data.token, body: {} })
  assert.equal((await f.call('/identity', { token: ok.data.token })).status, 401)
})

test('sessions and accounts survive a restart without storing the password or the key', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-restart-'))
  const first = createAccounts({ file: path.join(directory, 'accounts.json') })
  const { token } = await first.register('ana', 'ana@teste.dev', 'senha-forte-1', 'ip')
  const second = createAccounts({ file: path.join(directory, 'accounts.json') })
  assert.equal(second.authenticate(token), 'ana'); assert.equal((await second.login('ana', 'senha-forte-1', 'ip')).username, 'ana')
  const saved = fs.readFileSync(path.join(directory, 'accounts.json'), 'utf8')
  assert.equal(saved.includes(token) || saved.includes('senha-forte-1'), false)
})

test('anyone can create a server they own and invite friends; friends join as regular members', async t => {
  const f = await fixture(t)
  const ana = (await f.register('ana')).data.token, bia = (await f.register('bia')).data.token
  assert.equal((await f.call('/servers', { token: ana, body: { name: '  ' } })).status, 400)
  const created = await f.call('/servers', { token: ana, body: { name: 'Casa da Ana' } })
  assert.equal(created.status, 200); assert.equal(created.data.name, 'Casa da Ana'); assert.deepEqual(created.data.policy.ownerIds, ['ana'])
  assert.deepEqual(created.data.channels.map(channel => channel.type).sort(), ['text', 'voice'])
  assert.deepEqual((await f.call('/identity', { token: ana })).data.servers, [{ id: created.data.id, name: 'Casa da Ana' }])
  assert.equal((await f.call('/servers/' + created.data.id, { token: bia })).status, 403)
  const text = created.data.channels.find(channel => channel.type === 'text').id
  const invited = await f.call('/servers/' + created.data.id + '/commands', { token: ana, body: { revision: created.data.revision, action: { type: 'invite-create', channelId: text, maxAge: 3600, maxUses: 5 } } })
  assert.equal(invited.status, 200)
  const code = invited.data.invites.at(-1).code
  assert.equal((await f.call('/invites/' + code + '/accept', { token: bia, body: {} })).status, 200)
  const joined = (await f.call('/servers/' + created.data.id, { token: bia })).data
  assert.deepEqual(joined.policy.memberRoles.bia, [])
  assert.equal((await f.call('/identity', { token: bia })).data.servers.length, 1)
  assert.equal((await f.call('/servers/srv-1', { token: bia })).status, 403)
})

test('the number of owned servers is limited', async t => {
  const f = await fixture(t)
  const token = (await f.register('ana')).data.token
  for (let index = 0; index < 10; index++) assert.equal((await f.call('/servers', { token, body: { name: 'S' + index } })).status, 200)
  assert.equal((await f.call('/servers', { token, body: { name: 'extra' } })).status, 409)
})

test('files are stored on the server disk and only reachable by the owner, a recipient or a channel reader', async t => {
  const f = await fixture(t)
  const ana = (await f.register('ana')).data.token, bia = (await f.register('bia')).data.token, caio = (await f.register('caio')).data.token
  const content = Buffer.from('conteúdo do arquivo')
  const uploaded = await f.call('/files', { token: ana, raw: content, headers: { 'Content-Length': String(content.length), 'X-File-Name': encodeURIComponent('relatório.txt'), 'X-File-Type': 'text/plain', 'Content-Type': 'application/octet-stream' } })
  assert.equal(uploaded.status, 201); assert.equal(uploaded.data.name, 'relatório.txt'); assert.equal(uploaded.data.size, content.length)
  assert.equal(fs.existsSync(path.join(f.directory, 'files', uploaded.data.id + '.bin')), true)
  const link = await f.call('/links/' + uploaded.data.id, { token: ana })
  assert.equal(link.status, 200)
  const download = await f.call(link.data.url)
  assert.equal(download.status, 200); assert.deepEqual(download.data, content)
  assert.equal((await f.call(link.data.url.replace(/signature=.{4}/, 'signature=0000'))).status, 403)
  assert.equal((await f.call('/links/' + uploaded.data.id, { token: bia })).status, 403)
  assert.equal((await f.call('/files/' + uploaded.data.id + '/share', { token: bia, body: { recipient: 'bia' } })).status, 403)
  assert.equal((await f.call('/files/' + uploaded.data.id + '/share', { token: ana, body: { recipient: 'ninguem' } })).status, 400)
  assert.equal((await f.call('/files/' + uploaded.data.id + '/share', { token: ana, body: { recipient: 'bia' } })).status, 200)
  assert.equal((await f.call('/links/' + uploaded.data.id, { token: bia })).status, 200)
  assert.equal((await f.call('/links/' + uploaded.data.id, { token: caio })).status, 403)
  assert.equal((await f.call('/views/' + uploaded.data.id, { token: bia, body: {} })).data.allowed, true)
  assert.equal((await f.call('/views/' + uploaded.data.id, { token: bia, body: {} })).data.allowed, false)
})

test('uploads respect the declared size and the per-person quota', async t => {
  const f = await fixture(t)
  const ana = (await f.register('ana')).data.token
  const send = size => f.call('/files', { token: ana, raw: Buffer.alloc(size, 1), headers: { 'Content-Length': String(size), 'X-File-Name': 'a.bin', 'Content-Type': 'application/octet-stream' } })
  assert.equal((await send(600)).status, 201)
  assert.equal((await send(600)).status, 413)
  assert.equal((await send(400)).status, 201)
})

test('uploads stop before the server disk runs out of free space', async t => {
  const f = await fixture(t, { reserveBytes: Number.MAX_SAFE_INTEGER })
  const ana = (await f.register('ana')).data.token
  const response = await f.call('/files', { token: ana, raw: Buffer.alloc(10, 1), headers: { 'Content-Length': '10', 'X-File-Name': 'a.bin', 'Content-Type': 'application/octet-stream' } })
  assert.equal(response.status, 507)
  assert.equal(fs.readdirSync(path.join(f.directory, 'files')).length, 0)
})

test('a malformed file name is rejected without storing anything', async t => {
  const f = await fixture(t)
  const ana = (await f.register('ana')).data.token
  assert.equal((await f.call('/files', { token: ana, raw: Buffer.alloc(3, 1), headers: { 'Content-Length': '3', 'X-File-Name': '%E0%A4%A', 'Content-Type': 'application/octet-stream' } })).status, 400)
})

test('a fresh server without personal keys keeps account-owned AI projects across restarts', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-projects-'))
  const start = async () => {
    const service = createCommunityService({ tokens: {}, accounts: createAccounts({ file: path.join(directory, 'accounts.json') }), storage: jsonCommunityStorage(path.join(directory, 'community.json')) })
    service.server.listen(0, '127.0.0.1'); await once(service.server, 'listening')
    const base = 'http://127.0.0.1:' + service.server.address().port
    const call = (route, token, body) => fetch(base + route, { method: body ? 'POST' : 'GET', headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }).then(async response => ({ status: response.status, data: await response.json() }))
    return { service, call, stop: async () => { service.server.closeAllConnections(); await new Promise(resolve => service.server.close(resolve)) } }
  }
  let run = await start()
  const token = (await run.call('/register', null, { username: 'ana', email: 'ana@teste.dev', password: 'senha-forte-1' })).data.token
  const created = (await run.call('/servers', token, { name: 'Casa' })).data
  const text = created.channels.find(channel => channel.type === 'text').id
  const command = async action => { const current = (await run.call('/servers/' + created.id, token)).data; return run.call('/servers/' + created.id + '/commands', token, { revision: current.revision, action }) }
  assert.equal((await command({ type: 'ai-channel-model', channelId: text, model: 'model-alpha' })).status, 200)
  assert.equal((await command({ type: 'project-create', id: 'project-1', parentId: text, name: 'Projeto' })).status, 200)
  await run.stop()
  run = await start()
  t.after(run.stop)
  const after = (await run.call('/servers/' + created.id, token)).data
  assert.equal(after.policy.projects['project-1'].archived, undefined)
})
