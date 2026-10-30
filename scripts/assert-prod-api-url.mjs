/**
 * Antes de `pnpm dist`: exige MAIN_VITE_MEBSY_API_URL en .env.production
 * (o MEBSY_API_URL en el entorno) para no generar un instalador apuntando a localhost.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function readEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i <= 0) continue
    const key = trimmed.slice(0, i).trim()
    const value = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    out[key] = value
  }
  return out
}

const fileEnv = {
  ...readEnvFile(resolve(root, '.env')),
  ...readEnvFile(resolve(root, '.env.production'))
}

const url =
  process.env.MAIN_VITE_MEBSY_API_URL?.trim() ||
  process.env.MEBSY_API_URL?.trim() ||
  fileEnv.MAIN_VITE_MEBSY_API_URL?.trim() ||
  fileEnv.MEBSY_API_URL?.trim() ||
  ''

if (!url || url.includes('127.0.0.1') || url.includes('localhost')) {
  console.error(`
[dist] Falta una URL de API de producción.

Creá .env.production (ver .env.production.example) con:

  MAIN_VITE_MEBSY_API_URL=https://tu-api.koyeb.app

O exportá MEBSY_API_URL / MAIN_VITE_MEBSY_API_URL antes de pnpm dist.
`)
  process.exit(1)
}

if (!/^https:\/\//i.test(url)) {
  console.warn(`[dist] Aviso: se recomienda HTTPS en producción → ${url}`)
}

console.log(`[dist] API embebida → ${url}`)
