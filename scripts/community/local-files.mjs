import fs from 'node:fs'
import path from 'node:path'
import { createHmac, randomBytes, randomUUID, timingSafeEqual, createHash } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import { validFileId } from './files.mjs'

const MAX_UPLOAD_SIZE = 2 * 1024 ** 3

export class FileError extends Error { constructor(status, message) { super(message); this.status = status } }
const need = (condition, status, message) => { if (!condition) throw new FileError(status, message) }
const sign = (key, id, expires, viewer) => createHmac('sha256', key).update(JSON.stringify([id, expires, viewer])).digest('hex')

// Files live on the server's own disk (the community volume). `canRead(actor, id)` is the community's message/channel rule.
// shortcut: links are signed with a per-process key, so a restart only invalidates 15-minute links; persist the key if that ever matters.
// `reserveBytes` keeps the VPS disk from filling up: uploads stop while less than that would remain free.
export function createLocalFiles({ directory, quotaBytes = 5 * 1024 ** 3, reserveBytes = 2 * 1024 ** 3, key = randomBytes(32) }) {
  directory = path.resolve(directory)
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  const records = new Map()
  for (const name of fs.readdirSync(directory)) if (/\.json$/.test(name) && validFileId(name.slice(0, -5))) records.set(name.slice(0, -5), JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')))
  const meta = id => path.join(directory, id + '.json'), blob = id => path.join(directory, id + '.bin')
  const save = (id, record) => {
    const temporary = meta(id) + '.' + randomUUID() + '.tmp'
    try { fs.writeFileSync(temporary, JSON.stringify(record), { flag: 'wx', mode: 0o600 }); fs.renameSync(temporary, meta(id)); records.set(id, record) } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary) }
  }
  const find = id => { need(validFileId(id) && records.has(id), 404, 'Arquivo não encontrado.'); return records.get(id) }
  const access = async (actor, id, canRead) => { const record = find(id); return record.owner === actor || !!record.recipients?.includes(actor) || await canRead(actor, id) }
  let uploads = 0, downloads = 0
  const pending = new Map()
  const used = actor => [...records.values()].reduce((total, record) => total + (record.owner === actor ? record.size : 0), pending.get(actor) || 0)
  const freeBytes = () => { const disk = fs.statfsSync(directory); return disk.bavail * disk.bsize - [...pending.values()].reduce((total, size) => total + size, 0) }
  return {
    canReference: async (actor, id, canRead) => records.has(id) && access(actor, id, canRead),
    async upload(actor, request) {
      const size = Number(request.headers['content-length'])
      need(Number.isSafeInteger(size) && size >= 0 && size <= MAX_UPLOAD_SIZE, 413, 'Limite de 2 GB por arquivo.')
      let name
      try { name = decodeURIComponent(String(request.headers['x-file-name'] || 'arquivo')).replace(/[\r\n]/g, '').slice(0, 200) || 'arquivo' } catch { throw new FileError(400, 'Nome de arquivo inválido.') }
      need(used(actor) + size <= quotaBytes, 413, 'Seu espaço de armazenamento no servidor acabou.')
      need(freeBytes() - size >= reserveBytes, 507, 'O servidor está sem espaço para novos arquivos. Avise o administrador.')
      need(uploads < 4, 429, 'Uploads ocupados. Tente novamente.')
      uploads++; pending.set(actor, (pending.get(actor) || 0) + size)
      const id = randomUUID(), temporary = path.join(directory, id + '.part')
      try {
        let bytes = 0
        await pipeline(request, new Transform({ transform(chunk, _encoding, done) { bytes += chunk.length; done(bytes > size ? new Error('Arquivo maior que o informado.') : null, chunk) } }), fs.createWriteStream(temporary, { flags: 'wx', mode: 0o600 }))
        need(bytes === size, 400, 'Upload incompleto.')
        fs.renameSync(temporary, blob(id))
        save(id, { owner: actor, name, size, recipients: [], createdAt: Date.now() })
        return { id, name, size, type: String(request.headers['x-file-type'] || 'application/octet-stream').slice(0, 100) }
      } finally {
        uploads--; const left = pending.get(actor) - size; if (left > 0) pending.set(actor, left); else pending.delete(actor)
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
      }
    },
    async share(actor, id, recipient, canRecipient, canRead) {
      need(await access(actor, id, canRead), 403, 'Você não pode compartilhar este arquivo.')
      need(canRecipient(recipient), 400, 'Destinatário não encontrado.')
      const record = find(id), recipients = new Set(record.recipients || []); recipients.add(recipient)
      need(recipients.size <= 250, 400, 'Limite de destinatários diretos atingido.')
      save(id, { ...record, recipients: [...recipients] })
    },
    // Each viewer can register a single view; the receipt marks view-once attachments as consumed.
    view(actor, id) {
      find(id)
      const receipt = path.join(directory, 'view-' + createHash('sha256').update(actor + ':' + id).digest('hex') + '.json')
      try { fs.writeFileSync(receipt, JSON.stringify({ viewedAt: Date.now() }), { flag: 'wx', mode: 0o600 }); return true } catch (error) { if (error.code === 'EEXIST') return false; throw error }
    },
    async link(actor, id, canRead) {
      need(await access(actor, id, canRead), 403, 'Você não tem acesso a este arquivo.')
      const expires = Date.now() + 15 * 60 * 1000
      return '/files/' + id + '?expires=' + expires + '&viewer=' + encodeURIComponent(actor) + '&signature=' + sign(key, id, expires, actor)
    },
    async download(id, query, canRead, response) {
      const expires = Number(query.get('expires')), viewer = query.get('viewer') || '', provided = query.get('signature') || ''
      const expected = Buffer.from(sign(key, id, expires, viewer)), given = Buffer.from(provided)
      need(validFileId(id) && Number.isSafeInteger(expires) && expires >= Date.now() && given.length === expected.length && timingSafeEqual(given, expected), 403, 'Link expirado ou inválido.')
      need(await access(viewer, id, canRead), 403, 'Você não tem mais acesso a este arquivo.')
      need(downloads < 16, 429, 'Downloads ocupados. Tente novamente.')
      const record = find(id)
      downloads++
      try {
        response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(record.name), 'Content-Length': record.size, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })
        await pipeline(fs.createReadStream(blob(id)), response)
      } finally { downloads-- }
    },
  }
}
