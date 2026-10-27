import {useEffect,useState} from 'react'
import {aiProviderName,aiProviders,parseAiModel,type AiProviderId} from '../roles/ai'

export function AiModelSelector({defaultModel,endpoint,provider,model,onChange}:{defaultModel:string;endpoint?:string;provider:AiProviderId;model:string;onChange:(provider:AiProviderId,model:string)=>void}){
  const [models,setModels]=useState<Array<{id:string;name:string}>>([])
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const defaultProvider=parseAiModel(defaultModel)?.provider||'openai'
  const custom=provider.startsWith('compatible-')
  const availableProviders=aiProviders.filter(item=>!item.startsWith('compatible-')||item===defaultProvider)
  useEffect(()=>{
    let live=true
    setModels([]);setError('');setLoading(true)
    window.contalkDesktop?.communityAiModels(provider,custom?endpoint:undefined)
      .then(result=>{if(live)setModels(result.models)})
      .catch(reason=>{if(live)setError(reason instanceof Error?reason.message:'Não foi possível consultar os modelos.')})
      .finally(()=>{if(live)setLoading(false)})
    if(!window.contalkDesktop){setLoading(false);setError('Abra no aplicativo desktop para consultar modelos.')}
    return()=>{live=false}
  },[provider,custom,endpoint])
  return <div className="ct-ai-model-picker">
    <label>API <select aria-label="Provedor de IA para este pedido" value={provider} onChange={event=>onChange(event.target.value as AiProviderId,'')}>
      {availableProviders.map(item=><option key={item} value={item}>{aiProviderName[item]}</option>)}
    </select></label>
    <label>Modelo <select aria-label="Modelo de IA para este pedido" value={models.some(item=>item.id===model)?model:''} onChange={event=>{if(event.target.value)onChange(provider,event.target.value)}} disabled={loading||!models.length}>
      <option value="">{loading?'Consultando API…':models.length?'Selecione da API':'Lista indisponível'}</option>
      {models.map(item=><option key={item.id} value={item.id}>{item.name===item.id?item.id:item.name+' · '+item.id}</option>)}
    </select></label>
    <button type="button" title="Atualizar lista de modelos" aria-label="Atualizar lista de modelos" onClick={()=>{setLoading(true);setError('');window.contalkDesktop?.communityAiModels(provider,custom?endpoint:undefined).then(result=>setModels(result.models)).catch(reason=>setError(reason instanceof Error?reason.message:'Falha na consulta.')).finally(()=>setLoading(false))}}>↻</button>
    <label>Ou ID <input aria-label="Identificador manual do modelo" value={model} placeholder="Identificador do modelo" maxLength={100} onChange={event=>onChange(provider,event.target.value.trim())}/></label>
    {error&&<small role="status">{error} Informe o ID manualmente se a API não oferecer uma lista.</small>}
    {!error&&models.length>0&&<small>Lista fornecida pela API. O acesso ao modelo é confirmado ao enviar.</small>}
  </div>
}
