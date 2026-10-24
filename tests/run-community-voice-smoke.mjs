// Opt-in real SFU check. Uses a unique temporary room and synthetic microphone.
// Supply server credentials through the environment; never through argv or logs.
import { build } from 'esbuild'
import { spawn, execFileSync } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID, randomBytes } from 'node:crypto'
import { RoomServiceClient } from 'livekit-server-sdk'
import { createCommunityService, createCommunityState } from '../scripts/community/service.mjs'
import { createCommunityVoice, communityRoom } from '../scripts/community/voice.mjs'
import { initialPolicy } from '../src/roles/permissions.ts'

const url=process.env.CONTALK_COMMUNITY_LIVEKIT_URL,key=process.env.CONTALK_COMMUNITY_LIVEKIT_API_KEY,secret=process.env.CONTALK_COMMUNITY_LIVEKIT_API_SECRET
if(!url||!key||!secret)throw new Error('Configure the three CONTALK_COMMUNITY_LIVEKIT environment variables for this opt-in test.')
const cloud=new URL(url).hostname.endsWith('.livekit.cloud')
const id='smoke-'+randomUUID(),channelId='voice',folder='release/community-voice-smoke/'+(cloud?'cloud':'local')
fs.mkdirSync(folder,{recursive:true})
const keys={alice:randomBytes(32).toString('hex'),bob:randomBytes(32).toString('hex')},state=createCommunityState(['alice','bob'])
const policy=initialPolicy(id,['alice','bob']);policy.ownerIds=['alice']
state.servers[id]={id,name:'Teste isolado',revision:0,policy,channels:[{id:channelId,name:'Voz de teste',type:'voice',serverId:id}],messages:{},audit:[]}
const voice=createCommunityVoice({url,apiKey:key,apiSecret:secret}),service=createCommunityService({tokens:{[keys.alice]:'alice',[keys.bob]:'bob'},initialState:state,voice})
service.server.listen(0,'127.0.0.1');await once(service.server,'listening')
const endpoint='http://127.0.0.1:'+service.server.address().port
try{
 if(cloud){const allowanceToken=await voice.token(state.servers[id],'bob',channelId)
 const validation=new URL(url.replace(/^ws/,'http')+'/rtc/v1/validate');validation.searchParams.set('access_token',allowanceToken.token)
 const allowance=await fetch(validation,{signal:AbortSignal.timeout(10000)})
 if(!allowance.ok){
  const detail=(await allowance.text()).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'REDACTED').slice(0,400)
  fs.writeFileSync(folder+'/result.json',JSON.stringify({ok:false,blocked:true,stage:'LiveKit allowance',status:allowance.status,error:detail},null,2))
  throw new Error('The real SFU check is blocked by LiveKit HTTP '+allowance.status+'. See the redacted result.')
 }
 }
 await build({entryPoints:['electron/community.ts'],bundle:true,platform:'node',format:'cjs',external:['electron'],outfile:folder+'/community.cjs'})
 await build({stdin:{resolveDir:process.cwd(),loader:'ts',contents:`
import {useRoleStore} from './src/store/useRoleStore';import {useVoiceStore} from './src/store/useVoiceStore';
const check=(value,message)=>{if(!value)throw new Error(message)};
const wait=async(predicate,message)=>{const deadline=Date.now()+15000;while(Date.now()<deadline){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,100))}throw new Error(message)};
(async()=>{try{
 await window.contalkDesktop.configureCommunity(${JSON.stringify({url:endpoint,token:keys.bob})});await useRoleStore.getState().activate('bob',${JSON.stringify(id)});await wait(()=>useRoleStore.getState().status==='connected','service subscription failed');
 const joined=await useVoiceStore.getState().joinChannel('voice','Voz de teste',{username:'bob',display_name:'Bob'});
 check(joined,'SFU connection failed: '+useVoiceStore.getState().error);await wait(()=>useVoiceStore.getState().participants.some(person=>person.isLocal&&person.isAudioEnabled),'synthetic microphone did not publish');
 const room=useVoiceStore.getState().currentRoom;check(room.localParticipant.isMicrophoneEnabled,'microphone starts enabled');
 const muted=await window.diag.deny('SPEAK');check(muted==='synced','SFU permissions have not been acknowledged');
 await wait(()=>!room.localParticipant.isMicrophoneEnabled,'SFU did not revoke an active microphone publication');
 let rejected=false;try{await room.localParticipant.setMicrophoneEnabled(true)}catch{rejected=true}check(rejected||!room.localParticipant.isMicrophoneEnabled,'publication must remain denied after revocation');
 const disconnected=await window.diag.deny('CONNECT');check(disconnected==='synced','disconnect has not been acknowledged');await wait(()=>useVoiceStore.getState().connectionStatus==='disconnected','SFU did not disconnect a member after CONNECT was revoked');
 let tokenDenied=false;try{await window.contalkDesktop.communityVoiceToken(${JSON.stringify(id)},'voice')}catch{tokenDenied=true}check(tokenDenied,'service must reject a new token after revocation');
 await useVoiceStore.getState().leaveChannel();await useRoleStore.getState().activate(null);window.diag.result({ok:true,checks:['real-sfu-connection','synthetic-microphone-publication','live-speak-revocation','republish-denied','live-connect-revocation','new-token-denied']});
}catch(error){await useVoiceStore.getState().leaveChannel();window.diag.result({ok:false,error:String(error.message).replace(/access_token=[^&\\s]+/g,'access_token=REDACTED')})}})();
`},bundle:true,platform:'browser',format:'iife',outfile:folder+'/renderer.js'})
 fs.writeFileSync(folder+'/index.html','<!doctype html><html><body><div id="contalk-audio-container"></div><script src="renderer.js"></script></body></html>')
 fs.writeFileSync(folder+'/preload.cjs',`const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('contalkDesktop',{communityStatus:()=>ipcRenderer.invoke('community-status'),configureCommunity:value=>ipcRenderer.invoke('community-configure',value),subscribeCommunity:id=>ipcRenderer.invoke('community-subscribe',id),unsubscribeCommunity:()=>ipcRenderer.invoke('community-unsubscribe'),communityVoiceToken:(...args)=>ipcRenderer.invoke('community-voice-token',...args),onCommunityState:listener=>{const handler=(_,value)=>listener(value);ipcRenderer.on('community-state',handler);return()=>ipcRenderer.removeListener('community-state',handler)},getLiveKitToken:()=>{throw new Error('The legacy signing path must never be used in this test')}});contextBridge.exposeInMainWorld('diag',{deny:permission=>ipcRenderer.invoke('diag-deny',permission),result:value=>ipcRenderer.send('diag-result',value)});`)
 fs.writeFileSync(folder+'/main.cjs',`const {app,BrowserWindow,ipcMain}=require('electron');const fs=require('fs'),path=require('path');const {setupCommunity}=require('./community.cjs');app.setPath('userData',path.join(__dirname,'profile'));app.commandLine.appendSwitch('use-fake-device-for-media-stream');app.commandLine.appendSwitch('use-fake-ui-for-media-stream');const endpoint=${JSON.stringify(endpoint)},token=${JSON.stringify(keys.alice)},serverId=${JSON.stringify(id)};ipcMain.handle('diag-deny',async(_,permission)=>{const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};const current=await (await fetch(endpoint+'/servers/'+serverId,{headers})).json();const deny=permission==='SPEAK'?'2097152':'1048576';const response=await fetch(endpoint+'/servers/'+serverId+'/commands',{method:'POST',headers,body:JSON.stringify({revision:current.revision,action:{type:'role',command:{type:'overwrite',channel:'voice',targetId:'bob',targetType:'member',overwrite:{id:'bob',type:'member',allow:'0',deny}}}})});if(!response.ok)throw new Error('Administrative permission update failed');return (await response.json()).voiceSync});const network=[];let win;const timeout=setTimeout(()=>app.exit(1),55000);ipcMain.on('diag-result',(_,value)=>{clearTimeout(timeout);fs.writeFileSync(path.join(__dirname,'result.json'),JSON.stringify(value,null,2));value.network=network;console.log(JSON.stringify(value));win.destroy();app.exit(value.ok?0:1)});app.whenReady().then(()=>{win=new BrowserWindow({show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});win.webContents.session.setPermissionRequestHandler((_,permission,callback)=>callback(permission==='media'));win.webContents.session.webRequest.onErrorOccurred(details=>{const target=new URL(details.url);if(target.hostname.endsWith('livekit.cloud'))network.push({host:target.hostname,path:target.pathname,error:details.error})});win.webContents.session.webRequest.onCompleted(details=>{const target=new URL(details.url);if(target.hostname.endsWith('livekit.cloud')&&details.statusCode>=400)network.push({host:target.hostname,path:target.pathname,status:details.statusCode})});setupCommunity(win,()=> 'bob');win.loadFile(path.join(__dirname,'index.html'))});`)
 const electron=process.env.ELECTRON_PATH||execFileSync(process.execPath,['-e',"process.stdout.write(require('electron'))"],{encoding:'utf8'}).trim(),env={...process.env};delete env.ELECTRON_RUN_AS_NODE
 for(const name of ['CONTALK_COMMUNITY_LIVEKIT_URL','CONTALK_COMMUNITY_LIVEKIT_API_KEY','CONTALK_COMMUNITY_LIVEKIT_API_SECRET'])delete env[name]
 const child=spawn(electron,[path.join(folder,'main.cjs')],{windowsHide:true,stdio:'inherit',env}),timeout=setTimeout(()=>child.kill(),65000)
 try{const [code]=await once(child,'exit');if(code!==0)throw new Error('Real SFU smoke failed; inspect the redacted result in release/community-voice-smoke.')}finally{clearTimeout(timeout)}
}finally{
 service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve))
 const room=communityRoom(id,channelId)
 if(!room.startsWith('contalk-community:smoke-'))throw new Error('Unsafe cleanup room name.')
 try{await new RoomServiceClient(url,key,secret).deleteRoom(room)}catch(error){if(error.code!=='not_found'&&error.code!==5&&error.status!==404)console.error('Temporary SFU room cleanup could not be confirmed.')}
}
