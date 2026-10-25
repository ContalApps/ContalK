import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTypescript } from './load-typescript.mjs'

test('media reconnection can keep the original server after navigation selects a different server',async()=>{
  const current={configured:true,status:'connected',serverId:'original'},calls=[]
  const {centralVoiceToken}=loadTypescript('src/roles/transport.ts',{
    '../store/useRoleStore':{useRoleStore:{getState:()=>current}},'./permissions':{},
  },{window:{contalkDesktop:{communityVoiceToken:async(serverId,channelId)=>{calls.push({serverId,channelId});return {url:'ws://127.0.0.1/realtime',token:'fixture-ticket'}}}}})
  const first=await centralVoiceToken('voice-original')
  current.serverId='other'
  const resumed=await centralVoiceToken('voice-original',first.serverId)
  assert.equal(resumed.serverId,'original')
  assert.deepEqual(calls,[{serverId:'original',channelId:'voice-original'},{serverId:'original',channelId:'voice-original'}])
})
