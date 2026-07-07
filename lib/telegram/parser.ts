import { parseImporteToCents } from "@/lib/finanzas/format"
import type { TipoMovimiento } from "@/lib/finanzas/types"

/**
 * Parser del registro rápido por Telegram.
 * Formatos aceptados (el tipo es opcional, por defecto gasto):
 *   "12,50 cena mercadona"
 *   "gasto 12,50 cena"
 *   "ingreso 1200 nomina"
 *   "inversion 200 indexado"
 */

export interface MensajeParseado {
  tipo: TipoMovimiento
  importeCents: number
  concepto: string
}

const TIPOS: Record<string, TipoMovimiento> = {
  gasto: "gasto",
  ingreso: "ingreso",
  inversion: "inversion",
  inversión: "inversion",
}

export function parsearMovimiento(texto: string): MensajeParseado | null {
  const tokens = texto.trim().split(/\s+/)
  if (tokens.length === 0) return null

  let tipo: TipoMovimiento = "gasto"
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
    .filter((_, i) => i !== idxImporte && i >= inicio)
    .join(" ")
    .trim()

  return { tipo, importeCents, concepto }
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
  [/farmacia|m[eé]dico|dentista|fisio|gimnasio|gym|salud|[oó]ptica|anal[ií]tica/i, "Salud"],
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
