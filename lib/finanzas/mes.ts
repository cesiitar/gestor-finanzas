/** Utilidades de mes en formato "YYYY-MM" */

/** "2026-07" → "Julio 2026" (sin el "de", y solo la inicial en mayúscula) */
export function etiquetaMes(mesISO: string): string {
  const [y, m] = mesISO.split("-").map(Number)
  const s = new Date(y, m - 1, 1)
    .toLocaleDateString("es-ES", { month: "long", year: "numeric" })
    .replace(" de ", " ")
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Suma meses a un "YYYY-MM" */
export function sumarMeses(mesISO: string, delta: number): string {
  const [y, m] = mesISO.split("-").map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
