import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
test('installation progress stays alive until the completion event is signaled', {skip:process.platform!=='win32'||!existsSync('native/bin/contalk-update.exe'),timeout:10000},async()=>{
 const name='Local\\ContalKUpdate-'+randomUUID()
 const child=spawn('native/bin/contalk-update.exe',['--wait',name,'public/contalk-avatar.png'],{windowsHide:true})
 let timeout
 try {
  await new Promise((resolve,reject)=>{let text='';timeout=setTimeout(()=>reject(new Error('No ready signal')),5000);child.stdout.on('data',data=>{text+=data;if(text.includes('ready\n')){clearTimeout(timeout);resolve()}});child.once('error',reject);child.once('exit',code=>reject(new Error('Exited before ready: '+code)))})
  assert.equal(child.exitCode,null)
  const exited=new Promise((resolve,reject)=>{timeout=setTimeout(()=>reject(new Error('Progress did not close')),3000);child.once('exit',code=>{clearTimeout(timeout);resolve(code)})})
  const signal=spawn('native/bin/contalk-update.exe',['--finish',name],{windowsHide:true})
  assert.equal(await new Promise((resolve,reject)=>{signal.once('error',reject);signal.once('exit',resolve)}),0)
  assert.equal(await exited,0)
 }finally{clearTimeout(timeout);if(child.exitCode===null)child.kill()}
})
