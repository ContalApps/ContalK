import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createStore } from 'zustand/vanilla'
import { loadTypescript } from './load-typescript.mjs'

test('a snapshot requested before access revocation cannot restore private history after revocation arrives',async()=>{
  let receive,resolve,pending=false,unsubscribed=0
  const snapshot={actor:'alice',id:'group',revision:1,messages:{text:[{id:'private',content:'Mensagem privada'}]},hasOlder:{text:true},policy:{}}
  const delayed=new Promise(done=>{resolve=done})
  const bridge={communityStatus:async()=>({configured:true,url:'https://community.example.com'}),unsubscribeCommunity:async()=>{},onCommunityState:callback=>{receive=callback;return()=>{unsubscribed++}},subscribeCommunity:async()=>{},communitySnapshot:async()=>{pending=true;return delayed}}
  const {useRoleStore:store}=loadTypescript('src/store/useRoleStore.ts',{zustand:{create:createStore},'../roles/history':{mergeHistory:()=>({})}},{window:{contalkDesktop:bridge}})
  await store.getState().activate('alice','group')
  receive({serverId:'group',snapshot})
  assert.equal(store.getState().status,'connected')
  const refresh=store.getState().refresh();assert.equal(pending,true)
  receive({serverId:'group',accessRevoked:true})
  assert.equal(store.getState().snapshot,null);assert.equal(unsubscribed,1)
  resolve(snapshot);await refresh
  assert.equal(store.getState().status,'revoked');assert.equal(store.getState().snapshot,null)
  assert.equal(store.getState().owner,'alice');assert.equal(store.getState().configured,true)
  assert.equal(Object.keys(store.getState().olderMessages).length,0)
})

test('switching servers for the same account retains its connection configuration while clearing the previous snapshot',async()=>{
  const subscribed=[],bridge={communityStatus:async()=>({configured:true,url:'https://community.example.com'}),unsubscribeCommunity:async()=>{},onCommunityState:()=>()=>{},subscribeCommunity:async id=>subscribed.push(id)}
  const {useRoleStore:store}=loadTypescript('src/store/useRoleStore.ts',{zustand:{create:createStore},'../roles/history':{mergeHistory:()=>({})}},{window:{contalkDesktop:bridge}})
  await store.getState().activate('alice','original')
  const observed=[];const stop=store.subscribe(state=>observed.push({configured:state.configured,url:state.url,snapshot:state.snapshot}))
  await store.getState().activate('alice','other');stop()
  assert.ok(observed.length>0)
  assert.ok(observed.every(state=>state.configured&&state.url==='https://community.example.com'&&state.snapshot===null))
  assert.deepEqual(subscribed,['original','other'])
})
