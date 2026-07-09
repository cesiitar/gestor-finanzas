import type { Categoria, Movimiento } from "./types"

/**
 * Generación de CSV pura (sin dependencias de navegador ni de SheetJS):
 * la usan tanto la exportación de la app como el backup mensual del bot.
 * Separador ";" y BOM UTF-8: lo que Excel en español abre bien.
 */

const ETIQUETA_TIPO = { ingreso: "Ingreso", gasto: "Gasto", inversion: "Inversión" } as const

export interface FilaExport {
  fecha: string // DD/MM/YYYY
  tipo: string
  categoria: string
  concepto: string
  /** En euros, con signo de flujo de caja (ingreso +, gasto/inversión −) */
  importe: number
}

function signo(m: Movimiento): number {
  return m.tipo === "ingreso" ? 1 : -1
}

export function construirFilas(
  movimientos: Movimiento[],
  categoriasById: Map<string, Categoria>
): FilaExport[] {
  return movimientos.map((m) => {
    const [y, mes, d] = m.fecha.split("-")
    return {
      fecha: `${d}/${mes}/${y}`,
      tipo: ETIQUETA_TIPO[m.tipo],
      categoria: categoriasById.get(m.categoria_id)?.nombre ?? "Sin categoría",
      concepto: m.concepto,
      importe: (signo(m) * m.importe_cents) / 100,
    }
  })
}

/** Escapa un campo CSV si contiene ; comillas o saltos de línea */
function campoCSV(valor: string): string {
  if (/[";\n\r]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`
  return valor
}

/** Contenido CSV completo (con BOM UTF-8) listo para guardar o enviar */
export function generarCSV(filas: FilaExport[]): string {
  const cabecera = ["Fecha", "Tipo", "Categoría", "Concepto", "Importe"].join(";")
  const lineas = filas.map((f) =>
    [
      f.fecha,
      f.tipo,
      campoCSV(f.categoria),
      campoCSV(f.concepto),
      // Coma decimal, sin símbolo €: Excel es-ES lo reconoce como número
      f.importe.toFixed(2).replace(".", ","),
    ].join(";")
  )
  return "﻿" + [cabecera, ...lineas].join("\r\n")
}
