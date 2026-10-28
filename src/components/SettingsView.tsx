import { BrandMark } from './BrandMark'
import { ControlIcon } from './ControlIcon'
import { useEffect, useRef, useState } from 'react'
import { usePreferencesStore, type Theme } from '../store/usePreferencesStore'
import { useAuthStore } from '../store/useAuthStore'
import { useDevStore } from '../store/useDevStore'
import { AudioSettings } from './AudioSettings'
import { Avatar } from './Avatar'
import { DensityControl } from './DensityControl'
import { AiSettings } from './AiSettings'
import { CoastalScene } from './CoastalScene'

export function SettingsView({ onClose, onEditProfile, initialTab='appearance' }: { onClose: () => void; onEditProfile: () => void; initialTab?:'appearance'|'ai' }) {
  const preferences = usePreferencesStore()
  const user = useAuthStore(s => s.user)!
  const devStore = useDevStore()
  const [tab, setTab] = useState<'appearance' | 'audio' | 'account' | 'about' | 'notifications' | 'ai' | 'integrations'>(initialTab)
  const [error, setError] = useState('')
  const [updateMessage, setUpdateMessage] = useState('')
  const [checking, setChecking] = useState(false)
  const ref = useRef<HTMLElement>(null)
  const previous = useRef(document.activeElement as HTMLElement | null)
  useEffect(() => {
    void devStore.checkLocalGitHubAuth()
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => previous.current?.focus()
  }, [])
  const update = (patch: Parameters<typeof preferences.update>[0]) => { try { preferences.update(patch); setError('') } catch { setError('Não foi possível salvar a preferência. Tente novamente.') } }
  return <section className="ct-settings-screen" ref={ref} role="dialog" aria-modal="true" aria-label="Configurações do ConTALK" onKeyDown={e => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    if (e.key === 'Tab') { const elements = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select, textarea, [tabindex="0"]')]; const first = elements[0]; const last = elements[elements.length - 1]; if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()} }
  }}>
    <aside className="ct-settings-nav"><div className="ct-settings-account"><Avatar name={user.display_name} identity={user.username}/><span><strong>{user.display_name}</strong><small>Configurações pessoais</small></span></div><span className="ct-eyebrow">Configurações</span><nav aria-label="Seções de configurações">{([['appearance','palette','Aparência'],['audio','ear','Voz e áudio'],['notifications','bell','Notificações'],['ai','ai','Inteligência artificial'],['integrations','git','Integrações'],['account','user','Minha conta'],['about','info','Sobre o ConTALK']] as const).map(([id,icon,label])=><button key={id} aria-current={tab===id?'page':undefined} className={tab===id?'active':''} onClick={()=>{setTab(id);setError('')}}><ControlIcon name={icon}/>{label}</button>)}</nav><button className="ct-settings-back" onClick={onClose}><ControlIcon name="back"/> Voltar ao ConTALK</button></aside>
    <div className="ct-settings-content"><header className="ct-settings-heading"><div><span className="ct-eyebrow">Configurações do usuário</span><h1>{tab==='appearance'?'Aparência':tab==='audio'?'Voz e áudio':tab==='account'?'Minha conta':tab==='notifications'?'Notificações':tab==='ai'?'Inteligência artificial':tab==='integrations'?'Integrações e Serviços Externos':'Sobre o ConTALK'}</h1><p>{tab==='appearance'?'Tema, escala e leitura do aplicativo.':tab==='audio'?'Seu microfone, sua voz, seus dispositivos.':tab==='account'?'Um perfil com a sua cara.':tab==='notifications'?'Acompanhe o que acontece, do seu jeito.':tab==='ai'?'Sua chave e seus limites de uso da IA.':tab==='integrations'?'Login direto com GitHub, Atlassian (Jira/Confluence) e provedores.':'Boas conversas começam aqui.'}</p></div><button className="ct-settings-close" aria-label="Fechar configurações" onClick={onClose}><ControlIcon name="close"/><small>ESC</small></button></header>
    {tab==='appearance'&&<>
      <div className={`ct-theme-feature ${preferences.theme==='vice-city'?'coastal':'midnight'}`}>{preferences.theme==='vice-city'&&<CoastalScene/>}<div><span className="ct-eyebrow">{preferences.theme==='vice-city'?'Um novo horizonte':'O seu ponto de encontro'}</span><h2>{preferences.theme==='vice-city'?'Fim de tarde em Vice City.':'A noite é nossa.'}</h2><p>{preferences.theme==='vice-city'?'Céu de pêssego. Mar tranquilo. Conversas sem pressa.':'O roxo e a noite que já fazem parte do ConTALK.'}</p><span className="ct-feature-tag">{preferences.theme==='vice-city'?'VICE CITY · PÔR DO SOL':'CONTALK · CLÁSSICO'}</span></div></div>
      <div className="ct-settings-section-title"><h2>Tema do aplicativo</h2><span>Aplicado apenas à sua conta neste dispositivo</span></div>
      <div className="ct-theme-options" role="radiogroup" aria-label="Tema do aplicativo">{([['classic','ConTALK clássico','Preto neutro e minimalista, no estilo do Codex.'],['vice-city','Vice City','Inspirado no GTA VI: litoral, pôr do sol e cores foscas.']] as [Theme,string,string][]).map(([theme,title,description])=><label className={`ct-theme-choice ${theme} ${preferences.theme===theme?'selected':''}`} key={theme}><input type="radio" name="theme" value={theme} checked={preferences.theme===theme} onChange={()=>update({theme})}/><div className="ct-theme-mini">{theme==='vice-city'?<CoastalScene/>:<span className="ct-mini-moon"/>}<div className="ct-mini-sidebar"><i/><i/><i/></div><div className="ct-mini-panel"><b/><i/><i/></div></div><div className="ct-theme-caption"><span><strong>{title}</strong><small>{description}</small></span><span className="ct-radio-dot" aria-hidden="true">{preferences.theme===theme&&<ControlIcon name="check" size={12}/>}</span></div></label>)}</div>
      <section className="ct-settings-preferences"><div className="ct-setting-row ct-density-row"><span><strong>Escala da interface</strong><small>Menor: mais conteúdo na tela. Maior: textos, botões e painéis maiores.</small></span><DensityControl value={preferences.interfaceScale} onChange={value=>update({interfaceScale:value})}/></div><label className="ct-setting-row"><span><strong>Reduzir animações</strong><small>Movimentos mais discretos ao abrir telas e menus.</small></span><input type="checkbox" checked={preferences.reducedMotion} onChange={e=>update({reducedMotion:e.target.checked})}/></label><label className="ct-setting-row"><span><strong>Tamanho do texto</strong><small>Ajuste a leitura de mensagens e listas.</small></span><select aria-label="Tamanho do texto" value={preferences.textSize} onChange={e=>update({textSize:Number(e.target.value) as 100|110|120})}><option value={100}>Padrão · 100%</option><option value={110}>Maior · 110%</option><option value={120}>Grande · 120%</option></select></label></section>
      <p className="ct-settings-saved" role="status"><ControlIcon name="check" size={14}/> Suas preferências são salvas automaticamente.</p>
      <section className="ct-settings-preferences" aria-label="Atalhos da barra de título">
        <div className="ct-settings-section-title"><h2>Barra de título</h2><span>Escolha os atalhos exibidos ao lado do sino.</span></div>
        <label className="ct-setting-row"><span><strong>Mostrar busca</strong><small>O atalho Ctrl+K continua disponível com o ícone oculto.</small></span><input type="checkbox" checked={preferences.titleBarSearch} onChange={e=>update({titleBarSearch:e.target.checked})}/></label>
        <label className="ct-setting-row"><span><strong>Mostrar ajuda</strong><small>O atalho F1 continua disponível com o ícone oculto.</small></span><input type="checkbox" checked={preferences.titleBarHelp} onChange={e=>update({titleBarHelp:e.target.checked})}/></label>
      </section>
    </>}
    {tab==='ai'&&<AiSettings key={user.username}/>}
    {tab==='audio'&&<AudioSettings embedded onClose={()=>setTab('appearance')}/>}
    {tab==='notifications'&&<section className="ct-settings-preferences"><label className="ct-setting-row"><span><strong>Notificações do sistema</strong><small>Receba avisos de mensagens, amizades e atividade da chamada fora da área que você está lendo.</small></span><input type="checkbox" checked={preferences.systemNotifications} onChange={e=>update({systemNotifications:e.target.checked})}/></label><label className="ct-setting-row"><span><strong>Destacar menções de cargos e de todos</strong><small>Identifique quando uma mensagem chama seus cargos, @everyone ou @here. Os avisos gerais de mensagens seguem a opção acima.</small></span><input type="checkbox" checked={preferences.roleMentionNotifications} onChange={e=>update({roleMentionNotifications:e.target.checked})}/></label><p className="ct-settings-saved">O sino e os contadores de mensagens continuam disponíveis quando os avisos do sistema estão desativados.</p></section>}
    {tab==='integrations'&&(
      <section className="ct-settings-preferences" aria-label="Integrações e Serviços Externos">
        <div className="ct-settings-section-title">
          <h2>Hub de Serviços Externos e Login Direto</h2>
          <span>Vincule suas ferramentas de trabalho com login direto de 1 clique, sem complexidade de chaves ou tokens manuais.</span>
        </div>

        <div className="ct-integrations-grid">
          {/* GitHub Card */}
          <div className="ct-integration-card">
            <div className="ct-integration-card-header">
              <div className="ct-integration-title">
                <ControlIcon name="git" size={18}/>
                <strong>GitHub</strong>
              </div>
              <span className={devStore.githubAccounts.length > 0 ? "ct-badge-connected" : "ct-badge-disconnected"}>
                {devStore.githubAccounts.length > 0 ? `${devStore.githubAccounts.length} conta(s) vinculada(s)` : 'Não Conectado'}
              </span>
            </div>
            <p className="ct-integration-card-desc">
              Acesso a repositórios privados e públicos, pull requests, issues e sincronização automática com seu perfil.
            </p>
            <div className="ct-integration-actions">
              {devStore.detectedLocalGitHub ? (
                <button
                  type="button"
                  className="ct-primary ct-direct-login-btn"
                  onClick={() => void devStore.connectGitHubDirect()}
                >
                  <ControlIcon name="git" size={14}/>
                  <span>Conectar @{devStore.detectedLocalGitHub.username} (1-Clique)</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="ct-primary ct-direct-login-btn"
                  onClick={() => void devStore.connectGitHubDirect()}
                >
                  <ControlIcon name="git" size={14}/>
                  <span>Login Direto com GitHub</span>
                </button>
              )}
            </div>
          </div>

          {/* Atlassian Card */}
          <div className="ct-integration-card">
            <div className="ct-integration-card-header">
              <div className="ct-integration-title">
                <ControlIcon name="settings" size={18}/>
                <strong>Atlassian (Jira & Confluence)</strong>
              </div>
              <span className={devStore.atlassian?.connected ? "ct-badge-connected" : "ct-badge-disconnected"}>
                {devStore.atlassian?.connected ? 'Conectado ✓' : 'Não Conectado'}
              </span>
            </div>
            <p className="ct-integration-card-desc">
              Importação contínua de tickets no Quadro Kanban/Tarefas e documentações do Confluence na Central de Documentos.
            </p>
            <div className="ct-integration-actions">
              <button
                type="button"
                className="ct-primary ct-direct-login-btn"
                onClick={() => void devStore.connectAtlassianDirect()}
              >
                <ControlIcon name="settings" size={14}/>
                <span>{devStore.atlassian?.connected ? 'Sincronizar Atlassian Cloud' : 'Login Direto Atlassian (1-Clique)'}</span>
              </button>
              {devStore.atlassian?.connected && (
                <button
                  type="button"
                  className="ct-secondary"
                  onClick={() => devStore.disconnectAtlassian()}
                >
                  Desconectar
                </button>
              )}
            </div>
          </div>

          {/* AI Providers Card */}
          <div className="ct-integration-card">
            <div className="ct-integration-card-header">
              <div className="ct-integration-title">
                <ControlIcon name="ai" size={18}/>
                <strong>Modelos e Provedores de IA</strong>
              </div>
              <span className="ct-badge-connected">Ativo</span>
            </div>
            <p className="ct-integration-card-desc">
              OpenAI (GPT-4o, DALL-E), Anthropic Claude, Google Gemini e servidores MCP prontos para inferência e desenvolvimento.
            </p>
            <div className="ct-integration-actions">
              <button
                type="button"
                className="ct-secondary"
                onClick={() => setTab('ai')}
              >
                <ControlIcon name="ai" size={14}/>
                <span>Gerenciar Provedores de IA</span>
              </button>
            </div>
          </div>

          {/* Coolify / VPS Card */}
          <div className="ct-integration-card">
            <div className="ct-integration-card-header">
              <div className="ct-integration-title">
                <ControlIcon name="rocket" size={18}/>
                <strong>Deploy Contínuo (Coolify)</strong>
              </div>
              <span className="ct-badge-connected">Deploy Automático ✓</span>
            </div>
            <p className="ct-integration-card-desc">
              Infraestrutura de alta disponibilidade com deploy contínuo automático disparado a cada merge na branch main.
            </p>
          </div>
        </div>
      </section>
    )}
    {tab==='account'&&<section className="ct-settings-profile"><Avatar name={user.display_name} identity={user.username} large/><h2>{user.display_name}</h2><p>@{user.username}</p><dl><div><dt>E-mail</dt><dd>{user.email}</dd></div><div><dt>Sobre mim</dt><dd>{user.bio||'Você ainda não adicionou uma descrição.'}</dd></div></dl><button className="ct-primary" onClick={onEditProfile}>Editar perfil e foto</button></section>}
    {tab==='about'&&<section className="ct-settings-about"><BrandMark/><h2>ConTALK</h2><span className="ct-pill">Versão {import.meta.env.VITE_APP_VERSION}</span><p>Seu espaço para conversar, jogar e ficar perto de quem importa.</p>{window.contalkDesktop?.checkForUpdates&&<button className="ct-primary" disabled={checking} onClick={async()=>{setChecking(true);try{const state=await window.contalkDesktop!.checkForUpdates();setUpdateMessage(state.status==='available'?`A versão ${state.version} está disponível no aviso de atualização.`:state.status==='error'?state.error||'Não foi possível verificar.':state.status==='idle'?'Você está na versão mais recente.':'Verificação iniciada. Acompanhe o aviso de atualização.')}catch{setUpdateMessage('Não foi possível verificar. Tente novamente.')}finally{setChecking(false)}}}>{checking?'Verificando...':'Verificar atualizações'}</button>}<p role="status">{updateMessage}</p></section>}
    {error&&<p className="ct-settings-error" role="alert">{error}</p>}
    </div>
  </section>
}
