/**
 * Utilidades de semana (lunes a domingo, convención europea) para agrupar
 * la lista de movimientos. Todo opera sobre fechas ISO "YYYY-MM-DD" con
 * aritmética de calendario local, sin horas ni zonas horarias.
 */

const pad = (n: number) => String(n).padStart(2, "0")
const aISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Lunes de la semana a la que pertenece esa fecha */
export function lunesISO(fechaISO: string): string {
  const [y, m, d] = fechaISO.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = dt.getDay() // 0=domingo … 6=sábado
  const desdeLunes = dow === 0 ? 6 : dow - 1
  dt.setDate(dt.getDate() - desdeLunes)
  return aISO(dt)
}

/** Suma días a una fecha ISO */
export function sumarDias(fechaISO: string, dias: number): string {
  const [y, m, d] = fechaISO.split("-").map(Number)
  return aISO(new Date(y, m - 1, d + dias))
}

/**
 * Etiqueta de una semana a partir de su lunes:
 * "Esta semana", "Semana pasada" o el rango "7–13 jul" / "28 jun–4 jul".
 */
export function etiquetaSemana(lunes: string, hoyISO: string): string {
  const lunesActual = lunesISO(hoyISO)
  if (lunes === lunesActual) return "Esta semana"
  if (lunes === sumarDias(lunesActual, -7)) return "Semana pasada"

  const domingo = sumarDias(lunes, 6)
  const [ly, lm, ld] = lunes.split("-").map(Number)
  const [dy, dm, dd] = domingo.split("-").map(Number)
  const mesLunes = new Date(ly, lm - 1, ld).toLocaleDateString("es-ES", {
    month: "short",
  }).replace(".", "")
  const mesDomingo = new Date(dy, dm - 1, dd).toLocaleDateString("es-ES", {
    month: "short",
  }).replace(".", "")

  // Mismo mes: "7–13 jul"; distinto: "28 jun–4 jul"
  return lm === dm
    ? `${ld}–${dd} ${mesDomingo}`
    : `${ld} ${mesLunes}–${dd} ${mesDomingo}`
}
