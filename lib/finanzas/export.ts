import * as XLSX from "xlsx"
import type { Categoria, Movimiento } from "./types"

/**
 * Exportación a CSV y Excel (.xlsx).
 * - CSV con separador ";" y BOM UTF-8: es lo que Excel en español abre bien.
 * - Importes con signo de flujo de caja: ingreso +, gasto e inversión −,
 *   para que un autosuma en Excel dé el neto directamente.
 */

const ETIQUETA_TIPO = { ingreso: "Ingreso", gasto: "Gasto", inversion: "Inversión" } as const

interface FilaExport {
  fecha: string // DD/MM/YYYY
  tipo: string
  categoria: string
  concepto: string
  /** En euros, con signo (número) */
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

function descargar(blob: Blob, nombreArchivo: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nombreArchivo
  a.click()
  URL.revokeObjectURL(url)
}

/** Escapa un campo CSV si contiene ; comillas o saltos de línea */
function campoCSV(valor: string): string {
  if (/[";\n\r]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`
  return valor
}

export function exportarCSV(filas: FilaExport[], nombreArchivo: string) {
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
  // BOM UTF-8 para que Excel no destroce las tildes
  const contenido = "﻿" + [cabecera, ...lineas].join("\r\n")
  descargar(new Blob([contenido], { type: "text/csv;charset=utf-8" }), nombreArchivo)
}

export function exportarXLSX(
  filas: FilaExport[],
  nombreArchivo: string,
  nombreHoja: string
) {
  const hoja = XLSX.utils.json_to_sheet(
    filas.map((f) => ({
      Fecha: f.fecha,
      Tipo: f.tipo,
      Categoría: f.categoria,
      Concepto: f.concepto,
      Importe: f.importe,
    }))
  )
  // Formato de número con dos decimales en la columna Importe
  const rango = XLSX.utils.decode_range(hoja["!ref"] ?? "A1")
  for (let fila = 1; fila <= rango.e.r; fila++) {
    const celda = hoja[XLSX.utils.encode_cell({ r: fila, c: 4 })]
    // El código de formato usa convención US; Excel lo pinta según el idioma del sistema
    if (celda && typeof celda.v === "number") celda.z = "#,##0.00"
  }
  hoja["!cols"] = [
    { wch: 12 }, // Fecha
    { wch: 10 }, // Tipo
    { wch: 16 }, // Categoría
    { wch: 28 }, // Concepto
    { wch: 12 }, // Importe
  ]

  const libro = XLSX.utils.book_new()
  // El nombre de hoja de Excel no admite : \ / ? * [ ] y máx. 31 chars
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja.slice(0, 31))
  XLSX.writeFile(libro, nombreArchivo)
}
