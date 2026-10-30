# Repos separados

| Repo | Visibilidad | Contenido | Deploy |
|------|-------------|-----------|--------|
| [`XanaxSSJ/sistemaerp`](https://github.com/XanaxSSJ/sistemaerp) | **Público** | Desktop Electron | GitHub Releases |
| [`XanaxSSJ/api-sistemaerp`](https://github.com/XanaxSSJ/api-sistemaerp) | **Privado** | API Fastify + migraciones + compose | **Oracle Cloud VM** |
| `api-sunaterp` | **Privado** | Greenter SEE (sidecar PHP) | Mismo VPS (compose) |

## Producción (Oracle Cloud)

API + Greenter en una VM con Docker Compose + Caddy.  
Guía: `api-sistemaerp/docs/DEPLOY-OCI.md`.

SEE **no** funciona en un PaaS que solo corra el Dockerfile Node sin sidecar ni volúmenes.

## Desarrollo en dos carpetas

```
Desktop/
  SistemaPos/       → remote: sistemaerp (o renombrá la carpeta)
  api-sistemaerp/   → remote: api-sistemaerp
```

## Historial limpio

El push inicial a `sistemaerp` usa historial **nuevo** (sin commits viejos del monorepo) para que la API no quede visible en el historial público.
