/** Convierte un monto PEN a: "CIENTO CINCUENTA Y SEIS CON 64/100 SOLES" */

const UNIDADES = [
  '',
  'UNO',
  'DOS',
  'TRES',
  'CUATRO',
  'CINCO',
  'SEIS',
  'SIETE',
  'OCHO',
  'NUEVE',
  'DIEZ',
  'ONCE',
  'DOCE',
  'TRECE',
  'CATORCE',
  'QUINCE',
  'DIECISEIS',
  'DIECISIETE',
  'DIECIOCHO',
  'DIECINUEVE',
  'VEINTE',
  'VEINTIUNO',
  'VEINTIDOS',
  'VEINTITRES',
  'VEINTICUATRO',
  'VEINTICINCO',
  'VEINTISEIS',
  'VEINTISIETE',
  'VEINTIOCHO',
  'VEINTINUEVE'
]

const DECENAS = [
  '',
  '',
  'VEINTE',
  'TREINTA',
  'CUARENTA',
  'CINCUENTA',
  'SESENTA',
  'SETENTA',
  'OCHENTA',
  'NOVENTA'
]

const CENTENAS = [
  '',
  'CIENTO',
  'DOSCIENTOS',
  'TRESCIENTOS',
  'CUATROCIENTOS',
  'QUINIENTOS',
  'SEISCIENTOS',
  'SETECIENTOS',
  'OCHOCIENTOS',
  'NOVECIENTOS'
]

function underHundred(n: number): string {
  if (n < 30) return UNIDADES[n] ?? ''
  const d = Math.floor(n / 10)
  const u = n % 10
  if (u === 0) return DECENAS[d] ?? ''
  return `${DECENAS[d]} Y ${UNIDADES[u]}`
}

function underThousand(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'CIEN'
  if (n < 100) return underHundred(n)
  const c = Math.floor(n / 100)
  const rest = n % 100
  const head = CENTENAS[c] ?? ''
  if (rest === 0) return head
  return `${head} ${underHundred(rest)}`
}

function integerToWords(n: number): string {
  if (n === 0) return 'CERO'
  if (n < 1000) return underThousand(n)

  if (n < 1_000_000) {
    const miles = Math.floor(n / 1000)
    const rest = n % 1000
    const milesTxt =
      miles === 1 ? 'MIL' : `${underThousand(miles)} MIL`
    if (rest === 0) return milesTxt
    return `${milesTxt} ${underThousand(rest)}`
  }

  const millones = Math.floor(n / 1_000_000)
  const rest = n % 1_000_000
  const millTxt =
    millones === 1 ? 'UN MILLON' : `${integerToWords(millones)} MILLONES`
  if (rest === 0) return millTxt
  return `${millTxt} ${integerToWords(rest)}`
}

export function amountInWordsPen(amount: number): string {
  const safe = Math.round(Math.abs(amount) * 100) / 100
  const enteros = Math.floor(safe)
  const centavos = Math.round((safe - enteros) * 100)
  const cent = String(centavos).padStart(2, '0')
  return `${integerToWords(enteros)} CON ${cent}/100 SOLES`
}
