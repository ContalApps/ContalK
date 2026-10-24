// Four isolated Electron renderers, a real native media worker and synthetic tracks.
// No production accounts, microphone, cloud service or existing data are used.
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'
import { randomBytes } from 'node:crypto'
import { build } from 'esbuild'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { createCommunityVoice } from '../scripts/community/realtime.mjs'
import { createCommunityService, createCommunityState } from '../scripts/community/service.mjs'
import { initialPolicy, mask } from '../src/roles/permissions.ts'
const require=createRequire(import.meta.url), folder=path.resolve('release/native-voice-smoke')
fs.mkdirSync(folder,{recursive:true})
const freePort=async()=>{const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));return port}
const port=await freePort(),mediaPort=await freePort(),url=`ws://127.0.0.1:${port}/realtime`
const members=['alice','bob','carol','dan'],tokens=Object.fromEntries(members.map(name=>[randomBytes(32).toString('hex'),name]))
const state=createCommunityState(members),group={id:'smoke',name:'Isolated',revision:0,policy:initialPolicy('smoke',members),channels:[{id:'voice',serverId:'smoke',type:'voice',name:'Isolated'}],messages:{},audit:[]}
group.policy.ownerIds=['alice'];state.servers.smoke=group
const voice=createCommunityVoice({url,mediaPort,announcedAddress:'127.0.0.1'}),service=createCommunityService({tokens,initialState:state,voice})
service.server.listen(port,'127.0.0.1');await once(service.server,'listening')
try {
  await build({stdin:{resolveDir:process.cwd(),loader:'ts',contents:`
import {Room,RoomEvent,Track} from './src/media/realtime';
const wait=async(test,message)=>{const deadline=Date.now()+20000;while(Date.now()<deadline){if(test())return;await new Promise(r=>setTimeout(r,80))}throw new Error(message)};
(async()=>{let room,context;try{
 const {actor}=await window.diag.config();const ticket=()=>window.diag.ticket();room=new Room({tokenProvider:ticket});
 const authority=await ticket();await room.connect(authority.url,authority.token);
 await room.localParticipant.setName(actor);await room.localParticipant.setMetadata(JSON.stringify({bio:'synthetic test'}));
 context=new AudioContext();const oscillator=context.createOscillator(),destination=context.createMediaStreamDestination();oscillator.connect(destination);oscillator.start();await context.resume();
 await room.localParticipant.publishTrack(destination.stream.getAudioTracks()[0],{source:Track.Source.Microphone});
 if(actor==='alice'){
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d');let frame=0;const draw=setInterval(()=>{ctx.fillStyle=frame++%2?'red':'blue';ctx.fillRect(0,0,320,180)},80);window.draw=draw;
  const video=canvas.captureStream(10).getVideoTracks()[0];await room.localParticipant.publishTrack(video,{source:Track.Source.ScreenShare});
  await room.localParticipant.publishTrack(video.clone(),{source:Track.Source.Camera});
  const audio=context.createMediaStreamDestination();oscillator.connect(audio);await room.localParticipant.publishTrack(audio.stream.getAudioTracks()[0],{source:Track.Source.ScreenShareAudio,forceStereo:true});
 }
 await wait(()=>room.remoteParticipants.size===3,'four peers did not join');
 await wait(()=>[...room.remoteParticipants.values()].every(p=>p.isMicrophoneEnabled),'remote microphones did not arrive');
 if(actor!=='alice')await wait(()=>room.remoteParticipants.get('alice')?.isScreenShareEnabled&&room.remoteParticipants.get('alice')?.getTrackPublication(Track.Source.ScreenShareAudio),'screen video/audio did not arrive');
 // Verify actual inbound RTP packets, not only publication acknowledgements.
 const checkRtp=async()=>{let received=0;for(const consumer of room.consumers.values()){const stats=await consumer.getStats();for(const report of stats.values())if(report.type==='inbound-rtp'&&report.packetsReceived>0){received++;break}}return received >= (actor==='alice'?3:6)};
 let gotRtp=false;for(let i=0;i<100&&!gotRtp;i++){gotRtp=await checkRtp();if(!gotRtp)await new Promise(r=>setTimeout(r,100))}if(!gotRtp)throw new Error('no inbound RTP');
 const mic=room.localParticipant.getTrackPublication(Track.Source.Microphone);await mic.track.mute();if(room.localParticipant.isMicrophoneEnabled)throw new Error('mute failed');await mic.track.unmute();
 await window.diag.barrier('ready');
 if(actor==='bob'){let recovered=false;room.once(RoomEvent.Reconnected,()=>recovered=true);room.socket.close();await wait(()=>recovered,'reconnect failed');await wait(()=>room.remoteParticipants.size===3,'roster after reconnect');}
 await window.diag.barrier('recovered');
 if(actor==='bob'){
  await window.diag.deny('SPEAK');await wait(()=>!room.localParticipant.isMicrophoneEnabled,'SPEAK did not revoke publication');
  let denied=false;try{await room.localParticipant.publishTrack(context.createMediaStreamDestination().stream.getAudioTracks()[0],{source:Track.Source.Microphone})}catch{denied=true}if(!denied)throw new Error('republish was allowed');
  await window.diag.deny('CONNECT');await wait(()=>room.state==='disconnected','CONNECT did not disconnect');
  let tokenDenied=false;try{await ticket()}catch{tokenDenied=true}if(!tokenDenied)throw new Error('ticket allowed after revocation');
 }
 await window.diag.barrier('revoked');
 if(actor==='carol'){const captured=room.localParticipant.getTrackPublication(Track.Source.Microphone).track.mediaStreamTrack;room.socket.close();await wait(()=>room.state==='reconnecting','recovery did not start');await room.disconnect();if(captured.readyState!=='ended')throw new Error('microphone remained live after leaving during recovery')}
 await room.disconnect();await context.close();clearInterval(window.draw);window.diag.result({ok:true,actor,checks:['four-clients','synthetic-audio','inbound-rtp','camera-screen-video-audio','mute','reconnect','server-permissions','disconnect-capture-cleanup']});
}catch(error){await room?.disconnect();await context?.close();clearInterval(window.draw);window.diag.result({ok:false,error:error.message})}})();
`},bundle:true,platform:'browser',format:'iife',outfile:folder+'/renderer.js'})
  fs.writeFileSync(folder+'/index.html','<!doctype html><body><script src="renderer.js"></script></body>')
  fs.writeFileSync(folder+'/preload.cjs',`const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('diag',{config:()=>ipcRenderer.invoke('config'),ticket:()=>ipcRenderer.invoke('ticket'),barrier:stage=>ipcRenderer.invoke('barrier',stage),deny:permission=>ipcRenderer.invoke('deny',permission),result:value=>ipcRenderer.send('result',value)});`)
  fs.writeFileSync(folder+'/main.cjs',`const {app,BrowserWindow,ipcMain}=require('electron'),path=require('path'),fs=require('fs');const actors=${JSON.stringify(members)},keys=${JSON.stringify(Object.fromEntries(Object.entries(tokens).map(([key,name])=>[name,key])))},base='http://127.0.0.1:${port}',roles=new Map(),windows=[],barriers=new Map(),results=[];app.setPath('userData',path.join(__dirname,'profile'));app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');ipcMain.handle('config',e=>({actor:roles.get(e.sender.id)}));ipcMain.handle('ticket',async e=>{const r=await fetch(base+'/servers/smoke/voice-token',{method:'POST',headers:{Authorization:'Bearer '+keys[roles.get(e.sender.id)],'Content-Type':'application/json'},body:JSON.stringify({channelId:'voice'})});if(!r.ok)throw new Error('Ticket denied');return r.json()});ipcMain.handle('barrier',(_,stage)=>new Promise(resolve=>{const waiting=barriers.get(stage)||[];waiting.push(resolve);barriers.set(stage,waiting);if(waiting.length===4)waiting.forEach(done=>done())}));ipcMain.handle('deny',async(_,permission)=>{const headers={Authorization:'Bearer '+keys.alice,'Content-Type':'application/json'},current=await(await fetch(base+'/servers/smoke',{headers})).json();const response=await fetch(base+'/servers/smoke/commands',{method:'POST',headers,body:JSON.stringify({revision:current.revision,action:{type:'role',command:{type:'overwrite',channel:'voice',targetId:'bob',targetType:'member',overwrite:{id:'bob',type:'member',allow:'0',deny:permission==='SPEAK'?'2097152':'1048576'}}}})});if(!response.ok)throw new Error('Permission command failed');return true});let finished=false;const finish=ok=>{if(finished)return;finished=true;fs.writeFileSync(path.join(__dirname,'result.json'),JSON.stringify({ok,results,production:false},null,2));console.log(JSON.stringify({ok,results}));windows.forEach(win=>win.destroy());app.exit(ok?0:1)};const timer=setTimeout(()=>{results.push({ok:false,error:'integration timeout'});finish(false)},90000);ipcMain.on('result',(_,result)=>{results.push(result);if(!result.ok||results.length===4){clearTimeout(timer);finish(results.length===4&&results.every(result=>result.ok))}});app.whenReady().then(()=>{for(const actor of actors){const win=new BrowserWindow({show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,partition:'native-'+actor}});roles.set(win.webContents.id,actor);windows.push(win);win.loadFile(path.join(__dirname,'index.html'))}});`)
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE
  const child=spawn(require('electron'),[folder+'/main.cjs'],{windowsHide:true,stdio:'inherit',env})
  const timeout=setTimeout(()=>child.kill(),100000)
  try { const [code]=await once(child,'exit');if(code!==0)throw new Error('Four-client native media test failed; see release/native-voice-smoke/result.json') } finally {clearTimeout(timeout)}
} finally {voice.close();service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve))}
