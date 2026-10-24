// Runs the real media/permission integration check against a disposable local
// LiveKit binary. No cloud quota, production key or physical microphone is used.
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import dgram from 'node:dgram'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { randomBytes } from 'node:crypto'
import { RoomServiceClient } from 'livekit-server-sdk'

const folder=path.resolve('release/local-community-voice'),executable=process.env.LIVEKIT_SERVER_PATH||path.resolve('release/livekit-local/livekit-server.exe')
if(!fs.existsSync(executable))throw new Error('Set LIVEKIT_SERVER_PATH to an official LiveKit server binary.')
fs.mkdirSync(folder,{recursive:true})
async function freeTcp(){const server=net.createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port}
async function freeUdp(){const socket=dgram.createSocket('udp4');socket.bind(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));return port}
const port=await freeTcp(),tcp=await freeTcp(),udp=await freeUdp(),key='local-smoke-key',secret=randomBytes(32).toString('hex')
const configuration={port,bind_addresses:['127.0.0.1'],rtc:{tcp_port:tcp,udp_port:udp,use_external_ip:false,node_ip:'127.0.0.1',enable_loopback_candidate:true,ips:{includes:['127.0.0.0/8']},stun_servers:[]},keys:{[key]:secret},logging:{level:'error'},room:{empty_timeout:5,departure_timeout:2}}
const configFile=path.join(folder,'fixture.json');fs.writeFileSync(configFile,JSON.stringify(configuration,null,2))
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE
const sfu=spawn(executable,['--config',configFile,'--bind','127.0.0.1'],{windowsHide:true,stdio:['ignore','pipe','pipe'],env})
let log='',processError
sfu.on('error',error=>{processError=error})
for(const pipe of [sfu.stdout,sfu.stderr])pipe.on('data',chunk=>{log=(log+chunk.toString()).slice(-50000)})
try{
 const url='ws://127.0.0.1:'+port,api=new RoomServiceClient(url,key,secret),deadline=Date.now()+15000
 let started=false
 while(Date.now()<deadline){
  if(processError)throw processError
  if(sfu.exitCode!==null)throw new Error('The local SFU exited; inspect release/local-community-voice/server.log.')
  try{await api.listRooms();started=true;break}catch{await new Promise(resolve=>setTimeout(resolve,200))}
 }
 if(!started)throw new Error('The local SFU did not start before the deadline.')
 console.log('Local LiveKit is ready; validating synthetic audio and permission revocation.')
 const child=spawn(process.execPath,['tests/run-community-voice-smoke.mjs'],{windowsHide:true,stdio:'inherit',env:{...env,CONTALK_COMMUNITY_LIVEKIT_URL:url,CONTALK_COMMUNITY_LIVEKIT_API_KEY:key,CONTALK_COMMUNITY_LIVEKIT_API_SECRET:secret}})
 const timeout=setTimeout(()=>child.kill(),75000)
 try{const [code]=await once(child,'exit');if(code!==0)throw new Error('Local SFU integration did not pass.')}finally{clearTimeout(timeout)}
 const result=JSON.parse(fs.readFileSync('release/community-voice-smoke/local/result.json','utf8'))
 fs.writeFileSync(path.join(folder,'result.json'),JSON.stringify({...result,transport:'local LiveKit',production:false},null,2))
}finally{
 if(sfu.exitCode===null){sfu.kill();await Promise.race([once(sfu,'exit'),new Promise(resolve=>setTimeout(resolve,3000))])}
 fs.writeFileSync(path.join(folder,'server.log'),log.replaceAll(secret,'REDACTED'))
 fs.unlinkSync(configFile)
}
