import { useState } from 'react'
import { ControlIcon } from './ControlIcon'
import { AiGeneratedImage } from './AiGeneratedImage'

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
  // 1. ```tool_call ... ```
  // 2. <agent_action ...>...</agent_action>
  // 3. ```tool_call:run_command ... ```
  const actionRegex = /(```tool_call(?::(\w+))?\s*[\r\n]+([\s\S]*?)```|<agent_action\s+tool="([^"]+)"(?:\s+path="([^"]+)")?(?:\s+server="([^"]+)")?(?:\s+tool_name="([^"]+)")?>([\s\S]*?)<\/agent_action>)/gi

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = actionRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', text: content.slice(lastIndex, match.index) })
    }

    const fullMatch = match[0]
    const blockCodeKind = match[2]
    const blockCodeContent = match[3]
    const tagTool = match[4]
    const tagPath = match[5]
    const tagServer = match[6]
    const tagToolName = match[7]
    const tagBody = match[8]

    let action: AgentAction | null = null
    const id = `action_${++actionCounter}_${Date.now()}`

    if (blockCodeContent !== undefined) {
      // Code fence format
      const trimmed = blockCodeContent.trim()
      if (blockCodeKind) {
        const toolKind = blockCodeKind as AgentToolType
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
      if (inBackground && desktop?.workspaceExecCommand) {
        const res = await desktop.workspaceExecCommand(action.command)
        setOutput(res)
        setStatus('executed')
      } else if (!inBackground && desktop?.terminalInput) {
        // Send to active terminal session
        desktop.terminalInput('', action.command + '\r')
        setStatus('executed')
        setOutput({ stdout: `Comando enviado ao terminal ativo:\n$ ${action.command}`, stderr: '' })
      } else if (desktop?.workspaceExecCommand) {
        const res = await desktop.workspaceExecCommand(action.command)
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

      let finalContent = action.content || ''
      if (action.tool === 'edit_file' && action.target !== undefined && action.replacement !== undefined) {
        if (!desktop.workspaceReadFile) throw new Error('Não foi possível ler o arquivo original.')
        const original = await desktop.workspaceReadFile(action.path)
        if (!original.includes(action.target)) {
          throw new Error('O trecho de código a ser substituído não foi encontrado no arquivo.')
        }
        finalContent = original.replace(action.target, action.replacement)
      }

      await desktop.workspaceWriteFile(action.path, finalContent)
      
      // Notify application of file change so active DevCodeEditor tab can update
      window.dispatchEvent(new CustomEvent('contalk-file-written', {
        detail: { path: action.path, content: finalContent }
      }))

      setStatus('executed')
      setOutput({ stdout: `Arquivo atualizado com sucesso: ${action.path}`, stderr: '' })
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

  const toolIcon = action.tool === 'run_command' ? 'terminal' : action.tool === 'mcp_call' || action.tool === 'generate_image' ? 'ai' : 'git-code'

  return (
    <div className={`ct-agent-card ct-agent-${action.tool} ct-status-${status}`}>
      <div className="ct-agent-card-header">
        <div className="ct-agent-card-title">
          <ControlIcon name={toolIcon} size={15} />
          <strong>
            {action.tool === 'run_command' && 'Executar comando'}
            {action.tool === 'write_file' && `Criar / sobrescrever arquivo: ${action.path}`}
            {action.tool === 'edit_file' && `Modificar arquivo: ${action.path}`}
            {action.tool === 'read_file' && `Ler arquivo: ${action.path}`}
            {action.tool === 'list_files' && `Listar pasta: ${action.path || '.'}`}
            {action.tool === 'mcp_call' && `Ferramenta MCP: ${action.server} / ${action.toolName}`}
            {action.tool === 'generate_image' && `Gerar imagem com IA: "${action.prompt || action.command}"`}
          </strong>
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

        {action.tool === 'mcp_call' && action.args && (
          <pre className="ct-agent-code-box">
            <code>{JSON.stringify(action.args, null, 2)}</code>
          </pre>
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
            <button
              type="button"
              className="ct-btn-primary ct-agent-btn"
              onClick={() => void handleApplyFileChange()}
            >
              <ControlIcon name="check" size={13} />
              <span>Aplicar Alteração</span>
            </button>
          )}

          {action.tool === 'mcp_call' && (
            <button
              type="button"
              className="ct-btn-primary ct-agent-btn"
              onClick={() => void handleRunMcp()}
            >
              <ControlIcon name="check" size={13} />
              <span>Aprovar e Invocar Tool</span>
            </button>
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
