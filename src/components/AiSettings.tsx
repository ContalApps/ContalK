import {useEffect,useState} from 'react'
import {aiProviders,aiProviderName,type AiProviderId} from '../roles/ai'

export function AiSettings(){
  const [provider,setProvider]=useState<AiProviderId>('openai'),[key,setKey]=useState(''),[configured,setConfigured]=useState<AiProviderId[]>([])
  const [contextTokens,setContextTokens]=useState(8192),[maxOutputTokens,setMaxOutputTokens]=useState(2048),[busy,setBusy]=useState(false),[status,setStatus]=useState('')
  useEffect(()=>{void window.contalkDesktop?.communityAiStatus().then(value=>{setConfigured(value.providers||[]);setContextTokens(value.contextTokens);setMaxOutputTokens(value.maxOutputTokens)}).catch(()=>setStatus('Não foi possível ler a configuração da IA.'))},[])
  const saved=configured.includes(provider)
  return <section className="ct-settings-preferences"><div className="ct-settings-section-title"><h2>APIs pessoais de IA</h2><span>Cada provedor usa sua própria chave, protegida neste computador. A cobrança é feita pelo provedor da chave usada.</span></div>
    <form onSubmit={event=>{event.preventDefault();setBusy(true);setStatus('');void window.contalkDesktop!.communityAiConfigure({provider,...(key.trim()?{key:key.trim()}:{}),contextTokens,maxOutputTokens}).then(value=>{setConfigured(value.providers);setKey('');setStatus('Chave de '+aiProviderName[provider]+' salva neste dispositivo.')}).catch(error=>setStatus(error.message)).finally(()=>setBusy(false))}}>
      <label>Provedor<select aria-label="Provedor da chave pessoal" value={provider} onChange={event=>{setProvider(event.target.value as AiProviderId);setKey('');setStatus('')}}>{aiProviders.map(item=><option key={item} value={item}>{aiProviderName[item]}</option>)}</select></label>
      <label>Chave da API<input aria-label={'Chave pessoal de '+aiProviderName[provider]} type="password" value={key} onChange={event=>setKey(event.target.value)} placeholder={saved?'Chave já configurada · deixe vazio para manter':'Cole sua chave pessoal'} autoComplete="off"/></label>
      <label>Máximo de tokens de contexto por pedido<input type="number" aria-label="Limite de contexto da IA" min={1024} max={32768} step={1024} value={contextTokens} onChange={event=>setContextTokens(Number(event.target.value))}/></label>
      <label>Máximo de tokens de saída por pedido<input type="number" aria-label="Limite de saída da IA" min={128} max={8192} step={128} value={maxOutputTokens} onChange={event=>setMaxOutputTokens(Number(event.target.value))}/></label>
      <button className="ct-primary" disabled={busy||!window.contalkDesktop?.communityAiConfigure||!saved&&!key.trim()}>{busy?'Salvando…':'Salvar configuração'}</button>
    </form>
    {saved&&<button disabled={busy} onClick={()=>{setBusy(true);void window.contalkDesktop!.communityAiRemove(provider).then(()=>{setConfigured(current=>current.filter(item=>item!==provider));setKey('');setStatus('Chave de '+aiProviderName[provider]+' removida deste dispositivo.')}).catch(error=>setStatus(error.message)).finally(()=>setBusy(false))}}>Remover chave de {aiProviderName[provider]}</button>}
    <p role="status">{status||'O histórico é compartilhado com os membros autorizados. Sua chave não aparece no histórico.'}</p>
  </section>
}
