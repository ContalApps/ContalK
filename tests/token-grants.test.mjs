import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AccessToken, TokenVerifier } from 'livekit-server-sdk'
import { roomGrant } from '../shared/livekit-grant.mjs'
test('signed room token allows own profile changes and does not grant administration',async()=>{
 const key='test-key', secret='test-secret-only-for-token-unit-test'
 const token=new AccessToken(key,secret,{identity:'test-user',name:'Test',ttl:60})
 token.addGrant(roomGrant('test-room'))
 const claims=await new TokenVerifier(key,secret).verify(await token.toJwt())
 assert.equal(claims.video.canUpdateOwnMetadata,true)
 assert.equal(claims.video.room,'test-room');assert.equal(claims.video.roomJoin,true)
 for(const field of ['roomAdmin','roomCreate','roomList','roomRecord'])assert.notEqual(claims.video[field],true)
})
