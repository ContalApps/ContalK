const {app,BrowserWindow,ipcMain}=require('electron')
const {AccessToken,RoomServiceClient}=require('livekit-server-sdk')
const {readFileSync,mkdirSync}=require('node:fs')
const {randomUUID}=require('node:crypto')
const path=require('node:path')
const name='contalk-diag-'+randomUUID()
const source=readFileSync('electron/main.ts','utf8')
const key=source.match(/const LIVEKIT_API_KEY = '([^']+)'/)[1]
const secret=source.match(/const LIVEKIT_API_SECRET = '([^']+)'/)[1]
const url=source.match(/const LIVEKIT_URL = '([^']+)'/)[1]
const folder=path.resolve('release/livekit-smoke')
mkdirSync(folder+'/userData',{recursive:true});app.setPath('userData',folder+'/userData')
let window,finished=false
const timeout=setTimeout(()=>finish({ok:false,error:'Live connection test timed out'}),35000)
async function finish(result){if(finished)return;finished=true;clearTimeout(timeout);try{await new RoomServiceClient(url.replace('wss:','https:'),key,secret).deleteRoom(name)}catch{};console.log(JSON.stringify(result));if(window&&!window.isDestroyed())window.destroy();app.exit(result.ok?0:1)}
ipcMain.handle('diag-token',async()=>{const {roomGrant}=await import('../shared/livekit-grant.mjs');const token=new AccessToken(key,secret,{identity:'diagnostic-'+randomUUID(),name:'ConTALK diagnostic',ttl:60});token.addGrant(roomGrant(name));return {url,token:await token.toJwt()}})
ipcMain.on('diag-result',(_event,result)=>void finish(result))
app.whenReady().then(()=>{window=new BrowserWindow({show:false,webPreferences:{preload:folder+'/preload.cjs',contextIsolation:true,nodeIntegration:false}});window.loadFile(folder+'/index.html').catch(error=>finish({ok:false,error:error.message}))}).catch(error=>finish({ok:false,error:error.message}))
