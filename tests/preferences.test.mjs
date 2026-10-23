import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTypescript } from './load-typescript.mjs'
function fixture() {
  const storage=new Map();let state;let fail=false
  const create=init=>{const get=()=>state;const set=patch=>state={...state,...patch};state=init(set,get);return {getState:get}}
  const store=loadTypescript('src/store/usePreferencesStore.ts',{zustand:{create}},{localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>{if(fail)throw new Error('full');storage.set(key,value)}}}).usePreferencesStore
  return {store,storage,fail:()=>{fail=true}}
}
test('theme, motion and text size persist per account without changing other users',()=>{
  const f=fixture(),state=f.store.getState
  state().activate('alice');state().update({theme:'vice-city',reducedMotion:true,textSize:120})
  state().activate('bob');assert.equal(state().theme,'classic');assert.equal(state().reducedMotion,false);assert.equal(state().textSize,100)
  state().activate('alice');assert.equal(state().theme,'vice-city');assert.equal(state().reducedMotion,true);assert.equal(state().textSize,120)
  state().activate(null);assert.equal(state().theme,'classic')
})
test('invalid saved settings fall back safely; failed saves do not pretend to persist',()=>{
  const f=fixture(),state=f.store.getState
  f.storage.set('contalk-preferences-v1:alice',JSON.stringify({theme:'neon',textSize:999,reducedMotion:'yes'}))
  state().activate('alice');assert.equal(state().theme,'classic');assert.equal(state().textSize,100);assert.equal(state().reducedMotion,false)
  f.fail();assert.throws(()=>state().update({theme:'vice-city'}),/full/);assert.equal(state().theme,'classic')
})
