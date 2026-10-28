import {ExpressionPanel} from './ExpressionPanel'
import type {CommunityExpression} from '../roles/expressions'
import {VoiceMessagePlayer} from './VoiceMessagePlayer'
import {VoiceMessageRecorder} from './VoiceMessageRecorder'
import { canMutateThread } from '../roles/threads'
import { PollEditor } from './PollEditor'
import { PollCard } from './PollCard'
import { ControlIcon } from './ControlIcon'
import { parseAgentActions, AgentActionCard } from './AgentActionCard'
import { AiModelSelector } from './AiModelSelector'
import { AiGeneratedImage } from './AiGeneratedImage'
import { aiModelId,validAiModel,type AiProviderId,TOKEN_ECONOMY_CONFIG,getEconomyMode,type TokenEconomyMode } from '../roles/ai'
import { MessageTools } from './MessageTools'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useCommunityStore } from '../store/useCommunityStore'
import type { Message, MessageOptions, Attachment } from '../store/useAppStore'
import { useRoleStore } from '../store/useRoleStore'
import { canMentionRole } from '../roles/permissions'
import { centralAllows } from '../roles/transport'

function ImagePreview({src,name}:{src:string;name:string}) {
  const [failed,setFailed]=useState(false)
  const [zoomed,setZoomed]=useState(false)
  if(failed)return <span>Prévia indisponível</span>
  return <>
    <img className="ct-chat-image" src={src} alt={name} loading="lazy" referrerPolicy="no-referrer" title="Clique para ampliar" onClick={()=>setZoomed(true)} onError={()=>setFailed(true)}/>
    {zoomed && (
      <div role="dialog" aria-modal="true" className="ct-modal-backdrop" onClick={()=>setZoomed(false)} style={{zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.85)',cursor:'zoom-out'}}>
        <img src={src} alt={name} style={{maxWidth:'90vw',maxHeight:'90vh',objectFit:'contain',borderRadius:'8px',boxShadow:'0 8px 32px rgba(0,0,0,0.8)'}}/>
      </div>
    )}
  </>
}
const storageMessage='Sua conta ainda não está conectada ao servidor. Saia e entre novamente com a internet ligada.'
export function AttachmentPreview({attachment:a,preview=true}:{attachment:Attachment;preview?:boolean}) {
  const [downloadError,setDownloadError]=useState('')
  if(a.storageId)return <div className="ct-attachment">{preview&&a.thumbnail&&<ImagePreview src={'data:image/jpeg;base64,'+a.thumbnail} name={a.name}/>}<strong>{a.name}</strong><small>{(a.size/1024/1024).toFixed(2)} MB</small><button className="ct-download-btn" onClick={()=>{setDownloadError('');void window.contalkDesktop?.openStorageFile(a.storageId!).catch(e=>setDownloadError(e.message))}}><ControlIcon name="download" size={13}/> Baixar arquivo</button>{downloadError&&<p role="alert">{downloadError}</p>}</div>
  const image=/^image\/(png|jpeg|gif|webp)$/.test(a.type)
  const src=image?a.data.replace('application/octet-stream',a.type):a.data
  const text=/^(text\/(plain|csv)|application\/json)$/.test(a.type)
  let snippet=''
  if(text)try{snippet=new TextDecoder().decode(Uint8Array.from(atob(a.data.split(',')[1]),c=>c.charCodeAt(0))).slice(0,600)}catch{/* No preview. */}
  return <div className="ct-attachment">{preview&&image&&<ImagePreview src={src} name={a.name}/>}<a href={a.data} download={a.name} className="ct-download-link"><ControlIcon name="download" size={13}/><strong>{a.name}</strong><small>{Math.max(1,Math.ceil(a.size/1024))} KB · {a.type||'Arquivo'}</small></a>{preview&&snippet&&<pre>{snippet}</pre>}</div>
}
export function MessageContent({content,attachment,preview=true,roleMentions=[],mentionsEveryone}:{content:string;attachment?:Attachment;preview?:boolean;roleMentions?:string[];mentionsEveryone?:'all'|'online'}) {
  const members=useCommunityStore(s=>s.members)
  const snapshot=useRoleStore(s=>s.snapshot)
  const roles=snapshot?.policy.roles||[]
  const renderText=(text:string)=>text.split(/(<@&[\w:-]{1,100}>|@everyone\b|@here\b|@[\w.-]+)/g).map((part,index)=>{
    const match=/^<@&([\w:-]{1,100})>$/.exec(part),role=match?roles.find(role=>role.id===match[1]):undefined
    if(role&&roleMentions.includes(role.id))return <mark className="ct-mention" key={index} aria-label={`Menção ao cargo ${role.name}`}>@{role.name}</mark>
    return part.startsWith('@')&&(members.some(member=>member.username===part.slice(1))||mentionsEveryone&&['@everyone','@here'].includes(part))?<mark className="ct-mention" key={index}>{part}</mark>:part
  })

  const imageRegex = /!\[([^\]]*)\]\(((?:https?:\/\/|data:image\/)[^\s)]+)\)/g
  const contentBlocks: Array<{ type: 'text' | 'image'; text?: string; alt?: string; src?: string }> = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = imageRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      contentBlocks.push({ type: 'text', text: content.slice(lastIndex, match.index) })
    }
    contentBlocks.push({ type: 'image', alt: match[1], src: match[2] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) {
    contentBlocks.push({ type: 'text', text: content.slice(lastIndex) })
  }

  const renderTextBlock = (textBlock: string, blockKey: number | string) => {
    const parts=textBlock.split(/(https?:\/\/[^\s<>]+)/g)
    const links=[...new Set(parts.filter(p=>/^https?:\/\//.test(p)))].slice(0,4)
    return (
      <span key={blockKey} className="ct-message-block">
        {parts.length > 0 && parts.some(p => p.trim()) && (
          <p>{parts.map((p,i)=>/^https?:\/\//.test(p)?<a key={i} href={p} target="_blank" rel="noopener noreferrer">{p}</a>:renderText(p))}</p>
        )}
        {preview&&links.map(link=>{try{const url=new URL(link);return <a className="ct-link-preview" key={link} href={url.href} target="_blank" rel="noopener noreferrer">{/\.(png|jpe?g|gif|webp)$/i.test(url.pathname)&&<ImagePreview src={url.href} name="Imagem compartilhada"/>}<strong>{url.hostname}</strong><small>{url.pathname==='/'?'Abrir site':decodeURI(url.pathname)}</small></a>}catch{return null}})}
      </span>
    )
  }

  return (
    <div className="ct-message-content">
      {contentBlocks.length === 0 ? null : contentBlocks.map((block, idx) => {
        if (block.type === 'image' && block.src) {
          return <AiGeneratedImage key={idx} src={block.src} alt={block.alt} caption={block.alt} />
        }
        return renderTextBlock(block.text || '', idx)
      })}
      {attachment&&<AttachmentPreview attachment={attachment} preview={preview}/>}
    </div>
  )
}
function AiCodeBlock({language,code}:{language:string;code:string}){
  const [copied,setCopied]=useState(false)
  const copy=async()=>{
    try{
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(()=>setCopied(false),2000)
    }catch{/* ignore */}
  }
  return <div className="ct-ai-code">
    <div className="ct-ai-code-header">
      <small>{language||"código"}</small>
      <button type="button" className="ct-ai-code-copy" aria-label="Copiar código" title="Copiar código" onClick={()=>void copy()}>
        <ControlIcon name={copied?"check":"copy"} size={12}/>
        <span>{copied?"Copiado":"Copiar"}</span>
      </button>
    </div>
    <pre><code>{code}</code></pre>
  </div>
}
function AiText({content}:{content:string}){
  const blocks = parseAgentActions(content)
  return <>
    {blocks.map((block, bIdx) => {
      if (block.type === 'action' && block.action) {
        return <AgentActionCard key={block.action.id || bIdx} action={block.action} />
      }
      const textContent = block.text || ''
      return <span key={bIdx}>
        {textContent.split(/(```[\s\S]*?```)/g).map((part, index) => {
          if (!part.startsWith("```") || !part.endsWith("```")) {
            return <MessageContent key={index} content={part} preview={true} />
          }
          const text = part.slice(3, -3), breakAt = text.indexOf("\n"), language = breakAt >= 0 ? text.slice(0, breakAt).trim() : ""
          const code = breakAt >= 0 ? text.slice(breakAt + 1) : text
          return <AiCodeBlock key={index} language={language} code={code} />
        })}
      </span>
    })}
  </>
}
export function ChatComposer({onSend,placeholder,disabled=false,channelId,ai}:{onSend:(text:string,attachment?:Attachment,options?:MessageOptions)=>Promise<void>;placeholder:string;disabled?:boolean;channelId?:string;ai?:{onPrompt:(text:string,fileIds:string[],limits:{contextTokens:number;maxOutputTokens:number},provider:AiProviderId,model:string)=>Promise<void>;active:boolean;endpoints:NonNullable<import('../store/useAppStore').Channel['aiEndpoints']>}}) {
  const [text,setText]=useState(''),[attachment,setAttachment]=useState<Attachment>(),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const [sendToAi,setSendToAi]=useState(()=>{
    if(!ai) return false
    try {
      if(typeof localStorage!=='undefined') {
        const saved = localStorage.getItem('contalk:chat-send-to-ai')
        if(saved!==null) return saved==='true'
      }
    } catch {}
    return false
  }),[aiFiles,setAiFiles]=useState<Array<{id:string;name:string;size:number;type:string}>>([])
  const [aiLimits,setAiLimits]=useState({contextTokens:8192,maxOutputTokens:2048})
  const [selectedProvider,setSelectedProvider]=useState<AiProviderId>(()=>{
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('contalk:preferred-ai-provider') as AiProviderId
        if (saved && ['openai', 'gemini', 'anthropic', 'xai', 'compatible-chat', 'compatible-responses'].includes(saved)) {
          return saved
        }
      }
    } catch { /* ignore */ }
    return 'openai'
  })
  const [selectedModel,setSelectedModel]=useState<string>(()=>{
    try {
      if (typeof localStorage !== 'undefined') {
        const savedProvider = localStorage.getItem('contalk:preferred-ai-provider') || 'openai'
        const savedModelForProvider = localStorage.getItem(`contalk:preferred-ai-model:${savedProvider}`)
        if (savedModelForProvider) return savedModelForProvider
        const generalSaved = localStorage.getItem('contalk:preferred-ai-model')
        if (generalSaved) return generalSaved
      }
    } catch { /* ignore */ }
    return ''
  })
  useEffect(()=>{
    if(!ai) {
      setSendToAi(false)
      setAiFiles([])
    }
  },[!!ai])
  useEffect(()=>{
    if(ai)void window.contalkDesktop?.communityAiStatus().then(value=>{
      setAiLimits({contextTokens:value.contextTokens,maxOutputTokens:value.maxOutputTokens})
      const isCurrentValid = value.providers.includes(selectedProvider) &&
        (!selectedProvider.startsWith('compatible-') || !!ai.endpoints[selectedProvider as 'compatible-chat' | 'compatible-responses'])
      if (!isCurrentValid) {
        const first = value.providers.find(provider =>
          !provider.startsWith('compatible-') || !!ai.endpoints[provider as 'compatible-chat' | 'compatible-responses']
        )
        if (first) {
          setSelectedProvider(first)
          try {
            if (typeof localStorage !== 'undefined') {
              const savedForFirst = localStorage.getItem(`contalk:preferred-ai-model:${first}`)
              if (savedForFirst) setSelectedModel(savedForFirst)
            }
          } catch { /* ignore */ }
        }
      }
    }).catch(()=>{})
  },[!!ai])
  const [localFile,setLocalFile]=useState<{id:string;name:string;size:number;type:string;thumbnail?:string}>()
  
  const [expressionPanel,setExpressionPanel]=useState(false),[expression,setExpression]=useState<CommunityExpression|null>(null)
  const [voiceRecorder,setVoiceRecorder]=useState(false)
  const [pollEditor,setPollEditor]=useState(false)
  const [preview,setPreview]=useState(true),[once,setOnce]=useState(false),[tts,setTts]=useState(false)
  const members=useCommunityStore(s=>s.members)
  const snapshot=useRoleStore(s=>s.snapshot),self=useAuthStore(s=>s.user?.username)
  const mentionRoles=snapshot&&self&&channelId?snapshot.policy.roles.filter(role=>role.id!==snapshot.policy.serverId&&canMentionRole(snapshot.policy,self,role,channelId)):[]
  const sendAfter=channelId?snapshot?.sendAfter?.[channelId]||0:0
  const [now,setNow]=useState(snapshot?.serverNow??Date.now())
  useEffect(()=>{const started=performance.now(),base=snapshot?.serverNow??Date.now();setNow(base);if(sendAfter<=base)return;const timer=setInterval(()=>{const value=base+performance.now()-started;setNow(value);if(value>=sendAfter)clearInterval(timer)},250);return()=>clearInterval(timer)},[sendAfter,snapshot?.serverNow])
  const cooling=sendAfter>now
  const canPoll=!!snapshot&&!!channelId&&snapshot.channels.some(channel=>channel.id===channelId&&channel.type==='text')&&centralAllows('SEND_POLLS',channelId)&&centralAllows('SEND_MESSAGES',channelId)
  const canVoice=!!snapshot&&!!channelId&&centralAllows('SEND_VOICE_MESSAGES',channelId)&&centralAllows('SEND_MESSAGES',channelId)
  const canTts=!!snapshot&&!!channelId&&centralAllows('SEND_TTS_MESSAGES',channelId)&&centralAllows('SEND_MESSAGES',channelId)
  const canAttach=!channelId||centralAllows('ATTACH_FILES',channelId)
  const canPreview=!channelId||centralAllows('EMBED_LINKS',channelId)
  const choose=async(file?:File)=>{
    if(sendToAi){setError('Para incluir um arquivo no pedido à IA, use o botão + e selecione-o no computador.');return}
    if(disabled||!canAttach){setError('Seu cargo não permite anexar arquivos neste canal.');return}
    if(!file)return
    if(file.size>1048576){setError('Escolha um arquivo de até 1 MB.');return}
    setBusy(true);setError('')
    try{const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>resolve(String(reader.result).replace(/^data:[^,]*,/, 'data:application/octet-stream;base64,'));reader.readAsDataURL(file)})
      setAttachment({name:file.name.slice(0,200),type:file.type.slice(0,100),size:file.size,data})
    }catch{setError('Não foi possível ler o arquivo.')}finally{setBusy(false)}
  }
  const pick=async()=>{setError('');try{const desktop=window.contalkDesktop;if(!desktop)throw new Error('Use o aplicativo desktop para anexar arquivos.');if(sendToAi){const files=await desktop.communityAiSelectFiles();if(files.length)setAiFiles(files);return}if(!await desktop.storageStatus())throw new Error(storageMessage);const file=await desktop.selectStorageFile();if(file){setLocalFile(file);setAttachment(undefined)}}catch(e){setError(e instanceof Error?e.message:'Falha ao selecionar.')}}
  return <div className="ct-chat-compose">{localFile&&<div className="ct-pending-attachment">{preview&&localFile.thumbnail&&<ImagePreview src={'data:image/jpeg;base64,'+localFile.thumbnail} name={localFile.name}/>}<strong>{localFile.name}</strong><small>{(localFile.size/1024/1024).toFixed(2)} MB</small><button onClick={()=>setLocalFile(undefined)}>Remover anexo</button></div>}{ai&&<div className={`ct-composer-ai-wrapper ${sendToAi ? 'is-active' : ''}`}><div className="ct-ai-toggle-bar"><label className="ct-ai-toggle"><input type="checkbox" aria-label="Enviar à IA" checked={sendToAi} onChange={event=>{const checked=event.target.checked;setSendToAi(checked);try{if(typeof localStorage!=='undefined'){localStorage.setItem('contalk:chat-send-to-ai',String(checked))}}catch{}setAttachment(undefined);setLocalFile(undefined);setExpression(null);setAiFiles([]);setOnce(false);setTts(false)}}/><span className="ct-ai-toggle-brand"><ControlIcon name="ai" size={13}/> Assistente de IA</span></label>{sendToAi&&<span className="ct-ai-toggle-active-tag">Modo IA Ativo</span>}{sendToAi&&<button type="button" className="ct-ai-deactivate-btn" title="Desativar modo IA e voltar ao chat normal" aria-label="Desativar IA no chat" onClick={()=>{setSendToAi(false);try{if(typeof localStorage!=='undefined'){localStorage.setItem('contalk:chat-send-to-ai','false')}}catch{}}}><ControlIcon name="close" size={11}/><span>Desativar IA</span></button>}</div>{sendToAi&&<div className="ct-ai-expanded-controls"><AiModelSelector endpoints={ai.endpoints} provider={selectedProvider} model={selectedModel} onChange={(provider,model)=>{setSelectedProvider(provider);setSelectedModel(model);try{if(typeof localStorage!=='undefined'){localStorage.setItem('contalk:preferred-ai-provider',provider);if(model){localStorage.setItem('contalk:preferred-ai-model',model);localStorage.setItem(`contalk:preferred-ai-model:${provider}`,model)}}}catch{}}}/><div className="ct-ai-economy-picker"><label htmlFor="ct-composer-economy">Economia:</label><select id="ct-composer-economy" aria-label="Economia de Tokens" className="ct-ai-picker-select" value={getEconomyMode(aiLimits.contextTokens, aiLimits.maxOutputTokens)} onChange={e=>{const mode=e.target.value as TokenEconomyMode;const cfg=TOKEN_ECONOMY_CONFIG[mode];setAiLimits({contextTokens:cfg.contextTokens,maxOutputTokens:cfg.maxOutputTokens})}}><option value="standard">Padrão (Sem economia)</option><option value="moderate">Moderada (Recomendado)</option><option value="aggressive">Bruta (Máx economia)</option></select></div></div>}</div>}{!!aiFiles.length&&<div className="ct-pending-attachment">{aiFiles.map(file=><span key={file.id}>{file.name} · {(file.size/1024/1024).toFixed(2)} MB </span>)}<button type="button" onClick={()=>setAiFiles([])}>Remover</button></div>}{!sendToAi&&<div className="ct-send-options"><label><input type="checkbox" checked={preview&&canPreview} disabled={!canPreview} onChange={e=>setPreview(e.target.checked)}/> Gerar prévia</label><label><input type="checkbox" checked={once} onChange={e=>setOnce(e.target.checked)}/> Visualização única por pessoa</label><label><input type="checkbox" aria-label="Enviar com leitura em voz" checked={tts} disabled={!canTts&&!tts} onChange={event=>setTts(event.target.checked)}/> Leitura em voz</label><select aria-label="Mencionar pessoa" className="ct-mention-select" value="" onChange={e=>{const value=e.target.value;setText(text+(value.startsWith('role:')?' <@&'+value.slice(5)+'> ':value.startsWith('all:')?' @'+value.slice(4)+' ':' @'+value+' '))}}><option value="">@ Mencionar</option>{members.map(m=><option key={m.username} value={m.username}>{m.display_name}</option>)}{mentionRoles.length>0&&<optgroup label="Cargos">{mentionRoles.map(role=><option key={role.id} value={'role:'+role.id}>{role.name}</option>)}</optgroup>}{channelId&&snapshot&&centralAllows('MENTION_EVERYONE',channelId)&&<optgroup label="Todos"><option value="all:everyone">@everyone</option><option value="all:here">@here</option></optgroup>}</select></div>}{expression&&<div className="ct-pending-expression"><img src={'data:image/jpeg;base64,'+expression.attachment.thumbnail} alt=""/><span>{expression.name}</span><button disabled={busy} onClick={()=>setExpression(null)}>Remover expressão</button></div>}{attachment&&<div className="ct-pending-attachment"><AttachmentPreview attachment={attachment}/><button type="button" disabled={busy} onClick={()=>setAttachment(undefined)}>Remover anexo</button></div>}<form className="ct-composer" onSubmit={async e=>{e.preventDefault();if(busy||disabled||cooling||(!text.trim()&&!attachment&&!localFile&&!expression))return;if(expression&&(once||tts||attachment||localFile)){setError('Envie a expressão sem anexo, leitura em voz ou visualização única.');return}if(tts&&(once||attachment||localFile)){setError('Leitura em voz exige texto sem anexo ou visualização única.');return}setBusy(true);setError('');try{if(sendToAi&&ai){if(!validAiModel(aiModelId(selectedProvider,selectedModel)))throw new Error('Selecione um modelo de IA válido.');await ai.onPrompt(text,aiFiles.map(file=>file.id),aiLimits,selectedProvider,selectedModel);setText('');setAiFiles([]);return}let uploaded=attachment
      if(localFile)uploaded=await window.contalkDesktop!.uploadStorageFile(localFile.id)
      else if(attachment&&!attachment.storageId){if(!window.contalkDesktop)throw new Error('Use o aplicativo desktop para enviar anexos.');if(!await window.contalkDesktop.storageStatus())throw new Error(storageMessage);uploaded=await window.contalkDesktop.uploadInlineAttachment(attachment)}
      if(uploaded){setAttachment(uploaded);setLocalFile(undefined)}
      await onSend(text,uploaded,{preview,once,tts,expression:expression?{serverId:expression.serverId,id:expression.id}:undefined});setText('');setAttachment(undefined);setExpression(null)}catch(e){setError(e instanceof Error?e.message:'Falha ao enviar.')}finally{setBusy(false)}}}>
    {!sendToAi&&snapshot&&channelId&&<button type="button" className="ct-attach-button" aria-label="Emojis e figurinhas" title="Emojis e figurinhas" disabled={busy} onClick={()=>setExpressionPanel(true)}><ControlIcon name="react"/></button>}
    {!sendToAi&&canVoice&&<button type="button" className="ct-attach-button" aria-label="Gravar mensagem de voz" title="Gravar mensagem de voz" disabled={busy||disabled||cooling} onClick={()=>setVoiceRecorder(true)}><ControlIcon name="mic"/></button>}
    {!sendToAi&&canPoll&&<button type="button" className="ct-attach-button" aria-label="Criar enquete" title="Criar enquete" disabled={busy||disabled} onClick={()=>setPollEditor(true)}><ControlIcon name="poll"/></button>}
    <button type="button" className="ct-attach-button" aria-label={sendToAi?'Anexar arquivo à IA (até 50 MB no total)':'Anexar imagem ou arquivo (até 2 GB)'} disabled={busy||disabled||(!sendToAi&&!canAttach)} onClick={()=>void pick()}><ControlIcon name="plus" size={18}/></button>
    <input list="ct-mention-users" aria-label="Mensagem" maxLength={2000} placeholder={sendToAi?`Perguntar à IA em #${channelId}`:placeholder} value={text} disabled={busy||disabled} onChange={e=>setText(e.target.value)} onPaste={e=>{const file=e.clipboardData.files[0];if(file){e.preventDefault();void choose(file)}}}/><button className="ct-primary ct-composer-send-btn" disabled={busy||disabled||cooling||!!(sendToAi&&(!Number.isInteger(aiLimits.contextTokens)||aiLimits.contextTokens<1024||aiLimits.contextTokens>32768||!Number.isInteger(aiLimits.maxOutputTokens)||aiLimits.maxOutputTokens<128||aiLimits.maxOutputTokens>8192))||(!text.trim()&&!attachment&&!localFile&&!expression)}><ControlIcon name="send" size={13}/><span>{busy?'Enviando…':sendToAi?'Perguntar à IA':'Enviar'}</span></button></form><div className="ct-composer-hint" role={error?'alert':undefined}>{error||(cooling?'Modo lento: aguarde '+Math.ceil((sendAfter-now)/1000)+' s para enviar.':sendToAi?(ai?.active?'A resposta atual continua; este pedido entrará na fila.':'Anexos para IA: até 50 MB por pedido.'):'Anexe arquivos de até 2 GB. Imagens coladas: até 1 MB.')}</div>{expressionPanel&&channelId&&<ExpressionPanel channelId={channelId} onSelect={setExpression} onClose={()=>setExpressionPanel(false)}/>} {voiceRecorder&&channelId&&<VoiceMessageRecorder key={channelId} channelId={channelId} onSend={onSend} onClose={()=>setVoiceRecorder(false)}/>} {pollEditor&&channelId&&<PollEditor channelId={channelId} onClose={()=>setPollEditor(false)} onSend={poll=>onSend(poll.question,undefined,{poll})}/>}</div>
}


export function ChatMessage({message:m,onOpenChannel,aiPartial,onAiRetry,onAiCancel}:{message:Message;onOpenChannel?:(id:string)=>void;aiPartial?:string;onAiRetry?:()=>Promise<void>;onAiCancel?:()=>Promise<void>}) {
  const username=useAuthStore(s=>s.user?.username)||''
  const own=m.userId===username
  const roles=useRoleStore(),editAllowed=!roles.snapshot||canMutateThread(roles.snapshot.policy,username,m.channelId,'edit',roles.snapshot.serverNow),deleteAllowed=!roles.snapshot||canMutateThread(roles.snapshot.policy,username,m.channelId,'delete',roles.snapshot.serverNow)
  const storageKey='contalk-viewed:'+username+':'+m.id
  const [viewed,setViewed]=useState(()=>localStorage.getItem(storageKey)==='true')
  const [opened,setOpened]=useState(false),[editing,setEditing]=useState(false),[draft,setDraft]=useState(m.content),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const change=async(content?:string)=>{setBusy(true);setError('');try{await useCommunityStore.getState().changeMessage(m.channelId,m.id,content);setEditing(false)}catch(e){setError(e instanceof Error?e.message:'Falha ao alterar.')}finally{setBusy(false)}}
  const body=m.ai?<div className="ct-ai-response"><AiText content={m.ai.status==='queued'?'Pedido na fila…':m.ai.status==='running'?(aiPartial||'A IA está respondendo…'):m.content}/>{m.ai.status!=='completed'&&m.ai.status!=='running'&&<small role="status">{m.ai.status==='queued'?'Aguardando a resposta anterior':m.ai.status==='cancelled'?'Resposta interrompida':m.ai.status==='interrupted'?'Serviço reiniciado':'Resposta não concluída'}{m.ai.error?' · '+m.ai.error:''}</small>}{m.ai.status==='completed'&&<small>{m.ai.model} · {m.ai.inputTokens||0} entrada · {m.ai.outputTokens||0} saída</small>}{!!m.ai.files?.length&&<small>Arquivos recebidos: {m.ai.files.map(file=>file.name).join(', ')}. Anexe novamente para reutilizar.</small>}{m.ai.status==='queued'&&onAiCancel&&<button disabled={busy} onClick={()=>{setBusy(true);setError('');void onAiCancel().catch(failure=>setError(failure instanceof Error?failure.message:'Não foi possível retirar da fila.')).finally(()=>setBusy(false))}}>Retirar da fila</button>}{['failed','cancelled','interrupted'].includes(m.ai.status)&&onAiRetry&&<button disabled={busy} onClick={()=>{setBusy(true);setError('');void onAiRetry().catch(failure=>setError(failure instanceof Error?failure.message:'Não foi possível tentar novamente.')).finally(()=>setBusy(false))}}>Tentar novamente</button>}</div>:m.expression?<><MessageContent content={m.content} roleMentions={m.roleMentions} mentionsEveryone={m.mentionsEveryone} preview={m.preview!==false}/><figure className={'ct-message-expression '+m.expression.kind}>{m.attachment?.thumbnail?<img src={'data:image/jpeg;base64,'+m.attachment.thumbnail} alt={m.expression.name}/>:<span>:{m.expression.name}:</span>}<figcaption>{m.expression.name}</figcaption></figure></>:m.voice?<VoiceMessagePlayer message={m}/>:m.poll?<PollCard message={m}/>:<MessageContent content={m.content} attachment={m.attachment} preview={m.preview!==false} roleMentions={m.roleMentions} mentionsEveryone={m.mentionsEveryone}/>
  return <div>{m.once&&!own?<>{viewed&&!opened?<p>Mensagem já visualizada</p>:<button disabled={busy} onClick={async()=>{setBusy(true);try{if(!window.contalkDesktop)throw new Error('Abra no ConTALK desktop.');const allowed=await window.contalkDesktop.claimMessageView(m.id);localStorage.setItem(storageKey,'true');setViewed(true);if(allowed)setOpened(true)}catch(e){setError(e instanceof Error?e.message:'Não foi possível registrar a visualização.')}finally{setBusy(false)}}}>Abrir uma vez</button>}{opened&&<div role="dialog" aria-modal="true" className="ct-modal-backdrop"><section className="ct-edit-dialog">{body}<button onClick={()=>setOpened(false)}>Fechar visualização</button></section></div>}</>:editing?<form onSubmit={e=>{e.preventDefault();void change(draft)}}><textarea maxLength={2000} value={draft} onChange={e=>setDraft(e.target.value)}/><button disabled={busy}>Salvar</button><button type="button" onClick={()=>setEditing(false)}>Cancelar</button></form>:body}{m.editedAt&&<small>Editada</small>}{own&&<div className="ct-message-actions">{!m.poll&&!m.voice&&<button disabled={busy||!editAllowed} title="Editar mensagem" aria-label="Editar mensagem" onClick={()=>{setDraft(m.content);setEditing(true)}}><ControlIcon name="edit" size={12}/><span>Editar</span></button>}<button disabled={busy||!deleteAllowed} title="Apagar mensagem" aria-label="Apagar mensagem" onClick={()=>void change()}><ControlIcon name="delete" size={12}/><span>Apagar</span></button></div>}{!m.ai&&!editing&&<MessageTools message={m} onOpenChannel={onOpenChannel}/>} {error&&<p role="alert">{error}</p>}</div>
}
