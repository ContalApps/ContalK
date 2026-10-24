import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { WebSocket } from 'ws'
import { createCommunityVoice, voicePermissions, mediaListenInfos } from '../scripts/community/realtime.mjs'
import { createCommunityService, createCommunityState } from '../scripts/community/service.mjs'
import { initialPolicy, mask } from '../src/roles/permissions.ts'

test('sources are granted independently and unknown identities cannot connect', () => {
  const policy = initialPolicy('test', ['alice','bob'])
  policy.overwrites.voice = [{ id:'bob',type:'member',allow:'0',deny:mask(['SPEAK','STREAM']).toString() }]
  assert.deepEqual(voicePermissions(policy,'bob','voice').canPublishSources, [])
  assert.equal(voicePermissions(policy,'bob','voice').canSubscribe,true)
  assert.equal(voicePermissions(policy,'unknown','voice').canSubscribe,false)
  policy.overwrites.voice[0].deny = mask(['CONNECT']).toString()
  assert.equal(voicePermissions(policy,'bob','voice').canSubscribe,false)
})

test('insecure remote signaling URLs are rejected', () => {
  for (const url of ['ws://remote.invalid/realtime','wss://user:pass@remote.invalid/realtime','wss://remote.invalid/realtime?secret=x']) assert.throws(() => createCommunityVoice({url}),/WSS/)
})

test('private relay candidates use a real IPv4 interface while retaining the public announcement', () => {
  const config = { announcedAddress:'203.0.113.10',mediaPort:40000,interfaces:{lo:[{family:'IPv4',internal:true,address:'127.0.0.1'}],eth0:[{family:'IPv6',internal:false,address:'::1'},{family:'IPv4',internal:false,address:'10.0.1.3'}]} }
  assert.ok(mediaListenInfos(config).every(info=>info.ip==='0.0.0.0'&&!info.exposeInternalIp))
  assert.ok(mediaListenInfos({...config,exposeInternalIp:true}).every(info=>info.ip==='10.0.1.3'&&info.announcedAddress==='203.0.113.10'&&info.exposeInternalIp))
  assert.throws(()=>mediaListenInfos({...config,interfaces:{},exposeInternalIp:true}),/IPv4 interno/)
})

test('real WebSocket tickets are single use, enforce identity, four-person limit, targeted data and CONNECT revocation', async t => {
  const members = ['alice','bob','carol','dan','eve']
  const initialState = createCommunityState(members)
  const group = structuredClone(initialState.servers['srv-1']); group.id = 'test'; group.policy = initialPolicy('test',members); group.policy.ownerIds=['alice']; group.channels=[{id:'voice',type:'voice',name:'Test',serverId:'test'}]
  initialState.servers.test = group
  const voice = createCommunityVoice({url:'ws://127.0.0.1/realtime'})
  const service = createCommunityService({ tokens:{['a'.repeat(32)]:'alice'},initialState,voice })
  service.server.listen(0,'127.0.0.1'); await once(service.server,'listening')
  const url = `ws://127.0.0.1:${service.server.address().port}/realtime`, sockets=[]
  t.after(async()=>{ voice.close(); for(const socket of sockets)socket.terminate(); service.server.closeAllConnections(); await new Promise(resolve=>service.server.close(resolve)) })
  const connect = async token => {
    const socket = new WebSocket(url); sockets.push(socket); await once(socket,'open')
    const message=once(socket,'message'), closed=once(socket,'close')
    socket.send(JSON.stringify({id:1,method:'auth',token}))
    const result=await Promise.race([message.then(([value])=>JSON.parse(value)),closed.then(([code])=>({closed:code}))]); return {socket,result}
  }
  const ticket = await voice.token(group,'bob','voice')
  assert.match(ticket.token,/^[a-f0-9]{64}$/)
  const bob = await connect(ticket.token); assert.equal(bob.result.data.self.identity,'bob')
  assert.equal((await connect(ticket.token)).result.closed,4003)
  for (const actor of ['alice','carol','dan']) assert.ok((await connect((await voice.token(group,actor,'voice')).token)).result.data)
  assert.equal((await connect((await voice.token(group,'eve','voice')).token)).result.closed,4003)
  const revoked=structuredClone(group); revoked.policy.overwrites.voice=[{id:'bob',type:'member',allow:'0',deny:mask(['CONNECT']).toString()}]
  const closed=once(bob.socket,'close'); await voice.reconcile(group,revoked); assert.equal((await closed)[0],4003)
  await assert.rejects(()=>voice.token(revoked,'bob','voice'),/conectar/)
  // Presence uses the same authenticated protocol but cannot create media transports.
  const alice=await connect((await voice.presenceToken('alice','Alice')).token)
  const peer=await connect((await voice.presenceToken('bob','Bob')).token)
  const data=new Promise(resolve=>peer.socket.on('message',value=>{const packet=JSON.parse(value);if(packet.event==='data')resolve(packet.data)}))
  alice.socket.send(JSON.stringify({id:2,method:'data',data:{payload:'hello',topic:'dm',destinations:['bob']}}))
  const received=await data; assert.equal(received.participant.identity,'alice');assert.equal(received.payload,'hello')
})
