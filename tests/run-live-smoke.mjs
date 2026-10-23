import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
const folder='release/livekit-smoke'
mkdirSync(folder,{recursive:true})
await build({stdin:{contents:`import { Room, Track } from 'livekit-client'; (async()=>{const room=new Room();try{const {url,token}=await window.diag.token();await room.connect(url,token,{autoSubscribe:false});await room.localParticipant.setMetadata(JSON.stringify({test:'profile-permission'}));await room.localParticipant.setName('ContalK diagnostic');await room.localParticipant.publishData(new TextEncoder().encode('diagnostic'),{reliable:true});const context=new AudioContext();const destination=context.createMediaStreamDestination();const audio=destination.stream.getAudioTracks()[0];await room.localParticipant.publishTrack(audio,{source:Track.Source.Microphone});await room.localParticipant.unpublishTrack(audio,true);await context.close();await room.disconnect();window.diag.result({ok:true,checks:['connect','metadata-ack','name-ack','data-publish','audio-publish-ack','audio-unpublish','disconnect']})}catch(error){await room.disconnect();window.diag.result({ok:false,error:error.message})}})()`,resolveDir:process.cwd(),loader:'js'},bundle:true,platform:'browser',format:'iife',outfile:folder+'/renderer.js'})
writeFileSync(folder+'/index.html','<!doctype html><html><body><script src="renderer.js"></script></body></html>')
writeFileSync(folder+'/preload.cjs',`const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('diag',{token:()=>ipcRenderer.invoke('diag-token'),result:value=>ipcRenderer.send('diag-result',value)});`)
const electron=execFileSync(process.execPath,['-e',"process.stdout.write(require('electron'))"],{encoding:'utf8'}).trim()
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE
execFileSync(electron,['tests/livekit-live-smoke.cjs'],{stdio:'inherit',windowsHide:true,env})

