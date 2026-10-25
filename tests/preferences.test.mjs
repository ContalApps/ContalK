import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTypescript } from './load-typescript.mjs'
function fixture() {
  const storage=new Map();let state;let fail=false
  const create=init=>{const get=()=>state;const set=patch=>state={...state,...patch};state=init(set,get);return {getState:get}}
  const store=loadTypescript('src/store/usePreferencesStore.ts',{'../media/voice-input':loadTypescript('src/media/voice-input.ts'),zustand:{create}},{localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>{if(fail)throw new Error('full');storage.set(key,value)}}}).usePreferencesStore
  return {store,storage,fail:()=>{fail=true}}
}

test('voice mode and shortcut remain local to each account and reject typing keys',()=>{
 const f=fixture(),get=f.store.getState;get().activate('alice');get().update({voiceInputMode:'push-to-talk',pushToTalkKey:'F24',prioritySpeaker:true})
 get().activate('bob');assert.equal(get().voiceInputMode,'voice-activity');assert.equal(get().pushToTalkKey,'F8')
 assert.equal(get().prioritySpeaker,false)
 get().activate('alice');assert.equal(get().voiceInputMode,'push-to-talk');assert.equal(get().pushToTalkKey,'F24')
 assert.equal(get().prioritySpeaker,true)
 assert.throws(()=>get().update({pushToTalkKey:'KeyA'}),/inválida/);assert.throws(()=>get().update({voiceInputMode:'always-send'}),/inválida/)
 get().activate(null);assert.equal(get().voiceInputMode,'voice-activity')
})
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

test('interface scale is isolated per user, persists, and resets on logout',()=>{
 const f=fixture(),state=f.store.getState
 state().activate('alice');state().update({interfaceScale:80})
 state().activate('bob');assert.equal(state().interfaceScale,100);state().update({interfaceScale:120})
 state().activate('alice');assert.equal(state().interfaceScale,80)
 state().update({theme:'vice-city'});assert.equal(state().interfaceScale,80)
 state().activate('bob');assert.equal(state().interfaceScale,120)
 state().activate(null);assert.equal(state().interfaceScale,100)
})

test('invalid interface scales fall back safely and failed saves preserve the current scale',()=>{
 const f=fixture(),state=f.store.getState
 for(const value of [null,0,79,126,105.5,NaN,'110']){
  f.storage.set('contalk-preferences-v1:alice',JSON.stringify({interfaceScale:value}))
  state().activate('alice');assert.equal(state().interfaceScale,100)
 }
 assert.throws(()=>state().update({interfaceScale:200}),/Escala inválida/)
 state().update({interfaceScale:110});f.fail();assert.throws(()=>state().update({interfaceScale:80}),/full/);assert.equal(state().interfaceScale,110)
})

test('title bar shortcuts default on and are saved separately for each account',()=>{
 const f=fixture(),state=f.store.getState
 state().activate('alice');assert.equal(state().titleBarSearch,true);assert.equal(state().titleBarHelp,true)
 state().update({titleBarSearch:false,titleBarHelp:false})
 state().activate('bob');assert.equal(state().titleBarSearch,true);assert.equal(state().titleBarHelp,true)
 state().activate('alice');assert.equal(state().titleBarSearch,false);assert.equal(state().titleBarHelp,false)
 state().update({theme:'vice-city'});assert.equal(state().titleBarSearch,false)
})

test('density accepts each integer from 80 to 120 and migrates the previous upper limit',()=>{
 const f=fixture(),state=f.store.getState;state().activate('alice')
 for(let value=80;value<=120;value++){state().update({interfaceScale:value});assert.equal(state().interfaceScale,value)}
 assert.throws(()=>state().update({interfaceScale:121}),/Escala inválida/)
 f.storage.set('contalk-preferences-v1:alice',JSON.stringify({interfaceScale:125}));state().activate('alice');assert.equal(state().interfaceScale,120)
})

test('role mention preferences persist independently from general notifications and other accounts',()=>{
 const f=fixture(),state=f.store.getState
 state().activate('alice');state().update({roleMentionNotifications:false})
 assert.equal(state().systemNotifications,true)
 state().activate('bob');assert.equal(state().roleMentionNotifications,true)
 state().activate('alice');assert.equal(state().roleMentionNotifications,false)
})

test('soundboard volume is separate per account and accepts only an integer percentage',()=>{const f=fixture(),get=f.store.getState;get().activate('alice');assert.equal(get().soundboardVolume,50);get().update({soundboardVolume:20});get().activate('bob');assert.equal(get().soundboardVolume,50);get().activate('alice');assert.equal(get().soundboardVolume,20);for(const value of [-1,101,1.5,'20'])assert.throws(()=>get().update({soundboardVolume:value}))})
