# Repos separados

| Repo | Visibilidad | Contenido | Deploy |
|------|-------------|-----------|--------|
| [`XanaxSSJ/sistemaerp`](https://github.com/XanaxSSJ/sistemaerp) | **Público** | Desktop Electron | GitHub Releases |
| [`XanaxSSJ/api-sistemaerp`](https://github.com/XanaxSSJ/api-sistemaerp) | **Privado** | API Fastify + migraciones | Koyeb |

## Koyeb

Conectar **solo** `api-sistemaerp`. Así un push del desktop no redeploya la API.

- Dockerfile: `Dockerfile` (raíz del repo API)
- Context: `.`

## Desarrollo en dos carpetas

```
Desktop/
  SistemaPos/       → remote: sistemaerp (o renombrá la carpeta)
  api-sistemaerp/   → remote: api-sistemaerp
```

## Historial limpio

El push inicial a `sistemaerp` usa historial **nuevo** (sin commits viejos del monorepo) para que la API no quede visible en el historial público.
