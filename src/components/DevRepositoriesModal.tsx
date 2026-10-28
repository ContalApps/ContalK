import { useState, useMemo } from 'react'
import { useDevStore, type GitHubRepo } from '../store/useDevStore'
import { ControlIcon } from './ControlIcon'

interface DevRepositoriesModalProps {
  onClose: () => void
  onOpenAccounts?: () => void
}

const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  'C#': '#178600',
  Python: '#3572A5',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  PHP: '#4F5D95',
  Ruby: '#701516',
  Markdown: '#083fa1',
  Shell: '#89e051'
}

export function DevRepositoriesModal({ onClose, onOpenAccounts }: DevRepositoriesModalProps) {
  const {
    repositories,
    loadingRepos,
    lastReposSync,
    syncAllRepositories,
    cloneRepository,
    githubAccounts,
    selectedRepoId,
    setSelectedRepoId,
    detectedLocalGitHub,
    connectGitHubDirect,
    githubError
  } = useDevStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all')
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all')
  const [sortMode, setSortMode] = useState<'updated' | 'name' | 'stars'>('updated')

  const [copiedId, setCopiedId] = useState<string | number | null>(null)
  const [cloningId, setCloningId] = useState<string | number | null>(null)
  const [cloneStatus, setCloneStatus] = useState<{ id: string | number; message: string; isError?: boolean } | null>(null)

  // Unique languages for filter pills/dropdown
  const availableLanguages = useMemo(() => {
    const set = new Set<string>()
    repositories.forEach(r => {
      if (r.language) set.add(r.language)
    })
    return Array.from(set).sort()
  }, [repositories])

  // Filtered and sorted repositories
  const filteredRepositories = useMemo(() => {
    return repositories.filter(repo => {
      // Account filter
      if (accountFilter !== 'all' && repo.accountId !== accountFilter) {
        return false
      }
      // Visibility filter
      if (visibilityFilter === 'public' && repo.isPrivate) return false
      if (visibilityFilter === 'private' && !repo.isPrivate) return false

      // Language filter
      if (selectedLanguage !== 'all' && repo.language !== selectedLanguage) return false

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchName = repo.name.toLowerCase().includes(query)
        const matchFull = repo.fullName.toLowerCase().includes(query)
        const matchDesc = (repo.description || '').toLowerCase().includes(query)
        const matchLang = (repo.language || '').toLowerCase().includes(query)
        const matchOwner = repo.owner.toLowerCase().includes(query)
        if (!matchName && !matchFull && !matchDesc && !matchLang && !matchOwner) {
          return false
        }
      }
      return true
    }).sort((a, b) => {
      if (sortMode === 'name') {
        return a.name.localeCompare(b.name)
      }
      if (sortMode === 'stars') {
        return (b.stars || 0) - (a.stars || 0)
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }, [repositories, accountFilter, visibilityFilter, selectedLanguage, searchQuery, sortMode])

  const handleCopyUrl = async (repo: GitHubRepo, e: React.MouseEvent) => {
    e.stopPropagation()
    const url = repo.cloneUrl || (repo.htmlUrl.endsWith('.git') ? repo.htmlUrl : `${repo.htmlUrl}.git`)
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(repo.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      /* ignore */
    }
  }

  const handleCloneRepo = async (repo: GitHubRepo, e: React.MouseEvent) => {
    e.stopPropagation()
    setCloningId(repo.id)
    setCloneStatus(null)
    const result = await cloneRepository(repo)
    setCloningId(null)
    if (result.success) {
      setCloneStatus({
        id: repo.id,
        message: `Repositório clonado com sucesso em ./${result.path}!`,
        isError: false
      })
    } else {
      setCloneStatus({
        id: repo.id,
        message: result.error || 'Falha ao clonar repositório.',
        isError: true
      })
    }
  }

  const formatRelativeDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const diffMs = Date.now() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMins / 60)
      const diffDays = Math.floor(diffHours / 24)

      if (diffMins < 2) return 'agora há pouco'
      if (diffMins < 60) return `há ${diffMins} min`
      if (diffHours < 24) return `há ${diffHours} hora${diffHours === 1 ? '' : 's'}`
      if (diffDays === 1) return 'ontem'
      if (diffDays < 30) return `há ${diffDays} dias`
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="ct-modal-backdrop" onClick={onClose}>
      <section
        className="ct-dev-modal-panel ct-repos-dialog"
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <header className="ct-dev-modal-header">
          <div>
            <h2>
              <ControlIcon name="git-branch" size={17}/>
              <span>Repositórios</span>
              <span className="ct-repos-total-count">{filteredRepositories.length} de {repositories.length}</span>
            </h2>
            <p>
              {lastReposSync
                ? `Sincronizado às ${new Date(lastReposSync).toLocaleTimeString('pt-BR')} com suas contas GitHub.`
                : 'Sincronizado com suas contas GitHub e ambiente local.'}
            </p>
          </div>

          <div className="ct-dev-header-actions">
            <button
              type="button"
              className={`ct-refresh-btn ${loadingRepos ? 'is-loading' : ''}`}
              onClick={() => void syncAllRepositories()}
              disabled={loadingRepos}
              title="Sincronizar todos os repositórios com o GitHub"
            >
              <ControlIcon name="refresh" size={13}/>
              <span>{loadingRepos ? 'Sincronizando…' : 'Sincronizar Todas as Contas'}</span>
            </button>

            {onOpenAccounts && (
              <button
                type="button"
                className="ct-secondary"
                onClick={onOpenAccounts}
                title="Gerenciar contas GitHub vinculadas"
              >
                <ControlIcon name="git" size={13}/>
                <span>Contas GitHub</span>
              </button>
            )}

            <button type="button" className="ct-close-btn" onClick={onClose} aria-label="Fechar">
              <ControlIcon name="close" size={14}/>
            </button>
          </div>
        </header>

        {/* Error banner if any */}
        {githubError && (
          <div className="ct-error-banner" style={{ margin: '0 24px 16px' }}>
            <ControlIcon name="alert" size={14}/>
            <span>{githubError}</span>
          </div>
        )}

        {/* Accounts bar / selector */}
        <div className="ct-repos-accounts-bar">
          <span className="ct-repos-bar-label">Contas:</span>
          <div className="ct-repos-accounts-pills">
            <button
              type="button"
              className={`ct-repo-account-pill ${accountFilter === 'all' ? 'active' : ''}`}
              onClick={() => setAccountFilter('all')}
            >
              <span>Todas as Contas</span>
              <span className="ct-pill-badge">{repositories.length}</span>
            </button>

            {githubAccounts.map(acc => {
              const count = repositories.filter(r => r.accountId === acc.id).length
              return (
                <button
                  key={acc.id}
                  type="button"
                  className={`ct-repo-account-pill ${accountFilter === acc.id ? 'active' : ''}`}
                  onClick={() => setAccountFilter(acc.id)}
                >
                  {acc.avatarUrl ? (
                    <img src={acc.avatarUrl} alt="" className="ct-repo-account-avatar"/>
                  ) : (
                    <ControlIcon name="git" size={12}/>
                  )}
                  <span>@{acc.username}</span>
                  <span className="ct-pill-badge">{count}</span>
                </button>
              )
            })}

            {detectedLocalGitHub && !githubAccounts.some(a => a.username.toLowerCase() === detectedLocalGitHub.username.toLowerCase()) && (
              <button
                type="button"
                className="ct-repo-account-pill ct-detected-pill"
                onClick={() => void connectGitHubDirect()}
                title="Conectar sua conta local detectada em 1 clique"
              >
                <ControlIcon name="git" size={12}/>
                <span>⚡ Conectar @{detectedLocalGitHub.username} (1-Clique)</span>
              </button>
            )}
          </div>
        </div>

        {/* Search, Filter and Sort Toolbar */}
        <div className="ct-repos-toolbar">
          <div className="ct-repos-search-wrap">
            <ControlIcon name="search" size={14}/>
            <input
              type="text"
              placeholder="Buscar por nome, descrição, linguagem ou proprietário…"
              className="ct-repos-search-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className="ct-search-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Limpar busca"
              >
                <ControlIcon name="close" size={11}/>
              </button>
            )}
          </div>

          <div className="ct-repos-filter-group">
            {/* Visibility filter */}
            <div className="ct-repos-segmented-control">
              <button
                type="button"
                className={visibilityFilter === 'all' ? 'active' : ''}
                onClick={() => setVisibilityFilter('all')}
              >
                Todos
              </button>
              <button
                type="button"
                className={visibilityFilter === 'public' ? 'active' : ''}
                onClick={() => setVisibilityFilter('public')}
              >
                Públicos
              </button>
              <button
                type="button"
                className={visibilityFilter === 'private' ? 'active' : ''}
                onClick={() => setVisibilityFilter('private')}
              >
                Privados
              </button>
            </div>

            {/* Language filter dropdown */}
            {availableLanguages.length > 0 && (
              <select
                className="ct-repos-select"
                value={selectedLanguage}
                onChange={e => setSelectedLanguage(e.target.value)}
                aria-label="Filtrar por linguagem"
              >
                <option value="all">Todas as linguagens</option>
                {availableLanguages.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            )}

            {/* Sort order */}
            <select
              className="ct-repos-select"
              value={sortMode}
              onChange={e => setSortMode(e.target.value as any)}
              aria-label="Ordenar repositórios"
            >
              <option value="updated">Mais recentes</option>
              <option value="name">Nome (A-Z)</option>
              <option value="stars">Mais estrelas</option>
            </select>
          </div>
        </div>

        {/* Repositories List / Grid */}
        <div className="ct-repos-content">
          {filteredRepositories.length === 0 ? (
            <div className="ct-repos-empty">
              <ControlIcon name="git-branch" size={32}/>
              <h3>Nenhum repositório encontrado</h3>
              <p>
                {searchQuery || visibilityFilter !== 'all' || selectedLanguage !== 'all'
                  ? 'Nenhum repositório corresponde aos filtros selecionados.'
                  : 'Vincule sua conta GitHub para carregar e sincronizar seus repositórios no ConTALK Studio.'}
              </p>
              {(searchQuery || visibilityFilter !== 'all' || selectedLanguage !== 'all') ? (
                <button
                  type="button"
                  className="ct-secondary"
                  onClick={() => {
                    setSearchQuery('')
                    setVisibilityFilter('all')
                    setSelectedLanguage('all')
                    setAccountFilter('all')
                  }}
                >
                  Limpar todos os filtros
                </button>
              ) : (
                <button
                  type="button"
                  className="ct-primary"
                  onClick={() => void syncAllRepositories()}
                >
                  <ControlIcon name="refresh" size={13}/>
                  <span>Sincronizar Agora</span>
                </button>
              )}
            </div>
          ) : (
            <div className="ct-repos-grid">
              {filteredRepositories.map(repo => {
                const isSelected = selectedRepoId === repo.id
                const isCopied = copiedId === repo.id
                const isCloning = cloningId === repo.id
                const thisCloneStatus = cloneStatus?.id === repo.id ? cloneStatus : null
                const langColor = repo.language ? (LANGUAGE_COLORS[repo.language] || '#8b949e') : undefined

                return (
                  <article
                    key={repo.id}
                    className={`ct-repo-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => setSelectedRepoId(isSelected ? null : repo.id)}
                  >
                    {/* Card Top Row */}
                    <div className="ct-repo-card-header">
                      <div className="ct-repo-card-title-group">
                        <ControlIcon name={repo.isPrivate ? 'lock' : 'git-branch'} size={15}/>
                        <h4 className="ct-repo-card-name" title={repo.fullName}>{repo.name}</h4>
                      </div>

                      <div className="ct-repo-badges">
                        <span className={`ct-repo-badge ${repo.isPrivate ? 'is-private' : 'is-public'}`}>
                          {repo.isPrivate ? 'Privado' : 'Público'}
                        </span>
                        {repo.stars !== undefined && repo.stars > 0 && (
                          <span className="ct-repo-stars-badge" title={`${repo.stars} estrelas no GitHub`}>
                            ★ {repo.stars}
                          </span>
                        )}
                        <span className="ct-repo-branch-badge" title={`Branch padrão: ${repo.defaultBranch}`}>
                          {repo.defaultBranch}
                        </span>
                      </div>
                    </div>

                    {/* Full Name & Owner */}
                    <div className="ct-repo-card-owner">
                      <span>{repo.fullName}</span>
                    </div>

                    {/* Description */}
                    <p className="ct-repo-card-desc">
                      {repo.description || <span className="ct-desc-placeholder">Sem descrição informada</span>}
                    </p>

                    {/* Metadata Footer */}
                    <div className="ct-repo-card-meta">
                      {repo.language && (
                        <span className="ct-repo-lang-pill">
                          <span className="ct-repo-lang-dot" style={{ backgroundColor: langColor }}/>
                          <span>{repo.language}</span>
                        </span>
                      )}
                      <span className="ct-repo-updated" title={`Atualizado em ${repo.updatedAt}`}>
                        Atualizado {formatRelativeDate(repo.updatedAt)}
                      </span>
                    </div>

                    {/* Clone feedback message if any */}
                    {thisCloneStatus && (
                      <div className={`ct-repo-clone-status ${thisCloneStatus.isError ? 'is-error' : 'is-success'}`}>
                        <ControlIcon name={thisCloneStatus.isError ? 'alert' : 'check'} size={12}/>
                        <span>{thisCloneStatus.message}</span>
                      </div>
                    )}

                    {/* Expanded Detail Panel */}
                    {isSelected && (
                      <div className="ct-repo-expanded-details" onClick={e => e.stopPropagation()}>
                        <div className="ct-repo-clone-urls">
                          <label>Comando de Clone:</label>
                          <div className="ct-repo-cmd-box">
                            <code>git clone {repo.cloneUrl || repo.htmlUrl + '.git'}</code>
                            <button
                              type="button"
                              className="ct-copy-cmd-btn"
                              onClick={e => void handleCopyUrl(repo, e)}
                              title="Copiar comando de clone"
                            >
                              <ControlIcon name={isCopied ? 'check' : 'copy'} size={12}/>
                              <span>{isCopied ? 'Copiado!' : 'Copiar'}</span>
                            </button>
                          </div>
                        </div>

                        <div className="ct-repo-quick-links">
                          <a href={`${repo.htmlUrl}/commits`} target="_blank" rel="noreferrer" className="ct-repo-quick-link">
                            <ControlIcon name="git-commit" size={12}/>
                            <span>Commits</span>
                          </a>
                          <a href={`${repo.htmlUrl}/branches`} target="_blank" rel="noreferrer" className="ct-repo-quick-link">
                            <ControlIcon name="git-branch" size={12}/>
                            <span>Branches</span>
                          </a>
                          <a href={`${repo.htmlUrl}/pulls`} target="_blank" rel="noreferrer" className="ct-repo-quick-link">
                            <ControlIcon name="git-pr" size={12}/>
                            <span>Pull Requests</span>
                          </a>
                          <a href={`${repo.htmlUrl}/issues`} target="_blank" rel="noreferrer" className="ct-repo-quick-link">
                            <ControlIcon name="git-issue" size={12}/>
                            <span>Issues</span>
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Card Actions */}
                    <div className="ct-repo-card-actions" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        className="ct-repo-action-btn"
                        onClick={() => window.open(repo.htmlUrl, '_blank')}
                        title="Abrir página do repositório no GitHub"
                      >
                        <ControlIcon name="arrow" size={13}/>
                        <span>Ver no GitHub</span>
                      </button>

                      <button
                        type="button"
                        className="ct-repo-action-btn"
                        onClick={e => void handleCopyUrl(repo, e)}
                        title="Copiar link de clone para a área de transferência"
                      >
                        <ControlIcon name={isCopied ? 'check' : 'copy'} size={13}/>
                        <span>{isCopied ? 'URL Copiada!' : 'Copiar URL'}</span>
                      </button>

                      <button
                        type="button"
                        className="ct-repo-action-btn ct-primary-action"
                        onClick={e => void handleCloneRepo(repo, e)}
                        disabled={isCloning}
                        title="Clonar repositório localmente no ConTALK Desktop"
                      >
                        <ControlIcon name="download" size={13}/>
                        <span>{isCloning ? 'Clonando…' : 'Clonar Local'}</span>
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
