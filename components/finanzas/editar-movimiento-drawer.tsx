"use client"

import { useEffect, useState } from "react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { hoyISO, parseImporteToCents } from "@/lib/finanzas/format"
import { COLOR_TIPO } from "@/lib/finanzas/iconos"
import { useFinanzasCtx } from "./finanzas-provider"
import type { Movimiento } from "@/lib/finanzas/types"

/** Editar o borrar un movimiento existente (se abre al tocarlo en la lista) */
export function EditarMovimientoDrawer({
  movimiento,
  onOpenChange,
}: {
  movimiento: Movimiento | null
  onOpenChange: (open: boolean) => void
}) {
  const { categorias, updateMovimiento, deleteMovimiento } = useFinanzasCtx()

  const [importe, setImporte] = useState("")
  const [concepto, setConcepto] = useState("")
  const [fecha, setFecha] = useState("")
  const [categoriaId, setCategoriaId] = useState<string | null>(null)

  useEffect(() => {
    if (movimiento) {
      setImporte(
        (movimiento.importe_cents / 100).toLocaleString("es-ES", {
          minimumFractionDigits: 2,
        })
      )
      setConcepto(movimiento.concepto)
      setFecha(movimiento.fecha)
      setCategoriaId(movimiento.categoria_id)
    }
  }, [movimiento])

  if (!movimiento) {
    return (
      <Drawer open={false} onOpenChange={onOpenChange}>
        <DrawerContent className="border-white/[0.08] bg-[#101216]" />
      </Drawer>
    )
  }

  const delTipo = categorias.filter((c) => c.tipo === movimiento.tipo)
  const cents = parseImporteToCents(importe)
  const valido = cents !== null && categoriaId !== null && fecha !== ""

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!movimiento || !valido || cents === null || categoriaId === null) return
    updateMovimiento(movimiento.id, {
      importe_cents: cents,
      concepto: concepto.trim(),
      fecha,
      categoria_id: categoriaId,
    })
    onOpenChange(false)
  }

  function borrar() {
    if (!movimiento) return
    deleteMovimiento(movimiento.id)
    onOpenChange(false)
  }

  return (
    <Drawer open onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="border-white/[0.08] bg-[#101216]">
        <DrawerHeader>
          <DrawerTitle>Editar movimiento</DrawerTitle>
        </DrawerHeader>
        <form
          onSubmit={guardar}
          className="flex flex-col gap-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex items-baseline justify-center gap-1 py-1">
            <input
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              inputMode="decimal"
              aria-label="Importe en euros"
              className={cn(
                "w-40 bg-transparent text-right font-display text-4xl font-semibold tabular-nums outline-none placeholder:text-neutral-700",
                COLOR_TIPO[movimiento.tipo].texto
              )}
            />
            <span className={cn("text-2xl font-medium", COLOR_TIPO[movimiento.tipo].texto)}>
              €
            </span>
          </div>

          <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Categoría">
            {delTipo.map((cat) => (
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

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Concepto (opcional)"
              aria-label="Concepto"
              className="h-12 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-base outline-none placeholder:text-neutral-600 focus-visible:ring-2 focus-visible:ring-white/20"
            />
            <input
              type="date"
              value={fecha}
              max={hoyISO()}
              onChange={(e) => setFecha(e.target.value)}
              aria-label="Fecha"
              className="h-12 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-neutral-300 outline-none focus-visible:ring-2 focus-visible:ring-white/20 [color-scheme:dark]"
            />
          </div>

          <button
            type="submit"
            disabled={!valido}
            className="h-12 rounded-2xl bg-white text-base font-semibold text-neutral-950 transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
          >
            Guardar cambios
          </button>
          <button
            type="button"
            onClick={borrar}
            className="h-11 rounded-2xl text-sm text-neutral-500 transition-colors hover:text-rose-400 cursor-pointer"
          >
            Eliminar movimiento
          </button>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
