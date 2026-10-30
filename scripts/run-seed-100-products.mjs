import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const require = createRequire(resolve(root, 'api/package.json'))
const postgres = require('postgres')

const env = readFileSync(resolve(root, 'api/.env'), 'utf8')
const line = env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))
if (!line) throw new Error('DATABASE_URL no encontrado')
const url = line
  .slice('DATABASE_URL='.length)
  .trim()
  .replace(/^["']|["']$/g, '')

const full = readFileSync(resolve(__dirname, 'seed-100-products.sql'), 'utf8')
const start = full.indexOf('WITH inserted AS')
const end = full.indexOf('COMMIT;')
if (start < 0 || end < 0) throw new Error('SQL incompleto')
const body = full.slice(start, end)

const sql = postgres(url, { ssl: 'require', max: 1 })

try {
  await sql.begin(async (tx) => {
    await tx.unsafe(body)
  })
  const counts = await sql`
    select
      (select count(*)::int from productos where codigo like 'DEM%') as demos,
      (select count(*)::int from productos) as productos,
      (select count(*)::int from marcas) as marcas,
      (select count(*)::int from stocks) as stocks
  `
  console.log(counts[0])
  const byCat = await sql`
    select c.nombre, count(*)::int as n
    from productos p
    join categorias c on c.id = p.categoria_id
    where p.codigo like 'DEM%'
    group by c.nombre
    order by c.nombre
  `
  console.log(byCat)
} catch (err) {
  console.error(err)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
