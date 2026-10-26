import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'

const derive = promisify(scrypt)
const digest = value => createHash('sha256').update(value).digest('hex')
const USERNAME = /^[a-z0-9_-]{3,32}$/
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/
const MAX_SESSIONS = 10

export class AccountError extends Error { constructor(status, message) { super(message); this.status = status } }
const need = (condition, status, message) => { if (!condition) throw new AccountError(status, message) }

// The server is the only place accounts exist; the desktop app keeps just the session key and a profile cache.
// Accounts live in their own file beside community.json so logins never rewrite the chat history.
// shortcut: failure counters are per process and in memory; a restart clears them, move them to disk only if abuse shows up.
export function createAccounts({ file } = {}) {
  let data = { accounts: {}, sessions: {} }
  if (file && fs.existsSync(file)) data = JSON.parse(fs.readFileSync(file, 'utf8'))
  const attempts = new Map(), signups = new Map()
  const save = () => {
    if (!file) return
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const temporary = file + '.' + randomBytes(6).toString('hex') + '.tmp'
    try {
      const descriptor = fs.openSync(temporary, 'wx', 0o600)
      try { fs.writeFileSync(descriptor, JSON.stringify(data)); fs.fsyncSync(descriptor) } finally { fs.closeSync(descriptor) }
      fs.renameSync(temporary, file)
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary) }
  }
  const hash = async (password, salt) => (await derive(password, salt, 64)).toString('hex')
  const throttle = (map, key, limit, windowMs) => {
    const now = Date.now(), entry = map.get(key)
    if (!entry || entry.until < now) {
      if (map.size > 10000) for (const [old, value] of map) if (value.until < now) map.delete(old)
      map.set(key, { count: 1, until: now + windowMs }); return
    }
    need(++entry.count <= limit, 429, 'Muitas tentativas. Aguarde alguns minutos.')
  }
  const startSession = username => {
    const token = randomBytes(32).toString('hex')
    const mine = Object.entries(data.sessions).filter(([, session]) => session.username === username).sort((a, b) => a[1].createdAt - b[1].createdAt)
    for (const [id] of mine.slice(0, Math.max(0, mine.length - MAX_SESSIONS + 1))) delete data.sessions[id]
    data.sessions[digest(token)] = { username, createdAt: Date.now() }
    return token
  }
  const password = value => need(typeof value === 'string' && value.length >= 8 && value.length <= 200, 400, 'A senha precisa ter de 8 a 200 caracteres.')
  const byEmail = email => Object.keys(data.accounts).find(name => data.accounts[name].email === email)
  return {
    has: username => Object.hasOwn(data.accounts, String(username).toLowerCase()),
    async register(username, email, secret, client, taken = () => false) {
      need(typeof username === 'string' && USERNAME.test(username.toLowerCase()), 400, 'Use de 3 a 32 letras, números, _ ou - no nome de usuário.')
      need(typeof email === 'string' && EMAIL.test(email.trim()), 400, 'Informe um e-mail válido.')
      password(secret)
      const name = username.toLowerCase(), mail = email.trim().toLowerCase()
      throttle(signups, client, 10, 3600000)
      const free = () => {
        need(!Object.hasOwn(data.accounts, name) && !taken(name), 409, 'Este nome de usuário já está em uso.')
        need(!byEmail(mail), 409, 'Este e-mail já está em uso.')
      }
      free()
      const salt = randomBytes(16).toString('hex')
      const hashed = await hash(secret, salt)
      free()
      data.accounts[name] = { email: mail, salt, hash: hashed, createdAt: Date.now() }
      const token = startSession(name)
      save()
      return { username: name, email: mail, token }
    },
    // The identifier is the username or the e-mail, like the sign-in screen.
    async login(identifier, secret, client) {
      need(typeof identifier === 'string' && identifier.trim().length > 0 && identifier.length <= 260, 400, 'Informe seu usuário ou e-mail.')
      password(secret)
      const key = identifier.trim().toLowerCase(), name = key.includes('@') ? byEmail(key) : key
      throttle(attempts, client + ':' + key, 8, 900000)
      const account = name && Object.hasOwn(data.accounts, name) ? data.accounts[name] : null
      need(account, 404, 'Conta não encontrada. Crie uma conta para entrar.')
      const actual = Buffer.from(await hash(secret, account.salt)), expected = Buffer.from(account.hash)
      need(actual.length === expected.length && timingSafeEqual(actual, expected), 401, 'Senha incorreta.')
      attempts.delete(client + ':' + key)
      const token = startSession(name)
      save()
      return { username: name, email: account.email, token }
    },
    authenticate: token => { const session = data.sessions[digest(token)]; return session && Object.hasOwn(data.accounts, session.username) ? session.username : undefined },
    revoke(token) { const id = digest(token); if (Object.hasOwn(data.sessions, id)) { delete data.sessions[id]; save() } },
  }
}
