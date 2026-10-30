/**
 * Embebe el icono en MebsyCore.exe sin winCodeSign (falla en Windows
 * sin privilegio para crear symlinks de darwin al extraer el toolset).
 */
import { rcedit } from 'rcedit'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const exeName = `${context.packager.appInfo.productFilename}.exe`
  const exePath = join(context.appOutDir, exeName)
  const iconPath = join(context.packager.projectDir, 'build', 'icon.ico')

  if (!existsSync(exePath)) {
    console.warn(`[after-pack] No existe ${exePath}`)
    return
  }
  if (!existsSync(iconPath)) {
    console.warn(`[after-pack] No existe ${iconPath}`)
    return
  }

  await rcedit(exePath, { icon: iconPath })
  console.log(`[after-pack] Icono aplicado → ${exeName}`)
}
