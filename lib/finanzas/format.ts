/**
 * Formato es-ES / EUR para toda la app.
 * Los importes viven en céntimos (entero) y solo se convierten a € al pintar.
 */

const eurFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
})

/** 123456 → "1.234,56 €" */
export function formatEUR(cents: number): string {
  return eurFormatter.format(cents / 100)
}

/**
 * Convierte lo que teclea el usuario ("12,50", "1.234,56", "12.50") a céntimos.
 * Devuelve null si no es un importe válido (> 0).
 */
export function parseImporteToCents(input: string): number | null {
  const limpio = input.trim().replace(/[€\s]/g, "")
  if (!limpio) return null

  let normalizado: string
  if (limpio.includes(",")) {
    // Formato español: el punto es separador de miles y la coma decimal
    normalizado = limpio.replace(/\./g, "").replace(",", ".")
  } else {
    // Sin coma: un punto se interpreta como decimal ("12.50")
    normalizado = limpio
  }

  const valor = Number(normalizado)
  if (!Number.isFinite(valor) || valor <= 0) return null

  return Math.round(valor * 100)
}

/**
 * Parte un importe formateado para pintar los decimales atenuados:
 * 123456 → { entero: "1.234", resto: ",56 €" }
 */
export function partesEUR(cents: number): { entero: string; resto: string } {
  const f = eurFormatter.format(cents / 100)
  const i = f.indexOf(",")
  return i === -1
    ? { entero: f, resto: "" }
    : { entero: f.slice(0, i), resto: f.slice(i) }
}

/** 0.0834 → "8,3 %" (con signo si se pide) */
export function formatPct(ratio: number, conSigno = false): string {
  const pct = new Intl.NumberFormat("es-ES", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: conSigno ? "exceptZero" : "auto",
  }).format(ratio)
  return pct
}

/**
 * Fecha de hoy en formato YYYY-MM-DD, SIEMPRE en hora española.
 * Clave para el servidor: Vercel corre en UTC y sin esto los registros
 * del bot y los gastos fijos entre las 00:00 y las 02:00 caerían en "ayer".
 */
export function hoyISO(): string {
  // El locale sueco (sv-SE) formatea exactamente como YYYY-MM-DD
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(
    new Date()
  )
}

/** "2026-07-05" → "sáb, 5 jul" (o "hoy"/"ayer" si aplica) */
export function formatFechaCorta(fechaISO: string): string {
  const hoy = hoyISO()
  if (fechaISO === hoy) return "hoy"

  // "Ayer" derivado de hoyISO (aritmética de calendario, sin timezone)
  const [hy, hm, hd] = hoy.split("-").map(Number)
  const ayer = new Date(hy, hm - 1, hd - 1)
  const ayerISO = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, "0")}-${String(ayer.getDate()).padStart(2, "0")}`
  if (fechaISO === ayerISO) return "ayer"

  const [y, m, d] = fechaISO.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}
