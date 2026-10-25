import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn,execFileSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {once} from 'node:events'

const binary='native/bin/contalk-voice-input.exe',available=process.platform==='win32'&&existsSync(binary)
test('Windows speech generates a real WAV in memory using an installed voice, without playing it',{skip:!available,timeout:15000},async t=>{
 const voices=JSON.parse(execFileSync(binary,['--voices'],{windowsHide:true,encoding:'utf8'}));if(!voices.length){t.skip('Não há voz SAPI instalada neste Windows.');return}
 const child=spawn(binary,['--speech',voices[0].id],{windowsHide:true,stdio:'pipe'}),chunks=[];child.stdout.on('data',chunk=>chunks.push(chunk));child.stderr.resume();child.stdin.write(Buffer.from('Teste local de leitura do ConTALK.','utf8').toString('base64')+'\n')
 assert.equal((await once(child,'exit'))[0],0);const data=Buffer.concat(chunks);assert.ok(data.length>1000);assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WAVE')
})
test('speech rejects malformed input and oversized text without producing audio',{skip:!available,timeout:15000},async()=>{
 for(const data of ['not-base64',Buffer.from('x'.repeat(2501)).toString('base64')]){
  const child=spawn(binary,['--speech','default'],{windowsHide:true,stdio:'pipe'});let size=0;child.stdout.on('data',chunk=>size+=chunk.length);child.stderr.resume();child.stdin.write(data+'\n');assert.notEqual((await once(child,'exit'))[0],0);assert.equal(size,0)
 }
})
