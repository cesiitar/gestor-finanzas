import * as XLSX from "xlsx"
import { construirFilas, generarCSV, type FilaExport } from "./csv"

/**
 * Exportación desde el navegador a CSV y Excel (.xlsx).
 * La lógica de construcción del CSV vive en csv.ts (compartida con el
 * backup mensual del bot, que corre en servidor).
 */

export { construirFilas } from "./csv"

function descargar(blob: Blob, nombreArchivo: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nombreArchivo
  a.click()
  URL.revokeObjectURL(url)
}

export function exportarCSV(filas: FilaExport[], nombreArchivo: string) {
  descargar(
    new Blob([generarCSV(filas)], { type: "text/csv;charset=utf-8" }),
    nombreArchivo
  )
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
  // El código de formato usa convención US; Excel lo pinta según el idioma del sistema
  const rango = XLSX.utils.decode_range(hoja["!ref"] ?? "A1")
  for (let fila = 1; fila <= rango.e.r; fila++) {
    const celda = hoja[XLSX.utils.encode_cell({ r: fila, c: 4 })]
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
