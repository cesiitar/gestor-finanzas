/** Utilidades de mes en formato "YYYY-MM" */

/** "2026-07" → "julio 2026" */
export function etiquetaMes(mesISO: string): string {
  const [y, m] = mesISO.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  })
}

/** Suma meses a un "YYYY-MM" */
export function sumarMeses(mesISO: string, delta: number): string {
  const [y, m] = mesISO.split("-").map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
