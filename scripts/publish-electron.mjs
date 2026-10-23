import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { load } = require('js-yaml')
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const version = pkg.version
const tag = `v${version}`
const gh = args => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim()
if (git(['status', '--porcelain'])) throw new Error('Faça commit das alterações antes de publicar.')
const sha = git(['rev-parse', 'HEAD'])
if (git(['rev-list', '-n', '1', tag]) !== sha) throw new Error('A tag da versão precisa apontar para o commit atual.')
const installer = `ConTALK-Setup-${version}.exe`
const required = [installer, `${installer}.blockmap`, 'latest.yml']
for (const file of required) if (!existsSync(path.join('release', file))) throw new Error(`Arquivo ausente: ${file}. Execute npm run build:electron.`)
const manifest = load(readFileSync('release/latest.yml', 'utf8'))
const digest = createHash('sha512').update(readFileSync(path.join('release', installer))).digest('base64')
if (manifest.version !== version || manifest.path !== installer || manifest.sha512 !== digest || !manifest.files?.some(file => file.url === installer && file.sha512 === digest)) throw new Error('O manifesto não corresponde ao instalador desta versão.')
const notes = path.resolve('RELEASE_NOTES.md')
if (!existsSync(notes)) throw new Error('Escreva RELEASE_NOTES.md antes de publicar.')
let release
try { release = JSON.parse(gh(['release', 'view', tag, '--json', 'isDraft,url'])) }
catch (error) { if (!String(error.stderr).includes('release not found')) throw error }
if (release && !release.isDraft) throw new Error('A versão já foi publicada. Use uma nova versão; não substitua instaladores em uso.')
if (!release) gh(['release', 'create', tag, '--draft', '--verify-tag', '--target', sha, '--title', `ConTALK v${version}`, '--notes-file', notes])
// Upload the update manifest last. The release stays hidden until all assets exist.
for (const file of required) gh(['release', 'upload', tag, path.join('release', file), '--clobber'])
const assets = JSON.parse(gh(['release', 'view', tag, '--json', 'assets'])).assets
for (const name of required) if (!assets.some(asset => asset.name === name && asset.state === 'uploaded' && asset.size > 0)) throw new Error(`Upload não confirmado: ${name}`)
gh(['release', 'edit', tag, '--draft=false', '--latest', '--notes-file', notes])
console.log(gh(['release', 'view', tag, '--json', 'url', '--jq', '.url']))
