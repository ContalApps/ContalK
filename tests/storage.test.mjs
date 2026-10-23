import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { MAX_UPLOAD_SIZE, sealSession, openSession, signDownload, validDownload, storageOwner } from '../scripts/storage-policy.mjs'
test('central Telegram sessions are encrypted and reject tampering and wrong keys',()=>{
 const key=randomBytes(32),sealed=sealSession('private-telegram-session',key)
 assert.ok(!sealed.includes(Buffer.from('private-telegram-session')))
 assert.equal(openSession(sealed,key),'private-telegram-session')
 assert.throws(()=>openSession(sealed,randomBytes(32)))
 sealed[15]^=1;assert.throws(()=>openSession(sealed,key))
})
test('download capabilities expire and cannot be used for another file',()=>{
 const key=randomBytes(32),expires=10000,signature=signDownload(key,'file-a',expires)
 assert.equal(validDownload(key,'file-a',expires,signature,9000),true)
 assert.equal(validDownload(key,'file-b',expires,signature,9000),false)
 assert.equal(validDownload(key,'file-a',expires,signature,10001),false)
 assert.equal(validDownload(key,'file-a',expires,'bad',9000),false)
 assert.equal(MAX_UPLOAD_SIZE,2147483648)
})
test('storage authentication never accepts object prototype keys as credentials',()=>{
 assert.equal(storageOwner({secret:'caliari'},'secret'),'caliari')
 for(const token of ['toString','__proto__','unknown',undefined])assert.equal(storageOwner({secret:'caliari'},token),null)
})
