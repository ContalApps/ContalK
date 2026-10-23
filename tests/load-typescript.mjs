import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transformSync } from 'esbuild'
const require = createRequire(import.meta.url)
export function loadTypescript(file, mocks = {}, globals = {}) {
  const source = readFileSync(file, 'utf8').replaceAll('import.meta.url', JSON.stringify(new URL('../' + file, import.meta.url).href))
  const { code } = transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2022' })
  const module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, require: name => name in mocks ? mocks[name] : require(name), console, setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, ...globals })
  return module.exports
}
