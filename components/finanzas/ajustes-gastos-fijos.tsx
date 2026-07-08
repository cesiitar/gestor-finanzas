"use client"

import { useState } from "react"
import { Plus, RefreshCw } from "lucide-react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { formatEUR, parseImporteToCents } from "@/lib/finanzas/format"
import { useFinanzasCtx } from "./finanzas-provider"
import type { GastoFijo } from "@/lib/finanzas/types"

/**
 * Gastos fijos: se repiten igual todos los meses (alquiler, gym, Netflix…).
 * El cron diario los registra solos el día elegido y avisa por Telegram.
 */
export function AjustesGastosFijos() {
  const { gastosFijos, categorias, categoriasById, cargando, addGastoFijo, updateGastoFijo, deleteGastoFijo } =
    useFinanzasCtx()

  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<GastoFijo | null>(null)
  const [nombre, setNombre] = useState("")
  const [importe, setImporte] = useState("")
  const [dia, setDia] = useState("1")
  const [categoriaId, setCategoriaId] = useState<string | null>(null)

  const categoriasGasto = categorias.filter((c) => c.tipo === "gasto")
  const cents = parseImporteToCents(importe)
  const diaNum = Number(dia)
  const valido =
    nombre.trim() !== "" &&
    cents !== null &&
    categoriaId !== null &&
    Number.isInteger(diaNum) &&
    diaNum >= 1 &&
    diaNum <= 31

  function abrirNuevo() {
    setEditando(null)
    setNombre("")
    setImporte("")
    setDia("1")
    setCategoriaId(categoriasGasto[0]?.id ?? null)
    setAbierto(true)
  }

  function abrirEdicion(fijo: GastoFijo) {
    setEditando(fijo)
    setNombre(fijo.nombre)
    setImporte((fijo.importe_cents / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 }))
    setDia(String(fijo.dia_mes))
    setCategoriaId(fijo.categoria_id)
    setAbierto(true)
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!valido || cents === null || categoriaId === null) return
    const datos = {
      nombre: nombre.trim(),
      importe_cents: cents,
      dia_mes: diaNum,
      categoria_id: categoriaId,
    }
    if (editando) updateGastoFijo(editando.id, datos)
    else addGastoFijo(datos)
    setAbierto(false)
  }

  function borrar() {
    if (!editando) return
    deleteGastoFijo(editando.id)
    setAbierto(false)
  }

  if (cargando) return null

  const totalFijos = gastosFijos.reduce((s, f) => s + (f.activo ? f.importe_cents : 0), 0)

  return (
    <section>
      <div className="flex items-center justify-between px-1.5 pb-2">
        <h2 className="micro-label">Gastos fijos</h2>
        <button
          onClick={abrirNuevo}
          className="flex h-8 items-center gap-1 rounded-full border border-primary/30 bg-primary/[0.08] px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/[0.14] cursor-pointer"
        >
          <Plus className="size-3.5" aria-hidden /> Nuevo
        </button>
      </div>

      {gastosFijos.length === 0 ? (
        <div className="flex items-center gap-3 rounded-[1.25rem] border border-dashed border-white/10 px-4 py-5">
          <RefreshCw className="size-4.5 shrink-0 text-neutral-600" aria-hidden />
          <p className="text-sm text-neutral-400">
            Añade gastos que se repiten cada mes (alquiler, gimnasio…) y se
            registrarán solos el día que elijas.
          </p>
        </div>
      ) : (
        <>
          <ul className="card divide-y divide-white/[0.04] overflow-hidden">
            {gastosFijos.map((fijo) => (
              <li key={fijo.id}>
                <button
                  onClick={() => abrirEdicion(fijo)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] cursor-pointer"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] font-mono text-[11px] text-neutral-400" aria-hidden>
                    {fijo.dia_mes}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[15px]", fijo.activo ? "text-neutral-100" : "text-neutral-500 line-through")}>
                      {fijo.nombre}
                    </span>
                    <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                      {categoriasById.get(fijo.categoria_id)?.nombre} · día {fijo.dia_mes}
                    </span>
                  </span>
                  <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-rose-400">
                    −{formatEUR(fijo.importe_cents)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="px-1.5 pt-2 text-right text-xs tabular-nums text-neutral-500">
            Total fijo mensual: {formatEUR(totalFijos)}
          </p>
        </>
      )}

      <Drawer open={abierto} onOpenChange={setAbierto} repositionInputs={false}>
        <DrawerContent className="border-white/[0.08] bg-[#101216]">
          <DrawerHeader>
            <DrawerTitle>{editando ? `Editar ${editando.nombre}` : "Nuevo gasto fijo"}</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={guardar} className="flex flex-col gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre (p. ej. Alquiler)"
              aria-label="Nombre del gasto fijo"
              className="h-12 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-base outline-none placeholder:text-neutral-600 focus-visible:ring-2 focus-visible:ring-white/20"
            />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                inputMode="decimal"
                placeholder="Importe (0,00)"
                aria-label="Importe mensual en euros"
                className="h-12 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-base tabular-nums outline-none placeholder:text-neutral-600 focus-visible:ring-2 focus-visible:ring-white/20"
              />
              <label className="flex h-12 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-neutral-400">
                Día
                <input
                  value={dia}
                  onChange={(e) => setDia(e.target.value)}
                  inputMode="numeric"
                  aria-label="Día del mes (1 a 31)"
                  className="w-9 bg-transparent text-center text-base tabular-nums text-neutral-100 outline-none"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Categoría">
              {categoriasGasto.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="radio"
                  aria-checked={categoriaId === cat.id}
                  onClick={() => setCategoriaId(cat.id)}
                  className={cn(
                    "h-9 rounded-full border px-3 text-xs transition-colors cursor-pointer",
                    categoriaId === cat.id
                      ? "border-white/25 bg-white/10 text-white"
                      : "border-white/[0.07] bg-white/[0.02] text-neutral-400"
                  )}
                >
                  {cat.nombre}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={!valido}
              className="h-12 rounded-2xl bg-white text-base font-semibold text-neutral-950 transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
            >
              {editando ? "Guardar cambios" : "Crear gasto fijo"}
            </button>
            {editando && (
              <button
                type="button"
                onClick={borrar}
                className="h-11 rounded-2xl text-sm text-neutral-500 transition-colors hover:text-rose-400 cursor-pointer"
              >
                Eliminar gasto fijo
              </button>
            )}
          </form>
        </DrawerContent>
      </Drawer>
    </section>
  )
}
