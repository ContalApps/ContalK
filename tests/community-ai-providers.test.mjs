import {test} from 'node:test'
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {anthropicProvider,geminiProvider,multiAiProvider} from '../scripts/community/ai-providers.mjs'
import {createCommunityService,createCommunityState} from '../scripts/community/service.mjs'
import {parseAiModel,validAiEndpoint} from '../src/roles/ai.ts'

const sample={key:'personal-secret-key',model:'model-alpha',messages:[{userName:'alice',content:'Explique'}],summary:'',files:[],signal:new AbortController().signal}
const sse=events=>new Response(events.map(event=>'data: '+JSON.stringify(event)+'\n\n').join(''),{status:200,headers:{'content-type':'text/event-stream'}})

test('Claude counts the exact request, streams text and records provider usage',async()=>{
  const calls=[]
  const ai=anthropicProvider({fetcher:async(url,options)=>{
    calls.push({url:String(url),body:JSON.parse(options.body),headers:options.headers})
    if(String(url).endsWith('/count_tokens'))return Response.json({input_tokens:47})
    return sse([{type:'message_start',message:{usage:{input_tokens:47,output_tokens:1}}},{type:'content_block_delta',delta:{type:'text_delta',text:'Olá'}},{type:'message_delta',delta:{stop_reason:'end_turn'},usage:{output_tokens:3}},{type:'message_stop'}])
  }})
  assert.equal(await ai.count(sample),47)
  let streamed='';const answer=await ai.generate({...sample,maxOutputTokens:128,onDelta:value=>streamed+=value})
  assert.equal(streamed,'Olá');assert.equal(answer.text,'Olá');assert.deepEqual(answer.usage,{input_tokens:47,output_tokens:3})
  assert.equal(calls[0].headers['x-api-key'],sample.key)
  assert.equal(calls[0].body.model,sample.model)
})

test('Gemini uses countTokens and streamed content with the personal key',async()=>{
  const calls=[]
  const ai=geminiProvider({fetcher:async(url,options)=>{
    calls.push({url:String(url),body:JSON.parse(options.body),headers:options.headers})
    if(String(url).includes(':countTokens'))return Response.json({totalTokens:31})
    return sse([{candidates:[{content:{parts:[{text:'Bom '}]} }]},{candidates:[{content:{parts:[{text:'dia'}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:31,candidatesTokenCount:4}}])
  }})
  assert.equal(await ai.count(sample),31)
  let streamed='';const answer=await ai.generate({...sample,maxOutputTokens:128,onDelta:value=>streamed+=value})
  assert.equal(streamed,'Bom dia');assert.deepEqual(answer.usage,{input_tokens:31,output_tokens:4})
  assert.equal(calls[0].headers['x-goog-api-key'],sample.key)
  assert.equal(calls[0].body.generateContentRequest.model,'models/model-alpha')
  assert.match(calls[1].url,/streamGenerateContent\?alt=sse$/)
})

test('Gemini retries transient HTTP failures and reports persistent failures precisely',async()=>{
  let calls=0,waits=0
  const ai=geminiProvider({fetcher:async()=>{
    calls++
    return calls===1?new Response('',{status:503}):Response.json({totalTokens:12})
  },wait:async()=>{waits++}})
  assert.equal(await ai.count(sample),12)
  assert.equal(calls,2)
  assert.equal(waits,1)

  calls=0
  const unavailable=geminiProvider({fetcher:async()=>{calls++;return new Response('',{status:503})},wait:async()=>{}})
  await assert.rejects(unavailable.count(sample),/Gemini.*HTTP 503/)
  assert.equal(calls,3)

  calls=0
  const payment=geminiProvider({fetcher:async()=>{calls++;return new Response('',{status:402})},wait:async()=>{}})
  await assert.rejects(payment.count(sample),/pagamento ou créditos/)
  assert.equal(calls,1)
})

test('custom endpoints require a server allowlist and cannot receive a mismatched provider key',async t=>{
  assert.deepEqual(parseAiModel('anthropic|claude-model'),{provider:'anthropic',model:'claude-model'})
  for(const url of ['http://api.example.test/v1','https://localhost/v1','https://127.0.0.1/v1','https://user:pass@api.example.test/v1'])assert.equal(validAiEndpoint(url),false)
  const key='k'.repeat(40),service=createCommunityService({tokens:{[key]:'alice'},initialState:createCommunityState(['alice']),aiAllowedHosts:'api.example.test',aiProvider:{count:async()=>20,summarize:async()=>({text:'',usage:{}}),generate:async()=>({text:'OK',usage:{input_tokens:20,output_tokens:1}})}})
  service.server.listen(0,'127.0.0.1');await once(service.server,'listening')
  t.after(async()=>{service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve))})
  const base='http://127.0.0.1:'+service.server.address().port
  const call=async(route,body)=>{const result=await fetch(base+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:result.status,data:await result.json()}}
  const revision=(await call('/servers/srv-1')).data.revision
  const command=action=>call('/servers/srv-1/commands',{revision,action})
  assert.equal((await command({type:'ai-channel-model',channelId:'ch-general',model:'compatible-chat|model-alpha',endpoint:'https://evil.test/v1'})).status,400)
  assert.equal((await command({type:'ai-channel-model',channelId:'ch-general',model:'compatible-chat|model-alpha',endpoint:'https://api.example.test/v1'})).status,200)
  const body={channelId:'ch-general',text:'Oi',key:'personal-secret-key',provider:'anthropic',contextTokens:1024,maxOutputTokens:128,files:[]}
  assert.equal((await call('/servers/srv-1/ai-runs',body)).status,409)
  body.provider='compatible-chat'
  assert.equal((await call('/servers/srv-1/ai-runs',body)).status,202)
})

test('compatible Chat Completions rejects media before generation and streams text',async()=>{
  let called=0
  const router=multiAiProvider({fetcher:async(_url,options)=>{called++;return sse([{choices:[{delta:{content:'Pronto'},finish_reason:null}]},{choices:[{delta:{},finish_reason:'stop'}],usage:{prompt_tokens:12,completion_tokens:2}}])}})
  const args={...sample,provider:'compatible-chat',endpoint:'https://api.example.test/v1',maxOutputTokens:128,onDelta:()=>{}}
  await assert.rejects(router.count({...args,files:[{name:'x.png',type:'image/png',size:1,data:'YQ=='}]}),/apenas anexos de texto/)
  assert.equal(called,0)
  const answer=await router.generate(args)
  assert.equal(answer.text,'Pronto');assert.deepEqual(answer.usage,{input_tokens:12,output_tokens:2})
})
