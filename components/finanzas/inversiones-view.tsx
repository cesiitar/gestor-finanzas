"use client"

import { useMemo, useState } from "react"
import { Plus, PencilLine } from "lucide-react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { formatEUR, formatPct, parseImporteToCents } from "@/lib/finanzas/format"
import { useFinanzasCtx } from "./finanzas-provider"
import { MovimientosList } from "./movimientos-list"
import type { Posicion } from "@/lib/finanzas/types"

/** Signo delante de una ganancia ya formateada */
function eurConSigno(cents: number): string {
  return `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${formatEUR(Math.abs(cents))}`
}

function colorGanancia(cents: number): string {
  if (cents > 0) return "text-emerald-400"
  if (cents < 0) return "text-rose-400"
  return "text-neutral-400"
}

/**
 * Inversiones: cartera de posiciones (aportado derivado de los movimientos
 * vinculados, valor actual editado a mano) + historial de aportaciones.
 */
export function InversionesView() {
  const {
    movimientos,
    posiciones,
    categoriasById,
    cargando,
    addPosicion,
    setValorPosicion,
  } = useFinanzasCtx()

  const [nuevaAbierta, setNuevaAbierta] = useState(false)
  const [editando, setEditando] = useState<Posicion | null>(null)

  const aportaciones = useMemo(
    () => movimientos.filter((m) => m.tipo === "inversion"),
    [movimientos]
  )

  /** Aportado por posición, derivado de los movimientos vinculados */
  const aportadoPorPosicion = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const m of aportaciones) {
      if (m.posicion_id)
        mapa.set(m.posicion_id, (mapa.get(m.posicion_id) ?? 0) + m.importe_cents)
    }
    return mapa
  }, [aportaciones])

  // KPIs de cartera. La ganancia solo compara posiciones (valor vs aportado
  // vinculado); lo aportado sin posición cuenta en el total invertido.
  const invertidoTotal = aportaciones.reduce((s, m) => s + m.importe_cents, 0)
  const valorCartera = posiciones.reduce((s, p) => s + p.valor_actual_cents, 0)
  const aportadoVinculado = posiciones.reduce(
    (s, p) => s + (aportadoPorPosicion.get(p.id) ?? 0),
    0
  )
  const ganancia = valorCartera - aportadoVinculado
  const rentabilidad = aportadoVinculado > 0 ? ganancia / aportadoVinculado : 0

  return (
    <>
      <header className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
        <h1 className="text-xl font-semibold tracking-tight">Inversiones</h1>
      </header>

      <main className="space-y-6 px-4">
        {/* KPIs de cartera */}
        <section className="rounded-3xl bg-gradient-to-b from-sky-500/15 to-neutral-900/60 p-5 ring-1 ring-sky-500/20">
          <p className="text-sm text-neutral-400">Valor de la cartera</p>
          <p className="pt-1 text-4xl font-semibold tabular-nums">
            {formatEUR(valorCartera)}
          </p>
          <p className={cn("pt-1.5 text-sm font-medium tabular-nums", colorGanancia(ganancia))}>
            {eurConSigno(ganancia)} · {formatPct(rentabilidad, true)}
          </p>
          <p className="pt-3 text-xs text-neutral-500">
            Invertido en total: <span className="tabular-nums">{formatEUR(invertidoTotal)}</span>
            {invertidoTotal > aportadoVinculado && " (incluye aportaciones sin posición)"}
          </p>
        </section>

        {/* Posiciones */}
        <section>
          <div className="flex items-center justify-between px-1.5 pb-3">
            <h2 className="text-sm font-medium text-neutral-500">Posiciones</h2>
            <button
              onClick={() => setNuevaAbierta(true)}
              className="flex h-9 items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900/60 px-3 text-xs text-neutral-300 transition-colors hover:text-white cursor-pointer"
            >
              <Plus className="size-3.5" aria-hidden /> Nueva
            </button>
          </div>

          {posiciones.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-800 px-6 py-10 text-center text-sm text-neutral-400">
              Crea tu primera posición (p. ej. &ldquo;Fondo indexado&rdquo;) para
              seguir su valor y rentabilidad.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {posiciones.map((pos) => {
                const aportado = aportadoPorPosicion.get(pos.id) ?? 0
                const gananciaPos = pos.valor_actual_cents - aportado
                const rentPos = aportado > 0 ? gananciaPos / aportado : 0
                return (
                  <li key={pos.id}>
                    <button
                      onClick={() => setEditando(pos)}
                      className="flex w-full items-center gap-3 rounded-2xl bg-neutral-900/70 px-4 py-3.5 text-left transition-colors hover:bg-neutral-900 cursor-pointer"
                      aria-label={`Editar valor de ${pos.nombre}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-neutral-100">
                          {pos.nombre}
                        </p>
                        <p className="text-xs text-neutral-500 tabular-nums">
                          Aportado {formatEUR(aportado)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[15px] font-semibold tabular-nums">
                          {formatEUR(pos.valor_actual_cents)}
                        </p>
                        <p className={cn("text-xs font-medium tabular-nums", colorGanancia(gananciaPos))}>
                          {eurConSigno(gananciaPos)}
                          {aportado > 0 && ` · ${formatPct(rentPos, true)}`}
                        </p>
                      </div>
                      <PencilLine className="size-4 shrink-0 text-neutral-600" aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Historial de aportaciones */}
        <section>
          <h2 className="px-1.5 pb-3 text-sm font-medium text-neutral-500">
            Aportaciones
          </h2>
          <MovimientosList
            movimientos={aportaciones}
            categoriasById={categoriasById}
            cargando={cargando}
          />
        </section>
      </main>

      <NuevaPosicionDrawer
        open={nuevaAbierta}
        onOpenChange={setNuevaAbierta}
        onCrear={addPosicion}
      />
      <EditarValorDrawer
        posicion={editando}
        onOpenChange={(open) => !open && setEditando(null)}
        onGuardar={setValorPosicion}
      />
    </>
  )
}

function NuevaPosicionDrawer({
  open,
  onOpenChange,
  onCrear,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCrear: (nombre: string) => Promise<Posicion | null>
}) {
  const [nombre, setNombre] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    onOpenChange(false)
    await onCrear(nombre.trim())
    setNombre("")
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="bg-neutral-950 border-neutral-800">
        <DrawerHeader>
          <DrawerTitle>Nueva posición</DrawerTitle>
        </DrawerHeader>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
            placeholder="p. ej. MSCI World, Bitcoin, Plan de pensiones…"
            aria-label="Nombre de la posición"
            className="h-12 rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 text-base outline-none placeholder:text-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-600"
          />
          <button
            type="submit"
            disabled={!nombre.trim()}
            className="h-12 rounded-2xl bg-sky-500 text-base font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
          >
            Crear posición
          </button>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

function EditarValorDrawer({
  posicion,
  onOpenChange,
  onGuardar,
}: {
  posicion: Posicion | null
  onOpenChange: (o: boolean) => void
  onGuardar: (id: string, valorCents: number) => void
}) {
  const [valor, setValor] = useState("")
  const cents = parseImporteToCents(valor)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!posicion || cents === null) return
    onGuardar(posicion.id, cents)
    onOpenChange(false)
    setValor("")
  }

  return (
    <Drawer open={posicion !== null} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="bg-neutral-950 border-neutral-800">
        <DrawerHeader>
          <DrawerTitle>Valor actual de {posicion?.nombre}</DrawerTitle>
        </DrawerHeader>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex items-baseline justify-center gap-1 py-2">
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              autoFocus
              placeholder={
                posicion ? (posicion.valor_actual_cents / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 }) : "0,00"
              }
              aria-label="Valor actual en euros"
              className="w-44 bg-transparent text-right text-4xl font-semibold tabular-nums text-sky-400 outline-none placeholder:text-neutral-700"
            />
            <span className="text-2xl font-medium text-sky-400">€</span>
          </div>
          <button
            type="submit"
            disabled={cents === null}
            className="h-12 rounded-2xl bg-sky-500 text-base font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
          >
            Actualizar valor
          </button>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
