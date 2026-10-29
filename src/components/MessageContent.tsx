import { ExpressionPanel } from './ExpressionPanel'
import type { CommunityExpression } from '../roles/expressions'
import { VoiceMessagePlayer } from './VoiceMessagePlayer'
import { VoiceMessageRecorder } from './VoiceMessageRecorder'
import { canMutateThread } from '../roles/threads'
import { PollEditor } from './PollEditor'
import { PollCard } from './PollCard'
import { ControlIcon } from './ControlIcon'
import { LinkPreview } from './LinkPreview'
import { MessageTools } from './MessageTools'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useCommunityStore } from '../store/useCommunityStore'
import type { Message, MessageOptions, Attachment } from '../store/useAppStore'
import { useRoleStore } from '../store/useRoleStore'
import { canMentionRole } from '../roles/permissions'
import { centralAllows } from '../roles/transport'

const fileUrlCache = new Map<string, string>()

function ImagePreview({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  if (failed) return <span>Prévia indisponível</span>
  return (
    <>
      <img
        className="ct-chat-image"
        src={src}
        alt={name}
        loading="lazy"
        referrerPolicy="no-referrer"
        title="Clique para ampliar"
        onClick={() => setZoomed(true)}
        onError={() => setFailed(true)}
      />
      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          className="ct-modal-backdrop"
          onClick={() => setZoomed(false)}
          style={{
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)',
            cursor: 'zoom-out'
          }}
        >
          <img
            src={src}
            alt={name}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.8)'
            }}
          />
        </div>
      )}
    </>
  )
}

function StorageAttachmentPreview({ a }: { a: Attachment; preview: boolean }) {
  const [effectiveSrc, setEffectiveSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const placeholder = a.thumbnail ? `data:image/jpeg;base64,${a.thumbnail}` : null

  useEffect(() => {
    let cancelled = false
    if (!a.storageId) return
    const cached = fileUrlCache.get(a.storageId)
    if (cached) {
      setEffectiveSrc(cached)
      return
    }
    if (window.contalkDesktop?.getStorageFileUrl) {
      window.contalkDesktop.getStorageFileUrl(a.storageId).then(directUrl => {
        if (!cancelled && directUrl) {
          fileUrlCache.set(a.storageId!, directUrl)
          setEffectiveSrc(directUrl)
        }
      }).catch(() => {})
    }
    return () => { cancelled = true }
  }, [a.storageId])

  const displaySrc = effectiveSrc || placeholder

  if (a.type.startsWith('image/')) {
    return (
      <div className="ct-attachment ct-attachment-image">
        {displaySrc && !failed ? (
          <img
            className="ct-chat-image"
            src={displaySrc}
            alt={a.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            title="Clique para ampliar"
            onClick={() => setZoomed(true)}
            onError={() => {
              if (effectiveSrc) {
                setEffectiveSrc(null)
              } else {
                setFailed(true)
              }
            }}
          />
        ) : (
          <span className="ct-chat-image-fallback">
            <ControlIcon name="file" size={24} />
          </span>
        )}
        <div className="ct-attachment-info">
          <div className="ct-attachment-text">
            <strong>{a.name}</strong>
            <small>{(a.size / 1024 / 1024).toFixed(2)} MB</small>
          </div>
          <button
            type="button"
            className="ct-download-btn"
            title="Baixar imagem original"
            aria-label={`Baixar imagem ${a.name}`}
            onClick={() => {
              void window.contalkDesktop?.openStorageFile(a.storageId!).catch(() => {})
            }}
          >
            <ControlIcon name="download" size={13} /> Baixar
          </button>
        </div>
        {zoomed && (
          <div
            role="dialog"
            aria-modal="true"
            className="ct-modal-backdrop"
            onClick={() => setZoomed(false)}
            style={{
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.85)',
              cursor: 'zoom-out'
            }}
          >
            <img
              src={displaySrc || ''}
              alt={a.name}
              style={{
                maxWidth: '90vw',
                maxHeight: '90vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.8)'
              }}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="ct-attachment">
      <div className="ct-attachment-info">
        <div className="ct-attachment-text">
          <strong>{a.name}</strong>
          <small>{(a.size / 1024 / 1024).toFixed(2)} MB · {a.type || 'Arquivo'}</small>
        </div>
        <button
          type="button"
          className="ct-download-btn"
          onClick={() => {
            void window.contalkDesktop?.openStorageFile(a.storageId!).catch(() => {})
          }}
        >
          <ControlIcon name="download" size={13} /> Baixar
        </button>
      </div>
    </div>
  )
}

function AttachmentPreview({ attachment: a, preview }: { attachment: Attachment; preview?: boolean }) {
  const [downloadError] = useState('')
  if (a.storageId) {
    return <StorageAttachmentPreview a={a} preview={!!preview} />
  }
  const text = /^(text\/(plain|csv)|application\/json)$/.test(a.type)
  let snippet = ''
  if (text) {
    try {
      snippet = new TextDecoder().decode(
        Uint8Array.from(atob(a.data.split(',')[1]), c => c.charCodeAt(0))
      ).slice(0, 600)
    } catch {
      /* No preview. */
    }
  }
  return (
    <div className="ct-attachment">
      <a href={a.data} download={a.name} className="ct-download-link">
        <ControlIcon name="download" size={13} />
        <strong>{a.name}</strong>
        <small>{Math.max(1, Math.ceil(a.size / 1024))} KB · {a.type || 'Arquivo'}</small>
      </a>
      {preview && snippet && <pre>{snippet}</pre>}
      {downloadError && <p role="alert">{downloadError}</p>}
    </div>
  )
}

export function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }
  return (
    <div
      className="ct-code-block"
      style={{
        margin: '6px 0',
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '6px',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 10px',
          background: 'rgba(255,255,255,0.04)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          fontSize: '11px',
          color: '#94a3b8'
        }}
      >
        <span>{language || 'código'}</span>
        <button
          type="button"
          aria-label="Copiar código"
          title="Copiar código"
          onClick={() => void copy()}
          style={{
            background: 'none',
            border: 'none',
            color: copied ? '#4ade80' : 'inherit',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px'
          }}
        >
          <ControlIcon name={copied ? 'check' : 'copy'} size={12} />
          <span>{copied ? 'Copiado!' : 'Copiar'}</span>
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '10px',
          overflowX: 'auto',
          fontSize: '13px',
          lineHeight: '1.45',
          fontFamily: 'monospace'
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function MessageContent({
  content,
  attachment,
  preview = true,
  roleMentions = [],
  mentionsEveryone
}: {
  content: string
  attachment?: Attachment
  preview?: boolean
  roleMentions?: string[]
  mentionsEveryone?: 'all' | 'online'
}) {
  const members = useCommunityStore(s => s.members)
  const snapshot = useRoleStore(s => s.snapshot)
  const roles = snapshot?.policy.roles || []

  const renderText = (text: string) =>
    text.split(/(<@&[\w:-]{1,100}>|@everyone\b|@here\b|@[\w.-]+)/g).map((part, index) => {
      const match = /^<@&([\w:-]{1,100})>$/.exec(part)
      const role = match ? roles.find(r => r.id === match[1]) : undefined
      if (role && roleMentions.includes(role.id)) {
        return (
          <mark className="ct-mention" key={index} aria-label={`Menção ao cargo ${role.name}`}>
            @{role.name}
          </mark>
        )
      }
      return part.startsWith('@') &&
        (members.some(m => m.username === part.slice(1)) ||
          (mentionsEveryone && ['@everyone', '@here'].includes(part))) ? (
        <mark className="ct-mention" key={index}>
          {part}
        </mark>
      ) : (
        part
      )
    })

  // Parse code blocks
  const codeBlockRegex = /```([a-zA-Z0-9_\-#+.]*)\n([\s\S]*?)```/g
  const contentParts: Array<{ type: 'text' | 'code'; text?: string; language?: string; code?: string }> = []
  let lastIdx = 0
  let codeMatch: RegExpExecArray | null

  while ((codeMatch = codeBlockRegex.exec(content)) !== null) {
    if (codeMatch.index > lastIdx) {
      contentParts.push({ type: 'text', text: content.slice(lastIdx, codeMatch.index) })
    }
    contentParts.push({ type: 'code', language: codeMatch[1], code: codeMatch[2] })
    lastIdx = codeMatch.index + codeMatch[0].length
  }
  if (lastIdx < content.length) {
    contentParts.push({ type: 'text', text: content.slice(lastIdx) })
  }

  const renderTextBlock = (textBlock: string, blockKey: number | string) => {
    const imageRegex = /!\[([^\]]*)\]\(((?:https?:\/\/|data:image\/)[^\s)]+)\)/g
    const imgParts: Array<{ type: 'text' | 'image'; text?: string; alt?: string; src?: string }> = []
    let imgLast = 0
    let imgMatch: RegExpExecArray | null

    while ((imgMatch = imageRegex.exec(textBlock)) !== null) {
      if (imgMatch.index > imgLast) {
        imgParts.push({ type: 'text', text: textBlock.slice(imgLast, imgMatch.index) })
      }
      imgParts.push({ type: 'image', alt: imgMatch[1], src: imgMatch[2] })
      imgLast = imgMatch.index + imgMatch[0].length
    }
    if (imgLast < textBlock.length) {
      imgParts.push({ type: 'text', text: textBlock.slice(imgLast) })
    }

    return (
      <span key={blockKey} className="ct-message-block">
        {imgParts.map((part, pIdx) => {
          if (part.type === 'image' && part.src) {
            return <ImagePreview key={pIdx} src={part.src} name={part.alt || 'Imagem'} />
          }
          const links = [...new Set((part.text || '').split(/(https?:\/\/[^\s<>]+)/g).filter(p => /^https?:\/\//.test(p)))].slice(0, 4)
          const textSegments = (part.text || '').split(/(https?:\/\/[^\s<>]+)/g)
          return (
            <span key={pIdx}>
              {textSegments.some(p => p.trim()) && (
                <p>
                  {textSegments.map((p, i) =>
                    /^https?:\/\//.test(p) ? (
                      <a key={i} href={p} target="_blank" rel="noopener noreferrer">
                        {p}
                      </a>
                    ) : (
                      renderText(p)
                    )
                  )}
                </p>
              )}
              {preview && links.map(link => <LinkPreview key={link} url={link} />)}
            </span>
          )
        })}
      </span>
    )
  }

  return (
    <div className="ct-message-content">
      {contentParts.map((item, idx) => {
        if (item.type === 'code' && item.code !== undefined) {
          return <CodeBlock key={idx} language={item.language || ''} code={item.code} />
        }
        return renderTextBlock(item.text || '', idx)
      })}
      {attachment && <AttachmentPreview attachment={attachment} preview={preview} />}
    </div>
  )
}

const storageMessage = 'Sua conta ainda não está conectada ao servidor. Saia e entre novamente com a internet ligada.'

export function ChatComposer({
  onSend,
  placeholder,
  disabled = false,
  channelId
}: {
  onSend: (text: string, attachment?: Attachment, options?: MessageOptions) => Promise<void>
  placeholder: string
  disabled?: boolean
  channelId?: string
  ai?: any
}) {
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState<Attachment>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [localFile, setLocalFile] = useState<{ id: string; name: string; size: number; type: string; thumbnail?: string }>()
  const [expressionPanel, setExpressionPanel] = useState(false)
  const [expression, setExpression] = useState<CommunityExpression | null>(null)
  const [voiceRecorder, setVoiceRecorder] = useState(false)
  const [pollEditor, setPollEditor] = useState(false)
  const [preview, setPreview] = useState(true)
  const [once, setOnce] = useState(false)
  const [tts, setTts] = useState(false)

  const members = useCommunityStore(s => s.members)
  const snapshot = useRoleStore(s => s.snapshot)
  const self = useAuthStore(s => s.user?.username)
  const mentionRoles = snapshot && self && channelId
    ? snapshot.policy.roles.filter(role => role.id !== snapshot.policy.serverId && canMentionRole(snapshot.policy, self, role, channelId))
    : []
  const sendAfter = channelId ? snapshot?.sendAfter?.[channelId] || 0 : 0
  const [now, setNow] = useState(snapshot?.serverNow ?? Date.now())

  useEffect(() => {
    const started = performance.now()
    const base = snapshot?.serverNow ?? Date.now()
    setNow(base)
    if (sendAfter <= base) return
    const timer = setInterval(() => {
      const value = base + performance.now() - started
      setNow(value)
      if (value >= sendAfter) clearInterval(timer)
    }, 250)
    return () => clearInterval(timer)
  }, [sendAfter, snapshot?.serverNow])

  const cooling = sendAfter > now
  const canPoll = !!snapshot && !!channelId && snapshot.channels.some(channel => channel.id === channelId && channel.type === 'text') && centralAllows('SEND_POLLS', channelId) && centralAllows('SEND_MESSAGES', channelId)
  const canVoice = !!snapshot && !!channelId && centralAllows('SEND_VOICE_MESSAGES', channelId) && centralAllows('SEND_MESSAGES', channelId)
  const canTts = !!snapshot && !!channelId && centralAllows('SEND_TTS_MESSAGES', channelId) && centralAllows('SEND_MESSAGES', channelId)
  const canAttach = !channelId || centralAllows('ATTACH_FILES', channelId)
  const canPreview = !channelId || centralAllows('EMBED_LINKS', channelId)

  const choose = async (file?: File) => {
    if (disabled || !canAttach) {
      setError('Seu cargo não permite anexar arquivos neste canal.')
      return
    }
    if (!file) return
    if (file.size > 1048576) {
      setError('Escolha um arquivo de até 1 MB.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = reject
        reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, 'data:application/octet-stream;base64,'))
        reader.readAsDataURL(file)
      })
      setAttachment({ name: file.name.slice(0, 200), type: file.type.slice(0, 100), size: file.size, data })
    } catch {
      setError('Não foi possível ler o arquivo.')
    } finally {
      setBusy(false)
    }
  }

  const pick = async () => {
    setError('')
    try {
      const desktop = window.contalkDesktop
      if (!desktop) throw new Error('Use o aplicativo desktop para anexar arquivos.')
      if (!(await desktop.storageStatus())) throw new Error(storageMessage)
      const file = await desktop.selectStorageFile()
      if (file) {
        setLocalFile(file)
        setAttachment(undefined)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao selecionar.')
    }
  }

  return (
    <div className="ct-chat-compose">
      {localFile && (
        <div className="ct-pending-attachment">
          {preview && localFile.thumbnail && <ImagePreview src={'data:image/jpeg;base64,' + localFile.thumbnail} name={localFile.name} />}
          <strong>{localFile.name}</strong>
          <small>{(localFile.size / 1024 / 1024).toFixed(2)} MB</small>
          <button onClick={() => setLocalFile(undefined)}>Remover anexo</button>
        </div>
      )}

      <div className="ct-send-options">
        <label>
          <input type="checkbox" checked={preview && canPreview} disabled={!canPreview} onChange={e => setPreview(e.target.checked)} /> Gerar prévia
        </label>
        <label>
          <input type="checkbox" checked={once} onChange={e => setOnce(e.target.checked)} /> Visualização única por pessoa
        </label>
        <label>
          <input type="checkbox" aria-label="Enviar com leitura em voz" checked={tts} disabled={!canTts && !tts} onChange={event => setTts(event.target.checked)} /> Leitura em voz
        </label>
        <select
          aria-label="Mencionar pessoa"
          className="ct-mention-select"
          value=""
          onChange={e => {
            const val = e.target.value
            setText(text + (val.startsWith('role:') ? ' <@&' + val.slice(5) + '> ' : val.startsWith('all:') ? ' @' + val.slice(4) + ' ' : ' @' + val + ' '))
          }}
        >
          <option value="">@ Mencionar</option>
          {members.map(m => (
            <option key={m.username} value={m.username}>
              {m.display_name}
            </option>
          ))}
          {mentionRoles.length > 0 && (
            <optgroup label="Cargos">
              {mentionRoles.map(role => (
                <option key={role.id} value={'role:' + role.id}>
                  {role.name}
                </option>
              ))}
            </optgroup>
          )}
          {channelId && snapshot && centralAllows('MENTION_EVERYONE', channelId) && (
            <optgroup label="Todos">
              <option value="all:everyone">@everyone</option>
              <option value="all:here">@here</option>
            </optgroup>
          )}
        </select>
      </div>

      {expression && (
        <div className="ct-pending-expression">
          <img src={'data:image/jpeg;base64,' + expression.attachment.thumbnail} alt="" />
          <span>{expression.name}</span>
          <button disabled={busy} onClick={() => setExpression(null)}>
            Remover expressão
          </button>
        </div>
      )}

      {attachment && (
        <div className="ct-pending-attachment">
          <AttachmentPreview attachment={attachment} />
          <button type="button" disabled={busy} onClick={() => setAttachment(undefined)}>
            Remover anexo
          </button>
        </div>
      )}

      <form
        className="ct-composer"
        onSubmit={async e => {
          e.preventDefault()
          if (busy || disabled || cooling || (!text.trim() && !attachment && !localFile && !expression)) return
          if (expression && (once || tts || attachment || localFile)) {
            setError('Envie a expressão sem anexo, leitura em voz ou visualização única.')
            return
          }
          if (tts && (once || attachment || localFile)) {
            setError('Leitura em voz exige texto sem anexo ou visualização única.')
            return
          }
          setBusy(true)
          setError('')
          try {
            let uploaded = attachment
            if (localFile) {
              uploaded = await window.contalkDesktop!.uploadStorageFile(localFile.id)
            } else if (attachment && !attachment.storageId) {
              if (!window.contalkDesktop) throw new Error('Use o aplicativo desktop para enviar anexos.')
              if (!(await window.contalkDesktop.storageStatus())) throw new Error(storageMessage)
              uploaded = await window.contalkDesktop.uploadInlineAttachment(attachment)
            }
            if (uploaded) {
              setAttachment(uploaded)
              setLocalFile(undefined)
            }
            await onSend(text, uploaded, {
              preview,
              once,
              tts,
              expression: expression ? { serverId: expression.serverId, id: expression.id } : undefined
            })
            setText('')
            setAttachment(undefined)
            setExpression(null)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Falha ao enviar.')
          } finally {
            setBusy(false)
          }
        }}
      >
        {snapshot && channelId && (
          <button
            type="button"
            className="ct-attach-button"
            aria-label="Emojis e figurinhas"
            title="Emojis e figurinhas"
            disabled={busy}
            onClick={() => setExpressionPanel(true)}
          >
            <ControlIcon name="react" />
          </button>
        )}
        {canVoice && (
          <button
            type="button"
            className="ct-attach-button"
            aria-label="Gravar mensagem de voz"
            title="Gravar mensagem de voz"
            disabled={busy || disabled || cooling}
            onClick={() => setVoiceRecorder(true)}
          >
            <ControlIcon name="mic" />
          </button>
        )}
        {canPoll && (
          <button
            type="button"
            className="ct-attach-button"
            aria-label="Criar enquete"
            title="Criar enquete"
            disabled={busy || disabled}
            onClick={() => setPollEditor(true)}
          >
            <ControlIcon name="poll" />
          </button>
        )}
        <button
          type="button"
          className="ct-attach-button"
          aria-label="Anexar imagem ou arquivo (até 2 GB)"
          disabled={busy || disabled || !canAttach}
          onClick={() => void pick()}
        >
          <ControlIcon name="plus" size={18} />
        </button>
        <input
          list="ct-mention-users"
          aria-label="Mensagem"
          maxLength={2000}
          placeholder={placeholder}
          value={text}
          disabled={busy || disabled}
          onChange={e => setText(e.target.value)}
          onPaste={e => {
            const file = e.clipboardData.files[0]
            if (file) {
              e.preventDefault()
              void choose(file)
            }
          }}
        />
        <button
          className="ct-primary ct-composer-send-btn"
          disabled={busy || disabled || cooling || (!text.trim() && !attachment && !localFile && !expression)}
        >
          <ControlIcon name="send" size={13} />
          <span>{busy ? 'Enviando…' : 'Enviar'}</span>
        </button>
      </form>

      <div className="ct-composer-hint" role={error ? 'alert' : undefined}>
        {error || (cooling ? 'Modo lento: aguarde ' + Math.ceil((sendAfter - now) / 1000) + ' s para enviar.' : 'Anexe arquivos de até 2 GB. Imagens coladas: até 1 MB.')}
      </div>

      {expressionPanel && channelId && (
        <ExpressionPanel channelId={channelId} onSelect={setExpression} onClose={() => setExpressionPanel(false)} />
      )}
      {voiceRecorder && channelId && (
        <VoiceMessageRecorder key={channelId} channelId={channelId} onSend={onSend} onClose={() => setVoiceRecorder(false)} />
      )}
      {pollEditor && channelId && (
        <PollEditor channelId={channelId} onClose={() => setPollEditor(false)} onSend={poll => onSend(poll.question, undefined, { poll })} />
      )}
    </div>
  )
}

export function ChatMessage({
  message: m,
  onOpenChannel
}: {
  message: Message
  onOpenChannel?: (id: string) => void
  aiPartial?: string
  onAiRetry?: () => Promise<void>
  onAiCancel?: () => Promise<void>
}) {
  const username = useAuthStore(s => s.user?.username) || ''
  const own = m.userId === username
  const roles = useRoleStore()
  const editAllowed = !roles.snapshot || canMutateThread(roles.snapshot.policy, username, m.channelId, 'edit', roles.snapshot.serverNow)
  const deleteAllowed = !roles.snapshot || canMutateThread(roles.snapshot.policy, username, m.channelId, 'delete', roles.snapshot.serverNow)
  const storageKey = 'contalk-viewed:' + username + ':' + m.id
  const [viewed, setViewed] = useState(() => localStorage.getItem(storageKey) === 'true')
  const [opened, setOpened] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(m.content)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const change = async (content?: string) => {
    setBusy(true)
    setError('')
    try {
      await useCommunityStore.getState().changeMessage(m.channelId, m.id, content)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao alterar.')
    } finally {
      setBusy(false)
    }
  }

  const body = m.expression ? (
    <>
      <MessageContent content={m.content} roleMentions={m.roleMentions} mentionsEveryone={m.mentionsEveryone} preview={m.preview !== false} />
      <figure className={'ct-message-expression ' + m.expression.kind}>
        {m.attachment?.thumbnail ? (
          <img src={'data:image/jpeg;base64,' + m.attachment.thumbnail} alt={m.expression.name} />
        ) : (
          <span>:{m.expression.name}:</span>
        )}
        <figcaption>{m.expression.name}</figcaption>
      </figure>
    </>
  ) : m.voice ? (
    <VoiceMessagePlayer message={m} />
  ) : m.poll ? (
    <PollCard message={m} />
  ) : (
    <MessageContent content={m.content} attachment={m.attachment} preview={m.preview !== false} roleMentions={m.roleMentions} mentionsEveryone={m.mentionsEveryone} />
  )

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
      {!editing && <MessageTools message={m} onOpenChannel={onOpenChannel} actions={actions} />}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
