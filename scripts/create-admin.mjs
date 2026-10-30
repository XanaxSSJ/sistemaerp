/**
 * Genera hash scrypt (mismo formato que la API) + SQL bootstrap admin.
 *
 * Uso:
 *   node scripts/create-admin.mjs
 *   node scripts/create-admin.mjs --user admin --password "Secreta123!" --nombre "Administrador"
 *   node scripts/create-admin.mjs --user admin --password "..." --empresa --sucursal
 *
 * Luego pegá el SQL en Supabase → SQL Editor (proyecto producción).
 */
import { randomBytes, scryptSync } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const KEYLEN = 64

function parseArgs(argv) {
  const out = {
    user: null,
    password: null,
    nombre: null,
    empresa: false,
    sucursal: false,
    ruc: '20123456789',
    razon: 'Mi Empresa SAC',
    comercial: 'MebsyStore',
    direccion: 'Av. Ejemplo 123',
    sucursalCodigo: 'S01',
    sucursalNombre: 'Sede Principal'
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    if (a === '--user' && next) {
      out.user = next
      i++
    } else if (a === '--password' && next) {
      out.password = next
      i++
    } else if (a === '--nombre' && next) {
      out.nombre = next
      i++
    } else if (a === '--empresa') {
      out.empresa = true
    } else if (a === '--sucursal') {
      out.sucursal = true
    } else if (a === '--ruc' && next) {
      out.ruc = next
      i++
    } else if (a === '--help' || a === '-h') {
      out.help = true
    }
  }
  return out
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEYLEN).toString('hex')
  return `${salt}:${hash}`
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function buildSql(opts, passwordHash) {
  const parts = []
  parts.push('-- MebsyStore · bootstrap admin (generado por scripts/create-admin.mjs)')
  parts.push('-- Pegar en Supabase → SQL Editor\n')

  if (opts.empresa) {
    parts.push(`INSERT INTO empresa (ruc, razon_social, nombre_comercial, direccion, igv_porcentaje)
SELECT ${sqlLiteral(opts.ruc)}, ${sqlLiteral(opts.razon)}, ${sqlLiteral(opts.comercial)}, ${sqlLiteral(opts.direccion)}, 18
WHERE NOT EXISTS (SELECT 1 FROM empresa LIMIT 1);
`)
  }

  if (opts.sucursal) {
    parts.push(`INSERT INTO sucursales (codigo, nombre, direccion, activa)
SELECT ${sqlLiteral(opts.sucursalCodigo)}, ${sqlLiteral(opts.sucursalNombre)}, ${sqlLiteral(opts.direccion)}, true
WHERE NOT EXISTS (SELECT 1 FROM sucursales WHERE codigo = ${sqlLiteral(opts.sucursalCodigo)});
`)
  }

  parts.push(`INSERT INTO usuarios (username, password_hash, nombre, rol, activo)
SELECT ${sqlLiteral(opts.user)}, ${sqlLiteral(passwordHash)}, ${sqlLiteral(opts.nombre)}, 'admin', true
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE username = ${sqlLiteral(opts.user)});
`)

  parts.push(
    '-- Nota: admin sin filas en usuario_sucursales puede acceder a todas las sedes activas.'
  )
  parts.push('-- Las series se configuran en la app (Sucursales).')
  return parts.join('\n')
}

async function promptMissing(opts) {
  const rl = createInterface({ input, output })
  try {
    if (!opts.user) {
      opts.user = (await rl.question('Usuario [admin]: ')).trim() || 'admin'
    }
    if (!opts.nombre) {
      opts.nombre =
        (await rl.question('Nombre [Administrador]: ')).trim() ||
        'Administrador'
    }
    if (!opts.password) {
      opts.password = (await rl.question('Contraseña: ')).trim()
    }
  } finally {
    rl.close()
  }
}

const opts = parseArgs(process.argv.slice(2))

if (opts.help) {
  console.log(`Uso:
  node scripts/create-admin.mjs
  node scripts/create-admin.mjs --user admin --password "..." --nombre "Administrador"
  node scripts/create-admin.mjs --user admin --password "..." --empresa --sucursal

Flags:
  --empresa          Incluye INSERT de empresa
  --sucursal         Incluye INSERT de sucursal S01
  --ruc              RUC para --empresa
`)
  process.exit(0)
}

await promptMissing(opts)

if (!opts.password || opts.password.length < 6) {
  console.error('Error: la contraseña debe tener al menos 6 caracteres.')
  process.exit(1)
}

const passwordHash = hashPassword(opts.password)
const sql = buildSql(opts, passwordHash)

console.log('\n--- Hash (scrypt salt:hash) ---')
console.log(passwordHash)
console.log('\n--- SQL ---')
console.log(sql)
