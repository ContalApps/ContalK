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
import { useEffect, useState, useRef, useMemo } from 'react'
import { Avatar } from './Avatar'
import { useAuthStore } from '../store/useAuthStore'
import { useCommunityStore } from '../store/useCommunityStore'
import type { Message, MessageOptions, Attachment } from '../store/useAppStore'
import { useRoleStore } from '../store/useRoleStore'
import { canMentionRole } from '../roles/permissions'
import { centralAllows } from '../roles/transport'

const fileUrlCache = new Map<string, string>()

function ViewOnceIcon({ size = 18, active = false }: { size?: number; active?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.5" strokeDasharray={active ? 'none' : '3.5 2'} />
      <path d="M10.5 10.5L12 9v6.5" />
      <path d="M10.5 15.5h3" />
    </svg>
  )
}

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

  const inputRef = useRef<HTMLInputElement>(null)
  const mentionDropdownRef = useRef<HTMLDivElement>(null)
  const [mentionActive, setMentionActive] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)

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

  const mentionCandidates = useMemo(() => {
    const list: Array<{
      kind: 'everyone' | 'here' | 'role' | 'member'
      id: string
      name: string
      username?: string
      description: string
      insertText: string
      color?: string | null
    }> = []

    if (channelId && snapshot && centralAllows('MENTION_EVERYONE', channelId)) {
      list.push({
        kind: 'everyone',
        id: 'all:everyone',
        name: 'everyone',
        description: 'Notificar todos no canal',
        insertText: '@everyone '
      })
      list.push({
        kind: 'here',
        id: 'all:here',
        name: 'here',
        description: 'Notificar membros online agora',
        insertText: '@here '
      })
    }

    for (const role of mentionRoles) {
      list.push({
        kind: 'role',
        id: 'role:' + role.id,
        name: role.name,
        description: 'Cargo do servidor',
        insertText: '<@&' + role.id + '> ',
        color: role.color ?? undefined
      })
    }

    for (const m of members) {
      list.push({
        kind: 'member',
        id: m.username,
        name: m.display_name,
        username: m.username,
        description: `@${m.username}${m.online ? ' • Online' : ''}`,
        insertText: `@${m.username} `
      })
    }

    return list
  }, [channelId, snapshot, mentionRoles, members])

  const filteredMentions = useMemo(() => {
    if (!mentionActive) return []
    const q = mentionQuery.toLowerCase()
    if (!q) return mentionCandidates
    return mentionCandidates.filter(
      c => c.name.toLowerCase().includes(q) || (c.username && c.username.toLowerCase().includes(q))
    )
  }, [mentionActive, mentionQuery, mentionCandidates])

  const checkMentionTrigger = (val: string, cursorPosition?: number) => {
    const cursor = cursorPosition ?? (inputRef.current?.selectionStart ?? val.length)
    const textBefore = val.slice(0, cursor)
    const match = textBefore.match(/(?:^|\s)@([a-zA-Z0-9_À-ÿ-]*)$/)
    if (match) {
      setMentionActive(true)
      setMentionQuery(match[1])
      setSelectedMentionIndex(0)
    } else {
      setMentionActive(false)
    }
  }

  const selectMention = (item: (typeof mentionCandidates)[0]) => {
    const input = inputRef.current
    const cursor = input?.selectionStart ?? text.length
    const textBefore = text.slice(0, cursor)
    const textAfter = text.slice(cursor)

    const match = textBefore.match(/(?:^|\s)@([a-zA-Z0-9_À-ÿ-]*)$/)
    if (!match) return

    const atIndex = textBefore.lastIndexOf('@')
    const newTextBefore = textBefore.slice(0, atIndex) + item.insertText
    const newText = newTextBefore + textAfter
    setText(newText)
    setMentionActive(false)

    requestAnimationFrame(() => {
      if (input) {
        input.focus()
        const newCursor = newTextBefore.length
        input.setSelectionRange(newCursor, newCursor)
      }
    })
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionActive && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedMentionIndex(i => (i + 1) % filteredMentions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedMentionIndex(i => (i - 1 + filteredMentions.length) % filteredMentions.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const safeIdx = Math.min(selectedMentionIndex, Math.max(0, filteredMentions.length - 1))
        selectMention(filteredMentions[safeIdx])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionActive(false)
        return
      }
    }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        mentionDropdownRef.current &&
        !mentionDropdownRef.current.contains(e.target as Node) &&
        inputRef.current !== e.target
      ) {
        setMentionActive(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
          <input type="checkbox" aria-label="Enviar com leitura em voz" checked={tts} disabled={!canTts && !tts} onChange={event => setTts(event.target.checked)} /> Leitura em voz
        </label>
        <select
          aria-label="Mencionar pessoa"
          className="ct-mention-select" style={{ display: 'none' }}
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

      {mentionActive && filteredMentions.length > 0 && (
        <div
          ref={mentionDropdownRef}
          className="ct-mention-dropdown"
          role="listbox"
          aria-label="Sugestões de menção"
        >
          <div className="ct-mention-dropdown-header">
            <span>Mencionar: <strong>{mentionQuery ? `@${mentionQuery}` : '@...'}</strong></span>
          </div>
          <div className="ct-mention-dropdown-list">
            {filteredMentions.slice(0, 8).map((item, idx) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={idx === selectedMentionIndex}
                className={`ct-mention-item ${idx === selectedMentionIndex ? 'active' : ''}`}
                onMouseDown={e => {
                  e.preventDefault()
                  selectMention(item)
                }}
                onMouseEnter={() => setSelectedMentionIndex(idx)}
              >
                {item.kind === 'everyone' || item.kind === 'here' ? (
                  <span className="ct-mention-badge ct-mention-everyone">@</span>
                ) : item.kind === 'role' ? (
                  <span className="ct-mention-badge ct-mention-role" style={{ color: item.color || '#58a6ff' }}>@</span>
                ) : (
                  <Avatar name={item.name} identity={item.username} />
                )}
                <div className="ct-mention-info">
                  <div className="flex items-center gap-1.5">
                    <span className="ct-mention-name">{item.name}</span>
                    {item.kind === 'role' && <span className="text-[10px] px-1 rounded bg-sky-500/10 text-sky-400">Cargo</span>}
                    {item.kind === 'everyone' && <span className="text-[10px] px-1 rounded bg-amber-500/10 text-amber-400">Todos</span>}
                  </div>
                  <span className="ct-mention-desc">{item.description}</span>
                </div>
              </button>
            ))}
          </div>
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
          ref={inputRef}
          list="ct-mention-users"
          aria-label="Mensagem"
          maxLength={2000}
          placeholder={placeholder}
          value={text}
          disabled={busy || disabled}
          onChange={e => {
            setText(e.target.value)
            checkMentionTrigger(e.target.value, e.target.selectionStart ?? undefined)
          }}
          onKeyDown={handleInputKeyDown}
          onClick={e => checkMentionTrigger(text, (e.target as HTMLInputElement).selectionStart ?? undefined)}
          onKeyUp={e => {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') {
              checkMentionTrigger(text, (e.target as HTMLInputElement).selectionStart ?? undefined)
            }
          }}
          onPaste={e => {
            const file = e.clipboardData.files[0]
            if (file) {
              e.preventDefault()
              void choose(file)
            }
          }}
        />
        <button
          type="button"
          className={`ct-view-once-btn ${once ? 'active' : ''}`}
          aria-label={once ? 'Visualização única ativada' : 'Ativar visualização única'}
          aria-pressed={once}
          title={once ? 'Visualização única ativada: a mensagem só poderá ser vista uma vez' : 'Visualização única por pessoa'}
          disabled={busy || disabled}
          onClick={() => setOnce(!once)}
        >
          <ViewOnceIcon active={once} size={18} />
        </button>
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (confirmDelete) {
      cancelDeleteRef.current?.focus()
    }
  }, [confirmDelete])
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
        onClick={() => setConfirmDelete(true)}
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
      {confirmDelete && (
        <div className="ct-modal-backdrop" onClick={() => !busy && setConfirmDelete(false)}>
          <section
            className="ct-edit-dialog ct-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={'delete-message-title-' + m.id}
            aria-describedby={'delete-message-desc-' + m.id}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => {
              if (e.key === 'Escape' && !busy) {
                e.stopPropagation()
                setConfirmDelete(false)
              }
              if (e.key === 'Tab') {
                const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
                if (!buttons.length) return
                if (e.shiftKey && document.activeElement === buttons[0]) {
                  e.preventDefault()
                  buttons[buttons.length - 1]?.focus()
                } else if (!e.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
                  e.preventDefault()
                  buttons[0]?.focus()
                }
              }
            }}
          >
            <h2 id={'delete-message-title-' + m.id}>Excluir mensagem</h2>
            <p id={'delete-message-desc-' + m.id}>
              Tem certeza de que deseja excluir esta mensagem? Esta ação não pode ser desfeita.
            </p>
            {m.content && (
              <div
                style={{
                  margin: '4px 0 12px',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  background: 'var(--ct-settings-bg, rgba(0, 0, 0, 0.25))',
                  border: '1px solid var(--ct-settings-line, rgba(255, 255, 255, 0.08))',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  maxHeight: '140px',
                  overflow: 'auto',
                  wordBreak: 'break-word',
                  color: 'var(--cx-fg-2, #ccc)'
                }}
              >
                {m.content}
              </div>
            )}
            {error && <p role="alert">{error}</p>}
            <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                ref={cancelDeleteRef}
                className="ct-secondary"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="ct-danger"
                aria-label="Confirmar exclusão da mensagem"
                disabled={busy}
                onClick={async () => {
                  await change()
                  setConfirmDelete(false)
                }}
              >
                {busy ? 'Excluindo…' : 'Excluir'}
              </button>
            </footer>
          </section>
        </div>
      )}
      {!editing && <MessageTools message={m} onOpenChannel={onOpenChannel} actions={actions} />}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
