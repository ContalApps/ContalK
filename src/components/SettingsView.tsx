import { useEffect, useRef, useState } from 'react'
import { usePreferencesStore, type Theme } from '../store/usePreferencesStore'
import { useAuthStore } from '../store/useAuthStore'
import { AudioSettings } from './AudioSettings'
import { Avatar } from './Avatar'
import { CoastalScene } from './CoastalScene'

export function SettingsView({ onClose, onEditProfile }: { onClose: () => void; onEditProfile: () => void }) {
  const preferences = usePreferencesStore()
  const user = useAuthStore(s => s.user)!
  const [tab, setTab] = useState<'appearance' | 'audio' | 'account' | 'about'>('appearance')
  const [error, setError] = useState('')
  const [updateMessage, setUpdateMessage] = useState('')
  const [checking, setChecking] = useState(false)
  const ref = useRef<HTMLElement>(null)
  const previous = useRef(document.activeElement as HTMLElement | null)
  useEffect(() => { ref.current?.querySelector<HTMLButtonElement>('button')?.focus(); return () => previous.current?.focus() }, [])
  const update = (patch: Parameters<typeof preferences.update>[0]) => { try { preferences.update(patch); setError('') } catch { setError('Não foi possível salvar a preferência. Tente novamente.') } }
  return <section className="ct-settings-screen" ref={ref} role="dialog" aria-modal="true" aria-label="Configurações do ContalK" onKeyDown={e => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    if (e.key === 'Tab') { const elements = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select, textarea, [tabindex="0"]')]; const first = elements[0]; const last = elements[elements.length - 1]; if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()} }
  }}>
    <aside className="ct-settings-nav"><div className="ct-settings-account"><Avatar name={user.display_name} identity={user.username}/><span><strong>{user.display_name}</strong><small>Configurações pessoais</small></span></div><span className="ct-eyebrow">SEU CONTALK</span><nav aria-label="Seções de configurações">{([['appearance','◐','Aparência'],['audio','≋','Voz e áudio'],['account','◎','Minha conta'],['about','ⓘ','Sobre o ContalK']] as const).map(([id,icon,label])=><button key={id} aria-current={tab===id?'page':undefined} className={tab===id?'active':''} onClick={()=>{setTab(id);setError('')}}><span aria-hidden="true">{icon}</span>{label}</button>)}</nav><p>Do seu jeito.<br/>Só para você.</p><button className="ct-settings-back" onClick={onClose}>← Voltar ao ContalK</button></aside>
    <div className="ct-settings-content"><header className="ct-settings-heading"><div><span className="ct-eyebrow">CONFIGURAÇÕES DO USUÁRIO</span><h1>{tab==='appearance'?'Aparência':tab==='audio'?'Voz e áudio':tab==='account'?'Minha conta':'Sobre o ContalK'}</h1><p>{tab==='appearance'?'Escolha o clima das suas conversas.':tab==='audio'?'Seu microfone, sua voz, seus dispositivos.':tab==='account'?'Um perfil com a sua cara.':'Boas conversas começam aqui.'}</p></div><button className="ct-settings-close" aria-label="Fechar configurações" onClick={onClose}>×<small>ESC</small></button></header>
    {tab==='appearance'&&<>
      <div className={`ct-theme-feature ${preferences.theme==='vice-city'?'coastal':'midnight'}`}>{preferences.theme==='vice-city'&&<CoastalScene/>}<div><span className="ct-eyebrow">{preferences.theme==='vice-city'?'UM NOVO HORIZONTE':'O SEU PONTO DE ENCONTRO'}</span><h2>{preferences.theme==='vice-city'?'Fim de tarde em Vice City.':'A noite é nossa.'}</h2><p>{preferences.theme==='vice-city'?'Céu de pêssego. Mar tranquilo. Conversas sem pressa.':'O roxo e a noite que já fazem parte do ContalK.'}</p><span className="ct-feature-tag">{preferences.theme==='vice-city'?'VICE CITY · PÔR DO SOL':'CONTALK · CLÁSSICO'}</span></div></div>
      <div className="ct-settings-section-title"><h2>Tema do aplicativo</h2><span>Aplicado apenas à sua conta neste dispositivo</span></div>
      <div className="ct-theme-options" role="radiogroup" aria-label="Tema do aplicativo">{([['classic','ContalK clássico','A identidade original, em tons de roxo.'],['vice-city','Vice City','Inspirado no GTA VI: litoral, pôr do sol e cores foscas.']] as [Theme,string,string][]).map(([theme,title,description])=><label className={`ct-theme-choice ${theme} ${preferences.theme===theme?'selected':''}`} key={theme}><input type="radio" name="theme" value={theme} checked={preferences.theme===theme} onChange={()=>update({theme})}/><div className="ct-theme-mini">{theme==='vice-city'?<CoastalScene/>:<span className="ct-mini-moon"/>}<div className="ct-mini-sidebar"><i/><i/><i/></div><div className="ct-mini-panel"><b/><i/><i/></div></div><div className="ct-theme-caption"><span><strong>{title}</strong><small>{description}</small></span><span className="ct-radio-dot" aria-hidden="true">{preferences.theme===theme?'✓':''}</span></div></label>)}</div>
      <section className="ct-settings-preferences"><label className="ct-setting-row"><span><strong>Reduzir animações</strong><small>Movimentos mais discretos ao abrir telas e menus.</small></span><input type="checkbox" checked={preferences.reducedMotion} onChange={e=>update({reducedMotion:e.target.checked})}/></label><label className="ct-setting-row"><span><strong>Tamanho do texto</strong><small>Ajuste a leitura de mensagens e listas.</small></span><select aria-label="Tamanho do texto" value={preferences.textSize} onChange={e=>update({textSize:Number(e.target.value) as 100|110|120})}><option value={100}>Padrão · 100%</option><option value={110}>Maior · 110%</option><option value={120}>Grande · 120%</option></select></label></section>
      <p className="ct-settings-saved" role="status">✓ Suas preferências são salvas automaticamente.</p>
    </>}
    {tab==='audio'&&<AudioSettings embedded onClose={()=>setTab('appearance')}/>}
    {tab==='account'&&<section className="ct-settings-profile"><Avatar name={user.display_name} identity={user.username} large/><h2>{user.display_name}</h2><p>@{user.username}</p><dl><div><dt>E-mail</dt><dd>{user.email}</dd></div><div><dt>Sobre mim</dt><dd>{user.bio||'Você ainda não adicionou uma descrição.'}</dd></div></dl><button className="ct-primary" onClick={onEditProfile}>Editar perfil e foto</button></section>}
    {tab==='about'&&<section className="ct-settings-about"><img src="./contalk-avatar.png" alt="Morceguinho ContalK"/><h2>ContalK</h2><span className="ct-pill">Versão {import.meta.env.VITE_APP_VERSION}</span><p>Seu espaço para conversar, jogar e ficar perto de quem importa.</p>{window.contalkDesktop?.checkForUpdates&&<button className="ct-primary" disabled={checking} onClick={async()=>{setChecking(true);try{const state=await window.contalkDesktop!.checkForUpdates();setUpdateMessage(state.status==='available'?`A versão ${state.version} está disponível no aviso de atualização.`:state.status==='error'?state.error||'Não foi possível verificar.':state.status==='idle'?'Você está na versão mais recente.':'Verificação iniciada. Acompanhe o aviso de atualização.')}catch{setUpdateMessage('Não foi possível verificar. Tente novamente.')}finally{setChecking(false)}}}>{checking?'Verificando...':'Verificar atualizações'}</button>}<p role="status">{updateMessage}</p></section>}
    {error&&<p className="ct-settings-error" role="alert">{error}</p>}
    </div>
  </section>
}
