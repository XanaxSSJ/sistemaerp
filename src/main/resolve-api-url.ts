import { app } from 'electron'

/**
 * URL de API:
 * 1) MEBSY_API_URL en process.env / .env (dev u override)
 * 2) Valor embebido en build de producción (MAIN_VITE_MEBSY_API_URL)
 * 3) localhost (solo desarrollo)
 */
export function resolveApiUrl(): string {
  const fromEnv = process.env.MEBSY_API_URL?.trim()
  if (fromEnv) return stripTrailingSlash(fromEnv)

  const baked =
    typeof import.meta.env?.MAIN_VITE_MEBSY_API_URL === 'string'
      ? import.meta.env.MAIN_VITE_MEBSY_API_URL.trim()
      : ''

  if (app.isPackaged) {
    if (baked) return stripTrailingSlash(baked)
    return 'http://127.0.0.1:3001'
  }

  if (baked) return stripTrailingSlash(baked)
  return 'http://127.0.0.1:3001'
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}
