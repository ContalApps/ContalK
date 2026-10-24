import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TokenVerifier, TrackSource } from 'livekit-server-sdk'
import { createCommunityVoice, voicePermissions, communityRoom } from '../scripts/community/voice.mjs'
import { initialPolicy, mask } from '../src/roles/permissions.ts'

function fixture() {
 const policy=initialPolicy('group',['alice','bob']);policy.ownerIds=['alice']
 return {id:'group',policy,channels:[{id:'voice',type:'voice'}]}
}
test('central voice tokens bind identity and room, restrict publication sources, expire promptly and grant no data or admin access',async()=>{
 const server=fixture()
 server.policy.overwrites.voice=[{id:'bob',type:'member',allow:'0',deny:mask(['SPEAK','STREAM']).toString()}]
 const secret='private-test-secret-not-a-production-key'
 const voice=createCommunityVoice({url:'wss://test.invalid',apiKey:'test-key',apiSecret:secret,client:{}})
 const token=await voice.token(server,'bob','voice')
 const claims=await new TokenVerifier('test-key',secret).verify(token.token)
 assert.equal(claims.sub,'bob');assert.equal(claims.video.room,communityRoom('group','voice'))
 assert.equal(claims.video.canPublish,false);assert.equal(claims.video.canPublishData,false);assert.deepEqual(claims.video.canPublishSources,[])
 assert.equal(claims.video.roomAdmin,undefined);assert.ok(claims.exp-claims.nbf<=300)
 server.policy.overwrites.voice[0].deny=mask(['CONNECT']).toString()
 await assert.rejects(()=>voice.token(server,'bob','voice'),/conectar/)
})
test('revoking connect removes an active member and changing speak updates active publication permissions',async()=>{
 const server=fixture(),removed=[],updated=[]
 const client={listParticipants:async()=>[{identity:'alice'},{identity:'bob'},{identity:'unknown'}],removeParticipant:async(...args)=>removed.push(args),updateParticipant:async(...args)=>updated.push(args)}
 const voice=createCommunityVoice({url:'wss://test.invalid',apiKey:'test',apiSecret:'private-test-secret',client})
 const next=structuredClone(server)
 next.policy.overwrites.voice=[{id:'bob',type:'member',allow:'0',deny:mask(['SPEAK']).toString()}]
 await voice.reconcile(server,next)
 assert.equal(removed[0][1],'unknown')
 assert.equal(updated.find(item=>item[1]==='bob')[2].permission.canPublishSources.includes(TrackSource.MICROPHONE),false)
 assert.equal(updated.find(item=>item[1]==='bob')[2].permission.canPublishSources.includes(TrackSource.SCREEN_SHARE),true)
 next.policy.overwrites.voice[0].deny=mask(['CONNECT']).toString()
 await voice.reconcile(server,next)
 assert.ok(removed.some(item=>item[1]==='bob'))
 next.channels=[];await voice.reconcile(server,next)
 assert.ok(removed.some(item=>item[1]==='alice'))
})
test('microphone and screen grants remain distinct and ownership is checked against membership',()=>{
 const server=fixture()
 assert.equal(voicePermissions(server.policy,'bob','voice').canPublishSources.includes(TrackSource.MICROPHONE),true)
 assert.equal(voicePermissions(server.policy,'stranger','voice').canSubscribe,false)
})

test('central presence tokens allow peer data and own profile updates without publishing media or granting administration',async()=>{
 const secret='server-only-test-secret',voice=createCommunityVoice({url:'wss://test.invalid',apiKey:'test',apiSecret:secret,client:{}})
 const result=await voice.presenceToken('bob','Bob')
 const claims=await new TokenVerifier('test',secret).verify(result.token)
 assert.equal(claims.sub,'bob');assert.equal(claims.video.room,'contalk-community-presence-v2')
 assert.equal(claims.video.canPublish,false);assert.deepEqual(claims.video.canPublishSources,[])
 assert.equal(claims.video.canPublishData,true);assert.equal(claims.video.canUpdateOwnMetadata,true)
 assert.equal(claims.video.roomAdmin,undefined)
})
