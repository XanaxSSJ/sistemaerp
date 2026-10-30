import { app, BrowserWindow, dialog, shell } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { setupAutoUpdater } from './auto-update'
import { ApiClient } from './cloud/api-client'
import { RealtimeClient } from './cloud/realtime-client'
import { registerIpcHandlers } from './ipc'
import { resolveApiUrl } from './resolve-api-url'

function loadRootEnv() {
  const candidates = [
    join(app.getAppPath(), '.env'),
    join(process.cwd(), '.env'),
    join(process.cwd(), 'api', '.env')
  ]
  for (const file of candidates) {
    if (!existsSync(file)) continue
    const text = readFileSync(file, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const i = trimmed.indexOf('=')
      if (i <= 0) continue
      const key = trimmed.slice(0, i).trim()
      const value = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, '')
      if (!(key in process.env)) process.env[key] = value
    }
  }
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: 'MebsyCore',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  loadRootEnv()

  const apiUrl = resolveApiUrl()
  const api = new ApiClient(apiUrl)
  const realtime = new RealtimeClient(apiUrl, () => api.getToken())

  registerIpcHandlers(api, apiUrl, realtime)
  createWindow()
  setupAutoUpdater()

  // Health en background: no bloquea el primer paint del login
  void api
    .health()
    .then(() => {
      console.log(`[MebsyCore] Cloud OK → ${apiUrl}`)
    })
    .catch((err) => {
      console.error('[MebsyCore] API no disponible:', err)
      const hint = app.isPackaged
        ? 'Verificá que la API esté en línea y que el instalador se generó con la URL correcta (.env.production).'
        : 'Inicia la API (`pnpm dev:api`) o configurá MEBSY_API_URL en .env'
      dialog.showErrorBox(
        'MebsyCore — API requerida',
        `No se pudo conectar a la API cloud:\n${apiUrl}\n\n${hint}`
      )
    })

  app.on('before-quit', () => {
    realtime.unsubscribe()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
