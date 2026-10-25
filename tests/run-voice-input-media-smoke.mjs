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
const require=createRequire(import.meta.url), folder=path.resolve('release/voice-input-media-smoke')
const electron=process.env.ELECTRON_PATH||require('electron')
if(!fs.existsSync(electron))throw new Error('Runtime Electron não encontrado. Execute npm rebuild electron ou defina ELECTRON_PATH para um runtime compatível.')
fs.mkdirSync(folder,{recursive:true})
const freePort=async()=>{const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));return port}
const port=await freePort(),mediaPort=await freePort(),url=`ws://127.0.0.1:${port}/realtime`
const members=['alice','bob'],tokens=Object.fromEntries(members.map(name=>[randomBytes(32).toString('hex'),name]))
const state=createCommunityState(members),group={id:'smoke',name:'Isolated',revision:0,policy:initialPolicy('smoke',members),channels:[{id:'voice',serverId:'smoke',type:'voice',name:'Isolated'},{id:'destination',serverId:'smoke',type:'voice',name:'Destination'}],messages:{},audit:[]}
group.policy.ownerIds=['alice'];group.policy.overwrites.voice=[{id:'bob',type:'member',allow:'0',deny:mask(['USE_VAD']).toString()}];state.servers.smoke=group
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

 await wait(()=>room.remoteParticipants.size===1,'two participants');
 const packets=async()=>{let total=0;for(const consumer of room.consumers.values())if(consumer.kind==='audio')for(const value of(await consumer.getStats()).values())if(value.type==='inbound-rtp')total+=value.packetsReceived||0;return total};
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),check=(value,message)=>{if(!value)throw Error(message)};
 await wait(()=>room.remoteParticipants.get(actor==='alice'?'bob':'alice')?.getTrackPublication(Track.Source.Microphone),'remote microphone');
 if(actor==='bob'){check(room.inputMode==='push-to-talk'&&!room.localParticipant.isMicrophoneEnabled,'USE_VAD denial did not force idle PTT');let refused=false;try{await room.request('input-mode',{mode:'voice-activity'})}catch{refused=true}check(refused,'VAD mode bypass');const mic=room.localParticipant.getTrackPublication(Track.Source.Microphone);refused=false;try{await mic.track.unmute()}catch{refused=true}check(refused,'resume without held lease');}
 await window.diag.barrier('ready');
 if(actor==='bob')await room.setPushToTalk(true);
 await window.diag.barrier('pressed');
 if(actor==='alice'){await wait(()=>room.remoteParticipants.get('bob').isMicrophoneEnabled,'PTT microphone not announced');let received=false;for(let i=0;i<60&&!received;i++){received=(await packets())>0;if(!received)await pause(50)}check(received,'no held RTP');}
 await window.diag.barrier('received');
 if(actor==='bob'){const track=room.localParticipant.getTrackPublication(Track.Source.Microphone).track.mediaStreamTrack;const release=room.setPushToTalk(false);check(!track.enabled,'release waits for network');await release;}
 await window.diag.barrier('released');
 if(actor==='alice'){await pause(500);const before=await packets();await pause(700);check(await packets()===before,'released microphone still forwarded RTP');}
 await window.diag.barrier('quiet');
 let renewal;
 if(actor==='bob'){await room.setPushToTalk(true);renewal=setInterval(()=>void room.setPushToTalk(true).catch(()=>{}),400);}
 await window.diag.barrier('held');
 if(actor==='alice'){await pause(1200);const before=await packets();await pause(1400);check((await packets())>before,'renewal did not sustain RTP');}else await pause(2700);
 if(renewal)clearInterval(renewal);
 await window.diag.barrier('held-done');
 if(actor==='bob'){await wait(()=>!room.localParticipant.isMicrophoneEnabled,'expired lease did not pause microphone');check(!room.localParticipant.getTrackPublication(Track.Source.Microphone).track.mediaStreamTrack.enabled,'expired lease left local source enabled');}
 await window.diag.barrier('lease-ended');
 if(actor==='alice'){await pause(500);const before=await packets();await pause(700);check(await packets()===before,'expired lease still forwarded RTP');}
 if(actor==='bob'){
  await window.diag.rule([]);await wait(()=>room.inputMode==='voice-activity'&&room.localParticipant.canUseVoiceActivity,'permission restored but preference did not return');check(!room.localParticipant.isMicrophoneEnabled,'permission restore opened microphone');
  const mic=room.localParticipant.getTrackPublication(Track.Source.Microphone),rtpParameters=room.producers.get(mic.producerId).rtpParameters;await mic.track.unmute();check(room.localParticipant.isMicrophoneEnabled,'authorized VAD microphone could not resume');
  await window.diag.rule(['USE_VAD']);await wait(()=>room.inputMode==='push-to-talk'&&!room.localParticipant.getTrackPublication(Track.Source.Microphone),'VAD revoke did not close automatic microphone');check(mic.track.mediaStreamTrack.readyState==='ended','revocation kept capture live');
  let bypass=false;try{await room.request('produce',{transportId:room.sendTransport.id,source:'microphone',kind:'audio',rtpParameters,paused:false})}catch{bypass=true}check(bypass,'raw producer bypassed PTT');
  const destination=context.createMediaStreamDestination();oscillator.connect(destination);await room.localParticipant.publishTrack(destination.stream.getAudioTracks()[0],{source:Track.Source.Microphone});check(!room.localParticipant.isMicrophoneEnabled,'PTT republish opened microphone');await room.setPushToTalk(true);check(room.localParticipant.isMicrophoneEnabled,'PTT could not resume');await window.diag.moderate('voice-mute',true);await wait(()=>room.localParticipant.serverMuted&&!room.localParticipant.isMicrophoneEnabled,'server mute did not close held PTT');await window.diag.moderate('voice-mute',false);await wait(()=>!room.localParticipant.serverMuted,'server unmute absent');check(!room.localParticipant.isMicrophoneEnabled,'server unmute opened PTT');
 }
 await window.diag.barrier('done');await room.disconnect();await context.close();window.diag.result({ok:true,actor,checks:['two-real-mediasoup-clients','USE_VAD-forces-PTT','forged-auto-mode-and-resume-rejected','pressed-key-inbound-RTP','release-cuts-local-before-ack','released-RTP-stops','renewal-sustains-RTP','expired-lease-stops-local-and-RTP','permission-restores-preference-without-opening-mic','VAD-revocation-stops-capture','raw-producer-bypass-rejected','server-mute-blocks-held-PTT']});

}catch(error){await room?.disconnect();await context?.close();clearInterval(window.draw);window.diag.result({ok:false,error:error.message})}})();
`},bundle:true,platform:'browser',format:'iife',outfile:folder+'/renderer.js'})
  fs.writeFileSync(folder+'/index.html','<!doctype html><body><script src="renderer.js"></script></body>')
  fs.writeFileSync(folder+'/preload.cjs',`const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('diag',{config:()=>ipcRenderer.invoke('config'),ticket:()=>ipcRenderer.invoke('ticket'),barrier:stage=>ipcRenderer.invoke('barrier',stage),deny:permission=>ipcRenderer.invoke('deny',permission),rule:deny=>ipcRenderer.invoke('rule',deny),moderate:(...args)=>ipcRenderer.invoke('moderate',...args),result:value=>ipcRenderer.send('result',value)});`)
  fs.writeFileSync(folder+'/main.cjs',`const {app,BrowserWindow,ipcMain}=require('electron'),path=require('path'),fs=require('fs');const actors=${JSON.stringify(members)},keys=${JSON.stringify(Object.fromEntries(Object.entries(tokens).map(([key,name])=>[name,key])))},base='http://127.0.0.1:${port}',roles=new Map(),windows=[],barriers=new Map(),results=[];app.setPath('userData',path.join(__dirname,'profile'));app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');ipcMain.handle('config',e=>({actor:roles.get(e.sender.id)}));ipcMain.handle('ticket',async e=>{const r=await fetch(base+'/servers/smoke/voice-token',{method:'POST',headers:{Authorization:'Bearer '+keys[roles.get(e.sender.id)],'Content-Type':'application/json'},body:JSON.stringify({channelId:'voice'})});if(!r.ok)throw new Error('Ticket denied');return r.json()});ipcMain.handle('barrier',(_,stage)=>new Promise(resolve=>{const waiting=barriers.get(stage)||[];waiting.push(resolve);barriers.set(stage,waiting);if(waiting.length===2)waiting.forEach(done=>done())}));ipcMain.handle('moderate',async(_,type,enabled,destinationId)=>{const headers={Authorization:'Bearer '+keys.alice,'Content-Type':'application/json'},current=await(await fetch(base+'/servers/smoke',{headers})).json();const response=await fetch(base+'/servers/smoke/commands',{method:'POST',headers,body:JSON.stringify({revision:current.revision,action:{type,member:'bob',channelId:'voice',enabled,destinationId}})});if(!response.ok)throw new Error('Voice moderation command failed');return true});ipcMain.handle('rule',async(_,deny)=>{const headers={Authorization:'Bearer '+keys.alice,'Content-Type':'application/json'},current=await(await fetch(base+'/servers/smoke',{headers})).json();const response=await fetch(base+'/servers/smoke/commands',{method:'POST',headers,body:JSON.stringify({revision:current.revision,action:{type:'role',command:{type:'overwrite',channel:'voice',targetId:'bob',targetType:'member',overwrite:{id:'bob',type:'member',allow:'0',deny:deny.includes('USE_VAD')?'33554432':'0'}}}})});if(!response.ok)throw Error('Synthetic voice rule failed')});ipcMain.handle('deny',async(_,permission)=>{const headers={Authorization:'Bearer '+keys.alice,'Content-Type':'application/json'},current=await(await fetch(base+'/servers/smoke',{headers})).json();const response=await fetch(base+'/servers/smoke/commands',{method:'POST',headers,body:JSON.stringify({revision:current.revision,action:{type:'role',command:{type:'overwrite',channel:'voice',targetId:'bob',targetType:'member',overwrite:{id:'bob',type:'member',allow:'0',deny:permission==='SPEAK'?'2097152':'1048576'}}}})});if(!response.ok)throw new Error('Permission command failed');return true});let finished=false;const finish=ok=>{if(finished)return;finished=true;fs.writeFileSync(path.join(__dirname,'result.json'),JSON.stringify({ok,results,production:false},null,2));console.log(JSON.stringify({ok,results}));windows.forEach(win=>win.destroy());app.exit(ok?0:1)};const timer=setTimeout(()=>{results.push({ok:false,error:'integration timeout'});finish(false)},90000);ipcMain.on('result',(_,result)=>{results.push(result);if(!result.ok||results.length===2){clearTimeout(timer);finish(results.length===2&&results.every(result=>result.ok))}});app.whenReady().then(()=>{for(const actor of actors){const win=new BrowserWindow({show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,partition:'native-'+actor}});roles.set(win.webContents.id,actor);windows.push(win);win.loadFile(path.join(__dirname,'index.html'))}});`)
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE
  const child=spawn(electron,[folder+'/main.cjs'],{windowsHide:true,stdio:'inherit',env})
  const timeout=setTimeout(()=>child.kill(),100000)
  try { const [code]=await once(child,'exit');if(code!==0)throw new Error('Voice input media test failed; see release/voice-input-media-smoke/result.json') } finally {clearTimeout(timeout)}
} finally {voice.close();service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve))}
