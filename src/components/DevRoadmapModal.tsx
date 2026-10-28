import { ControlIcon } from './ControlIcon'
import { DevProjectTabs, type DevProjectTabId } from './DevProjectTabs'

export function DevRoadmapModal({
  onClose,
  onSwitchTab
}: {
  onClose: () => void
  onSwitchTab?: (tab: DevProjectTabId) => void
}) {
  const milestones = [
    {
      version: 'v0.1.30 (Atual)',
      status: 'released',
      statusText: 'Versão Ativa',
      title: 'Dev Hub Completo & Drag-and-Drop de Projetos',
      items: [
        'Cards de Kanban com drag-and-drop e movimentação entre colunas',
        'Lista de tarefas interativa com reordenação por arrasto',
        'Central de documentação com Markdown e reorganização de artigos',
        'Persistência e sincronização de repositórios GitHub e Atlassian (Jira/Confluence)'
      ]
    },
    {
      version: 'v0.2.0',
      status: 'in-progress',
      statusText: 'Em Desenvolvimento',
      title: 'Dev Studio Integrado & Agentes MCP Nativos',
      items: [
        'Terminal interativo com split pane e suporte a múltiplos shells',
        'Agentes de IA autônomos com MCP (Model Context Protocol)',
        'Diff visual de pull requests e commit inline direto do chat'
      ]
    },
    {
      version: 'v0.3.0',
      status: 'planned',
      statusText: 'Planejado',
      title: 'Colaboração P2P em Tempo Real & Workspace Compartilhado',
      items: [
        'Cursores de presença e edição colaborativa em tempo real (CRDTs)',
        'Compartilhamento de telas multi-display com baixa latência',
        'Painéis de métricas e telemetria de CI/CD em tempo real'
      ]
    }
  ]

  return (
    <div className="ct-modal-backdrop" onClick={onClose}>
      <section className="ct-dev-modal-panel ct-roadmap-dialog" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <header className="ct-dev-modal-header">
          <div>
            <h2><ControlIcon name="roadmap" size={16}/> Projetos — Roadmap & Marcos de Versão</h2>
            <p>Planejamento estratégico de entregas, próximos lançamentos e objetivos da plataforma.</p>
          </div>
          <div className="ct-dev-header-actions">
            <button type="button" className="ct-close-btn" onClick={onClose} aria-label="Fechar">
              <ControlIcon name="close" size={14}/>
            </button>
          </div>
        </header>

        {/* Tab navigation for Projects Hub */}
        <DevProjectTabs activeTab="roadmap" onSwitchTab={onSwitchTab} />

        <div className="ct-roadmap-body">
          <div className="ct-roadmap-timeline">
            {milestones.map((m, idx) => (
              <div key={idx} className={`ct-roadmap-item ct-status-${m.status}`}>
                <div className="ct-roadmap-marker">
                  <div className="ct-roadmap-dot" />
                  {idx < milestones.length - 1 && <div className="ct-roadmap-line" />}
                </div>
                <div className="ct-roadmap-content">
                  <div className="ct-roadmap-header">
                    <span className="ct-roadmap-version">{m.version}</span>
                    <span className={`ct-roadmap-badge ct-badge-${m.status}`}>{m.statusText}</span>
                  </div>
                  <h3>{m.title}</h3>
                  <ul className="ct-roadmap-list">
                    {m.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
