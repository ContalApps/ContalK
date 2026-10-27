import {test} from 'node:test'
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {createCommunityService,createCommunityState} from '../scripts/community/service.mjs'
import {can} from '../src/roles/permissions.ts'
import {openAiProvider,validateAiFiles} from '../scripts/community/ai.mjs'
import {geminiProvider} from '../scripts/community/ai-providers.mjs'
import {zipSync} from 'fflate'

const keys={alice:'a'.repeat(40),bob:'b'.repeat(40),carol:'c'.repeat(40)}
async function fixture(t,provider,storage){
  const service=createCommunityService({tokens:Object.fromEntries(Object.entries(keys).map(([name,key])=>[key,name])),initialState:createCommunityState(Object.keys(keys)),aiProvider:provider,storage})
  service.server.listen(0,'127.0.0.1');await once(service.server,'listening')
  t.after(async()=>{service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve))})
  const base='http://127.0.0.1:'+service.server.address().port
  const request=async(actor,route,body)=>{const response=await fetch(base+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+keys[actor],...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()}}
  const command=async(actor,action)=>{const revision=(await request(actor,'/servers/srv-1')).data.revision;return request(actor,'/servers/srv-1/commands',{revision,action})}
  const until=async(predicate)=>{for(let index=0;index<100;index++){const value=await predicate();if(value)return value;await new Promise(resolve=>setTimeout(resolve,10))}throw Error('Timed out waiting for AI run')}
  return {service,base,request,command,until}
}
const provider={
  count:async()=>100,
  summarize:async()=>({text:'Resumo do projeto',usage:{input_tokens:4,output_tokens:3}}),
  generate:async({onDelta,signal})=>{if(signal.aborted)throw Error('aborted');onDelta('Resposta ');await new Promise(resolve=>setTimeout(resolve,20));if(signal.aborted)throw Error('aborted');onDelta('compartilhada');return {text:'Resposta compartilhada',usage:{input_tokens:11,output_tokens:7}}},
}
const prompt=(channelId,files=[])=>({channelId,text:'Explique este projeto',key:'p'.repeat(40),contextTokens:8192,maxOutputTokens:2048,files})

test('HQ co-owners cannot see private AI projects; readers get complete history but cannot send or invoke',async t=>{
  const f=await fixture(t,provider)
  assert.equal((await f.command('alice',{type:'ai-channel-model',channelId:'ch-general',model:'model-alpha'})).status,200)
  assert.equal((await f.command('alice',{type:'project-create',id:'project-1',parentId:'ch-general',name:'Projeto secreto'})).status,200)
  const bob=(await f.request('bob','/servers/srv-1')).data
  assert.equal(JSON.stringify(bob).includes('Projeto secreto'),false)
  assert.equal(can(bob.policy,'bob','VIEW_CHANNEL','project-1'),false)
  assert.equal((await f.request('bob','/servers/srv-1/history/project-1')).status,403)
  assert.equal((await f.command('bob',{type:'project-member',id:'project-1',member:'bob',access:'manager'})).status,403)
  assert.equal((await f.command('alice',{type:'project-member',id:'project-1',member:'bob',access:'reader'})).status,200)
  const reader=(await f.request('bob','/servers/srv-1')).data
  assert.equal(can(reader.policy,'bob','READ_MESSAGE_HISTORY','project-1'),true)
  assert.equal(can(reader.policy,'bob','SEND_MESSAGES','project-1'),false)
  assert.equal((await f.command('bob',{type:'message-send',id:'forged',channel:'project-1',content:'Não'})).status,403)
  assert.equal((await f.request('bob','/servers/srv-1/ai-runs',prompt('project-1'))).status,403)
  assert.equal((await f.command('alice',{type:'message-send',id:'prior',channel:'project-1',content:'Contexto anterior'})).status,200)
  assert.equal((await f.request('bob','/servers/srv-1/history/project-1')).data.messages[0].content,'Contexto anterior')
  assert.equal((await f.command('alice',{type:'project-member',id:'project-1',member:'bob',access:'collaborator'})).status,200)
  assert.equal((await f.command('bob',{type:'message-send',id:'reply',channel:'project-1',content:'Agora posso colaborar'})).status,200)
  assert.equal((await f.command('bob',{type:'project-member',id:'project-1',member:'carol',access:'reader'})).status,403)
  assert.equal((await f.command('alice',{type:'project-member',id:'project-1',member:'bob',access:'manager'})).status,200)
  assert.equal((await f.command('bob',{type:'project-member',id:'project-1',member:'carol',access:'reader'})).status,200)
  assert.equal(can((await f.request('carol','/servers/srv-1')).data.policy,'carol','SEND_MESSAGES','project-1'),false)
  assert.equal((await f.command('alice',{type:'project-member',id:'project-1',member:'bob',access:null})).status,200)
  assert.equal(JSON.stringify((await f.request('bob','/servers/srv-1')).data).includes('Projeto secreto'),false)
})

test('AI runs stream to authorized members and finish with usage, without persisting the personal key or file bytes',async t=>{
  let saved;const storage={load:()=>saved||null,save:value=>{saved=structuredClone(value)}}
  const f=await fixture(t,provider,storage)
  await f.command('alice',{type:'ai-channel-model',channelId:'ch-general',model:'model-alpha'})
  await f.command('alice',{type:'project-create',id:'project-1',parentId:'ch-general',name:'Projeto privado'})
  await f.command('alice',{type:'project-member',id:'project-1',member:'bob',access:'reader'})
  const controller=new AbortController();t.after(()=>controller.abort())
  const stream=await fetch(f.base+'/servers/srv-1/ai-events/project-1',{headers:{Authorization:'Bearer '+keys.bob},signal:controller.signal});assert.equal(stream.status,200)
  const reader=stream.body.getReader()
  const started=await f.request('alice','/servers/srv-1/ai-runs',prompt('project-1'))
  assert.equal(started.status,202)
  let packet='';for(let index=0;index<5&&!/started|delta/.test(packet);index++)packet+=new TextDecoder().decode((await reader.read()).value)
  assert.match(packet,/started|delta/)
  const completed=await f.until(async()=>{const response=await f.request('bob','/servers/srv-1');return response.data.messages['project-1']?.find(message=>message.ai?.status==='completed')})
  assert.equal(completed.content,'Resposta compartilhada');assert.equal(completed.ai.model,'model-alpha');assert.equal(completed.ai.inputTokens,11)
  assert.equal(JSON.stringify(saved).includes('p'.repeat(40)),false)
  controller.abort()
})

test('file validation rejects unsupported data and archived projects do not allow AI invocations',async t=>{
  assert.throws(()=>validateAiFiles([{name:'archive.zip',size:1,data:'YQ=='}]),/não pode ser interpretado/)
  assert.throws(()=>validateAiFiles([{name:'bad.pdf',size:1,data:'YQ=='}]),/PDF/)
  assert.throws(()=>validateAiFiles([{name:'bad.gif',size:1,data:'YQ=='}]),/GIF/)
  assert.throws(()=>validateAiFiles([{name:'bad.docx',size:1,data:'YQ=='}]),/documento/)
  const f=await fixture(t,provider)
  await f.command('alice',{type:'ai-channel-model',channelId:'ch-general',model:'model-alpha'})
  await f.command('alice',{type:'project-create',id:'project-1',parentId:'ch-general',name:'Projeto'})
  assert.equal((await f.request('alice','/servers/srv-1/ai-runs',prompt('project-1',[{name:'archive.zip',size:1,data:'YQ=='}]))).status,400)
  assert.equal((await f.command('alice',{type:'project-member',id:'project-1',member:'bob',access:'manager'})).status,200)
  assert.equal((await f.command('alice',{type:'project-member',id:'project-1',member:'bob',access:null})).status,200)
  const snapshot=(await f.request('alice','/servers/srv-1')).data
  assert.equal(snapshot.policy.projects['project-1'].ownerId,'alice')
})

test('unavailable model records an actionable failure without generating or retaining the key',async t=>{
  let generated=false,saved
  const unavailable={...provider,count:async()=>{throw Error('O modelo escolhido não está disponível para esta chave.')},generate:async()=>{generated=true;throw Error('should not run')}}
  const f=await fixture(t,unavailable,{load:()=>saved||null,save:value=>{saved=structuredClone(value)}})
  await f.command('alice',{type:'ai-channel-model',channelId:'ch-general',model:'model-alpha'})
  const started=await f.request('alice','/servers/srv-1/ai-runs',prompt('ch-general'))
  assert.equal(started.status,202)
  const failed=await f.until(async()=>{const snapshot=(await f.request('alice','/servers/srv-1')).data;return snapshot.messages['ch-general']?.find(item=>item.ai?.id===started.data.runId&&item.ai.status==='failed')})
  assert.match(failed.ai.error,/não está disponível/);assert.equal(generated,false)
  assert.equal(JSON.stringify(saved).includes('p'.repeat(40)),false)
})

test('an archived project stays readable and only an existing manager can restore it',async t=>{
  const initial=createCommunityState(['alice','bob'])
  const server=initial.servers['srv-1']
  server.channels.find(item=>item.id==='ch-general').aiModel='model-alpha'
  server.channels.push({id:'project-1',serverId:'srv-1',type:'text',name:'Projeto',parentId:'ch-general',project:true})
  server.policy.projects={'project-1':{parentId:'ch-general',ownerId:'alice',members:{alice:'manager',bob:'reader'},createdAt:Date.now(),archived:true}}
  server.messages['project-1']=[]
  const f=await fixture(t,provider,{load:()=>initial,save:()=>{}})
  const bob=(await f.request('bob','/servers/srv-1')).data
  assert.equal(can(bob.policy,'bob','READ_MESSAGE_HISTORY','project-1'),true)
  assert.equal(can((await f.request('alice','/servers/srv-1')).data.policy,'alice','SEND_MESSAGES','project-1'),false)
  assert.equal((await f.command('bob',{type:'project-restore',id:'project-1'})).status,403)
  assert.equal((await f.command('alice',{type:'project-member',id:'project-1',member:'carol',access:'reader'})).status,403)
  assert.equal((await f.command('alice',{type:'project-restore',id:'project-1'})).status,200)
  assert.equal(can((await f.request('alice','/servers/srv-1')).data.policy,'alice','SEND_MESSAGES','project-1'),true)
})

test('losing the last manager credential archives a project without inviting another owner',async t=>{
  const initial=createCommunityState(['alice','bob']),server=initial.servers['srv-1']
  server.channels.push({id:'project-1',serverId:'srv-1',type:'text',name:'Projeto',parentId:'ch-general',project:true})
  server.policy.projects={'project-1':{parentId:'ch-general',ownerId:'alice',members:{alice:'manager',bob:'reader'},createdAt:Date.now()}}
  server.messages['project-1']=[]
  const service=createCommunityService({tokens:{[keys.bob]:'bob'},initialState:initial,aiProvider:provider})
  service.server.listen(0,'127.0.0.1');await once(service.server,'listening')
  t.after(async()=>{service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve))})
  const snapshot=service.snapshot('bob','srv-1')
  assert.equal(snapshot.policy.projects['project-1'].archived,true)
  assert.deepEqual(snapshot.policy.projects['project-1'].members,{alice:'manager',bob:'reader'})
  assert.equal(can(snapshot.policy,'bob','SEND_MESSAGES','project-1'),false)
})

test('cancellation marks a partial response as cancelled and allows a later request',async t=>{
  let started=0
  const waiting={...provider,generate:async({onDelta,signal})=>{
    started++;onDelta('Resposta parcial')
    if(started===1)await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true}))
    else return {text:'Resposta retomada',usage:{input_tokens:15,output_tokens:5}}
  }}
  const f=await fixture(t,waiting)
  await f.command('alice',{type:'ai-channel-model',channelId:'ch-general',model:'model-alpha'})
  const first=await f.request('alice','/servers/srv-1/ai-runs',prompt('ch-general'))
  assert.equal(first.status,202)
  await f.until(async()=>started===1)
  const queued=await f.request('bob','/servers/srv-1/ai-runs',prompt('ch-general'))
  assert.equal(queued.status,202);assert.equal(queued.data.queued,true)
  assert.equal((await f.request('bob','/servers/srv-1/ai-runs/ch-general/stop',{runId:queued.data.runId})).status,200)
  await f.until(async()=>{const snapshot=(await f.request('bob','/servers/srv-1')).data;return snapshot.messages['ch-general']?.find(item=>item.ai?.id===queued.data.runId&&item.ai.status==='cancelled')})
  assert.equal((await f.request('bob','/servers/srv-1/ai-runs/ch-general/stop',{})).status,200)
  await f.until(async()=>{const snapshot=(await f.request('alice','/servers/srv-1')).data;return snapshot.messages['ch-general']?.find(item=>item.ai?.id===first.data.runId&&item.ai.status==='cancelled')})
  const second=await f.request('alice','/servers/srv-1/ai-runs',prompt('ch-general'))
  assert.equal(second.status,202)
  const answer=await f.until(async()=>{const snapshot=(await f.request('alice','/servers/srv-1')).data;return snapshot.messages['ch-general']?.find(item=>item.ai?.id===second.data.runId&&item.ai.status==='completed')})
  assert.equal(answer.content,'Resposta retomada')
})

test('multiple requests wait in one conversation and execute in submission order',async t=>{
  let releaseFirst,started=0
  const ordered={...provider,generate:async({onDelta})=>{
    started++
    if(started===1)await new Promise(resolve=>{releaseFirst=resolve})
    const text='Resposta '+started;onDelta(text)
    return {text,usage:{input_tokens:10,output_tokens:3}}
  }}
  const f=await fixture(t,ordered)
  await f.command('alice',{type:'ai-channel-model',channelId:'ch-general',model:'model-alpha'})
  const first=await f.request('alice','/servers/srv-1/ai-runs',prompt('ch-general'))
  await f.until(async()=>!!releaseFirst)
  const second=await f.request('bob','/servers/srv-1/ai-runs',prompt('ch-general'))
  assert.equal(second.status,202);assert.equal(second.data.queued,true)
  const waiting=(await f.request('bob','/servers/srv-1')).data.messages['ch-general'].find(item=>item.ai?.id===second.data.runId)
  assert.equal(waiting.ai.status,'queued');assert.equal(started,1)
  releaseFirst()
  const finished=await f.until(async()=>{const snapshot=(await f.request('bob','/servers/srv-1')).data;return snapshot.messages['ch-general']?.find(item=>item.ai?.id===second.data.runId&&item.ai.status==='completed')})
  assert.equal(finished.content,'Resposta 2')
  assert.equal(started,2)
  const earlier=(await f.request('alice','/servers/srv-1')).data.messages['ch-general'].find(item=>item.ai?.id===first.data.runId)
  assert.equal(earlier.ai.status,'completed')
})

test('a stalled Gemini request fails and releases the next queued request',async t=>{
  let counts=0
  const gemini=geminiProvider({deadlineMs:150,fetcher:async url=>{
    if(String(url).includes(':countTokens'))return ++counts===1?new Promise(()=>{}):Response.json({totalTokens:10})
    return new Response('data: '+JSON.stringify({candidates:[{content:{parts:[{text:'Resposta seguinte'}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:2}})+'\n\n',{status:200})
  }})
  const f=await fixture(t,gemini)
  await f.command('alice',{type:'ai-channel-model',channelId:'ch-general',model:'gemini|model-alpha'})
  const body={...prompt('ch-general'),provider:'gemini'}
  const first=await f.request('alice','/servers/srv-1/ai-runs',body)
  const second=await f.request('bob','/servers/srv-1/ai-runs',body)
  assert.equal(first.status,202)
  assert.equal(second.status,202)
  assert.equal(second.data.queued,true)
  const failed=await f.until(async()=>{const snapshot=(await f.request('alice','/servers/srv-1')).data;return snapshot.messages['ch-general']?.find(message=>message.ai?.id===first.data.runId&&message.ai.status==='failed')})
  assert.match(failed.ai.error,/tempo limite durante a contagem de tokens/)
  const completed=await f.until(async()=>{const snapshot=(await f.request('bob','/servers/srv-1')).data;return snapshot.messages['ch-general']?.find(message=>message.ai?.id===second.data.runId&&message.ai.status==='completed')})
  assert.equal(completed.content,'Resposta seguinte')
})

test('interrupting stalled Gemini counting cancels it and starts the next queued request',async t=>{
  let counts=0
  const gemini=geminiProvider({deadlineMs:1000,fetcher:async url=>{
    if(String(url).includes(':countTokens'))return ++counts===1?new Promise(()=>{}):Response.json({totalTokens:10})
    return new Response('data: '+JSON.stringify({candidates:[{content:{parts:[{text:'Fila liberada'}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:2}})+'\n\n',{status:200})
  }})
  const f=await fixture(t,gemini)
  await f.command('alice',{type:'ai-channel-model',channelId:'ch-general',model:'gemini|model-alpha'})
  const body={...prompt('ch-general'),provider:'gemini'}
  const first=await f.request('alice','/servers/srv-1/ai-runs',body)
  const second=await f.request('bob','/servers/srv-1/ai-runs',body)
  assert.equal(second.data.queued,true)
  assert.equal((await f.request('alice','/servers/srv-1/ai-runs/ch-general/stop',{})).status,200)
  const cancelled=await f.until(async()=>{const snapshot=(await f.request('alice','/servers/srv-1')).data;return snapshot.messages['ch-general']?.find(message=>message.ai?.id===first.data.runId&&message.ai.status==='cancelled')})
  assert.match(cancelled.ai.error,/interrompida/)
  const completed=await f.until(async()=>{const snapshot=(await f.request('bob','/servers/srv-1')).data;return snapshot.messages['ch-general']?.find(message=>message.ai?.id===second.data.runId&&message.ai.status==='completed')})
  assert.equal(completed.content,'Fila liberada')
})

test('provider counts input and streams across CRLF chunk boundaries without storing state',async()=>{
  const requests=[]
  const encoder=new TextEncoder()
  const chunks=['data: {"type":"response.output_text.delta","delta":"Olá"}\r','\n\r\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":9,"output_tokens":2}}}\r\n\r\n']
  const fetcher=async(_url,options)=>{
    requests.push(JSON.parse(options.body))
    if(_url.endsWith('/input_tokens'))return new Response(JSON.stringify({input_tokens:9}),{status:200})
    return new Response(new ReadableStream({start(controller){for(const part of chunks)controller.enqueue(encoder.encode(part));controller.close()}}),{status:200})
  }
  const ai=openAiProvider({fetcher})
  const input={key:'secret',model:'model-alpha',messages:[{userName:'alice',content:'Oi'}],summary:'',files:[]}
  assert.equal(await ai.count(input),9)
  let partial='';const answer=await ai.generate({...input,maxOutputTokens:128,onDelta:delta=>partial+=delta})
  assert.equal(answer.text,'Olá');assert.equal(partial,'Olá');assert.equal(answer.usage.output_tokens,2)
  assert.equal(requests[1].store,false);assert.equal(requests[1].stream,true)
})

test('Office documents and spreadsheets are converted to counted text before generation',async()=>{
  const doc=Buffer.from(zipSync({'word/document.xml':new TextEncoder().encode('<w:document><w:p><w:t>Plano &amp; projeto</w:t></w:p></w:document>')}))
  const sheet=Buffer.from(zipSync({'xl/sharedStrings.xml':new TextEncoder().encode('<sst><si><t>Receita</t></si></sst>'),'xl/worksheets/sheet1.xml':new TextEncoder().encode('<worksheet><row><c t="s"><v>0</v></c><c><v>42</v></c></row></worksheet>')}))
  const files=validateAiFiles([{name:'plano.docx',size:doc.length,data:doc.toString('base64')},{name:'dados.xlsx',size:sheet.length,data:sheet.toString('base64')}])
  assert.match(files[0].extracted,/Plano & projeto/)
  assert.match(files[1].extracted,/Receita \| 42/)
  let input
  const ai=openAiProvider({fetcher:async(_url,options)=>{input=JSON.parse(options.body).input;return new Response(JSON.stringify({input_tokens:42}),{status:200})}})
  assert.equal(await ai.count({key:'secret',model:'model-alpha',messages:[{userName:'alice',content:'Explique'}],summary:'',files}),42)
  assert.equal(input[0].content[1].type,'input_text')
  assert.equal(input[0].content[2].type,'input_text')
  assert.equal(JSON.stringify(input).includes(doc.toString('base64')),false)
})

test('an invitation revocation closes the AI event stream and hides project metadata',async t=>{
  const f=await fixture(t,provider)
  await f.command('alice',{type:'ai-channel-model',channelId:'ch-general',model:'model-alpha'})
  await f.command('alice',{type:'project-create',id:'project-1',parentId:'ch-general',name:'Projeto privado'})
  await f.command('alice',{type:'project-member',id:'project-1',member:'bob',access:'reader'})
  const stream=await fetch(f.base+'/servers/srv-1/ai-events/project-1',{headers:{Authorization:'Bearer '+keys.bob}})
  assert.equal(stream.status,200)
  const reader=stream.body.getReader();await reader.read()
  assert.equal((await f.command('alice',{type:'project-member',id:'project-1',member:'bob',access:null})).status,200)
  const closed=await Promise.race([reader.read().then(value=>value.done),new Promise(resolve=>setTimeout(()=>resolve(false),1000))])
  assert.equal(closed,true)
  assert.equal((await f.request('bob','/servers/srv-1/ai-events/project-1')).status,403)
  assert.equal(JSON.stringify((await f.request('bob','/servers/srv-1')).data).includes('Projeto privado'),false)
})

test('service restart marks a running answer as interrupted without presenting partial output as complete',async t=>{
  const initial=createCommunityState(Object.keys(keys))
  initial.servers['srv-1'].messages['ch-general']=[{id:'old-run',channelId:'ch-general',userId:'ai:old-run',userName:'IA',content:'rascunho',timestamp:Date.now(),ai:{id:'old-run',channelId:'ch-general',actor:'alice',model:'model-alpha',status:'running'}},{id:'queued-run',channelId:'ch-general',userId:'ai:queued-run',userName:'IA',content:'',timestamp:Date.now()+1,ai:{id:'queued-run',channelId:'ch-general',actor:'bob',model:'model-alpha',status:'queued'}}]
  let saved=structuredClone(initial)
  const f=await fixture(t,provider,{load:()=>saved,save:value=>{saved=structuredClone(value)}})
  const message=(await f.request('alice','/servers/srv-1')).data.messages['ch-general'].find(item=>item.id==='old-run')
  assert.equal(message.ai.status,'interrupted')
  assert.equal(saved.servers['srv-1'].messages['ch-general'].find(item=>item.id==='old-run').ai.status,'interrupted')
  assert.equal(saved.servers['srv-1'].messages['ch-general'].find(item=>item.id==='queued-run').ai.status,'interrupted')
})

test('old messages are summarized while recent messages remain available to the model',async t=>{
  let summaries=0,context
  const tracking={...provider,summarize:async()=>{summaries++;return {text:'Resumo de decisões anteriores',usage:{input_tokens:12,output_tokens:8}}},generate:async input=>{context=input;return {text:'OK',usage:{input_tokens:20,output_tokens:3}}}}
  const f=await fixture(t,tracking)
  await f.command('alice',{type:'ai-channel-model',channelId:'ch-general',model:'model-alpha'})
  for(let index=0;index<3;index++)assert.equal((await f.command('alice',{type:'message-send',id:'history-'+index,channel:'ch-general',content:String(index).repeat(1900)})).status,200)
  const started=await f.request('alice','/servers/srv-1/ai-runs',{...prompt('ch-general'),contextTokens:1024})
  assert.equal(started.status,202)
  await f.until(async()=>{const snapshot=(await f.request('alice','/servers/srv-1')).data;return snapshot.messages['ch-general'].some(item=>item.ai?.id===started.data.runId&&item.ai.status==='completed')})
  assert.ok(summaries>0);assert.match(context.summary,/Resumo de decisões/)
  assert.equal(context.messages.at(-1).content,'Explique este projeto')
})
