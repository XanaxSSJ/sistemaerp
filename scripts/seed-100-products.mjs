import { writeFileSync } from 'node:fs'

const cats = [
  { id: 1, nombre: 'General' },
  { id: 2, nombre: 'Poleras' },
  { id: 3, nombre: 'Pantalones' },
  { id: 4, nombre: 'Camisas' },
  { id: 5, nombre: 'Sudaderas' },
  { id: 6, nombre: 'Overoles' },
  { id: 7, nombre: 'Chamarras' },
  { id: 8, nombre: 'Zapatillas' },
  { id: 9, nombre: 'Accesorios' }
]

const brands = [
  'Nike',
  'Adidas',
  'Puma',
  "Levi's",
  'Zara',
  'H&M',
  'Under Armour',
  'Columbia',
  'Converse',
  'Cat',
  'Dickies',
  'Mebsy',
  'Reebok',
  'The North Face',
  'Vans'
]

const catalog = {
  1: [
    'Kit básico tienda',
    'Bolsa reutilizable',
    'Llavero logo'
  ],
  2: [
    'Polera básica algodón',
    'Polera oversize',
    'Polera dry-fit',
    'Polera cuello V',
    'Polera raglan',
    'Polera estampada',
    'Polera slim fit',
    'Polera crop',
    'Polera manga 3/4',
    'Polera performance',
    'Polera premium piqué',
    'Polera kids',
    'Polera cuello redondo'
  ],
  3: [
    'Jean skinny',
    'Jean straight',
    'Pantalón chino',
    'Pantalón cargo',
    'Jogger fleece',
    'Pantalón drill',
    'Jean mom',
    'Pantalón sastre',
    'Pantalón outdoor',
    'Jean bootcut',
    'Pantalón stretch',
    'Pantalón wide leg',
    'Pantalón jogger tech'
  ],
  4: [
    'Camisa oxford',
    'Camisa linen',
    'Camisa denim',
    'Camisa formal manga larga',
    'Camisa casual cuadros',
    'Camisa hawaii',
    'Camisa slim office',
    'Camisa flannel',
    'Camisa bowling',
    'Camisa guayabera',
    'Camisa stretch office',
    'Camisa popelín'
  ],
  5: [
    'Hoodie clásico',
    'Crewneck fleece',
    'Sudadera zip',
    'Hoodie oversized',
    'Sudadera técnica',
    'Hoodie college',
    'Sudadera crop',
    'Hoodie canguro',
    'Sudadera french terry',
    'Hoodie kids',
    'Sudadera half-zip',
    'Hoodie heavyweight'
  ],
  6: [
    'Overol denim',
    'Overol drill',
    'Overol cargo trabajo',
    'Overol corto',
    'Overol industrial',
    'Overol fashion',
    'Overol mecánico',
    'Overol kids',
    'Overol stretch',
    'Overol reforzado',
    'Overol farming'
  ],
  7: [
    'Chamarra bomber',
    'Chamarra denim',
    'Parka impermeable',
    'Chamarra softshell',
    'Chamarra puffer',
    'Chamarra universitaria',
    'Chamarra cuero sintético',
    'Chamarra windbreaker',
    'Chamarra sherpa',
    'Chamarra racing',
    'Chamarra outdoor',
    'Chamarra soft quilt'
  ],
  8: [
    'Zapatilla running',
    'Zapatilla urbana',
    'Zapatilla high-top',
    'Zapatilla skate',
    'Zapatilla training',
    'Sandalia sport',
    'Zapatilla kids',
    'Zapatilla trail',
    'Slip-on casual',
    'Zapatilla court',
    'Zapatilla chunky',
    'Zapatilla lifestyle'
  ],
  9: [
    'Gorra trucker',
    'Cinturón cuero',
    'Mochila 20L',
    'Calcetines pack x3',
    'Bufanda knit',
    'Guantes tactiles',
    'Riñonera',
    'Lentes sol UV',
    'Bandana',
    'Cartera slim',
    'Reloj deportivo',
    'Collar cordón'
  ]
}

const prices = {
  1: [5, 35],
  2: [29, 99],
  3: [69, 189],
  4: [59, 159],
  5: [79, 219],
  6: [99, 249],
  7: [119, 349],
  8: [129, 399],
  9: [9, 129]
}

const variants = ['S', 'M', 'L', 'XL', 'Negro', 'Azul', 'Blanco', 'Gris']
const plan = { 2: 13, 3: 13, 4: 12, 5: 12, 6: 11, 7: 12, 8: 12, 9: 12, 1: 3 }

function esc(s) {
  return String(s).replace(/'/g, "''")
}

function priceFor(cat, i) {
  const [a, b] = prices[cat]
  const step = (b - a) / 11
  return Math.round((a + (i % 12) * step) * 100) / 100
}

const products = []
let n = 0
for (const [cid, count] of Object.entries(plan)) {
  const id = Number(cid)
  const names = catalog[id]
  for (let i = 0; i < count; i++) {
    n++
    const brand = brands[(n + id) % brands.length]
    const base = names[i % names.length]
    const variant = variants[i % variants.length]
    const withVariant = id !== 1 && id !== 9
    const nombre = withVariant ? `${base} ${variant}` : base
    products.push({
      codigo: `DEM${String(n).padStart(3, '0')}`,
      codigo_barras: `77510${1000000 + n}`,
      nombre: nombre.slice(0, 80),
      descripcion: `Producto demo · ${cats.find((c) => c.id === id).nombre}`,
      precio: priceFor(id, i),
      categoria_id: id,
      marca: brand
    })
  }
}

const brandSql = brands
  .map(
    (b) =>
      `INSERT INTO marcas (nombre) SELECT '${esc(b)}' WHERE NOT EXISTS (SELECT 1 FROM marcas m WHERE lower(m.nombre) = lower('${esc(b)}'));`
  )
  .join('\n')

const values = products
  .map((p) => {
    return `(
  '${esc(p.codigo)}',
  '${esc(p.codigo_barras)}',
  '${esc(p.nombre)}',
  '${esc(p.descripcion)}',
  ${p.precio},
  'NIU',
  '10',
  true,
  ${p.categoria_id},
  (SELECT id FROM marcas WHERE lower(nombre) = lower('${esc(p.marca)}') LIMIT 1)
)`
  })
  .join(',\n')

const sql = `
BEGIN;

${brandSql}

WITH inserted AS (
  INSERT INTO productos (
    codigo, codigo_barras, nombre, descripcion, precio, unidad, afectacion_igv, activo, categoria_id, marca_id
  )
  VALUES
${values}
  ON CONFLICT (codigo) DO NOTHING
  RETURNING id
)
INSERT INTO stocks (producto_id, sucursal_id, cantidad, stock_minimo)
SELECT i.id, s.id,
  (20 + (i.id % 80))::numeric,
  5
FROM inserted i
CROSS JOIN sucursales s
ON CONFLICT (producto_id, sucursal_id) DO NOTHING;

COMMIT;
`

writeFileSync(new URL('./seed-100-products.sql', import.meta.url), sql)
writeFileSync(
  new URL('./seed-100-products.json', import.meta.url),
  JSON.stringify({ brands, products, count: products.length }, null, 2)
)
console.log(`Generated ${products.length} products`)

