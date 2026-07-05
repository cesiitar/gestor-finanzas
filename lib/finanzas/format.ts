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

/** Fecha local de hoy en formato YYYY-MM-DD (sin sorpresas de timezone) */
export function hoyISO(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, "0")
  const dia = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mes}-${dia}`
}

/** "2026-07-05" → "sáb, 5 jul" (o "hoy"/"ayer" si aplica) */
export function formatFechaCorta(fechaISO: string): string {
  if (fechaISO === hoyISO()) return "hoy"

  const ayer = new Date()
  ayer.setDate(ayer.getDate() - 1)
  const ayerISO = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, "0")}-${String(ayer.getDate()).padStart(2, "0")}`
  if (fechaISO === ayerISO) return "ayer"

  const [y, m, d] = fechaISO.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}
