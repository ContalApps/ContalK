// Gera os ícones do ConTalk a partir de build/icon.svg.
// Uso: <electron.exe> scripts/generate-icons.cjs
// Saídas: src-tauri/icons/icon.ico (16 a 256 px), public/app-icon.png (512 px) e PNGs auxiliares.
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const svg = fs.readFileSync(path.join(root, 'build', 'icon.svg'), 'utf8')
const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const pngTargets = {
  'public/app-icon.png': 512,
  'public/logo.png': 512,
  'public/contalk-avatar.png': 256,
  'public/contalk-logo.png': 512,
  'src-tauri/icons/icon.png': 512,
  'src-tauri/icons/32x32.png': 32,
  'src-tauri/icons/64x64.png': 64,
  'src-tauri/icons/128x128.png': 128,
  'src-tauri/icons/128x128@2x.png': 256
}

function buildIco(images) {
  // ICO com entradas PNG (suportado desde o Windows Vista).
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4)
  const entries = [], bodies = []
  let offset = 6 + 16 * images.length
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0); entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2); entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(data.length, 8); entry.writeUInt32LE(offset, 12)
    offset += data.length
    entries.push(entry); bodies.push(data)
  }
  return Buffer.concat([header, ...entries, ...bodies])
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
  await win.loadURL('data:text/html,<html><body></body></html>')
  const render = size => win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = ${size}; canvas.height = ${size}
      const context = canvas.getContext('2d'); context.imageSmoothingQuality = 'high'
      context.drawImage(image, 0, 0, ${size}, ${size})
      resolve(canvas.toDataURL('image/png').split(',')[1])
    }
    image.onerror = reject
    image.src = 'data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}'
  })`)
  const png = async size => Buffer.from(await render(size), 'base64')
  const ico = []
  for (const size of icoSizes) ico.push({ size, data: await png(size) })
  fs.writeFileSync(path.join(root, 'src-tauri/icons/icon.ico'), buildIco(ico))
  for (const [file, size] of Object.entries(pngTargets)) fs.writeFileSync(path.join(root, file), await png(size))
  console.log('Ícones gerados:', ['src-tauri/icons/icon.ico', ...Object.keys(pngTargets)].join(', '))
  app.exit(0)
}).catch(error => { console.error(error); app.exit(1) })
