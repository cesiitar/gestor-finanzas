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
 * Convierte lo que teclea el usuario a céntimos, tolerante con el formato:
 * "12,50", "1.234,56", "12.50", "3.629" (miles), "3.629.54"… Devuelve el
 * número en céntimos (puede ser 0 o negativo) o null si no es un número.
 *
 * Reglas es-ES: la coma SIEMPRE es decimal. Con solo puntos, se decide por
 * contexto: un punto con 3 dígitos detrás es separador de miles ("3.629" =
 * 3629); con 1–2 dígitos es decimal ("12.50" = 12,50).
 */
export function parseNumeroToCents(input: string): number | null {
  let s = input.trim().replace(/[€\s]/g, "")
  const negativo = /^[-−]/.test(s)
  s = s.replace(/^[-−]/, "")
  if (!s) return null

  if (s.includes(",")) {
    // Coma decimal; los puntos son separadores de miles
    s = s.replace(/\./g, "").replace(",", ".")
  } else {
    const puntos = (s.match(/\./g) ?? []).length
    if (puntos > 0) {
      const idx = s.lastIndexOf(".")
      const decimales = s.length - idx - 1
      if (puntos > 1) {
        // Varios puntos: el último es decimal si trae 1–2 dígitos; si no, todos miles
        s =
          decimales <= 2
            ? s.slice(0, idx).replace(/\./g, "") + "." + s.slice(idx + 1)
            : s.replace(/\./g, "")
      } else if (decimales === 3) {
        // Un punto con 3 dígitos detrás → miles ("3.629" = 3629)
        s = s.replace(/\./g, "")
      }
      // Un punto con 1–2 dígitos detrás → decimal, se deja tal cual
    }
  }

  const valor = Number(s)
  if (!Number.isFinite(valor)) return null
  return Math.round((negativo ? -valor : valor) * 100)
}

/**
 * Igual que parseNumeroToCents pero solo acepta importes > 0 (para gastos,
 * ingresos y aportaciones). Devuelve null si es 0, negativo o inválido.
 */
export function parseImporteToCents(input: string): number | null {
  const cents = parseNumeroToCents(input)
  return cents !== null && cents > 0 ? cents : null
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
