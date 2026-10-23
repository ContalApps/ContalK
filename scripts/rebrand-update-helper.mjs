// Local release fallback without MSVC. Only equal-length display strings change.
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const file = 'native/bin/contalk-update.exe'
const originalHash = 'b7f38903068b45d53113a808f8c830f3515253185422ae9b14849b86ca12f077'
const original = readFileSync(file)
const hash = value => createHash('sha256').update(value).digest('hex')
if (hash(original) !== originalHash) throw new Error('O auxiliar não corresponde ao binário oficial esperado. Compile com npm run build:audio.')
const patched = Buffer.from(original)
for (const text of ['Atualizando ContalK', 'Abra o ContalK para verificar. Clique aqui para fechar.', 'O ContalK será reaberto automaticamente.']) {
  const before = Buffer.from(text, 'utf16le')
  const after = Buffer.from(text.replace('ContalK', 'ConTALK'), 'utf16le')
  const offset = patched.indexOf(before)
  if (offset < 0 || patched.indexOf(before, offset + before.length) !== -1 || before.length !== after.length) throw new Error('Texto do auxiliar diferente do esperado.')
  after.copy(patched, offset)
}
writeFileSync(file, patched)
console.log(JSON.stringify({file,originalSha256:originalHash,sha256:hash(patched),changes:'Somente três textos; código e eventos preservados.'}))
