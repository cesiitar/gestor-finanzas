"use client"

import { useState } from "react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { formatEUR, parseImporteToCents } from "@/lib/finanzas/format"
import { getIconoCategoria } from "@/lib/finanzas/iconos"
import { useFinanzasCtx } from "./finanzas-provider"
import type { Categoria } from "@/lib/finanzas/types"

/**
 * Presupuesto mensual por categoría de gasto: tocar una categoría abre el
 * editor. El dashboard usa estos límites para las barras de progreso.
 */
export function AjustesPresupuestos() {
  const { categorias, cargando, setPresupuestoCategoria } = useFinanzasCtx()
  const [editando, setEditando] = useState<Categoria | null>(null)
  const [valor, setValor] = useState("")

  const gastos = categorias.filter((c) => c.tipo === "gasto")
  const cents = parseImporteToCents(valor)

  function abrir(cat: Categoria) {
    setValor(
      cat.presupuesto_mensual_cents != null
        ? (cat.presupuesto_mensual_cents / 100).toLocaleString("es-ES", {
            minimumFractionDigits: 2,
          })
        : ""
    )
    setEditando(cat)
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!editando || cents === null) return
    setPresupuestoCategoria(editando.id, cents)
    setEditando(null)
  }

  function quitar() {
    if (!editando) return
    setPresupuestoCategoria(editando.id, null)
    setEditando(null)
  }

  if (cargando) {
    return <div className="h-40 animate-pulse rounded-2xl bg-neutral-900" aria-busy />
  }

  return (
    <section>
      <h2 className="px-1.5 pb-2 text-sm font-medium text-neutral-500">
        Presupuestos mensuales
      </h2>
      <ul className="overflow-hidden rounded-2xl bg-neutral-900/70">
        {gastos.map((cat) => {
          const Icono = getIconoCategoria(cat.nombre, cat.tipo)
          return (
            <li key={cat.id} className="border-b border-neutral-800/60 last:border-0">
              <button
                onClick={() => abrir(cat)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-neutral-900 cursor-pointer"
              >
                <Icono className="size-4.5 shrink-0 text-neutral-500" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[15px] text-neutral-100">
                  {cat.nombre}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-neutral-400">
                  {cat.presupuesto_mensual_cents != null
                    ? `${formatEUR(cat.presupuesto_mensual_cents)}/mes`
                    : "Sin presupuesto"}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <Drawer
        open={editando !== null}
        onOpenChange={(open) => !open && setEditando(null)}
        repositionInputs={false}
      >
        <DrawerContent className="bg-neutral-950 border-neutral-800">
          <DrawerHeader>
            <DrawerTitle>Presupuesto mensual de {editando?.nombre}</DrawerTitle>
          </DrawerHeader>
          <form
            onSubmit={guardar}
            className="flex flex-col gap-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-baseline justify-center gap-1 py-2">
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
                autoFocus
                placeholder="0,00"
                aria-label="Presupuesto mensual en euros"
                className="w-44 bg-transparent text-right text-4xl font-semibold tabular-nums outline-none placeholder:text-neutral-700"
              />
              <span className="text-2xl font-medium text-neutral-400">€</span>
            </div>
            <button
              type="submit"
              disabled={cents === null}
              className="h-12 rounded-2xl bg-white text-base font-semibold text-neutral-950 transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
            >
              Guardar presupuesto
            </button>
            {editando?.presupuesto_mensual_cents != null && (
              <button
                type="button"
                onClick={quitar}
                className="h-11 rounded-2xl text-sm text-neutral-500 transition-colors hover:text-rose-400 cursor-pointer"
              >
                Quitar presupuesto
              </button>
            )}
          </form>
        </DrawerContent>
      </Drawer>
    </section>
  )
}
