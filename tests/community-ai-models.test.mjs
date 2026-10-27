import {test} from 'node:test'
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {listAiModels} from '../scripts/community/ai-models.mjs'
import {createCommunityService,createCommunityState} from '../scripts/community/service.mjs'

test('Gemini models come from the personal API key, with generation filtering and pagination',async()=>{
  const calls=[]
  const models=await listAiModels({provider:'gemini',key:'personal-key',fetcher:async(url,options)=>{
    calls.push({url,options})
    return Response.json(calls.length===1?{models:[{name:'models/gemini-flash',displayName:'Flash',supportedGenerationMethods:['generateContent']},{name:'models/embedding',supportedGenerationMethods:['embedContent']}],nextPageToken:'next'}:{models:[{name:'models/gemini-pro',supportedGenerationMethods:['generateContent']}]})
  }})
  assert.deepEqual(models.map(model=>model.id),['gemini-pro','gemini-flash'])
  assert.equal(calls[0].options.headers['x-goog-api-key'],'personal-key')
  assert.match(calls[1].url,/pageToken=next/)
  assert.equal(calls[0].options.redirect,'error')
})

test('native and compatible providers use their model-list protocols',async()=>{
  const seen=[]
  const fetcher=async(url,options)=>{seen.push({url,options});return Response.json(url.includes('language-models')?{models:[{id:'grok-model'}]}:{data:[{id:'model-1',display_name:'Modelo 1'}]})}
  for(const [provider,endpoint] of [['openai'],['anthropic'],['xai'],['compatible-chat','https://api.example.test/v1']]){
    const models=await listAiModels({provider,key:'personal-key',endpoint,fetcher})
    assert.equal(models.length,1)
  }
  assert.equal(seen[0].url,'https://api.openai.com/v1/models')
  assert.match(seen[1].url,/api.anthropic.com\/v1\/models/)
  assert.equal(seen[1].options.headers['x-api-key'],'personal-key')
  assert.equal(seen[2].url,'https://api.x.ai/v1/language-models')
  assert.equal(seen[3].url,'https://api.example.test/v1/models')
})

test('model discovery requires an authenticated session and an allowed custom host',async t=>{
  const token='t'.repeat(40),personal='personal-api-key'
  let saved
  const service=createCommunityService({tokens:{[token]:'alice'},initialState:createCommunityState(['alice']),storage:{load:()=>null,save:value=>{saved=structuredClone(value)}},aiAllowedHosts:'api.example.test',aiProvider:{listModels:async args=>[{id:'model-1',name:args.provider}]}})
  service.server.listen(0,'127.0.0.1');await once(service.server,'listening')
  t.after(async()=>{service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve))})
  const url='http://127.0.0.1:'+service.server.address().port+'/ai-models'
  const call=async(body,auth=token)=>{const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()}}
  assert.equal((await call({provider:'gemini',key:personal},'invalid')).status,401)
  assert.equal((await call({provider:'compatible-chat',key:personal,endpoint:'https://other.example.test/v1'})).status,400)
  assert.deepEqual((await call({provider:'gemini',key:personal})).body.models,[{id:'model-1',name:'gemini'}])
  assert.equal((await call({provider:'compatible-chat',key:personal,endpoint:'https://api.example.test/v1'})).status,200)
  assert.equal(JSON.stringify(saved||{}).includes(personal),false)
})

test('a participant may override the channel default for one AI request',async t=>{
  const token='t'.repeat(40),seen=[]
  const provider={count:async args=>{seen.push({provider:args.provider,model:args.model});return 10},summarize:async()=>({text:'',usage:{}}),generate:async()=>({text:'OK',usage:{input_tokens:10,output_tokens:1}})}
  const service=createCommunityService({tokens:{[token]:'alice'},initialState:createCommunityState(['alice']),aiProvider:provider})
  service.server.listen(0,'127.0.0.1');await once(service.server,'listening')
  t.after(async()=>{service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve))})
  const base='http://127.0.0.1:'+service.server.address().port
  const call=async(route,body)=>{const response=await fetch(base+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()}}
  const revision=0
  assert.equal((await call('/servers/srv-1/commands',{revision,action:{type:'ai-channel-model',channelId:'ch-general',model:'gemini|gemini-default'}})).status,200)
  const started=await call('/servers/srv-1/ai-runs',{channelId:'ch-general',text:'Olá',key:'personal-key',provider:'openai',model:'gpt-model',contextTokens:2048,maxOutputTokens:256,files:[]})
  assert.equal(started.status,202)
  assert.equal(started.body.model,'gpt-model')
  for(let n=0;n<100&&!seen.length;n++)await new Promise(resolve=>setTimeout(resolve,10))
  assert.deepEqual(seen,[{provider:'openai',model:'gpt-model'}])
})

test('a model-free AI channel routes each compatible protocol to its authorized endpoint',async t=>{
  const token='t'.repeat(40),seen=[]
  const provider={count:async args=>{seen.push([args.provider,args.endpoint,args.model]);return 10},summarize:async()=>({text:'',usage:{}}),generate:async()=>({text:'OK',usage:{input_tokens:10,output_tokens:1}})}
  const service=createCommunityService({tokens:{[token]:'alice'},initialState:createCommunityState(['alice']),aiAllowedHosts:'api.example.test,other.example.test',aiProvider:provider})
  service.server.listen(0,'127.0.0.1');await once(service.server,'listening')
  t.after(async()=>{service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve))})
  const base='http://127.0.0.1:'+service.server.address().port
  const call=async(route,body)=>{const response=await fetch(base+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()}}
  assert.equal((await call('/servers/srv-1/commands',{revision:0,action:{type:'channel-create',id:'ai-room',name:'IA',channelType:'text',aiEnabled:true,aiEndpoints:{'compatible-chat':'https://api.example.test/v1','compatible-responses':'https://other.example.test/v1'}}})).status,200)
  for(const [name,endpoint] of [['compatible-chat','https://api.example.test/v1'],['compatible-responses','https://other.example.test/v1']]){
    const result=await call('/servers/srv-1/ai-runs',{channelId:'ai-room',text:'Olá',key:'personal-key',provider:name,model:'model-1',contextTokens:2048,maxOutputTokens:256,files:[]})
    assert.equal(result.status,202)
    for(let n=0;n<100&&!seen.some(item=>item[0]===name);n++)await new Promise(resolve=>setTimeout(resolve,10))
    assert.ok(seen.some(item=>item[0]===name&&item[1]===endpoint&&item[2]==='model-1'))
  }
})
