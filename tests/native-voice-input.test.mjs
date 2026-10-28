import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawn,execFileSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {once} from 'node:events'

const binary='native/bin/contalk-voice-input.exe',available=process.platform==='win32'&&existsSync(binary)
// F24 is a synthetic test shortcut, never a typing key or a production hotkey.
const key=up=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class ConTalkSyntheticKey { [DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra); [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key); }'; [ConTalkSyntheticKey]::keybd_event(135,0,${up?2:0},[UIntPtr]::Zero); Start-Sleep -Milliseconds 30; ([ConTalkSyntheticKey]::GetAsyncKeyState(135) -band 32768)`],{windowsHide:true,stdio:'pipe'}).toString().trim()
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const waitTimeout=process.env.CI?15000:4000
const wait=async predicate=>{const end=Date.now()+waitTimeout;while(!predicate()){if(Date.now()>end)throw Error('Native key observation timed out');await pause(20)}}
const timeout=process.env.CI?60000:25000

test('Windows key helper ignores an initially held key, emits hold renewals and exits when its owner closes stdin',{skip:!available,timeout},async t=>{
 let child;const entries=[]
 try{
  if(key(false)!=='32768'){t.skip('O desktop do runner não permite observar teclas sintéticas.');return}
  child=spawn(binary,['--key','135'],{windowsHide:true,stdio:'pipe'});let buffer=''
  child.stdout.on('data',data=>{buffer+=data;let newline;while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);entries.push(JSON.parse(line))}})
  child.stderr.resume();await wait(()=>entries.some(entry=>entry.ready));await pause(150);assert.equal(entries.some(entry=>entry.pressed),false)
  key(true);await pause(100);key(false);await wait(()=>entries.filter(entry=>entry.pressed).length>=2)
  key(true);await wait(()=>entries.at(-1).pressed===false);const exited=once(child,'exit');child.stdin.end();assert.equal((await exited)[0],0)
 }finally{key(true);child?.kill()}
})

test('native key helper refuses ordinary typing keys and malformed arguments',{skip:!available,timeout:15000},async()=>{
 for(const args of [['--key','65'],['--key','135tail'],['--other','135']]){
  const child=spawn(binary,args,{windowsHide:true,stdio:'pipe'});let output='';child.stdout.on('data',data=>output+=data);child.stderr.resume();assert.notEqual((await once(child,'exit'))[0],0);assert.equal(output,'')
 }
})
