import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTypescript } from './load-typescript.mjs'

test('devStore initializes repositories and handles repository selection', () => {
  let state = {}
  const mockSet = (updater) => {
    state = typeof updater === 'function' ? { ...state, ...updater(state) } : { ...state, ...updater }
  }
  const mockGet = () => state

  const mockLocalStorage = {
    getItem: () => null,
    setItem: () => {}
  }

  const { useDevStore } = loadTypescript('src/store/useDevStore.ts', {
    zustand: {
      create: (fn) => {
        state = fn(mockSet, mockGet)
        return {
          getState: mockGet,
          setState: mockSet,
          subscribe: () => () => {}
        }
      }
    }
  }, {
    localStorage: mockLocalStorage,
    window: {}
  })

  const current = useDevStore.getState()
  assert.ok(Array.isArray(current.repositories))
  assert.ok(current.repositories.length >= 1)

  // Test selecting a repository
  current.setSelectedRepoId('repo-contalk')
  assert.equal(useDevStore.getState().selectedRepoId, 'repo-contalk')
  current.setSelectedRepoId(null)
  assert.equal(useDevStore.getState().selectedRepoId, null)
})

test('devStore.cloneRepository checks desktop bridge and handles command execution', async () => {
  let state = {}
  const mockSet = (updater) => {
    state = typeof updater === 'function' ? { ...state, ...updater(state) } : { ...state, ...updater }
  }
  const mockGet = () => state

  const mockLocalStorage = {
    getItem: () => null,
    setItem: () => {}
  }

  let executedCommand = ''
  const mockWindow = {
    contalkDesktop: {
      workspaceExecCommand: async (cmd) => {
        executedCommand = cmd
        return { exitCode: 0, stdout: 'Cloning into...', stderr: '' }
      }
    }
  }

  const { useDevStore } = loadTypescript('src/store/useDevStore.ts', {
    zustand: {
      create: (fn) => {
        state = fn(mockSet, mockGet)
        return {
          getState: mockGet,
          setState: mockSet,
          subscribe: () => () => {}
        }
      }
    }
  }, {
    localStorage: mockLocalStorage,
    window: mockWindow
  })

  const testRepo = {
    id: 'test-1',
    name: 'transcribr',
    fullName: 'wastercaliari/transcribr',
    owner: 'wastercaliari',
    isPrivate: false,
    htmlUrl: 'https://github.com/wastercaliari/transcribr',
    defaultBranch: 'main',
    updatedAt: new Date().toISOString(),
    accountId: 'acc-1',
    cloneUrl: 'https://github.com/wastercaliari/transcribr.git'
  }

  const result = await useDevStore.getState().cloneRepository(testRepo)
  assert.equal(result.success, true)
  assert.equal(result.path, 'transcribr')
  assert.ok(executedCommand.includes('git clone https://github.com/wastercaliari/transcribr.git "transcribr"'))
})

test('devStore.syncAllRepositories synchronizes repositories from desktop gh CLI', async () => {
  let state = {}
  const mockSet = (updater) => {
    state = typeof updater === 'function' ? { ...state, ...updater(state) } : { ...state, ...updater }
  }
  const mockGet = () => state

  const mockLocalStorage = {
    getItem: () => null,
    setItem: () => {}
  }

  const fakeGhRepos = [
    {
      id: 'R_123',
      name: 'transcribr',
      nameWithOwner: 'wastercaliari/transcribr',
      isPrivate: false,
      description: 'Audio transcriber',
      url: 'https://github.com/wastercaliari/transcribr',
      defaultBranchRef: { name: 'main' },
      updatedAt: '2026-10-26T12:00:00Z',
      primaryLanguage: { name: 'JavaScript' },
      stargazerCount: 5,
      sshUrl: 'git@github.com:wastercaliari/transcribr.git'
    },
    {
      id: 'R_456',
      name: 'fidc-manager',
      nameWithOwner: 'wastercaliari/fidc-manager',
      isPrivate: true,
      description: 'Financial dashboard',
      url: 'https://github.com/wastercaliari/fidc-manager',
      defaultBranchRef: { name: 'main' },
      updatedAt: '2026-10-25T15:00:00Z',
      primaryLanguage: { name: 'HTML' },
      stargazerCount: 0,
      sshUrl: 'git@github.com:wastercaliari/fidc-manager.git'
    }
  ]

  const mockWindow = {
    contalkDesktop: {
      workspaceExecCommand: async (cmd) => {
        if (cmd.includes('gh repo list')) {
          return { exitCode: 0, stdout: JSON.stringify(fakeGhRepos), stderr: '' }
        }
        if (cmd.includes('gh auth token')) {
          return { exitCode: 0, stdout: 'mock-gh-token', stderr: '' }
        }
        return { exitCode: 1, stdout: '', stderr: 'unknown' }
      }
    }
  }

  const { useDevStore } = loadTypescript('src/store/useDevStore.ts', {
    zustand: {
      create: (fn) => {
        state = fn(mockSet, mockGet)
        return {
          getState: mockGet,
          setState: mockSet,
          subscribe: () => () => {}
        }
      }
    }
  }, {
    localStorage: mockLocalStorage,
    window: mockWindow,
    fetch: async () => ({
      ok: true,
      json: async () => ({ login: 'wastercaliari', name: 'Waster Caliari', avatar_url: 'https://avatar.url' })
    })
  })

  // Set account to wastercaliari
  useDevStore.setState({
    githubAccounts: [
      { id: 'acc-waster', username: 'wastercaliari', addedAt: Date.now() }
    ],
    activeAccountId: 'acc-waster'
  })

  await useDevStore.getState().syncAllRepositories()

  const updatedState = useDevStore.getState()
  assert.equal(updatedState.loadingRepos, false)
  assert.ok(updatedState.lastReposSync !== null)
  assert.equal(updatedState.repositories.length, 2)
  assert.equal(updatedState.repositories[0].name, 'transcribr')
  assert.equal(updatedState.repositories[0].language, 'JavaScript')
  assert.equal(updatedState.repositories[0].isPrivate, false)
  assert.equal(updatedState.repositories[1].name, 'fidc-manager')
  assert.equal(updatedState.repositories[1].isPrivate, true)
})
