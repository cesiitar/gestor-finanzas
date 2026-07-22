import { hoyISO, parseImporteToCents } from "@/lib/finanzas/format"
import type { TipoMovimiento } from "@/lib/finanzas/types"

/**
 * Parser del registro rápido por Telegram.
 * Formatos aceptados (el tipo es opcional, por defecto gasto):
 *   "12,50 cena mercadona"
 *   "gasto 12,50 cena"
 *   "ingreso 1200 nomina"
 *   "inversion 200 indexado"
 * Entiende fechas y las quita del concepto:
 *   "11 peluquero ayer"  ·  "nomina 1200 el día 1"
 *   "12,50 cena 1 de julio"  ·  "30 regalo 05/07"
 * Si el mensaje huele a fecha que no sabe resolver ("el lunes pasado"),
 * devuelve null para que lo intente la IA.
 */

export interface MensajeParseado {
  tipo: TipoMovimiento
  importeCents: number
  concepto: string
  /** YYYY-MM-DD; ausente = hoy */
  fecha?: string
}

const TIPOS: Record<string, TipoMovimiento> = {
  gasto: "gasto",
  ingreso: "ingreso",
  inversion: "inversion",
  inversión: "inversion",
}

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------
const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

const pad = (n: number) => String(n).padStart(2, "0")

/** ¿Existe ese día en el calendario? (rechaza 31 de junio, 30/02...) */
function fechaValida(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d))
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  )
}

/** Suma días a una fecha ISO con aritmética de calendario (sin timezones) */
function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + dias))
  return dt.toISOString().slice(0, 10)
}

/** Quita acentos para comparar ("miércoles" → "miercoles") */
const sinTildes = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

/** Día de la semana → número JS (0 domingo … 6 sábado) */
const DIAS_SEMANA: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3,
  jueves: 4, viernes: 5, sabado: 6,
}

/** Día de la semana de una fecha ISO (0 domingo … 6 sábado) */
function diaSemanaDe(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/**
 * Fecha del día de la semana `objetivo` respecto a hoy:
 * - "reciente": la ocurrencia más reciente (hoy incluido) → "el jueves"
 * - "pasado":   la de la semana anterior → "jueves pasado"
 * - "proximo":  la próxima futura → "jueves que viene"
 */
function fechaDiaSemana(
  hoy: string,
  objetivo: number,
  modo: "reciente" | "pasado" | "proximo"
): string {
  const dow = diaSemanaDe(hoy)
  let delta: number
  if (modo === "proximo") {
    delta = ((objetivo - dow + 7) % 7) || 7
  } else if (modo === "pasado") {
    delta = -(((dow - objetivo + 7) % 7) || 7)
  } else {
    delta = -((dow - objetivo + 7) % 7) // reciente: 0 si hoy es ese día
  }
  return sumarDias(hoy, delta)
}

// Palabras temporales que el parser NO sabe resolver → que lo intente la IA
const TEMPORAL_SIN_RESOLVER = /\b(semana|finde|mes\s+pasad[oa])\b/i

interface FechaExtraida {
  /** undefined = el texto no menciona fecha (se registrará hoy) */
  fecha?: string
  /** El texto sin la expresión de fecha */
  resto: string
  /** true si la fecha mencionada no es válida (p. ej. 31 de junio) */
  invalida?: boolean
}

/** Busca UNA expresión de fecha en el texto, la resuelve y la elimina */
function extraerFecha(texto: string): FechaExtraida {
  const hoy = hoyISO()
  const [hoyY, hoyM, hoyD] = hoy.split("-").map(Number)

  // Relativas: anteayer / ayer / hoy
  const relativas: [RegExp, number][] = [
    [/\b(antes\s+de\s+ayer|anteayer)\b/i, -2],
    [/\bayer\b/i, -1],
    [/\bhoy\b/i, 0],
  ]
  for (const [re, delta] of relativas) {
    if (re.test(texto)) {
      return { fecha: sumarDias(hoy, delta), resto: texto.replace(re, " ") }
    }
  }

  // "pasado mañana" (futuro explícito: si el usuario lo dice, se respeta)
  if (/\bpasado\s+mañana\b/i.test(texto))
    return { fecha: sumarDias(hoy, 2), resto: texto.replace(/\bpasado\s+mañana\b/i, " ") }
  // "esta mañana" / "por la mañana" = HOY (mañana = franja del día, no el futuro)
  const mananaHoy = texto.match(/\b(esta\s+mañana|por\s+la\s+mañana|de\s+la\s+mañana)\b/i)
  if (mananaHoy) return { fecha: hoy, resto: texto.replace(mananaHoy[0], " ") }
  // "mañana" a secas = día siguiente
  if (/\bmañana\b/i.test(texto))
    return { fecha: sumarDias(hoy, 1), resto: texto.replace(/\bmañana\b/i, " ") }

  // "hace 3 días" / "hace una semana" / "hace 2 semanas"
  // (importante: si no se captura, el número se confundiría con el importe)
  const NUM_PALABRA: Record<string, number> = {
    un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  }
  const hace = texto.match(/\bhace\s+(\d+|un|una|dos|tres|cuatro|cinco|seis)\s+(d[ií]as?|semanas?)\b/i)
  if (hace) {
    const n = NUM_PALABRA[hace[1].toLowerCase()] ?? Number(hace[1])
    const dias = /semana/i.test(hace[2]) ? n * 7 : n
    return { fecha: sumarDias(hoy, -dias), resto: texto.replace(hace[0], " ") }
  }

  // Días de la semana: "el jueves", "jueves pasado", "jueves que viene",
  // "próximo lunes"…  (lunes-domingo, con o sin tilde)
  const diaSem = texto.match(
    /\b(?:(pr[oó]xim[oa]|el|este)\s+)?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)(?:\s+(que\s+viene|pr[oó]xim[oa]|siguiente|pasad[oa]|anterior))?\b/i
  )
  if (diaSem) {
    const objetivo = DIAS_SEMANA[sinTildes(diaSem[2])]
    const antes = diaSem[1] ? sinTildes(diaSem[1]) : ""
    const despues = diaSem[3] ? sinTildes(diaSem[3]) : ""
    const modo: "reciente" | "pasado" | "proximo" =
      /pasad|anterior/.test(despues)
        ? "pasado"
        : /viene|proxim|siguiente/.test(despues) || antes.startsWith("proxim")
          ? "proximo"
          : "reciente"
    return {
      fecha: fechaDiaSemana(hoy, objetivo, modo),
      resto: texto.replace(diaSem[0], " "),
    }
  }

  // "1 de julio" / "el día 1 de julio" / "1 de julio de 2025"
  const conMes = texto.match(
    /\b(?:el\s+)?(?:d[ií]a\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+(?:de|del)\s+(\d{4}))?\b/i
  )
  if (conMes) {
    const d = Number(conMes[1])
    const m = MESES[conMes[2].toLowerCase()]
    let y = conMes[3] ? Number(conMes[3]) : hoyY
    // Sin año y en el futuro → se refiere al año pasado
    if (!conMes[3] && `${y}-${pad(m)}-${pad(d)}` > hoy) y -= 1
    if (!fechaValida(y, m, d)) return { resto: texto, invalida: true }
    return { fecha: `${y}-${pad(m)}-${pad(d)}`, resto: texto.replace(conMes[0], " ") }
  }

  // "el día 5" / "día 5" (del mes actual; si aún no ha llegado, el mes pasado)
  const soloDia = texto.match(/\b(?:el\s+)?d[ií]a\s+(\d{1,2})\b/i)
  if (soloDia) {
    const d = Number(soloDia[1])
    let y = hoyY
    let m = hoyM
    if (d > hoyD) {
      m -= 1
      if (m === 0) { m = 12; y -= 1 }
    }
    if (!fechaValida(y, m, d)) return { resto: texto, invalida: true }
    return { fecha: `${y}-${pad(m)}-${pad(d)}`, resto: texto.replace(soloDia[0], " ") }
  }

  // "05/07" / "5-7" / "05/07/2026" (dd/mm, formato español)
  const numerica = texto.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (numerica) {
    const d = Number(numerica[1])
    const m = Number(numerica[2])
    if (m >= 1 && m <= 12) {
      let y = numerica[3]
        ? Number(numerica[3]) < 100
          ? 2000 + Number(numerica[3])
          : Number(numerica[3])
        : hoyY
      if (!numerica[3] && `${y}-${pad(m)}-${pad(d)}` > hoy) y -= 1
      if (!fechaValida(y, m, d)) return { resto: texto, invalida: true }
      return { fecha: `${y}-${pad(m)}-${pad(d)}`, resto: texto.replace(numerica[0], " ") }
    }
  }

  return { resto: texto }
}

// ---------------------------------------------------------------------------
// Parser principal
// ---------------------------------------------------------------------------
// Muletillas de moneda que no aportan nada al concepto
const PALABRA_MONEDA = /^(€|euros?|eur|pavos?)$/i

// Conceptos que delatan un ingreso aunque no se escriba "ingreso"
const HUELE_A_INGRESO = /\b(n[oó]mina|sueldo|salario)\b/i

export function parsearMovimiento(texto: string): MensajeParseado | null {
  // 1º la fecha, para que sus números no se confundan con el importe
  const { fecha, resto, invalida } = extraerFecha(texto)
  if (invalida) return null
  // Fecha que no sabemos resolver ("el lunes pasado") → mejor la IA que hoy
  if (TEMPORAL_SIN_RESOLVER.test(resto)) return null

  const tokens = resto.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return null

  let tipo: TipoMovimiento | null = null
  let inicio = 0
  const primera = tokens[0].toLowerCase()
  if (primera in TIPOS) {
    tipo = TIPOS[primera]
    inicio = 1
  }

  // El primer token que parsea como importe válido es el importe
  let importeCents: number | null = null
  let idxImporte = -1
  for (let i = inicio; i < tokens.length; i++) {
    const cents = parseImporteToCents(tokens[i])
    if (cents !== null) {
      importeCents = cents
      idxImporte = i
      break
    }
  }
  if (importeCents === null) return null

  const concepto = tokens
    .filter((tok, i) => i !== idxImporte && i >= inicio && !PALABRA_MONEDA.test(tok))
    .join(" ")
    .trim()

  // Sin tipo explícito: "nomina 1200" es un ingreso, no un gasto
  if (tipo === null) {
    tipo = HUELE_A_INGRESO.test(concepto) ? "ingreso" : "gasto"
  }

  return { tipo, importeCents, concepto, fecha }
}

/**
 * Diccionario de palabras clave → nombre de categoría (las de serie).
 * Si el concepto contiene la palabra, se asigna esa categoría directamente.
 */
const KEYWORDS: [RegExp, string][] = [
  [/mercadona|lidl|carrefour|aldi|dia\b|super|comida|cena|comer|desayun|restaurante|bar\b|kebab|pizza|burguer|almuerzo|caf[eé]|panader/i, "Comida"],
  [/gasolina|diesel|repostar|bus|metro|taxi|uber|cabify|tren|renfe|avion|vuelo|parking|peaje|itv|taller|coche|moto/i, "Transporte"],
  [/cine|ocio|fiesta|copas|concierto|entrada|juego|steam|play|futbol|f[uú]tbol|padel|p[aá]del|viaje|hotel/i, "Ocio"],
  [/luz\b|agua\b|gas\b|alquiler|hipoteca|internet|wifi|fibra|comunidad|hogar|ikea|mueble|electrodom/i, "Hogar"],
  [/farmacia|m[eé]dico|dentista|fisio|gimnasio|gym|salud|[oó]ptica|anal[ií]tica|peluquer/i, "Salud"],
  [/ropa|zapatilla|zapato|amazon|aliexpress|regalo|perfume|tecnolog|m[oó]vil|ordenador/i, "Compras"],
  [/netflix|spotify|hbo|disney|dazn|suscripci[oó]n|prime|icloud|drive|chatgpt|claude|dominio/i, "Suscripciones"],
  [/n[oó]mina|sueldo|salario|paga\b/i, "Nómina"],
]

/** Nombre de categoría sugerido por el concepto, o null si no hay pista */
export function sugerirCategoria(concepto: string): string | null {
  for (const [regex, nombre] of KEYWORDS) {
    if (regex.test(concepto)) return nombre
  }
  return null
}

/** Categoría de respaldo por tipo cuando no hay pista */
export const CATEGORIA_FALLBACK: Record<TipoMovimiento, string> = {
  gasto: "Otros gastos",
  ingreso: "Otros ingresos",
  inversion: "Aportación",
}
