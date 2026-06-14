import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'src/assets/logo.png')
const out = (f) => resolve(root, 'public', f)

const PARCHMENT = '#F1E9D8' // token pergaminho (design Prancha)

// Ícones "any": fundo transparente, logo cheio.
async function any(size, file) {
  await sharp(src)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out(file))
}

// Maskable: safe zone. Logo a ~80% sobre fundo pergaminho sólido.
async function maskable(size, file) {
  const inner = Math.round(size * 0.8)
  const logo = await sharp(src).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: PARCHMENT } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(out(file))
}

// Apple touch: iOS ignora alpha (vira preto). Fundo pergaminho, logo ~92%.
async function apple(size, file) {
  const inner = Math.round(size * 0.92)
  const logo = await sharp(src).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: PARCHMENT } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(out(file))
}

await any(192, 'pwa-192.png')
await any(512, 'pwa-512.png')
await maskable(512, 'pwa-maskable-512.png')
await apple(180, 'apple-touch-icon.png')

console.log('icons gerados: pwa-192, pwa-512, pwa-maskable-512, apple-touch-icon')
