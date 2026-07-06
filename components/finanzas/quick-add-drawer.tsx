"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion } from "motion/react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { hoyISO, parseImporteToCents } from "@/lib/finanzas/format"
import { getIconoCategoria, COLOR_TIPO } from "@/lib/finanzas/iconos"
import type {
  Categoria,
  NuevoMovimiento,
  Posicion,
  TipoMovimiento,
} from "@/lib/finanzas/types"

const TIPOS: { valor: TipoMovimiento; etiqueta: string; accion: string }[] = [
  { valor: "gasto", etiqueta: "Gasto", accion: "Añadir gasto" },
  { valor: "ingreso", etiqueta: "Ingreso", accion: "Añadir ingreso" },
  { valor: "inversion", etiqueta: "Inversión", accion: "Añadir inversión" },
]

/** Fondo del botón de guardar según el tipo */
const BOTON_TIPO: Record<TipoMovimiento, string> = {
  gasto: "bg-rose-500 active:bg-rose-600",
  ingreso: "bg-emerald-500 active:bg-emerald-600",
  inversion: "bg-sky-500 active:bg-sky-600",
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  categorias: Categoria[]
  posiciones: Posicion[]
  onAdd: (nuevo: NuevoMovimiento) => void
}

/**
 * Registro rápido: el flujo feliz son 3 toques — importe, categoría, guardar
 * (tipo "gasto" y fecha "hoy" vienen preseleccionados).
 */
export function QuickAddDrawer({
  open,
  onOpenChange,
  categorias,
  posiciones,
  onAdd,
}: Props) {
  const [tipo, setTipo] = useState<TipoMovimiento>("gasto")
  const [importe, setImporte] = useState("")
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [posicionId, setPosicionId] = useState<string | null>(null)
  const [concepto, setConcepto] = useState("")
  const [fecha, setFecha] = useState(hoyISO())
  const importeRef = useRef<HTMLInputElement>(null)

  const categoriasDelTipo = useMemo(
    () => categorias.filter((c) => c.tipo === tipo),
    [categorias, tipo]
  )

  // Al abrir: formulario limpio con los valores más probables ya puestos
  useEffect(() => {
    if (open) {
      setTipo("gasto")
      setImporte("")
      setConcepto("")
      setFecha(hoyISO())
      setCategoriaId(null)
      setPosicionId(null)
    }
  }, [open])

  // Al cambiar de tipo, se preselecciona la primera categoría de ese tipo
  useEffect(() => {
    setCategoriaId(categoriasDelTipo[0]?.id ?? null)
  }, [categoriasDelTipo])

  const importeCents = parseImporteToCents(importe)
  const valido = importeCents !== null && categoriaId !== null && fecha !== ""

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valido || importeCents === null || categoriaId === null) return
    onAdd({
      fecha,
      tipo,
      categoria_id: categoriaId,
      concepto: concepto.trim(),
      importe_cents: importeCents,
      posicion_id: tipo === "inversion" ? posicionId : null,
    })
    // Optimistic: se cierra ya; el hook sincroniza y avisa solo si falla
    onOpenChange(false)
  }

  const tipoActivo = TIPOS.find((t) => t.valor === tipo)!

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="border-white/[0.08] bg-[#101216]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="sr-only">Añadir movimiento</DrawerTitle>

          {/* Selector de tipo: segmented control con la píldora animada */}
          <div
            role="radiogroup"
            aria-label="Tipo de movimiento"
            className="relative mx-auto grid w-full max-w-sm grid-cols-3 rounded-full bg-white/[0.05] p-1"
          >
            {TIPOS.map((t) => (
              <button
                key={t.valor}
                type="button"
                role="radio"
                aria-checked={tipo === t.valor}
                onClick={() => setTipo(t.valor)}
                className={cn(
                  "relative z-10 h-10 rounded-full text-sm font-medium transition-colors cursor-pointer",
                  tipo === t.valor ? "text-white" : "text-neutral-400"
                )}
              >
                {tipo === t.valor && (
                  <motion.span
                    layoutId="tipo-pill"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    className={cn(
                      "absolute inset-0 -z-10 rounded-full",
                      t.valor === "gasto" && "bg-rose-500/25 ring-1 ring-rose-500/50",
                      t.valor === "ingreso" && "bg-emerald-500/25 ring-1 ring-emerald-500/50",
                      t.valor === "inversion" && "bg-sky-500/25 ring-1 ring-sky-500/50"
                    )}
                  />
                )}
                {t.etiqueta}
              </button>
            ))}
          </div>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {/* Importe: el protagonista */}
          <div className="flex items-baseline justify-center gap-1 py-2">
            <input
              ref={importeRef}
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              inputMode="decimal"
              autoFocus
              placeholder="0,00"
              aria-label="Importe en euros"
              className={cn(
                "w-40 bg-transparent text-right font-display text-5xl font-semibold tabular-nums outline-none",
                "placeholder:text-neutral-700",
                COLOR_TIPO[tipo].texto
              )}
            />
            <span className={cn("text-3xl font-medium", COLOR_TIPO[tipo].texto)}>€</span>
          </div>

          {/* Categorías del tipo elegido */}
          <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Categoría">
            {categoriasDelTipo.map((cat) => {
              const Icono = getIconoCategoria(cat.nombre, cat.tipo)
              const activa = categoriaId === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="radio"
                  aria-checked={activa}
                  onClick={() => setCategoriaId(cat.id)}
                  className={cn(
                    "flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors cursor-pointer",
                    activa
                      ? "border-white/25 bg-white/10 text-white"
                      : "border-white/[0.07] bg-white/[0.02] text-neutral-400"
                  )}
                >
                  <Icono className="size-4" aria-hidden />
                  {cat.nombre}
                </button>
              )
            })}
          </div>

          {/* Posición (solo inversión, opcional): a qué posición de la cartera va la aportación */}
          {tipo === "inversion" && posiciones.length > 0 && (
            <div
              className="flex flex-wrap justify-center gap-2"
              role="radiogroup"
              aria-label="Posición de la cartera"
            >
              <button
                type="button"
                role="radio"
                aria-checked={posicionId === null}
                onClick={() => setPosicionId(null)}
                className={cn(
                  "h-9 rounded-full border px-3 text-xs transition-colors cursor-pointer",
                  posicionId === null
                    ? "border-sky-500/50 bg-sky-500/15 text-sky-300"
                    : "border-white/[0.07] bg-white/[0.02] text-neutral-500"
                )}
              >
                Sin posición
              </button>
              {posiciones.map((pos) => (
                <button
                  key={pos.id}
                  type="button"
                  role="radio"
                  aria-checked={posicionId === pos.id}
                  onClick={() => setPosicionId(pos.id)}
                  className={cn(
                    "h-9 rounded-full border px-3 text-xs transition-colors cursor-pointer",
                    posicionId === pos.id
                      ? "border-sky-500/50 bg-sky-500/15 text-sky-300"
                      : "border-white/[0.07] bg-white/[0.02] text-neutral-500"
                  )}
                >
                  {pos.nombre}
                </button>
              ))}
            </div>
          )}

          {/* Concepto + fecha, secundarios */}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Concepto (opcional)"
              aria-label="Concepto o sitio"
              className="h-12 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-base outline-none placeholder:text-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-600"
            />
            <input
              type="date"
              value={fecha}
              max={hoyISO()}
              onChange={(e) => setFecha(e.target.value)}
              aria-label="Fecha del movimiento"
              className="h-12 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-neutral-300 outline-none focus-visible:ring-2 focus-visible:ring-neutral-600 [color-scheme:dark]"
            />
          </div>

          <button
            type="submit"
            disabled={!valido}
            className={cn(
              "h-13 rounded-2xl text-base font-semibold text-white transition-all cursor-pointer",
              "disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]",
              BOTON_TIPO[tipo]
            )}
          >
            {tipoActivo.accion}
          </button>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
