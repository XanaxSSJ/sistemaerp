# Publicar un release (GitHub)

Repo: **XanaxSSJ/sistemaerp** (público)  
Config en `package.json` → `build.publish` + script `dist:publish`.

## Antes del primer release

1. `.env.production` con la API de Koyeb:

```env
MAIN_VITE_MEBSY_API_URL=https://TU-APP.koyeb.app
```

2. Token GitHub (Classic) con scope **`repo`**, o fine-grained con permiso de **Contents** + **Releases** en `sistemaerp`.

```powershell
$env:GH_TOKEN = "ghp_..."
```

## Publicar

1. Subí la versión en `package.json` (debe ser mayor que la instalada en las PCs):

```json
"version": "0.1.1"
```

2. Commit + push del código a `sistemaerp`.

3. Generar instalador y crear el Release:

```powershell
pnpm dist:publish
```

Eso sube a https://github.com/XanaxSSJ/sistemaerp/releases :

- `MebsyStore-Setup-0.1.1.exe`
- `latest.yml` (lo usa `electron-updater`)
- tag `v0.1.1`

## Solo instalador local (sin subir)

```powershell
pnpm dist
```

Sale en `release/`.

## Clientes

Las apps ya instaladas (con auto-update) detectan la versión nueva al abrir y ofrecen reiniciar.

Descarga manual: https://github.com/XanaxSSJ/sistemaerp/releases/latest
