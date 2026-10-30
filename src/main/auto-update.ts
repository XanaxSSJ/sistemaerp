import { app, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'

/**
 * Auto-update vía GitHub Releases (electron-builder publish.provider = github).
 * Solo corre en builds empaquetados.
 */
export function setupAutoUpdater(): void {
  if (!app.isPackaged) {
    console.log('[MebsyStore] Auto-update desactivado (modo desarrollo)')
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    console.log('[MebsyStore] Buscando actualizaciones…')
  })

  autoUpdater.on('update-available', (info) => {
    console.log(`[MebsyStore] Actualización disponible: ${info.version}`)
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[MebsyStore] La app está al día')
  })

  autoUpdater.on('error', (err) => {
    console.error('[MebsyStore] Error auto-update:', err)
  })

  autoUpdater.on('download-progress', (p) => {
    console.log(
      `[MebsyStore] Descarga update: ${p.percent.toFixed(1)}% (${Math.round(p.bytesPerSecond / 1024)} KB/s)`
    )
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[MebsyStore] Update ${info.version} descargada`)
    void dialog
      .showMessageBox({
        type: 'info',
        title: 'Actualización lista',
        message: `MebsyStore ${info.version} está lista para instalar.`,
        detail:
          'Se aplicará al reiniciar la aplicación. ¿Querés reiniciar ahora?',
        buttons: ['Reiniciar ahora', 'Más tarde'],
        defaultId: 0,
        cancelId: 1
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall(false, true)
        }
      })
  })

  // Delay breve: no competir con el primer paint / health check
  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((err) => {
      console.error('[MebsyStore] checkForUpdates falló:', err)
    })
  }, 8_000)
}

/** Chequeo manual (p. ej. desde menú / IPC futuro). */
export function checkForUpdatesNow(): void {
  if (!app.isPackaged) return
  void autoUpdater.checkForUpdates().catch((err) => {
    console.error('[MebsyStore] checkForUpdatesNow falló:', err)
  })
}
