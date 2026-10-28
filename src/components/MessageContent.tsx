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
import { LinkPreview } from './LinkPreview'
import { aiModelId,validAiModel,type AiProviderId,TOKEN_ECONOMY_CONFIG,getEconomyMode,type TokenEconomyMode } from '../roles/ai'
import { MessageTools } from './MessageTools'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useCommunityStore } from '../store/useCommunityStore'
import { usePreferencesStore } from '../store/usePreferencesStore'
import { useDevCollaborationStore } from '../store/useDevCollaborationStore'
import { useAppsStore } from '../store/useAppsStore'
import type { Message, MessageOptions, Attachment } from '../store/useAppStore'
import { useRoleStore } from '../store/useRoleStore'
import { canMentionRole } from '../roles/permissions'
import { centralAllows } from '../roles/transport'

const fileUrlCache = new Map<string, string>()

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

function ImageAttachmentPreview({ attachment: a, preview = true }: { attachment: Attachment; preview?: boolean }) {
  const [url, setUrl] = useState<string | null>(() => {
    if (a.data && a.data.length > 50) {
      return a.data.startsWith('data:') ? a.data : `data:${a.type || 'image/png'};base64,${a.data}`
    }
    if (a.storageId && fileUrlCache.has(a.storageId)) {
      return fileUrlCache.get(a.storageId)!
    }
    return null
  })
  const [downloadError, setDownloadError] = useState('')
  const [zoomed, setZoomed] = useState(false)
  const [failed, setFailed] = useState(false)

  const placeholder = a.thumbnail ? `data:image/jpeg;base64,${a.thumbnail}` : null

  useEffect(() => {
    if (url || !a.storageId) return

    let active = true
    const fetchUrl = async () => {
      try {
        if (window.contalkDesktop?.getStorageFileUrl) {
          const directUrl = await window.contalkDesktop.getStorageFileUrl(a.storageId!)
          if (active && directUrl) {
            fileUrlCache.set(a.storageId!, directUrl)
            setUrl(directUrl)
          }
        }
      } catch {
        // Fallback
      }
    }
    void fetchUrl()
    return () => {
      active = false
    }
  }, [a.storageId, url])

  const effectiveSrc = url || placeholder

  if (!preview) {
    return (
      <div className="ct-attachment">
        <strong>{a.name}</strong>
        <small>{(a.size / 1024 / 1024).toFixed(2)} MB</small>
        <button
          className="ct-download-btn"
          onClick={() => {
            setDownloadError('')
            if (a.storageId) void window.contalkDesktop?.openStorageFile(a.storageId).catch(e => setDownloadError(e.message))
          }}
        >
          <ControlIcon name="download" size={13} /> Baixar imagem
        </button>
      </div>
    )
  }

  return (
    <div className="ct-image-attachment-card">
      <div
        className="ct-image-attachment-wrapper"
        onClick={() => effectiveSrc && setZoomed(true)}
        title="Clique para ver em tamanho original"
      >
        {effectiveSrc && !failed ? (
          <img
            className="ct-chat-image"
            src={effectiveSrc}
            alt={a.name}
            loading="lazy"
            onError={() => {
              if (url && placeholder && effectiveSrc === url) {
                setUrl(null)
              } else {
                setFailed(true)
              }
            }}
          />
        ) : (
          <div className="ct-image-fallback">
            <ControlIcon name="image" size={24} />
            <span>Imagem</span>
          </div>
        )}
        <div className="ct-image-overlay-hint">
          <ControlIcon name="expand" size={13} />
          <span>Ver original</span>
        </div>
      </div>

      <div className="ct-image-attachment-footer">
        <div className="ct-image-attachment-info">
          <span className="ct-image-attachment-name" title={a.name}>{a.name}</span>
          <span className="ct-image-attachment-size">
            {a.size > 1048576
              ? `${(a.size / 1024 / 1024).toFixed(2)} MB`
              : `${Math.max(1, Math.round(a.size / 1024))} KB`}
          </span>
        </div>
        <button
          className="ct-download-icon-btn"
          title="Baixar imagem original"
          aria-label={`Baixar imagem ${a.name}`}
          onClick={e => {
            e.stopPropagation()
            setDownloadError('')
            if (a.storageId) {
              void window.contalkDesktop?.openStorageFile(a.storageId).catch(err => setDownloadError(err.message))
            } else if (effectiveSrc) {
              const aTag = document.createElement('a')
              aTag.href = effectiveSrc
              aTag.download = a.name
              aTag.click()
            }
          }}
        >
          <ControlIcon name="download" size={14} />
        </button>
      </div>

      {downloadError && <p role="alert" className="ct-attachment-error">{downloadError}</p>}

      {zoomed && effectiveSrc && (
        <div
          role="dialog"
          aria-modal="true"
          className="ct-modal-backdrop ct-image-modal"
          onClick={() => setZoomed(false)}
          style={{
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.88)',
            cursor: 'zoom-out'
          }}
        >
          <div
            className="ct-image-modal-body"
            onClick={e => e.stopPropagation()}
            style={{ cursor: 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '92vw', maxHeight: '92vh' }}
          >
            <img
              src={effectiveSrc}
              alt={a.name}
              style={{
                maxWidth: '92vw',
                maxHeight: '82vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.85)'
              }}
            />
            <div
              className="ct-image-modal-toolbar"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                marginTop: '12px',
                padding: '6px 12px',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: '8px',
                backdropFilter: 'blur(8px)'
              }}
            >
              <span style={{ fontSize: '13px', color: '#fff', fontWeight: 500 }}>
                {a.name} · {(a.size / 1024 / 1024).toFixed(2)} MB
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="ct-secondary"
                  style={{ padding: '5px 12px', fontSize: '12px' }}
                  onClick={() => {
                    if (a.storageId) void window.contalkDesktop?.openStorageFile(a.storageId)
                    else if (effectiveSrc) {
                      const link = document.createElement('a')
                      link.href = effectiveSrc
                      link.download = a.name
                      link.click()
                    }
                  }}
                >
                  <ControlIcon name="download" size={13} /> Baixar
                </button>
                <button
                  className="ct-secondary"
                  style={{ padding: '5px 12px', fontSize: '12px' }}
                  onClick={() => setZoomed(false)}
                >
                  <ControlIcon name="close" size={13} /> Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const storageMessage='Sua conta ainda não está conectada ao servidor. Saia e entre novamente com a internet ligada.'
export function AttachmentPreview({attachment:a,preview=true}:{attachment:Attachment;preview?:boolean}) {
  const [downloadError,setDownloadError]=useState('')
  const isImage =
    /^image\/(png|jpe?g|gif|webp|svg(\+xml)?)/i.test(a.type) ||
    /\.(png|jpe?g|gif|webp|svg)$/i.test(a.name)

  if (isImage) {
    return <ImageAttachmentPreview attachment={a} preview={preview} />
  }

  if(a.storageId)return <div className="ct-attachment">{preview&&a.thumbnail&&<ImagePreview src={'data:image/jpeg;base64,'+a.thumbnail} name={a.name}/>}<strong>{a.name}</strong><small>{(a.size/1024/1024).toFixed(2)} MB</small><button className="ct-download-btn" onClick={()=>{setDownloadError('');void window.contalkDesktop?.openStorageFile(a.storageId!).catch(e=>setDownloadError(e.message))}}><ControlIcon name="download" size={13}/> Baixar arquivo</button>{downloadError&&<p role="alert">{downloadError}</p>}</div>
  const text=/^(text\/(plain|csv)|application\/json)$/.test(a.type)
  let snippet=''
  if(text)try{snippet=new TextDecoder().decode(Uint8Array.from(atob(a.data.split(',')[1]),c=>c.charCodeAt(0))).slice(0,600)}catch{/* No preview. */}
  return <div className="ct-attachment"><a href={a.data} download={a.name} className="ct-download-link"><ControlIcon name="download" size={13}/><strong>{a.name}</strong><small>{Math.max(1,Math.ceil(a.size/1024))} KB · {a.type||'Arquivo'}</small></a>{preview&&snippet&&<pre>{snippet}</pre>}</div>
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
        {preview && links.map(link => <LinkPreview key={link} url={link} />)}
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
  const [applied,setApplied]=useState(false)
  const [applying,setApplying]=useState(false)
  const [applyError,setApplyError]=useState('')

  // Parse path and clean language
  let detectedFilePath = ''
  let cleanLang = language.trim()

  if (cleanLang.includes(':')) {
    const parts = cleanLang.split(':')
    if (parts[0] === 'file' || parts[0] === 'path') {
      detectedFilePath = parts.slice(1).join(':').trim()
      cleanLang = detectedFilePath.split('.').pop() || 'código'
    } else {
      cleanLang = parts[0].trim()
      detectedFilePath = parts.slice(1).join(':').trim()
    }
  } else if (cleanLang.includes('/') || cleanLang.includes('\\')) {
    detectedFilePath = cleanLang
    cleanLang = detectedFilePath.split('.').pop() || 'código'
  } else {
    // Check first line comment
    const firstLine = code.split('\n')[0] || ''
    const match = /^(?:\/\/|#|\/\*)\s*(?:file:\s*|filepath:\s*|path:\s*)?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)\b/.exec(firstLine)
    if (match) {
      detectedFilePath = match[1].trim()
    }
  }

  const copy=async()=>{
    try{
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(()=>setCopied(false),2000)
    }catch{/* ignore */}
  }

  const applyToProject = async () => {
    if (!detectedFilePath || applying) return
    setApplying(true)
    setApplyError('')
    try {
      const desktop = window.contalkDesktop
      if (!desktop?.workspaceWriteFile) {
        throw new Error('Ambiente desktop indisponível para gravar arquivos.')
      }
      const workspaceFolder = usePreferencesStore.getState().workspaceFolder || ''
      let targetPath = detectedFilePath
      const isAbs = /^[a-zA-Z]:[/\\]|^\/|^\\\\/.test(detectedFilePath)
      if (workspaceFolder && !isAbs) {
        targetPath = `${workspaceFolder.replace(/\\/g, '/').replace(/\/+$/, '')}/${detectedFilePath.replace(/^\/+/, '')}`
      }
      await desktop.workspaceWriteFile(targetPath, code)
      try {
        useDevCollaborationStore.getState().broadcastCode(targetPath, code)
      } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent('contalk-file-written', {
        detail: { path: targetPath, content: code }
      }))
      setApplied(true)
      setTimeout(() => setApplied(false), 3000)
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : 'Falha ao aplicar arquivo.')
      setTimeout(() => setApplyError(''), 4000)
    } finally {
      setApplying(false)
    }
  }

  const openInEditor = () => {
    if (!detectedFilePath) return
    const workspaceFolder = usePreferencesStore.getState().workspaceFolder || ''
    let targetPath = detectedFilePath
    const isAbs = /^[a-zA-Z]:[/\\]|^\/|^\\\\/.test(detectedFilePath)
    if (workspaceFolder && !isAbs) {
      targetPath = `${workspaceFolder.replace(/\\/g, '/').replace(/\/+$/, '')}/${detectedFilePath.replace(/^\/+/, '')}`
    }
    window.dispatchEvent(new CustomEvent('contalk-open-editor-file', {
      detail: { path: targetPath, content: code }
    }))
  }

  return <div className="ct-ai-code">
    <div className="ct-ai-code-header">
      <div className="ct-ai-code-header-info">
        <small>{cleanLang||"código"}</small>
        {detectedFilePath && (
          <span className="ct-ai-code-filepath" title={detectedFilePath}>
            <ControlIcon name="git-code" size={11} />
            <span>{detectedFilePath}</span>
          </span>
        )}
      </div>
      <div className="ct-ai-code-actions">
        {detectedFilePath && (
          <>
            <button
              type="button"
              className={`ct-ai-code-btn ct-ai-code-apply-btn ${applied ? 'is-applied' : ''}`}
              aria-label="Aplicar arquivo no projeto local"
              title="Salvar este arquivo diretamente no projeto local"
              disabled={applying}
              onClick={() => void applyToProject()}
            >
              <ControlIcon name={applied ? "check" : "download"} size={12}/>
              <span>{applied ? "Aplicado!" : applying ? "Salvando…" : "Aplicar no Projeto"}</span>
            </button>
            <button
              type="button"
              className="ct-ai-code-btn ct-ai-code-open-btn"
              aria-label="Abrir no editor colaborativo"
              title="Abrir no editor de código do ConTALK"
              onClick={openInEditor}
            >
              <ControlIcon name="git-code" size={12}/>
              <span>Abrir no Editor</span>
            </button>
          </>
        )}
        <button type="button" className="ct-ai-code-copy" aria-label="Copiar código" title="Copiar código" onClick={()=>void copy()}>
          <ControlIcon name={copied?"check":"copy"} size={12}/>
          <span>{copied?"Copiado":"Copiar"}</span>
        </button>
      </div>
    </div>
    {applyError && <div className="ct-ai-code-error" role="alert">{applyError}</div>}
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
  const workspaceFolder = usePreferencesStore(s => s.workspaceFolder)
  const updatePreferences = usePreferencesStore(s => s.update)
  const [agentMode, setAgentMode] = useState(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('contalk:chat-agent-mode')
        if (saved !== null) return saved === 'true'
      }
    } catch {}
    return true
  })
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
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ prompt: string }>).detail
      if (detail?.prompt) {
        setText(detail.prompt)
        setSendToAi(true)
      }
    }
    window.addEventListener('contalk-ai-prompt', handler)
    return () => window.removeEventListener('contalk-ai-prompt', handler)
  }, [])
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
  return <div className="ct-chat-compose">{localFile&&<div className="ct-pending-attachment">{preview&&localFile.thumbnail&&<ImagePreview src={'data:image/jpeg;base64,'+localFile.thumbnail} name={localFile.name}/>}<strong>{localFile.name}</strong><small>{(localFile.size/1024/1024).toFixed(2)} MB</small><button onClick={()=>setLocalFile(undefined)}>Remover anexo</button></div>}{ai&&<div className={`ct-composer-ai-wrapper ${sendToAi ? 'is-active' : ''}`}><div className="ct-ai-toggle-bar"><label className="ct-ai-toggle"><input type="checkbox" aria-label="Enviar à IA" checked={sendToAi} onChange={event=>{const checked=event.target.checked;setSendToAi(checked);try{if(typeof localStorage!=='undefined'){localStorage.setItem('contalk:chat-send-to-ai',String(checked))}}catch{}setAttachment(undefined);setLocalFile(undefined);setExpression(null);setAiFiles([]);setOnce(false);setTts(false)}}/><span className="ct-ai-toggle-brand"><ControlIcon name="ai" size={13}/> Assistente de IA</span></label>{sendToAi&&<span className="ct-ai-toggle-active-tag">Modo IA Ativo</span>}{sendToAi&&<button type="button" className="ct-ai-deactivate-btn" title="Desativar modo IA e voltar ao chat normal" aria-label="Desativar IA no chat" onClick={()=>{setSendToAi(false);try{if(typeof localStorage!=='undefined'){localStorage.setItem('contalk:chat-send-to-ai','false')}}catch{}}}><ControlIcon name="close" size={11}/><span>Desativar IA</span></button>}</div>{sendToAi&&<div className="ct-ai-expanded-controls"><AiModelSelector endpoints={ai.endpoints} provider={selectedProvider} model={selectedModel} onChange={(provider,model)=>{setSelectedProvider(provider);setSelectedModel(model);try{if(typeof localStorage!=='undefined'){localStorage.setItem('contalk:preferred-ai-provider',provider);if(model){localStorage.setItem('contalk:preferred-ai-model',model);localStorage.setItem(`contalk:preferred-ai-model:${provider}`,model)}}}catch{}}}/><div className="ct-ai-economy-picker"><label htmlFor="ct-composer-economy">Economia:</label><select id="ct-composer-economy" aria-label="Economia de Tokens" className="ct-ai-picker-select" value={getEconomyMode(aiLimits.contextTokens, aiLimits.maxOutputTokens)} onChange={e=>{const mode=e.target.value as TokenEconomyMode;const cfg=TOKEN_ECONOMY_CONFIG[mode];setAiLimits({contextTokens:cfg.contextTokens,maxOutputTokens:cfg.maxOutputTokens})}}><option value="standard">Padrão (Sem economia)</option><option value="moderate">Moderada (Recomendado)</option><option value="aggressive">Bruta (Máx economia)</option></select></div></div>}{sendToAi&&<div className="ct-ai-workspace-bar"><div className="ct-ai-workspace-info"><ControlIcon name="folder" size={13}/>{workspaceFolder?<span className="ct-ai-workspace-name" title={workspaceFolder}><strong>Projeto:</strong> {workspaceFolder.split(/[/\\]/).filter(Boolean).pop()||workspaceFolder}</span>:<span className="ct-ai-workspace-empty">Nenhuma pasta vinculada</span>}</div><div className="ct-ai-workspace-actions"><label className="ct-ai-workspace-toggle" title="Permitir que a IA veja a estrutura do projeto e sugira criações, edições e comandos executáveis"><input type="checkbox" checked={agentMode} onChange={e=>{const next=e.target.checked;setAgentMode(next);try{if(typeof localStorage!=='undefined')localStorage.setItem('contalk:chat-agent-mode',String(next))}catch{}}}/><span>Modo Agente no Projeto</span></label><button type="button" className={`ct-ai-workspace-btn ${!workspaceFolder?'is-highlight':''}`} title={workspaceFolder?'Trocar pasta vinculada':'Selecionar pasta do computador'} onClick={async()=>{try{const folder=await window.contalkDesktop?.openFolder?.();if(folder)updatePreferences({workspaceFolder:folder})}catch{}}}><ControlIcon name="folder" size={11}/><span>{workspaceFolder?'Trocar Pasta':'Vincular Pasta'}</span></button>{workspaceFolder&&<button type="button" className="ct-ai-workspace-btn is-disconnect" title="Desvincular pasta do chat" onClick={()=>updatePreferences({workspaceFolder:''})}><ControlIcon name="close" size={11}/><span>Desvincular</span></button>}</div></div>}{sendToAi&&<div className="ct-ai-apps-quick-bar"><span className="ct-ai-apps-label"><ControlIcon name="ai" size={11}/> Apps Conectados:</span><button type="button" className="ct-ai-app-chip" title="Pedir resumo dos e-mails recentes do Gmail" onClick={()=>setText('Por favor, consulte meus e-mails recentes no Gmail e faça um resumo dos pontos mais importantes e pendências.')}><ControlIcon name="mail" size={11}/><span>Resumo Gmail</span></button><button type="button" className="ct-ai-app-chip" title="Listar canais do YouTube que você segue" onClick={()=>setText('Por favor, liste os canais que sigo no YouTube e faça um resumo dos principais temas e novidades.')}><ControlIcon name="play" size={11}/><span>Canais YouTube</span></button><button type="button" className="ct-ai-app-chip" title="Ver agenda e próximos compromissos" onClick={()=>setText('Por favor, consulte meus próximos compromissos na Google Agenda e organize meu dia.')}><ControlIcon name="event" size={11}/><span>Google Agenda</span></button><button type="button" className="ct-ai-app-chip" title="Buscar arquivos recentes no Google Drive" onClick={()=>setText('Por favor, liste meus arquivos recentes no Google Drive e mostre as últimas modificações.')}><ControlIcon name="file" size={11}/><span>Google Drive</span></button><button type="button" className="ct-ai-app-chip" title="Pedir para a IA acessar e automatizar tarefas no navegador interno" onClick={()=>setText('Por favor, acesse a página [URL] no navegador interno e execute [ação].')}><ControlIcon name="globe" size={11}/><span>Navegador Web</span></button><button type="button" className="ct-ai-app-chip is-browser-open" title="Abrir janela do navegador interno" onClick={()=>window.dispatchEvent(new CustomEvent('contalk-open-browser'))}><ControlIcon name="expand" size={11}/><span>Abrir Navegador</span></button></div>}</div>}{!!aiFiles.length&&<div className="ct-pending-attachment">{aiFiles.map(file=><span key={file.id}>{file.name} · {(file.size/1024/1024).toFixed(2)} MB </span>)}<button type="button" onClick={()=>setAiFiles([])}>Remover</button></div>}{!sendToAi&&<div className="ct-send-options"><label><input type="checkbox" checked={preview&&canPreview} disabled={!canPreview} onChange={e=>setPreview(e.target.checked)}/> Gerar prévia</label><label><input type="checkbox" checked={once} onChange={e=>setOnce(e.target.checked)}/> Visualização única por pessoa</label><label><input type="checkbox" aria-label="Enviar com leitura em voz" checked={tts} disabled={!canTts&&!tts} onChange={event=>setTts(event.target.checked)}/> Leitura em voz</label><select aria-label="Mencionar pessoa" className="ct-mention-select" value="" onChange={e=>{const value=e.target.value;setText(text+(value.startsWith('role:')?' <@&'+value.slice(5)+'> ':value.startsWith('all:')?' @'+value.slice(4)+' ':' @'+value+' '))}}><option value="">@ Mencionar</option>{members.map(m=><option key={m.username} value={m.username}>{m.display_name}</option>)}{mentionRoles.length>0&&<optgroup label="Cargos">{mentionRoles.map(role=><option key={role.id} value={'role:'+role.id}>{role.name}</option>)}</optgroup>}{channelId&&snapshot&&centralAllows('MENTION_EVERYONE',channelId)&&<optgroup label="Todos"><option value="all:everyone">@everyone</option><option value="all:here">@here</option></optgroup>}</select></div>}{expression&&<div className="ct-pending-expression"><img src={'data:image/jpeg;base64,'+expression.attachment.thumbnail} alt=""/><span>{expression.name}</span><button disabled={busy} onClick={()=>setExpression(null)}>Remover expressão</button></div>}{attachment&&<div className="ct-pending-attachment"><AttachmentPreview attachment={attachment}/><button type="button" disabled={busy} onClick={()=>setAttachment(undefined)}>Remover anexo</button></div>}<form className="ct-composer" onSubmit={async e=>{e.preventDefault();if(busy||disabled||cooling||(!text.trim()&&!attachment&&!localFile&&!expression))return;if(expression&&(once||tts||attachment||localFile)){setError('Envie a expressão sem anexo, leitura em voz ou visualização única.');return}if(tts&&(once||attachment||localFile)){setError('Leitura em voz exige texto sem anexo ou visualização única.');return}setBusy(true);setError('');try{if(sendToAi&&ai){if(!validAiModel(aiModelId(selectedProvider,selectedModel)))throw new Error('Selecione um modelo de IA válido.');let promptText=text;try{const appsConfig=useAppsStore.getState();if(appsConfig?.google?.connected){const g=appsConfig.google;const svcs:string[]=[];if(g.enabledServices.gmail){svcs.push('- gmail_list_messages(query, maxResults): Lista os e-mails mais recentes da caixa de entrada do Gmail.\n- gmail_get_message(messageId): Lê o conteúdo de um e-mail específico.')}if(g.enabledServices.youtube){svcs.push('- youtube_list_subscriptions(maxResults): Lista os canais que o usuário segue no YouTube.\n- youtube_search_videos(query, maxResults): Pesquisa vídeos recomendados ou sobre um assunto no YouTube.')}if(g.enabledServices.calendar){svcs.push('- calendar_list_events(maxResults): Lista os próximos compromissos e reuniões da Google Agenda.')}if(g.enabledServices.drive){svcs.push('- drive_list_files(query, maxResults): Pesquisa ou lista arquivos recentes do Google Drive.')}if(svcs.length>0){const googleHeader=`[APLICATIVOS CONECTADOS - Google Workspace (${g.email||'Conectado'})]:\nO usuário autorizou o acesso às seguintes ferramentas de seus apps:\n${svcs.join('\n')}\nSe o pedido do usuário solicitar e-mails, vídeos/canais do youtube, compromissos da agenda ou arquivos, você DEVE acionar a ferramenta correspondente usando uma tag de ação:\n<agent_action tool="mcp_call" server="google" tool_name="gmail_list_messages">{"maxResults": 5}</agent_action>\nou <agent_action tool="mcp_call" server="google" tool_name="youtube_list_subscriptions">{"maxResults": 10}</agent_action>\nou <agent_action tool="mcp_call" server="google" tool_name="calendar_list_events">{"maxResults": 5}</agent_action>\nou <agent_action tool="mcp_call" server="google" tool_name="drive_list_files">{"maxResults": 5}</agent_action>\n\n`;promptText=googleHeader+promptText}}}catch{/* proceed */}const browserHeader=`[NAVEGADOR WEB INTERNO CONECTADO]:\nVocê tem acesso ao navegador web interno do ConTALK para navegação e automação de páginas:\n- browser_open(url, show): Abre uma página no navegador interno.\n- browser_navigate(url): Navega para uma nova URL.\n- browser_click(selector): Clica em um botão, link, menu ou campo na página ativa (por seletor CSS ou texto visível).\n- browser_type(selector, text, submit): Digita texto em um campo de entrada ou busca e opcionalmente submete o formulário.\n- browser_read_content(selector): Lê o texto, links e campos da página atual.\n- browser_screenshot(): Captura uma imagem da tela atual.\n- browser_scroll(direction, amount): Rola a página para cima ou para baixo.\nSe o usuário pedir para acessar um site, pesquisar algo na web, clicar em botões ou interagir com páginas, você DEVE acionar a ferramenta correspondente usando uma tag de ação:\n<agent_action tool="mcp_call" server="browser" tool_name="browser_open">{"url": "https://..."}</agent_action>\nou <agent_action tool="mcp_call" server="browser" tool_name="browser_click">{"selector": "button.submit"}</agent_action>\nou <agent_action tool="mcp_call" server="browser" tool_name="browser_type">{"selector": "input[name=q]", "text": "busca", "submit": true}</agent_action>\n\n`;promptText=browserHeader+promptText;if(workspaceFolder&&agentMode){try{const desktop=window.contalkDesktop;let fileListing='';if(desktop?.workspaceListFiles){const entries=await desktop.workspaceListFiles(workspaceFolder);const summary=entries.slice(0,40).map(e=>`${e.isDirectory?'[DIR] ':'      '}${e.name}`).join('\n');if(summary)fileListing=`\nArquivos detectados na raiz do projeto:\n${summary}`}const projectHeader=`[CONTEXTO DO PROJETO LOCAL]:\nPasta raiz do projeto: "${workspaceFolder}"${fileListing}\n\n[DIRETRIZES DO AGENTE CONTALK]:\n- Você tem permissão de leitura, escrita e execução neste projeto local do usuário e time colaborativo.\n- Para criar ou alterar arquivos, identifique o caminho relativo exato no cabeçalho do bloco de código (ex: \`\`\`tsx:src/caminho/arquivo.ext) ou utilize <agent_action tool="write_file" path="src/caminho/arquivo.ext">conteúdo</agent_action>.\n- Para comandos de terminal, utilize \`\`\`bash:run ou <agent_action tool="run_command">comando</agent_action>.\n- O usuário e time podem aplicar suas alterações com 1 clique diretamente no projeto.\n\n`;promptText=projectHeader+text}catch{/* proceed with raw text */}}await ai.onPrompt(promptText,aiFiles.map(file=>file.id),aiLimits,selectedProvider,selectedModel);setText('');setAiFiles([]);return}let uploaded=attachment
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
  const actions = own ? (
    <span className="ct-message-actions">
      {!m.poll && !m.voice && (
        <button
          disabled={busy || !editAllowed}
          title="Editar mensagem"
          aria-label="Editar mensagem"
          onClick={() => {
            setDraft(m.content)
            setEditing(true)
          }}
        >
          <ControlIcon name="edit" size={12} />
          <span>Editar</span>
        </button>
      )}
      <button
        disabled={busy || !deleteAllowed}
        title="Apagar mensagem"
        aria-label="Apagar mensagem"
        onClick={() => void change()}
      >
        <ControlIcon name="delete" size={12} />
        <span>Apagar</span>
      </button>
    </span>
  ) : null

  return (
    <div>
      {m.once && !own ? (
        <>
          {viewed && !opened ? (
            <p>Mensagem já visualizada</p>
          ) : (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  if (!window.contalkDesktop) throw new Error('Abra no ConTALK desktop.')
                  const allowed = await window.contalkDesktop.claimMessageView(m.id)
                  localStorage.setItem(storageKey, 'true')
                  setViewed(true)
                  if (allowed) setOpened(true)
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Não foi possível registrar a visualização.')
                } finally {
                  setBusy(false)
                }
              }}
            >
              Abrir uma vez
            </button>
          )}
          {opened && (
            <div role="dialog" aria-modal="true" className="ct-modal-backdrop">
              <section className="ct-edit-dialog">
                {body}
                <button onClick={() => setOpened(false)}>Fechar visualização</button>
              </section>
            </div>
          )}
        </>
      ) : editing ? (
        <form onSubmit={e => { e.preventDefault(); void change(draft) }}>
          <textarea maxLength={2000} value={draft} onChange={e => setDraft(e.target.value)} />
          <button disabled={busy}>Salvar</button>
          <button type="button" onClick={() => setEditing(false)}>Cancelar</button>
        </form>
      ) : (
        body
      )}
      {m.editedAt && <small>Editada</small>}
      {!m.ai && !editing && <MessageTools message={m} onOpenChannel={onOpenChannel} actions={actions} />}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
