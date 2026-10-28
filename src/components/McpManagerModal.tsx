import { useState, useEffect } from 'react'
import { ControlIcon } from './ControlIcon'

export interface McpServerItem {
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  disabled?: boolean
}

export function McpManagerModal({ onClose }: { onClose: () => void }) {
  const [servers, setServers] = useState<McpServerItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [argsStr, setArgsStr] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  // Tools discovery
  const [inspectingServer, setInspectingServer] = useState<string | null>(null)
  const [discoveredTools, setDiscoveredTools] = useState<Array<{ name: string; description?: string; inputSchema?: any }>>([])
  const [loadingTools, setLoadingTools] = useState(false)

  const desktop = typeof window !== 'undefined' ? window.contalkDesktop : undefined

  const loadServers = async () => {
    if (!desktop?.mcpListServers) return
    setLoading(true)
    setError('')
    try {
      const list = await desktop.mcpListServers()
      setServers(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao listar servidores MCP.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadServers()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !command.trim()) {
      setError('Preencha o nome e o comando do servidor.')
      return
    }
    if (!desktop?.mcpSaveServer) return

    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const args = argsStr.trim() ? argsStr.trim().split(/\s+/) : []
      await desktop.mcpSaveServer({
        name: name.trim(),
        command: command.trim(),
        args,
        disabled: false
      })
      setSuccess(`Servidor MCP "${name.trim()}" salvo com sucesso!`)
      setName('')
      setCommand('')
      setArgsStr('')
      setIsAdding(false)
      await loadServers()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar servidor MCP.')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (serverName: string) => {
    if (!desktop?.mcpRemoveServer) return
    setError('')
    setSuccess('')
    try {
      await desktop.mcpRemoveServer(serverName)
      if (inspectingServer === serverName) {
        setInspectingServer(null)
        setDiscoveredTools([])
      }
      setSuccess(`Servidor MCP "${serverName}" removido.`)
      await loadServers()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao remover servidor MCP.')
    }
  }

  const handleInspectTools = async (serverName: string) => {
    if (!desktop?.mcpListTools) return
    setInspectingServer(serverName)
    setLoadingTools(true)
    setError('')
    try {
      const res = await desktop.mcpListTools(serverName)
      setDiscoveredTools(res.tools || [])
    } catch (e) {
      setError(`Falha ao obter ferramentas de "${serverName}": ` + (e instanceof Error ? e.message : String(e)))
      setDiscoveredTools([])
    } finally {
      setLoadingTools(false)
    }
  }

  return (
    <div className="ct-modal-backdrop" onClick={onClose}>
      <section
        className="ct-edit-dialog ct-mcp-modal"
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '640px', width: '100%' }}
      >
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ControlIcon name="ai" size={18} />
            <h2 style={{ margin: 0, fontSize: '18px' }}>Servidores MCP (Model Context Protocol)</h2>
          </div>
          <button
            type="button"
            className="ct-modal-close"
            onClick={onClose}
            aria-label="Fechar"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--cx-fg-3)' }}
          >
            <ControlIcon name="close" size={16} />
          </button>
        </header>

        <p style={{ fontSize: '13px', color: 'var(--cx-fg-2)', margin: '0 0 16px 0', lineHeight: '1.5' }}>
          Conecte ferramentas externas ao ConTALK via protocolo MCP. Os agentes de IA nos seus canais e projetos poderão invocar automaticamente ferramentas configuradas aqui.
        </p>

        {error && <div className="ct-agent-card-error" role="alert" style={{ marginBottom: '12px' }}><ControlIcon name="close" size={13} /><span>{error}</span></div>}
        {success && <div style={{ padding: '8px 12px', background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e', color: '#4ade80', borderRadius: '6px', fontSize: '12px', marginBottom: '12px' }}>{success}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <strong style={{ fontSize: '14px' }}>Servidores Ativos ({servers.length})</strong>
          <button
            type="button"
            className="ct-btn-primary"
            style={{ fontSize: '12px', padding: '5px 10px' }}
            onClick={() => setIsAdding(!isAdding)}
          >
            {isAdding ? 'Cancelar' : '+ Adicionar Servidor MCP'}
          </button>
        </div>

        {isAdding && (
          <form onSubmit={handleSave} style={{ background: 'var(--cx-surface)', padding: '14px', borderRadius: '8px', border: '1px solid var(--cx-border-light)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Nome do Servidor</label>
                <input
                  type="text"
                  placeholder="Ex: filesystem, github, postgres"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: 'var(--cx-bg)', border: '1px solid var(--cx-border)', borderRadius: '4px', color: 'var(--cx-fg)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Comando Executável</label>
                <input
                  type="text"
                  placeholder="Ex: npx, python, node"
                  value={command}
                  onChange={e => setCommand(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: 'var(--cx-bg)', border: '1px solid var(--cx-border)', borderRadius: '4px', color: 'var(--cx-fg)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Argumentos (separados por espaço)</label>
                <input
                  type="text"
                  placeholder="Ex: -y @modelcontextprotocol/server-filesystem D:/projetos"
                  value={argsStr}
                  onChange={e => setArgsStr(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', background: 'var(--cx-bg)', border: '1px solid var(--cx-border)', borderRadius: '4px', color: 'var(--cx-fg)' }}
                />
              </div>
              <button
                type="submit"
                className="ct-btn-primary"
                disabled={loading}
                style={{ alignSelf: 'flex-start', marginTop: '6px' }}
              >
                {loading ? 'Salvando…' : 'Salvar Servidor'}
              </button>
            </div>
          </form>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', marginBottom: '16px' }}>
          {servers.length === 0 && !isAdding && (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--cx-fg-3)', background: 'var(--cx-surface)', borderRadius: '6px' }}>
              Nenhum servidor MCP configurado. Clique acima para adicionar seu primeiro servidor stdio.
            </div>
          )}

          {servers.map(server => (
            <div
              key={server.name}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                background: 'var(--cx-surface)',
                borderRadius: '6px',
                border: '1px solid var(--cx-border-light)'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong>{server.name}</strong>
                  <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', borderRadius: '4px' }}>stdio</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--cx-fg-3)', marginTop: '2px', fontFamily: 'monospace' }}>
                  {server.command} {server.args.join(' ')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="ct-btn-secondary"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                  onClick={() => void handleInspectTools(server.name)}
                >
                  Listar Ferramentas
                </button>
                <button
                  type="button"
                  className="ct-btn-danger"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                  onClick={() => void handleRemove(server.name)}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>

        {inspectingServer && (
          <div style={{ background: 'var(--cx-surface)', padding: '12px', borderRadius: '6px', border: '1px solid var(--cx-border-light)', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <strong style={{ fontSize: '12px' }}>Ferramentas de &quot;{inspectingServer}&quot; ({discoveredTools.length}):</strong>
              <button
                type="button"
                style={{ background: 'transparent', border: 'none', color: 'var(--cx-fg-3)', cursor: 'pointer', fontSize: '11px' }}
                onClick={() => setInspectingServer(null)}
              >
                Fechar ✕
              </button>
            </div>

            {loadingTools && <div style={{ fontSize: '12px', color: 'var(--cx-fg-3)' }}>Iniciando handshake MCP e descobrindo ferramentas…</div>}

            {!loadingTools && discoveredTools.length === 0 && (
              <div style={{ fontSize: '12px', color: 'var(--cx-fg-3)' }}>Nenhuma ferramenta exposta por este servidor.</div>
            )}

            {!loadingTools && discoveredTools.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                {discoveredTools.map(tool => (
                  <div key={tool.name} style={{ padding: '6px 8px', background: 'var(--cx-bg)', borderRadius: '4px', fontSize: '12px' }}>
                    <strong style={{ color: 'var(--cx-accent, #a78bfa)' }}>{tool.name}</strong>
                    {tool.description && <div style={{ fontSize: '11px', color: 'var(--cx-fg-2)', marginTop: '2px' }}>{tool.description}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <footer style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button type="button" className="ct-btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </footer>
      </section>
    </div>
  )
}
