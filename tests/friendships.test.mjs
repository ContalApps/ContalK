import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { loadTypescript } from './load-typescript.mjs'

function create(init) { let state; const get=()=>state;const set=patch=>state={...state,...patch};state=init(set,get);return {getState:get} }
function friendStore(storage=new Map()) {
  return loadTypescript('src/store/useFriendStore.ts',{zustand:{create}},{crypto:{randomUUID},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}}).useFriendStore
}
function network() {
  const stores={alice:friendStore(),bob:friendStore(),eve:friendStore()};const packets=[];const offline=new Set()
  const transport=sender=>async (target,packet)=>{if(offline.has(target))throw new Error('offline');packets.push({sender,target,packet})}
  for(const [name,store] of Object.entries(stores))store.getState().activate(name,transport(name))
  const drain=async()=>{let count=0;while(packets.length){assert.ok(count++<100,'no retry loop');const {sender,target,packet}=packets.shift();await stores[target].getState().receive(sender,sender,packet);await new Promise(r=>setImmediate(r))}}
  return {stores,drain,offline,packets}
}
test('friendship requires acceptance; unrelated peers cannot accept or acknowledge another request',async()=>{
  const f=network(),a=f.stores.alice.getState,b=f.stores.bob.getState
  a().request('bob','Bob');const event=a().outbox[0]
  await a().receive('eve','Eve',{ack:event.id});assert.equal(a().outbox.length,1)
  await a().receive('eve','Eve',{id:randomUUID(),requestId:event.requestId,action:'accept'});assert.equal(a().relations.eve,undefined)
  await f.drain();assert.equal(a().relations.bob.status,'outgoing');assert.equal(b().relations.alice.status,'incoming')
  b().accept('alice');await f.drain();assert.equal(a().relations.bob.status,'friend');assert.equal(b().relations.alice.status,'friend');assert.equal(a().outbox.length,0);assert.equal(b().outbox.length,0)
  a().remove('bob');await f.drain();assert.equal(a().relations.bob,undefined);assert.equal(b().relations.alice,undefined)
})
test('offline requests persist per account and are delivered after restart without reappearing on duplicate packets',async()=>{
  const storage=new Map();let a=friendStore(storage);const packets=[]
  a.getState().activate('alice',async()=>{throw new Error('offline')});a.getState().request('bob','Bob');await a.getState().flush()
  a=friendStore(storage);a.getState().activate('other');assert.equal(Object.keys(a.getState().relations).length,0)
  a.getState().activate('alice',async(target,packet)=>packets.push(packet));await a.getState().flush();assert.equal(packets[0].action,'request')
  const b=friendStore();b.getState().activate('bob',async(_,packet)=>a.getState().receive('bob','Bob',packet))
  await b.getState().receive('alice','Alice',packets[0]);b.getState().remove('alice');await b.getState().flush()
  await b.getState().receive('alice','Alice',packets[0]);assert.equal(b.getState().relations.alice,undefined)
})
test('crossed requests become a mutual friendship and can subsequently be removed',async()=>{
  const f=network(),a=f.stores.alice.getState,b=f.stores.bob.getState
  a().request('bob','Bob');b().request('alice','Alice');await f.drain()
  assert.equal(a().relations.bob.status,'friend');assert.equal(b().relations.alice.status,'friend');assert.equal(a().relations.bob.requestId,b().relations.alice.requestId)
  b().remove('alice');await f.drain();assert.equal(a().relations.bob,undefined);assert.equal(b().relations.alice,undefined)
})
test('cancel then request again preserves event order while a peer is offline',async()=>{
  const f=network(),a=f.stores.alice.getState,b=f.stores.bob.getState;f.offline.add('bob')
  a().request('bob','Bob');await a().flush();a().remove('bob');a().request('bob','Bob');await a().flush()
  f.offline.delete('bob');await a().flush();await f.drain()
  assert.equal(b().relations.alice.status,'incoming');assert.equal(b().relations.alice.requestId,a().relations.bob.requestId)
})
test('only accepted friends populate personal lists; other server members require an explicit conversation',()=>{
  const {friendPeople,directPeople}=loadTypescript('src/social/people.ts')
  const members=[{username:'bob',display_name:'Same name',online:true},{username:'eve',display_name:'Same name',online:true}]
  const relations={bob:{username:'bob',display_name:'Bob',status:'friend'},eve:{username:'eve',display_name:'Eve',status:'outgoing'}}
  const friends=friendPeople(members,relations,'alice');assert.deepEqual(Array.from(friends,m=>m.username),['bob'])
  assert.deepEqual(Array.from(directPeople(members,friends,{},'alice',null),m=>m.username),['bob'])
  const history={'dm:alice:eve':[{userId:'eve',userName:'Eve'}],'dm:bob:stranger':[{userId:'stranger',userName:'Stranger'}]}
  assert.deepEqual(Array.from(directPeople(members,friends,history,'alice',null),m=>m.username),['bob','eve'])
})
