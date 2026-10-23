import { roomGrant } from '../shared/livekit-grant.mjs'
import { app, BrowserWindow, ipcMain, desktopCapturer, shell, screen } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { AccessToken } from 'livekit-server-sdk'
import bcrypt from 'bcryptjs'
import { setupStorage } from './storage'
import { setupTray } from './tray'
import { setupUpdates } from './updates'
import { setupCaptureAudio } from './capture-audio'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬ dist-electron
// │ ├── main.js
// │ └── preload.mjs
// ├─┬ dist
// │ └── index.html

process.env.APP_ROOT = path.join(__dirname, '..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = app.isPackaged ? RENDERER_DIST : path.join(process.env.APP_ROOT, 'public')

let win: BrowserWindow | null = null

const LIVEKIT_URL = 'wss://contalk-vwlfqz0q.livekit.cloud'
const LIVEKIT_API_KEY = 'APIoDkLmBTDG5T5'
const LIVEKIT_API_SECRET = 'ahn9v2PgmEIJCxM1QQARYd1j39r76pq4bWrVx7KFcnD'

// Database local de usuários (armazenado em AppData/ContalK/users.json)
function getUsersFilePath(): string {
  const dir = app.getPath('userData')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, 'users.json')
}

interface StoredUser {
  id: string
  username: string
  display_name: string
  email: string
  password_hash: string
  avatar?: string
  bio?: string
  created_at: string
}

function loadUsers(): Record<string, StoredUser> {
  const file = getUsersFilePath()
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'))
    } catch {}
  }
  return {}
}

function saveUsers(users: Record<string, StoredUser>) {
  const file = getUsersFilePath()
  fs.writeFileSync(file, JSON.stringify(users, null, 2), 'utf-8')
}

function publicUser(u: StoredUser) { const { password_hash, ...safe } = u; return safe }
function isLegacyDemo(u: StoredUser) { return ['alice','bob','carol','dave'].includes(u.username) && u.id === 'usr_' + u.username && u.email === u.username + '@contalk.app' }
let sessionUser: string | null = null
function issueSession(username: string) {
  username = username.toLowerCase()
  sessionUser = username
  const token = randomUUID()
  fs.writeFileSync(path.join(app.getPath('userData'), 'session.json'), JSON.stringify({ username, token }))
  return token
}
ipcMain.handle('auth-session', (_event, token) => {
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'session.json'), 'utf8'))
    const user = loadUsers()[saved.username]
    if (saved.token !== token || !user || isLegacyDemo(user)) return null
    sessionUser = saved.username
    return publicUser(user)
  } catch { return null }
})
ipcMain.handle('auth-logout', () => { sessionUser = null; fs.writeFileSync(path.join(app.getPath('userData'), 'session.json'), '{}') })
ipcMain.handle('auth-accounts', () => Object.values(loadUsers()).filter(u => !isLegacyDemo(u)).map(publicUser))
ipcMain.handle('auth-profile', (_event, profile) => {
  if (!sessionUser) throw new Error('Entre na sua conta.')
  const users = loadUsers(); const current = users[sessionUser]
  if (!current) throw new Error('Conta não encontrada.')
  if (typeof profile.display_name !== 'string' || !profile.display_name.trim() || profile.display_name.length > 40) throw new Error('Nome inválido.')
  if (typeof profile.bio !== 'string' || profile.bio.length > 240) throw new Error('Descrição inválida.')
  if (typeof profile.avatar !== 'string' || profile.avatar.length > 50000 || (profile.avatar && !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(profile.avatar))) throw new Error('Foto inválida.')
  Object.assign(current, { display_name: profile.display_name.trim(), bio: profile.bio, avatar: profile.avatar })
  saveUsers(users)
  return publicUser(current)
})

function createWindow() {
  const iconPath = path.join(process.env.VITE_PUBLIC!, 'app-icon.png')

  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#0c0a14',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    titleBarStyle: 'default',
    title: 'ContalK',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  setupUpdates(win)
  setupTray(win)
  setupStorage(win,()=>sessionUser)
  setupCaptureAudio(win)

  // Test active push message to Renderer_process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// ─── IPC: Captura Nativa de Tela (Arquitetura Discord) ───────────────
ipcMain.handle('get-desktop-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 360, height: 200 },
      fetchWindowIcons: true,
    })

    return sources.map((s) => ({
      id: s.id, // ex: "screen:0:0" ou "window:12345:0"
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
      appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
      display_id: s.display_id,
      isScreen: s.id.startsWith('screen:'),
      width: Math.round((screen.getAllDisplays().find(d => String(d.id) === s.display_id)?.bounds.width || 1920) * (screen.getAllDisplays().find(d => String(d.id) === s.display_id)?.scaleFactor || 1)),
      height: Math.round((screen.getAllDisplays().find(d => String(d.id) === s.display_id)?.bounds.height || 1080) * (screen.getAllDisplays().find(d => String(d.id) === s.display_id)?.scaleFactor || 1)),
      isPrimary: s.display_id === String(screen.getPrimaryDisplay().id),
    }))
  } catch (err: any) {
    console.error('Falha ao obter desktop sources:', err)
    return []
  }
})

// ─── IPC: Token do LiveKit Cloud ────────────────────────────────────
ipcMain.handle('get-livekit-token', async (_event, { room, identity, name }) => {
  try {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name,
      ttl: 3600 * 24,
    })
    at.addGrant(roomGrant(room))
    return await at.toJwt()
  } catch (err: any) {
    console.error('Erro ao gerar token LiveKit:', err)
    throw new Error(err?.message || 'Falha ao gerar token')
  }
})

// ─── IPC: Autenticação de Usuários ──────────────────────────────────
ipcMain.handle('auth-login', async (_event, { identifier, password }) => {
  const users = loadUsers()
  const lower = identifier.toLowerCase()
  const found = Object.values(users).find(
    (u) => u.username.toLowerCase() === lower || u.email.toLowerCase() === lower
  )

  if (!found || isLegacyDemo(found)) {
    return { type: 'Error', data: 'Usuário ou e-mail não encontrado' }
  }

  const valid = bcrypt.compareSync(password, found.password_hash)
  if (!valid) {
    return { type: 'Error', data: 'Senha incorreta' }
  }

  const userSafe = publicUser(found)

  return {
    type: 'Success',
    data: {
      token: issueSession(found.username),
      user: userSafe,
    },
  }
})

ipcMain.handle('auth-register', async (_event, { username, email, password }) => {
  const users = loadUsers()
  const lower = username.toLowerCase()

  if (users[lower] && !isLegacyDemo(users[lower])) {
    return { type: 'Error', data: 'Nome de usuário já está em uso' }
  }

  const hash = bcrypt.hashSync(password, 10)
  const newUser: StoredUser = {
    id: `usr_${Date.now()}`,
    username,
    display_name: username,
    email,
    password_hash: hash,
    created_at: new Date().toISOString(),
  }

  users[lower] = newUser
  saveUsers(users)

  return {
    type: 'Success',
    data: {
      token: issueSession(newUser.username),
      user: {
        id: newUser.id,
        username: newUser.username,
        display_name: newUser.display_name,
        email: newUser.email,
      },
    },
  }
})

// ─── Ciclo de Vida da Aplicação ─────────────────────────────────────
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
