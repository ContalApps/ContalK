import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { loadTypescript } from './load-typescript.mjs'
test('a second launch quits without registering another instance handler',()=>{
 const app=new EventEmitter();let quits=0;app.quit=()=>quits++;app.requestSingleInstanceLock=()=>false
 const {setupSingleInstance}=loadTypescript('electron/single-instance.ts',{electron:{app}})
 assert.equal(setupSingleInstance(()=>null),false);assert.equal(quits,1);assert.equal(app.listenerCount('second-instance'),0)
})
test('a repeated shortcut opens the existing window and restores it if minimized',()=>{
 const app=new EventEmitter();app.requestSingleInstanceLock=()=>true
 const actions=[];let minimized=false,window=null
 const {setupSingleInstance}=loadTypescript('electron/single-instance.ts',{electron:{app}})
 assert.equal(setupSingleInstance(()=>window),true)
 app.emit('second-instance') // Safe before the first window is ready.
 window={isDestroyed:()=>false,isMinimized:()=>minimized,restore:()=>actions.push('restore'),show:()=>actions.push('show'),focus:()=>actions.push('focus')}
 app.emit('second-instance');assert.deepEqual(actions,['show','focus'])
 actions.length=0;minimized=true;app.emit('second-instance');assert.deepEqual(actions,['restore','show','focus'])
})
