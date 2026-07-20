/**
 * Semanas del MES (no naturales): la semana 1 son los días 1–7, la 2 los
 * 8–14, etc. Así cada semana cae siempre dentro de un único mes y nunca
 * queda partida entre dos meses. Opera sobre fechas ISO "YYYY-MM-DD".
 */

/** Número de semana del mes (1..5) al que pertenece esa fecha */
export function semanaDelMes(fechaISO: string): number {
  const dia = Number(fechaISO.slice(8, 10))
  return Math.floor((dia - 1) / 7) + 1
}

/** Rango de días de esa semana del mes: "1–7", "8–14", "29–31"… */
export function rangoSemanaDelMes(fechaISO: string): string {
  const [y, m] = fechaISO.split("-").map(Number)
  const n = semanaDelMes(fechaISO)
  const ultimoDia = new Date(y, m, 0).getDate() // día 0 del mes siguiente
  const ini = (n - 1) * 7 + 1
  const fin = Math.min(n * 7, ultimoDia)
  return `${ini}–${fin}`
}
