"use client"

import { useMemo, useState } from "react"
import { Plus } from "lucide-react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { getIconoCategoria } from "@/lib/finanzas/iconos"
import { useFinanzasCtx } from "./finanzas-provider"
import type { Categoria, TipoMovimiento } from "@/lib/finanzas/types"

const TIPOS: { valor: TipoMovimiento; etiqueta: string }[] = [
  { valor: "gasto", etiqueta: "Gasto" },
  { valor: "ingreso", etiqueta: "Ingreso" },
  { valor: "inversion", etiqueta: "Inversión" },
]

/** Crear, renombrar y borrar categorías (con reasignación si tienen movimientos) */
export function AjustesCategorias() {
  const {
    categorias,
    movimientos,
    gastosFijos,
    cargando,
    addCategoria,
    renombrarCategoria,
    borrarCategoria,
  } = useFinanzasCtx()

  const [nuevaAbierta, setNuevaAbierta] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState("")
  const [nuevoTipo, setNuevoTipo] = useState<TipoMovimiento>("gasto")

  const [editando, setEditando] = useState<Categoria | null>(null)
  const [nombreEdit, setNombreEdit] = useState("")
  const [reasignarA, setReasignarA] = useState<string | null>(null)
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)

  /** Cuántos movimientos/fijos usan cada categoría (para el flujo de borrado) */
  const usoPorCategoria = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const m of movimientos)
      mapa.set(m.categoria_id, (mapa.get(m.categoria_id) ?? 0) + 1)
    for (const f of gastosFijos)
      mapa.set(f.categoria_id, (mapa.get(f.categoria_id) ?? 0) + 1)
    return mapa
  }, [movimientos, gastosFijos])

  function abrirEdicion(cat: Categoria) {
    setEditando(cat)
    setNombreEdit(cat.nombre)
    setReasignarA(null)
    setConfirmandoBorrado(false)
  }

  async function guardarNombre(e: React.FormEvent) {
    e.preventDefault()
    if (!editando || !nombreEdit.trim()) return
    renombrarCategoria(editando.id, nombreEdit.trim())
    setEditando(null)
  }

  async function borrar() {
    if (!editando) return
    const uso = usoPorCategoria.get(editando.id) ?? 0
    if (uso > 0 && !reasignarA) return // la UI exige elegir destino antes
    const ok = await borrarCategoria(editando.id, reasignarA ?? undefined)
    if (ok) setEditando(null)
  }

  function crear(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevoNombre.trim()) return
    addCategoria(nuevoNombre.trim(), nuevoTipo)
    setNuevoNombre("")
    setNuevaAbierta(false)
  }

  if (cargando) return null

  const usoEditando = editando ? (usoPorCategoria.get(editando.id) ?? 0) : 0
  const destinos = editando
    ? categorias.filter((c) => c.tipo === editando.tipo && c.id !== editando.id)
    : []

  return (
    <section>
      <div className="flex items-center justify-between px-1.5 pb-2">
        <h2 className="micro-label">Categorías</h2>
        <button
          onClick={() => setNuevaAbierta(true)}
          className="flex h-8 items-center gap-1 rounded-full border border-primary/30 bg-primary/[0.08] px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/[0.14] cursor-pointer"
        >
          <Plus className="size-3.5" aria-hidden /> Nueva
        </button>
      </div>

      <ul className="card divide-y divide-white/[0.04] overflow-hidden">
        {TIPOS.map(({ valor, etiqueta }) => {
          const delTipo = categorias.filter((c) => c.tipo === valor)
          if (delTipo.length === 0) return null
          return (
            <li key={valor}>
              <p className="micro-label px-4 pt-3 pb-1">{etiqueta}s</p>
              <ul>
                {delTipo.map((cat) => {
                  const Icono = getIconoCategoria(cat.nombre, cat.tipo)
                  return (
                    <li key={cat.id}>
                      <button
                        onClick={() => abrirEdicion(cat)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] cursor-pointer"
                      >
                        <Icono className="size-4 shrink-0 text-neutral-500" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-[15px] text-neutral-100">
                          {cat.nombre}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-neutral-600">
                          {usoPorCategoria.get(cat.id) ?? 0} mov.
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </li>
          )
        })}
      </ul>

      {/* Nueva categoría */}
      <Drawer open={nuevaAbierta} onOpenChange={setNuevaAbierta} repositionInputs={false}>
        <DrawerContent className="border-white/[0.08] bg-[#101216]">
          <DrawerHeader>
            <DrawerTitle>Nueva categoría</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={crear} className="flex flex-col gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Tipo">
              {TIPOS.map((t) => (
                <button
                  key={t.valor}
                  type="button"
                  role="radio"
                  aria-checked={nuevoTipo === t.valor}
                  onClick={() => setNuevoTipo(t.valor)}
                  className={cn(
                    "h-10 rounded-full border text-sm transition-colors cursor-pointer",
                    nuevoTipo === t.valor
                      ? "border-white/25 bg-white/10 font-medium text-white"
                      : "border-white/[0.07] bg-white/[0.02] text-neutral-400"
                  )}
                >
                  {t.etiqueta}
                </button>
              ))}
            </div>
            <input
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              autoFocus
              placeholder="Nombre (p. ej. Mascotas)"
              aria-label="Nombre de la categoría"
              className="h-12 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-base outline-none placeholder:text-neutral-600 focus-visible:ring-2 focus-visible:ring-white/20"
            />
            <button
              type="submit"
              disabled={!nuevoNombre.trim()}
              className="h-12 rounded-2xl bg-white text-base font-semibold text-neutral-950 transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
            >
              Crear categoría
            </button>
          </form>
        </DrawerContent>
      </Drawer>

      {/* Editar / borrar categoría */}
      <Drawer
        open={editando !== null}
        onOpenChange={(open) => !open && setEditando(null)}
        repositionInputs={false}
      >
        <DrawerContent className="border-white/[0.08] bg-[#101216]">
          <DrawerHeader>
            <DrawerTitle>Editar categoría</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-3 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <form onSubmit={guardarNombre} className="flex gap-2">
              <input
                value={nombreEdit}
                onChange={(e) => setNombreEdit(e.target.value)}
                aria-label="Nombre de la categoría"
                className="h-12 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              />
              <button
                type="submit"
                disabled={!nombreEdit.trim() || nombreEdit.trim() === editando?.nombre}
                className="h-12 shrink-0 rounded-xl bg-white px-4 text-sm font-semibold text-neutral-950 transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
              >
                Renombrar
              </button>
            </form>

            {!confirmandoBorrado ? (
              <button
                onClick={() => setConfirmandoBorrado(true)}
                className="h-11 rounded-2xl text-sm text-neutral-500 transition-colors hover:text-rose-400 cursor-pointer"
              >
                Borrar categoría…
              </button>
            ) : (
              <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] p-4">
                {usoEditando > 0 ? (
                  <>
                    <p className="pb-3 text-sm text-neutral-300">
                      Esta categoría tiene <b>{usoEditando}</b> movimiento(s).
                      Elige a qué categoría pasarlos antes de borrarla:
                    </p>
                    <div className="flex flex-wrap gap-2 pb-3" role="radiogroup" aria-label="Reasignar a">
                      {destinos.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          role="radio"
                          aria-checked={reasignarA === c.id}
                          onClick={() => setReasignarA(c.id)}
                          className={cn(
                            "h-9 rounded-full border px-3 text-xs transition-colors cursor-pointer",
                            reasignarA === c.id
                              ? "border-white/25 bg-white/10 text-white"
                              : "border-white/[0.07] bg-white/[0.02] text-neutral-400"
                          )}
                        >
                          {c.nombre}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="pb-3 text-sm text-neutral-300">
                    No tiene movimientos. ¿Borrar definitivamente?
                  </p>
                )}
                <button
                  onClick={borrar}
                  disabled={usoEditando > 0 && !reasignarA}
                  className="h-11 w-full rounded-xl bg-rose-500 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
                >
                  {usoEditando > 0 ? "Reasignar y borrar" : "Borrar"}
                </button>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </section>
  )
}
