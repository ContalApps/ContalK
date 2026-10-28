const MAX_MODELS=250
const MAX_RESPONSE_BYTES=2*1024*1024
const validId=value=>typeof value==='string'&&/^[\w.:/-]{2,100}$/.test(value)

const errorFor=(provider,status)=>status===401||status===403?new Error('A chave pessoal de '+provider+' foi recusada.'):status===404||status===405?new Error('Esta API não oferece uma lista de modelos. Informe o identificador manualmente.'):new Error('Não foi possível consultar os modelos de '+provider+' (HTTP '+status+').')

async function getJson(fetcher,url,headers,signal,provider){
  let response
  try{response=await fetcher(url,{method:'GET',headers,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000),redirect:'error'})}
  catch{throw new Error(signal?.aborted?'Consulta de modelos interrompida.':'Não foi possível conectar à lista de modelos de '+provider+'.')}
  if(!response.ok)throw errorFor(provider,response.status)
  if(!response.body)throw new Error('A API não retornou uma lista de modelos.')
  const chunks=[];let size=0
  for await(const chunk of response.body){size+=chunk.length;if(size>MAX_RESPONSE_BYTES)throw new Error('A lista de modelos excedeu o limite de resposta.');chunks.push(chunk)}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw new Error('A API retornou uma lista de modelos inválida.')}
}

export async function listAiModels({provider,key,endpoint,signal,fetcher=fetch}){
  const bearer={Authorization:'Bearer '+key}
  let items=[]
  if(provider==='gemini'){
    let token=''
    for(let page=0;page<3;page++){
      const url='https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000'+(token?'&pageToken='+encodeURIComponent(token):'')
      const data=await getJson(fetcher,url,{'x-goog-api-key':key},signal,'Gemini')
      if(!Array.isArray(data.models))throw new Error('Gemini não retornou uma lista de modelos válida.')
      items.push(...data.models.filter(model=>model.supportedGenerationMethods?.some(m=>['generateContent','generateImages','predict'].includes(m))).map(model=>({id:model.baseModelId||String(model.name||'').replace(/^models\//,''),name:model.displayName})))
      token=data.nextPageToken||''
      if(!token||items.length>=MAX_MODELS)break
    }
  }else{
    const url=provider==='openai'?'https://api.openai.com/v1/models':provider==='anthropic'?'https://api.anthropic.com/v1/models?limit=1000':provider==='xai'?'https://api.x.ai/v1/language-models':endpoint.replace(/\/$/,'')+'/models'
    const headers=provider==='anthropic'?{'x-api-key':key,'anthropic-version':'2023-06-01'}:bearer
    const data=await getJson(fetcher,url,headers,signal,provider==='anthropic'?'Claude':provider==='xai'?'Grok':provider==='openai'?'OpenAI':'API compatível')
    const models=provider==='xai'?data.models:data.data
    if(!Array.isArray(models))throw new Error('A API não retornou uma lista de modelos válida.')
    items=models.map(model=>({id:model.id,name:model.display_name||model.name||model.id}))
  }
  const unique=new Map()
  for(const item of items){const id=provider==='gemini'?String(item.id||'').replace(/^models\//,''):item.id;if(validId(id)&&!unique.has(id))unique.set(id,{id,name:typeof item.name==='string'&&!/[\p{Cc}\p{Zl}\p{Zp}]/u.test(item.name)?item.name.slice(0,120):id});if(unique.size>=MAX_MODELS)break}
  return [...unique.values()].sort((a,b)=>b.id.localeCompare(a.id,undefined,{numeric:true}))
}
