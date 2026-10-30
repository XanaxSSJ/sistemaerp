# sistemaerp (MebsyStore Desktop)

Cliente **desktop** del POS MebsyStore (Electron + React). La API vive en un repo **privado** aparte: [`XanaxSSJ/api-sistemaerp`](https://github.com/XanaxSSJ/api-sistemaerp).

| | |
|---|---|
| **Versión** | `0.1.0` |
| **Stack** | Electron · React 19 · Vite · Tailwind · Zustand |
| **Updates** | GitHub Releases + `electron-updater` |
| **Repo** | Público (`XanaxSSJ/sistemaerp`) |

---

## Características

- Ventas: boletas (`03`), facturas (`01`) vía Nubefact; notas de venta (`NV`) con ticket propio
- Inventario multi-sucursal, transferencias, reportes
- Dashboard y cambio de sede (admin) en caliente

---

## Requisitos

- Node.js 20+
- pnpm 11+
- API en marcha (local o Koyeb) — ver `api-sistemaerp`

---

## Desarrollo

```bash
pnpm install
```

`.env` en la raíz:

```env
MEBSY_API_URL=http://127.0.0.1:3001
# o tu URL de Koyeb
```

API local (carpeta hermana):

```bash
cd ../api-sistemaerp
pnpm install && pnpm dev
```

Desktop:

```bash
pnpm dev
```

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Electron + Vite |
| `pnpm build` | Compila main/preload/renderer |
| `pnpm typecheck` | TypeScript |
| `pnpm dist` | Instalador NSIS (sin publicar) |
| `pnpm dist:publish` | Instalador + Release en GitHub |
| `pnpm create-admin` | SQL/hash para primer admin (Supabase) |

---

## Empaquetado e updates

1. `.env.production`:

```env
MAIN_VITE_MEBSY_API_URL=https://tu-api.koyeb.app
```

2. Token GitHub (`repo`):

```powershell
$env:GH_TOKEN = "ghp_..."
```

3. Publicar (subí `version` en `package.json` antes):

```bash
pnpm dist:publish
```

Releases: https://github.com/XanaxSSJ/sistemaerp/releases  
Descarga latest: https://github.com/XanaxSSJ/sistemaerp/releases/latest

---

## Estructura

```
sistemaerp/          # este repo (público)
  src/               # Electron main / preload / renderer
  core/              # tipos y utilidades del cliente
  scripts/

api-sistemaerp/      # repo privado (hermano en disco)
  src/               # Fastify API
  supabase/migrations/
  Dockerfile         # Koyeb
```

---

## Seguridad

- No hay código de API ni secretos en este repo.
- `.env` / `.env.production` no se versionan.
