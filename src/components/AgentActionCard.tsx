import { useState } from 'react'
import { ControlIcon } from './ControlIcon'
import { AiGeneratedImage } from './AiGeneratedImage'
import { usePreferencesStore } from '../store/usePreferencesStore'
import { useDevCollaborationStore } from '../store/useDevCollaborationStore'

export type AgentToolType = 'run_command' | 'write_file' | 'edit_file' | 'read_file' | 'list_files' | 'mcp_call' | 'generate_image'

export interface AgentAction {
  id: string
  tool: AgentToolType
  title?: string
  command?: string
  path?: string
  content?: string
  target?: string
  replacement?: string
  server?: string
  toolName?: string
  args?: Record<string, unknown>
  prompt?: string
  raw: string
}

export interface ParsedBlock {
  type: 'text' | 'action'
  text?: string
  action?: AgentAction
}

let actionCounter = 0

export function parseAgentActions(content: string): ParsedBlock[] {
  if (!content) return []
  const blocks: ParsedBlock[] = []
  
  // Regex to match:
  // 1. ```(?:tool_call(?::(\w+))?|file:([^\r\n]+)|(?:bash|sh|terminal|cmd):run)\s*[\r\n]+([\s\S]*?)```
  // 2. <agent_action ...>...</agent_action>
  const actionRegex = /(```(?:tool_call(?::(\w+))?|file:([^\r\n]+)|(?:bash|sh|terminal|cmd):run)\s*[\r\n]+([\s\S]*?)```|<agent_action\s+tool="([^"]+)"(?:\s+path="([^"]+)")?(?:\s+server="([^"]+)")?(?:\s+tool_name="([^"]+)")?>([\s\S]*?)<\/agent_action>)/gi

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = actionRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', text: content.slice(lastIndex, match.index) })
    }

    const fullMatch = match[0]
    const blockToolCallKind = match[2]
    const blockFilePath = match[3]
    const blockCodeContent = match[4]
    const tagTool = match[5]
    const tagPath = match[6]
    const tagServer = match[7]
    const tagToolName = match[8]
    const tagBody = match[9]

    let action: AgentAction | null = null
    const id = `action_${++actionCounter}_${Date.now()}`

    if (blockFilePath !== undefined) {
      // ```file:path/to/file.ext format
      action = {
        id,
        tool: 'write_file',
        path: blockFilePath.trim(),
        content: blockCodeContent !== undefined ? blockCodeContent.trimEnd() : '',
        raw: fullMatch
      }
    } else if (fullMatch.startsWith('```bash:run') || fullMatch.startsWith('```sh:run') || fullMatch.startsWith('```terminal:run') || fullMatch.startsWith('```cmd:run')) {
      action = {
        id,
        tool: 'run_command',
        command: (blockCodeContent || '').trim(),
        raw: fullMatch
      }
    } else if (blockCodeContent !== undefined) {
      // Code fence format: ```tool_call...
      const trimmed = blockCodeContent.trim()
      if (blockToolCallKind) {
        const toolKind = blockToolCallKind as AgentToolType
        if (toolKind === 'run_command') {
          action = { id, tool: 'run_command', command: trimmed, raw: fullMatch }
        } else if (toolKind === 'write_file') {
          const splitIdx = trimmed.indexOf('\n')
          const p = splitIdx >= 0 ? trimmed.slice(0, splitIdx).replace(/^path:\s*/i, '').trim() : 'file.txt'
          const c = splitIdx >= 0 ? trimmed.slice(splitIdx + 1) : ''
          action = { id, tool: 'write_file', path: p, content: c, raw: fullMatch }
        } else if (toolKind === 'generate_image') {
          let promptText = trimmed
          try {
            const p = JSON.parse(trimmed)
            promptText = p.prompt || p.description || trimmed
          } catch { /* ignore */ }
          action = { id, tool: 'generate_image', prompt: promptText, command: promptText, raw: fullMatch }
        }
      } else {
        try {
          const parsed = JSON.parse(trimmed)
          action = {
            id,
            tool: parsed.tool || parsed.name || 'run_command',
            command: parsed.command || parsed.args?.command,
            path: parsed.path || parsed.args?.path,
            content: parsed.content || parsed.args?.content,
            target: parsed.target || parsed.args?.target,
            replacement: parsed.replacement || parsed.args?.replacement,
            server: parsed.server || parsed.args?.server,
            toolName: parsed.toolName || parsed.args?.toolName,
            args: parsed.args || parsed.parameters,
            prompt: parsed.prompt || parsed.args?.prompt || parsed.description || parsed.command,
            raw: fullMatch
          }
        } catch {
          // If not valid JSON, treat as raw run_command
          action = { id, tool: 'run_command', command: trimmed, raw: fullMatch }
        }
      }
    } else if (tagTool) {
      // XML tag format
      const trimmedBody = (tagBody || '').trim()
      let args: Record<string, unknown> | undefined
      try {
        if (trimmedBody.startsWith('{') && trimmedBody.endsWith('}')) {
          args = JSON.parse(trimmedBody)
        }
      } catch { /* ignore */ }

      action = {
        id,
        tool: tagTool as AgentToolType,
        path: tagPath || (args?.path as string),
        command: (args?.command as string) || trimmedBody,
        content: (args?.content as string) || trimmedBody,
        target: args?.target as string,
        replacement: args?.replacement as string,
        server: tagServer || (args?.server as string),
        toolName: tagToolName || (args?.toolName as string),
        args,
        prompt: (args?.prompt as string) || (args?.description as string) || (args?.command as string) || trimmedBody,
        raw: fullMatch
      }
    }

    if (action) {
      blocks.push({ type: 'action', action })
    } else {
      blocks.push({ type: 'text', text: fullMatch })
    }

    lastIndex = actionRegex.lastIndex
  }

  if (lastIndex < content.length) {
    blocks.push({ type: 'text', text: content.slice(lastIndex) })
  }

  return blocks
}

export function AgentActionCard({ action }: { action: AgentAction }) {
  const [status, setStatus] = useState<'pending' | 'running' | 'executed' | 'rejected'>('pending')
  const [output, setOutput] = useState<{ stdout: string; stderr: string; exitCode?: number } | null>(null)
  const [mcpResult, setMcpResult] = useState<any>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<{ src: string; prompt: string } | null>(null)

  const desktop = typeof window !== 'undefined' ? window.contalkDesktop : undefined

  const handleGenerateImage = async () => {
    const prompt = action.prompt || action.command || action.content || ''
    if (!prompt) return
    setStatus('running')
    setErrorMessage('')
    try {
      if (!desktop?.communityAiGenerateImage) {
        throw new Error('Geração de imagem disponível apenas no aplicativo desktop.')
      }
      const res = await desktop.communityAiGenerateImage(prompt)
      setGeneratedImage(res)
      setStatus('executed')
      setOutput({ stdout: `Imagem gerada via ${res.provider} (${res.model}):\nPrompt: ${res.prompt}`, stderr: '' })
    } catch (e) {
      setStatus('pending')
      setErrorMessage(e instanceof Error ? e.message : 'Falha ao gerar imagem.')
    }
  }

  const handleRunCommand = async (inBackground = true) => {
    if (!action.command) return
    setStatus('running')
    setErrorMessage('')
    try {
      const workspaceFolder = usePreferencesStore.getState().workspaceFolder || undefined
      if (inBackground && desktop?.workspaceExecCommand) {
        const res = await desktop.workspaceExecCommand(action.command, workspaceFolder)
        setOutput(res)
        setStatus('executed')
      } else if (!inBackground && desktop?.terminalInput) {
        // Send to active terminal session
        desktop.terminalInput('', action.command + '\r')
        setStatus('executed')
        setOutput({ stdout: `Comando enviado ao terminal ativo:\n$ ${action.command}`, stderr: '' })
      } else if (desktop?.workspaceExecCommand) {
        const res = await desktop.workspaceExecCommand(action.command, workspaceFolder)
        setOutput(res)
        setStatus('executed')
      } else {
        throw new Error('Ambiente desktop indisponível para executar comandos.')
      }
    } catch (e) {
      setStatus('pending')
      setErrorMessage(e instanceof Error ? e.message : 'Falha ao executar comando.')
    }
  }

  const handleApplyFileChange = async () => {
    if (!action.path) return
    setStatus('running')
    setErrorMessage('')
    try {
      if (!desktop?.workspaceWriteFile) {
        throw new Error('Ambiente desktop indisponível para alterar arquivos.')
      }

      const workspaceFolder = usePreferencesStore.getState().workspaceFolder || ''
      let targetPath = action.path
      const isAbs = /^[a-zA-Z]:[/\\]|^\/|^\\\\/.test(action.path)
      if (workspaceFolder && !isAbs) {
        targetPath = `${workspaceFolder.replace(/\\/g, '/').replace(/\/+$/, '')}/${action.path.replace(/^\/+/, '')}`
      }

      let finalContent = action.content || ''
      if (action.tool === 'edit_file' && action.target !== undefined && action.replacement !== undefined) {
        if (!desktop.workspaceReadFile) throw new Error('Não foi possível ler o arquivo original.')
        const original = await desktop.workspaceReadFile(targetPath)
        if (!original.includes(action.target)) {
          throw new Error('O trecho de código a ser substituído não foi encontrado no arquivo.')
        }
        finalContent = original.replace(action.target, action.replacement)
      }

      await desktop.workspaceWriteFile(targetPath, finalContent)
      
      try {
        useDevCollaborationStore.getState().broadcastCode(targetPath, finalContent)
      } catch { /* ignore */ }

      // Notify application of file change so active DevCodeEditor tab can update
      window.dispatchEvent(new CustomEvent('contalk-file-written', {
        detail: { path: targetPath, content: finalContent }
      }))

      setStatus('executed')
      setOutput({ stdout: `Arquivo atualizado com sucesso no projeto: ${targetPath}`, stderr: '' })
    } catch (e) {
      setStatus('pending')
      setErrorMessage(e instanceof Error ? e.message : 'Falha ao gravar arquivo.')
    }
  }

  const handleRunMcp = async () => {
    if (!action.server || !action.toolName) return
    setStatus('running')
    setErrorMessage('')
    try {
      if (!desktop?.mcpCallTool) throw new Error('Suporte a MCP indisponível no momento.')
      const res = await desktop.mcpCallTool(action.server, action.toolName, action.args || {})
      setMcpResult(res)
      setStatus('executed')
      setOutput({ stdout: JSON.stringify(res, null, 2), stderr: '' })
    } catch (e) {
      setStatus('pending')
      setErrorMessage(e instanceof Error ? e.message : 'Falha ao invocar ferramenta MCP.')
    }
  }

  const handleReject = () => {
    setStatus('rejected')
  }

  let toolIcon: import('./ControlIcon').ControlIconName = action.tool === 'run_command' ? 'terminal' : action.tool === 'generate_image' ? 'ai' : 'git-code'
  let toolTitle = ''

  if (action.tool === 'mcp_call') {
    const s = (action.server || '').toLowerCase()
    const tn = (action.toolName || '').toLowerCase()
    if (s === 'google' || s === 'google-workspace') {
      if (tn.startsWith('gmail')) {
        toolIcon = 'mail'
        toolTitle = `Gmail: ${tn === 'gmail_get_message' ? 'Ler e-mail' : 'Consultar e-mails'}`
      } else if (tn.startsWith('youtube')) {
        toolIcon = 'play'
        toolTitle = `YouTube: ${tn === 'youtube_list_subscriptions' ? 'Canais inscritos' : 'Pesquisar vídeos'}`
      } else if (tn.startsWith('calendar')) {
        toolIcon = 'event'
        toolTitle = 'Google Agenda: Próximos compromissos'
      } else if (tn.startsWith('drive')) {
        toolIcon = 'file'
        toolTitle = 'Google Drive: Arquivos em nuvem'
      } else {
        toolIcon = 'ai'
        toolTitle = `Google Workspace: ${action.toolName}`
      }
    } else if (s === 'github') {
      toolIcon = 'git'
      toolTitle = `GitHub: ${action.toolName}`
    } else if (s === 'browser') {
      toolIcon = 'globe'
      if (tn === 'browser_open') toolTitle = `Navegador: Abrir ${action.args?.url || ''}`
      else if (tn === 'browser_navigate') toolTitle = `Navegador: Navegar para ${action.args?.url || ''}`
      else if (tn === 'browser_click') toolTitle = `Navegador: Clicar em "${action.args?.selector || ''}"`
      else if (tn === 'browser_type') toolTitle = `Navegador: Digitar "${action.args?.text || ''}" em "${action.args?.selector || ''}"`
      else if (tn === 'browser_read_content') toolTitle = 'Navegador: Ler conteúdo da página'
      else if (tn === 'browser_screenshot') toolTitle = 'Navegador: Capturar tela'
      else if (tn === 'browser_scroll') toolTitle = `Navegador: Rolar página (${action.args?.direction || 'baixo'})`
      else if (tn === 'browser_evaluate') toolTitle = 'Navegador: Executar Script'
      else toolTitle = `Navegador: ${action.toolName}`
    } else {
      toolIcon = 'ai'
      toolTitle = `Ferramenta MCP: ${action.server} / ${action.toolName}`
    }
  } else if (action.tool === 'run_command') {
    toolTitle = 'Executar comando'
  } else if (action.tool === 'write_file') {
    toolTitle = `Criar / sobrescrever arquivo: ${action.path}`
  } else if (action.tool === 'edit_file') {
    toolTitle = `Modificar arquivo: ${action.path}`
  } else if (action.tool === 'read_file') {
    toolTitle = `Ler arquivo: ${action.path}`
  } else if (action.tool === 'list_files') {
    toolTitle = `Listar pasta: ${action.path || '.'}`
  } else if (action.tool === 'generate_image') {
    toolTitle = `Gerar imagem com IA: "${action.prompt || action.command}"`
  }

  return (
    <div className={`ct-agent-card ct-agent-${action.tool} ct-status-${status}`}>
      <div className="ct-agent-card-header">
        <div className="ct-agent-card-title">
          <ControlIcon name={toolIcon} size={15} />
          <strong>{toolTitle}</strong>
        </div>
        <span className={`ct-agent-badge ct-badge-${status}`}>
          {status === 'pending' && 'Aguardando aprovação'}
          {status === 'running' && 'Executando…'}
          {status === 'executed' && 'Aprovado & Executado'}
          {status === 'rejected' && 'Rejeitado'}
        </span>
      </div>

      <div className="ct-agent-card-body">
        {action.tool === 'run_command' && action.command && (
          <pre className="ct-agent-code-box">
            <code>$ {action.command}</code>
          </pre>
        )}

        {action.tool === 'generate_image' && (
          <div className="ct-agent-image-preview">
            {generatedImage ? (
              <AiGeneratedImage src={generatedImage.src} alt={generatedImage.prompt} caption={generatedImage.prompt} />
            ) : (
              <div className="ct-agent-image-prompt-box">
                <div className="ct-agent-image-prompt-label">Prompt da imagem:</div>
                <p className="ct-agent-image-prompt-text">{action.prompt || action.command}</p>
              </div>
            )}
          </div>
        )}

        {(action.tool === 'write_file' || action.tool === 'edit_file') && (
          <div className="ct-agent-diff-preview">
            {action.target && (
              <div className="ct-diff-del">
                <span className="ct-diff-sign">-</span>
                <pre>{action.target}</pre>
              </div>
            )}
            {(action.replacement || action.content) && (
              <div className="ct-diff-add">
                <span className="ct-diff-sign">+</span>
                <pre>{action.replacement || action.content}</pre>
              </div>
            )}
          </div>
        )}

        {action.tool === 'mcp_call' && !mcpResult && action.args && (
          <pre className="ct-agent-code-box">
            <code>{JSON.stringify(action.args, null, 2)}</code>
          </pre>
        )}

        {action.tool === 'mcp_call' && mcpResult && (
          <div className="ct-mcp-results-container">
            {mcpResult.messages && Array.isArray(mcpResult.messages) && (
              <div className="ct-mcp-gmail-container">
                <div className="ct-mcp-account-header">
                  <ControlIcon name="mail" size={14} />
                  <span>{mcpResult.account || 'Gmail'} · {mcpResult.messages.length} e-mail(s)</span>
                </div>
                <div className="ct-mcp-email-list">
                  {mcpResult.messages.map((m: any, idx: number) => (
                    <div key={m.id || idx} className="ct-mcp-email-item">
                      <div className="ct-mcp-email-top">
                        <span className="ct-mcp-email-from">{m.from}</span>
                        <span className="ct-mcp-email-date">{m.date}</span>
                      </div>
                      <div className="ct-mcp-email-subject">{m.subject}</div>
                      {m.snippet && <div className="ct-mcp-email-snippet">{m.snippet}</div>}
                    </div>
                  ))}
                </div>
                <div className="ct-mcp-quick-summary-bar">
                  <button
                    type="button"
                    className="ct-mcp-summary-btn"
                    onClick={() => {
                      const summaryText = mcpResult.messages
                        .map((m: any) => `- De: ${m.from}\n  Assunto: ${m.subject}\n  Data: ${m.date}\n  Trecho: ${m.snippet}`)
                        .join('\n\n')
                      window.dispatchEvent(new CustomEvent('contalk-ai-prompt', {
                        detail: {
                          prompt: `Por favor, faça um resumo executivo claro e estruturado dos seguintes e-mails do Gmail, destacando ações prioritárias e pendências:\n\n${summaryText}`
                        }
                      }))
                    }}
                  >
                    <ControlIcon name="ai" size={13} />
                    <span>Resumir estes e-mails no chat com IA</span>
                  </button>
                </div>
              </div>
            )}

            {mcpResult.channels && Array.isArray(mcpResult.channels) && (
              <div className="ct-mcp-youtube-container">
                <div className="ct-mcp-account-header">
                  <ControlIcon name="play" size={14} />
                  <span>{mcpResult.account || 'YouTube'} · {mcpResult.channels.length} canais inscritos</span>
                </div>
                <div className="ct-mcp-channel-grid">
                  {mcpResult.channels.map((ch: any, idx: number) => (
                    <div key={ch.id || idx} className="ct-mcp-channel-card">
                      {ch.thumbnail && <img src={ch.thumbnail} alt={ch.title} className="ct-mcp-channel-thumb" />}
                      <div className="ct-mcp-channel-info">
                        <div className="ct-mcp-channel-title">
                          <strong>{ch.title}</strong>
                          {ch.subscriberCount && <span className="ct-mcp-pill">{ch.subscriberCount}</span>}
                        </div>
                        {ch.description && <p className="ct-mcp-channel-desc">{ch.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="ct-mcp-quick-summary-bar">
                  <button
                    type="button"
                    className="ct-mcp-summary-btn"
                    onClick={() => {
                      const summaryText = mcpResult.channels
                        .map((ch: any) => `- ${ch.title} (${ch.subscriberCount || ''}): ${ch.description || ''}`)
                        .join('\n')
                      window.dispatchEvent(new CustomEvent('contalk-ai-prompt', {
                        detail: {
                          prompt: `Por favor, faça um resumo e análise dos canais que sigo no YouTube, agrupando-os por temas e destacando recomendações:\n\n${summaryText}`
                        }
                      }))
                    }}
                  >
                    <ControlIcon name="ai" size={13} />
                    <span>Resumir canais do YouTube no chat com IA</span>
                  </button>
                </div>
              </div>
            )}

            {mcpResult.events && Array.isArray(mcpResult.events) && (
              <div className="ct-mcp-calendar-container">
                <div className="ct-mcp-account-header">
                  <ControlIcon name="event" size={14} />
                  <span>{mcpResult.account || 'Google Agenda'} · {mcpResult.events.length} compromissos</span>
                </div>
                <div className="ct-mcp-event-list">
                  {mcpResult.events.map((ev: any, idx: number) => (
                    <div key={ev.id || idx} className="ct-mcp-event-item">
                      <div className="ct-mcp-event-time">
                        <span className="ct-mcp-pill">{ev.start}</span>
                        {ev.location && <span className="ct-mcp-loc">{ev.location}</span>}
                      </div>
                      <div className="ct-mcp-event-title">{ev.summary}</div>
                      {ev.description && <div className="ct-mcp-event-desc">{ev.description}</div>}
                    </div>
                  ))}
                </div>
                <div className="ct-mcp-quick-summary-bar">
                  <button
                    type="button"
                    className="ct-mcp-summary-btn"
                    onClick={() => {
                      const summaryText = mcpResult.events
                        .map((ev: any) => `- ${ev.summary} | Horário: ${ev.start} até ${ev.end || ''} | Local: ${ev.location || 'Online'}\n  ${ev.description || ''}`)
                        .join('\n')
                      window.dispatchEvent(new CustomEvent('contalk-ai-prompt', {
                        detail: {
                          prompt: `Por favor, organize minha rotina e faça um briefing dos meus próximos compromissos da Google Agenda:\n\n${summaryText}`
                        }
                      }))
                    }}
                  >
                    <ControlIcon name="ai" size={13} />
                    <span>Organizar compromissos com IA</span>
                  </button>
                </div>
              </div>
            )}

            {mcpResult.files && Array.isArray(mcpResult.files) && (
              <div className="ct-mcp-drive-container">
                <div className="ct-mcp-account-header">
                  <ControlIcon name="file" size={14} />
                  <span>{mcpResult.account || 'Google Drive'} · {mcpResult.files.length} arquivos</span>
                </div>
                <div className="ct-mcp-file-list">
                  {mcpResult.files.map((f: any, idx: number) => (
                    <div key={f.id || idx} className="ct-mcp-file-item">
                      <ControlIcon name="file" size={15} />
                      <div className="ct-mcp-file-details">
                        <strong>{f.name}</strong>
                        <small>{f.size || ''} · Modificado: {f.modifiedTime || ''}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mcpResult.issues && Array.isArray(mcpResult.issues) && (
              <div className="ct-mcp-github-container">
                <div className="ct-mcp-account-header">
                  <ControlIcon name="git-issue" size={14} />
                  <span>Repositório {mcpResult.repo} · {mcpResult.issues.length} issues</span>
                </div>
                <div className="ct-mcp-gh-list">
                  {mcpResult.issues.map((iss: any) => (
                    <div key={iss.id} className="ct-mcp-gh-item">
                      <span className={`ct-mcp-status-${iss.state}`}>#{iss.number}</span>
                      <span className="ct-mcp-gh-title">{iss.title}</span>
                      <small>@{iss.author}</small>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {action.server === 'browser' && (
              <div className="ct-mcp-browser-container">
                <div className="ct-mcp-account-header">
                  <ControlIcon name="globe" size={14} />
                  <span>Navegador Interno {mcpResult.url && `· ${mcpResult.url}`}</span>
                  {desktop?.browserShow && (
                    <button
                      type="button"
                      className="ct-browser-launch-btn"
                      onClick={() => void desktop.browserShow?.()}
                      title="Exibir navegador interno em janela visual"
                    >
                      <ControlIcon name="expand" size={11} />
                      <span>Ver Navegador</span>
                    </button>
                  )}
                </div>

                {mcpResult.src && (
                  <div className="ct-mcp-browser-screenshot">
                    <img src={mcpResult.src} alt={mcpResult.title || 'Screenshot'} className="ct-browser-preview-img" />
                    <small className="ct-browser-preview-caption">{mcpResult.title} ({mcpResult.url})</small>
                  </div>
                )}

                {mcpResult.message && (
                  <div className="ct-mcp-browser-status">
                    <ControlIcon name="check" size={13} />
                    <span>{mcpResult.message}</span>
                    {mcpResult.tag && <span className="ct-mcp-pill">&lt;{mcpResult.tag}&gt;</span>}
                  </div>
                )}

                {mcpResult.content && (
                  <div className="ct-mcp-browser-content-view">
                    <div className="ct-browser-content-header">
                      <strong>{mcpResult.title}</strong>
                      <span className="ct-mcp-pill">{mcpResult.links?.length || 0} links</span>
                    </div>
                    <p className="ct-browser-content-text">{mcpResult.content}</p>
                    <div className="ct-mcp-quick-summary-bar">
                      <button
                        type="button"
                        className="ct-mcp-summary-btn"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('contalk-ai-prompt', {
                            detail: {
                              prompt: `Por favor, faça um resumo dos pontos mais importantes do conteúdo lido nesta página web:\n\nTítulo: ${mcpResult.title}\nURL: ${mcpResult.url}\n\nConteúdo:\n${mcpResult.content}`
                            }
                          }))
                        }}
                      >
                        <ControlIcon name="ai" size={13} />
                        <span>Resumir conteúdo da página com IA</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {status === 'pending' && (
        <div className="ct-agent-card-actions">
          {action.tool === 'run_command' && (
            <>
              <button
                type="button"
                className="ct-btn-primary ct-agent-btn"
                onClick={() => void handleRunCommand(true)}
              >
                <ControlIcon name="check" size={13} />
                <span>Aprovar e Executar</span>
              </button>
              <button
                type="button"
                className="ct-btn-secondary ct-agent-btn"
                onClick={() => void handleRunCommand(false)}
                title="Injetar e executar no terminal aberto"
              >
                <ControlIcon name="terminal" size={13} />
                <span>No Terminal</span>
              </button>
            </>
          )}

          {(action.tool === 'write_file' || action.tool === 'edit_file') && (
            <>
              <button
                type="button"
                className="ct-btn-primary ct-agent-btn"
                onClick={() => void handleApplyFileChange()}
              >
                <ControlIcon name="check" size={13} />
                <span>Aplicar no Projeto</span>
              </button>
              <button
                type="button"
                className="ct-btn-secondary ct-agent-btn"
                onClick={() => {
                  const workspaceFolder = usePreferencesStore.getState().workspaceFolder || ''
                  let targetPath = action.path || ''
                  const isAbs = /^[a-zA-Z]:[/\\]|^\/|^\\\\/.test(targetPath)
                  if (workspaceFolder && !isAbs) {
                    targetPath = `${workspaceFolder.replace(/\\/g, '/').replace(/\/+$/, '')}/${targetPath.replace(/^\/+/, '')}`
                  }
                  window.dispatchEvent(new CustomEvent('contalk-open-editor-file', {
                    detail: { path: targetPath, content: action.content || action.replacement || '' }
                  }))
                }}
                title="Abrir no editor colaborativo de código"
              >
                <ControlIcon name="git-code" size={13} />
                <span>Abrir no Editor</span>
              </button>
            </>
          )}

          {action.tool === 'mcp_call' && (
            <>
              <button
                type="button"
                className="ct-btn-primary ct-agent-btn"
                onClick={() => void handleRunMcp()}
              >
                <ControlIcon name="check" size={13} />
                <span>
                  {action.server === 'browser' ? 'Aprovar e Executar no Navegador' : 'Aprovar e Invocar Tool'}
                </span>
              </button>
              {action.server === 'browser' && desktop?.browserShow && (
                <button
                  type="button"
                  className="ct-btn-secondary ct-agent-btn"
                  onClick={() => void desktop.browserShow?.()}
                  title="Abrir navegador interno em janela dedicada"
                >
                  <ControlIcon name="globe" size={13} />
                  <span>Ver Navegador</span>
                </button>
              )}
            </>
          )}

          {action.tool === 'generate_image' && (
            <button
              type="button"
              className="ct-btn-primary ct-agent-btn"
              onClick={() => void handleGenerateImage()}
            >
              <ControlIcon name="ai" size={13} />
              <span>Gerar Imagem Agora</span>
            </button>
          )}

          <button
            type="button"
            className="ct-btn-danger ct-agent-btn"
            onClick={handleReject}
          >
            <ControlIcon name="close" size={13} />
            <span>Rejeitar</span>
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="ct-agent-card-error" role="alert">
          <ControlIcon name="close" size={13} />
          <span>{errorMessage}</span>
        </div>
      )}

      {output && (
        <div className="ct-agent-card-output">
          <div
            className="ct-agent-output-header"
            onClick={() => setDetailsExpanded(!detailsExpanded)}
          >
            <span>
              Saída da execução {output.exitCode !== undefined && `(Código de saída: ${output.exitCode})`}
            </span>
            <small>{detailsExpanded ? 'Ocultar ▲' : 'Ver saída ▼'}</small>
          </div>
          {detailsExpanded && (
            <pre className="ct-agent-output-content">
              {output.stdout || output.stderr || '(Nenhuma saída capturada)'}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
