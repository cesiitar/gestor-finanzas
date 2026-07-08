"use client"

import { useMemo, useState } from "react"
import { Download, ArrowUp, ArrowDown, Table2, Search } from "lucide-react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { formatEUR, hoyISO } from "@/lib/finanzas/format"
import { etiquetaMes } from "@/lib/finanzas/mes"
import { construirFilas, exportarCSV, exportarXLSX } from "@/lib/finanzas/export"
import { useFinanzasCtx } from "./finanzas-provider"
import { MesSelector } from "./mes-selector"
import type { Movimiento } from "@/lib/finanzas/types"

const ETIQUETA_TIPO = { ingreso: "Ingreso", gasto: "Gasto", inversion: "Inv." } as const
const COLOR_TIPO_TEXTO = {
  ingreso: "text-emerald-400",
  gasto: "text-rose-400",
  inversion: "text-sky-400",
} as const

type Columna = "fecha" | "tipo" | "categoria" | "concepto" | "importe"

/**
 * Vista Tabla: el mes completo en filas y columnas, como en Excel.
 * Ordenable por columna, con fila de totales y exportación a CSV/XLSX.
 * En móvil hace scroll horizontal con la columna de importe siempre visible.
 */
export function TablaView() {
  const { movimientos, categoriasById, cargando } = useFinanzasCtx()

  const mesActual = hoyISO().slice(0, 7)
  const [mes, setMes] = useState(mesActual)
  const [orden, setOrden] = useState<{ col: Columna; asc: boolean }>({
    col: "fecha",
    asc: false,
  })
  const [exportAbierto, setExportAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState("")

  const delMes = useMemo(() => {
    const base = movimientos.filter((m) => m.fecha.startsWith(mes))
    const q = busqueda.trim().toLowerCase()
    if (!q) return base
    return base.filter(
      (m) =>
        m.concepto.toLowerCase().includes(q) ||
        (categoriasById.get(m.categoria_id)?.nombre.toLowerCase() ?? "").includes(q)
    )
  }, [movimientos, mes, busqueda, categoriasById])

  const ordenados = useMemo(() => {
    const valor = (m: Movimiento): string | number => {
      switch (orden.col) {
        case "fecha":
          return m.fecha
        case "tipo":
          return m.tipo
        case "categoria":
          return categoriasById.get(m.categoria_id)?.nombre ?? ""
        case "concepto":
          return m.concepto
        case "importe":
          return m.importe_cents
      }
    }
    return [...delMes].sort((a, b) => {
      const va = valor(a)
      const vb = valor(b)
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "es")
      return orden.asc ? cmp : -cmp
    })
  }, [delMes, orden, categoriasById])

  const totales = useMemo(() => {
    let ingresos = 0
    let gastos = 0
    let inversion = 0
    for (const m of delMes) {
      if (m.tipo === "ingreso") ingresos += m.importe_cents
      else if (m.tipo === "gasto") gastos += m.importe_cents
      else inversion += m.importe_cents
    }
    return { ingresos, gastos, inversion, ahorro: ingresos - gastos }
  }, [delMes])

  function toggleOrden(col: Columna) {
    setOrden((prev) =>
      prev.col === col ? { col, asc: !prev.asc } : { col, asc: col !== "importe" && col !== "fecha" }
    )
  }

  function handleExport(alcance: "mes" | "todo", formato: "csv" | "xlsx") {
    const movs = alcance === "mes" ? ordenados : movimientos
    const filas = construirFilas(movs, categoriasById)
    const sufijo = alcance === "mes" ? mes : "todo"
    if (formato === "csv") {
      exportarCSV(filas, `finanzas-${sufijo}.csv`)
    } else {
      exportarXLSX(
        filas,
        `finanzas-${sufijo}.xlsx`,
        alcance === "mes" ? etiquetaMes(mes) : "Todos los movimientos"
      )
    }
    setExportAbierto(false)
  }

  const CABECERAS: { col: Columna; etiqueta: string; className?: string }[] = [
    { col: "fecha", etiqueta: "Fecha" },
    { col: "tipo", etiqueta: "Tipo" },
    { col: "categoria", etiqueta: "Categoría" },
    { col: "concepto", etiqueta: "Concepto" },
    { col: "importe", etiqueta: "Importe", className: "text-right" },
  ]

  return (
    <>
      <header className="flex items-end justify-between px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-3">
        <div>
          <p className="micro-label">Gestor de finanzas</p>
          <h1 className="pt-1 font-display text-[26px] font-semibold leading-none tracking-tight">
            Tabla
          </h1>
        </div>
        <button
          onClick={() => setExportAbierto(true)}
          aria-label="Exportar"
          className="flex h-10 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.08] px-3.5 text-sm font-medium text-primary transition-colors hover:bg-primary/[0.14] cursor-pointer"
        >
          <Download className="size-4" aria-hidden />
          Exportar
        </button>
      </header>

      <MesSelector mes={mes} onChange={setMes} />

      {/* Búsqueda por concepto o categoría dentro del mes */}
      <div className="px-4 pb-2">
        <label className="flex h-10 items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.02] px-3.5">
          <Search className="size-4 shrink-0 text-neutral-500" aria-hidden />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar concepto o categoría…"
            aria-label="Buscar movimientos"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-600"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda("")}
              className="text-xs text-neutral-500 hover:text-neutral-200 cursor-pointer"
            >
              Limpiar
            </button>
          )}
        </label>
      </div>

      <main className="px-2">
        {cargando ? (
          <div className="mx-2 h-64 animate-pulse rounded-2xl bg-neutral-900" />
        ) : delMes.length === 0 ? (
          <div className="mx-2 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-800 px-6 py-16 text-center">
            <Table2 className="size-8 text-neutral-600" aria-hidden />
            <p className="text-sm text-neutral-400">
              Sin movimientos en {etiquetaMes(mes)}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[1.25rem] border border-white/[0.07] bg-[#14161b]">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-800 bg-[#181b21] text-left text-xs text-neutral-400">
                  {CABECERAS.map(({ col, etiqueta, className }) => (
                    <th
                      key={col}
                      aria-sort={
                        orden.col === col
                          ? orden.asc
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                      className={cn(
                        "font-medium",
                        col === "importe" &&
                          "sticky right-0 bg-[#181b21] shadow-[inset_1px_0_0_0_theme(colors.neutral.800)]"
                      )}
                    >
                      <button
                        onClick={() => toggleOrden(col)}
                        className={cn(
                          "flex w-full items-center gap-1 px-3 py-2.5 cursor-pointer",
                          className === "text-right" && "justify-end"
                        )}
                      >
                        {etiqueta}
                        {orden.col === col &&
                          (orden.asc ? (
                            <ArrowUp className="size-3" aria-hidden />
                          ) : (
                            <ArrowDown className="size-3" aria-hidden />
                          ))}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordenados.map((m) => {
                  const [, mm, dd] = m.fecha.split("-")
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-neutral-800/60 last:border-0"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-neutral-300">
                        {dd}/{mm}
                      </td>
                      <td className={cn("px-3 py-2.5 text-xs font-medium", COLOR_TIPO_TEXTO[m.tipo])}>
                        {ETIQUETA_TIPO[m.tipo]}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-neutral-300">
                        {categoriasById.get(m.categoria_id)?.nombre ?? "—"}
                      </td>
                      <td className="max-w-40 truncate px-3 py-2.5 text-neutral-400">
                        {m.concepto || "—"}
                      </td>
                      <td
                        className={cn(
                          "sticky right-0 whitespace-nowrap bg-[#14161b] px-3 py-2.5 text-right font-medium tabular-nums shadow-[inset_1px_0_0_0_theme(colors.neutral.800)]",
                          COLOR_TIPO_TEXTO[m.tipo]
                        )}
                      >
                        {m.tipo === "gasto" ? "−" : m.tipo === "ingreso" ? "+" : ""}
                        {formatEUR(m.importe_cents)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t border-neutral-700 bg-[#181b21] text-xs">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right text-neutral-400">
                    Ingresos
                  </td>
                  <td className="sticky right-0 bg-[#181b21] px-3 py-2 text-right font-medium tabular-nums text-emerald-400 shadow-[inset_1px_0_0_0_theme(colors.neutral.800)]">
                    +{formatEUR(totales.ingresos)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right text-neutral-400">
                    Gastos
                  </td>
                  <td className="sticky right-0 bg-[#181b21] px-3 py-2 text-right font-medium tabular-nums text-rose-400 shadow-[inset_1px_0_0_0_theme(colors.neutral.800)]">
                    −{formatEUR(totales.gastos)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right text-neutral-400">
                    Inversión
                  </td>
                  <td className="sticky right-0 bg-[#181b21] px-3 py-2 text-right font-medium tabular-nums text-sky-400 shadow-[inset_1px_0_0_0_theme(colors.neutral.800)]">
                    {formatEUR(totales.inversion)}
                  </td>
                </tr>
                <tr className="border-t border-neutral-700">
                  <td colSpan={4} className="px-3 py-2.5 text-right font-medium text-neutral-200">
                    Ahorro (ingresos − gastos)
                  </td>
                  <td
                    className={cn(
                      "sticky right-0 bg-[#181b21] px-3 py-2.5 text-right font-semibold tabular-nums shadow-[inset_1px_0_0_0_theme(colors.neutral.800)]",
                      totales.ahorro >= 0 ? "text-emerald-400" : "text-rose-400"
                    )}
                  >
                    {totales.ahorro < 0 && "−"}
                    {formatEUR(Math.abs(totales.ahorro))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </main>

      {/* Opciones de exportación */}
      <Drawer open={exportAbierto} onOpenChange={setExportAbierto}>
        <DrawerContent className="border-white/[0.08] bg-[#101216]">
          <DrawerHeader>
            <DrawerTitle>Exportar movimientos</DrawerTitle>
          </DrawerHeader>
          <div className="grid grid-cols-2 gap-2.5 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <button
              onClick={() => handleExport("mes", "xlsx")}
              className="h-14 rounded-2xl bg-emerald-600 text-sm font-semibold text-white transition-all active:scale-[0.98] cursor-pointer"
            >
              Excel · {etiquetaMes(mes)}
            </button>
            <button
              onClick={() => handleExport("mes", "csv")}
              className="h-14 rounded-2xl border border-neutral-700 bg-neutral-900 text-sm font-medium text-neutral-200 transition-all active:scale-[0.98] cursor-pointer"
            >
              CSV · {etiquetaMes(mes)}
            </button>
            <button
              onClick={() => handleExport("todo", "xlsx")}
              className="h-14 rounded-2xl bg-emerald-600/80 text-sm font-semibold text-white transition-all active:scale-[0.98] cursor-pointer"
            >
              Excel · todo
            </button>
            <button
              onClick={() => handleExport("todo", "csv")}
              className="h-14 rounded-2xl border border-neutral-700 bg-neutral-900 text-sm font-medium text-neutral-200 transition-all active:scale-[0.98] cursor-pointer"
            >
              CSV · todo
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
