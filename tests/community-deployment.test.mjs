import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { prepareCommunityDeployment } from '../scripts/community-setup.mjs'

function temporary(t,beforeCleanup=async()=>{}){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'contalk-deployment-test-'))
  t.after(async()=>{await beforeCleanup();const resolved=fs.realpathSync(directory);assert.equal(path.dirname(resolved).toLowerCase(),fs.realpathSync(os.tmpdir()).toLowerCase());assert.ok(path.basename(resolved).startsWith('contalk-deployment-test-'));fs.rmSync(resolved,{recursive:true,force:true,maxRetries:3,retryDelay:100})})
  return directory
}

test('VPS preparation allows a missing address, generates separate keys and refuses to overwrite an existing deployment',t=>{
  const root=temporary(t),directory=path.join(root,'deployment')
  const result=prepareCommunityDeployment({directory,members:['alice','bob','alice']})
  assert.equal(result.members,2)
  const environment=fs.readFileSync(path.join(directory,'.env'),'utf8'),access=JSON.parse(fs.readFileSync(path.join(directory,'access.json'),'utf8'))
  assert.match(environment,/CONTALK_COMMUNITY_DOMAIN=\n/)
  assert.deepEqual(access.map(item=>item.username),['alice','bob'])
  assert.ok(access.every(item=>item.url===''&&/^[0-9a-f]{64}$/.test(item.token)))
  assert.notEqual(access[0].token,access[1].token)
  const internal=environment.match(/^CONTALK_COMMUNITY_INTERNAL_TOKEN=(.+)$/m)[1]
  assert.ok(access.every(item=>item.token!==internal))
  assert.throws(()=>prepareCommunityDeployment({directory,members:['charlie']}),/já existe/)
  assert.equal(fs.readFileSync(path.join(directory,'.env'),'utf8'),environment)
  assert.throws(()=>prepareCommunityDeployment({directory:path.join(root,'invalid'),members:['__proto__']}),/username/)
  assert.throws(()=>prepareCommunityDeployment({directory:path.join(root,'invalid'),members:['alice'],domain:'https://example.com/path'}),/domínio/)
  if(process.platform!=='win32')assert.equal(fs.statSync(path.join(directory,'.env')).mode&0o777,0o600)
})

test('the production entry point starts from zero without personal keys and keeps accounts, servers and roles across restart',async t=>{
  let child
  const stop=async()=>{if(child&&child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill();await exited}child=null}
  const root=temporary(t,stop)
  const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(resolve=>listener.close(resolve))
  const legacy='l'.repeat(64)
  const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('CONTALK_'))delete env[key]
  Object.assign(env,{CONTALK_COMMUNITY_HOST:'127.0.0.1',CONTALK_COMMUNITY_PORT:String(port),CONTALK_COMMUNITY_DATA:path.join(root,'data'),CONTALK_COMMUNITY_TOKENS:JSON.stringify({[legacy]:'alice'})})
  const entry=fileURLToPath(new URL('../scripts/community-server.mjs',import.meta.url)),base='http://127.0.0.1:'+port
  const start=async()=>{
    child=spawn(process.execPath,[entry],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']})
    let output='',failure;child.on('error',error=>{failure=error});for(const pipe of [child.stdout,child.stderr])pipe.on('data',value=>{output+=value})
    const deadline=Date.now()+10000
    while(Date.now()<deadline){
      if(failure)throw failure
      if(child.exitCode!==null)throw new Error('Community startup failed: '+output)
      try{const response=await fetch(base+'/health',{signal:AbortSignal.timeout(500)});if(response.ok)return}catch{}
      await new Promise(resolve=>setTimeout(resolve,40))
    }
    throw new Error('Community startup timed out: '+output)
  }
  const request=async(token,route,body)=>{
    const response=await fetch(base+route,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
    return {status:response.status,data:await response.json()}
  }
  await start()
  assert.equal((await request(legacy,'/identity')).status,401)
  const alice=(await request(null,'/register',{username:'alice',email:'alice@teste.dev',password:'senha-forte-1'})).data.token
  assert.ok(alice)
  const created=(await request(alice,'/servers',{name:'Servidor da Alice'})).data
  assert.equal((await request(alice,'/servers/'+created.id+'/commands',{revision:created.revision,action:{type:'role',command:{type:'create',id:'team',name:'Equipe VPS'}}})).status,200)
  assert.ok(fs.existsSync(path.join(root,'data','contalk-v2','accounts.json')))
  await stop();await start()
  assert.deepEqual((await request(alice,'/identity')).data.servers,[{id:created.id,name:'Servidor da Alice'}])
  const restored=(await request(alice,'/servers/'+created.id)).data
  assert.equal(restored.policy.roles.find(role=>role.id==='team').name,'Equipe VPS')
  assert.equal((await request(null,'/login',{identifier:'alice@teste.dev',password:'senha-forte-1'})).status,200)
})
