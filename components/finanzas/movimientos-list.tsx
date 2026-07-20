"use client"

import { useMemo } from "react"
import { AnimatePresence, motion } from "motion/react"
import { LogoBarras } from "@/components/ui/logo-barras"
import { cn } from "@/lib/utils"
import { formatEUR, formatFechaCorta } from "@/lib/finanzas/format"
import { semanaDelMes, rangoSemanaDelMes } from "@/lib/finanzas/semana"
import { getIconoCategoria, COLOR_TIPO } from "@/lib/finanzas/iconos"
import type { Categoria, Movimiento, TipoMovimiento } from "@/lib/finanzas/types"

const SIGNO = { gasto: "−", ingreso: "+", inversion: "" } as const

interface Props {
  movimientos: Movimiento[]
  categoriasById: Map<string, Categoria>
  cargando: boolean
  /** Si se pasa, cada fila es tocable (p. ej. para editar el movimiento) */
  onSelect?: (mov: Movimiento) => void
  /** Si se pasa, el estado vacío muestra un botón para abrir el registro */
  onAdd?: () => void
  /**
   * Filtro activo. Si se pasa, la lista se agrupa por semanas (lunes a domingo)
   * con un subtotal por semana acorde al filtro. Sin él, lista plana.
   */
  filtro?: TipoMovimiento | "todos"
}

/** Subtotal de una semana según el filtro activo (importe + color) */
function subtotalSemana(
  movs: Movimiento[],
  filtro: TipoMovimiento | "todos"
): { texto: string; clase: string } {
  if (filtro === "todos") {
    let ingresos = 0
    let gastos = 0
    for (const m of movs) {
      if (m.tipo === "ingreso") ingresos += m.importe_cents
      else if (m.tipo === "gasto") gastos += m.importe_cents
    }
    const neto = ingresos - gastos
    return {
      texto: `${neto >= 0 ? "+" : "−"}${formatEUR(Math.abs(neto))}`,
      clase: neto >= 0 ? "text-primary" : "text-rose-400",
    }
  }
  const suma = movs
    .filter((m) => m.tipo === filtro)
    .reduce((s, m) => s + m.importe_cents, 0)
  if (filtro === "ingreso")
    return { texto: `+${formatEUR(suma)}`, clase: "text-emerald-400" }
  if (filtro === "inversion")
    return { texto: formatEUR(suma), clase: "text-sky-400" }
  return { texto: `−${formatEUR(suma)}`, clase: "text-rose-400" }
}

/** Una fila de movimiento (compartida por la vista plana y la agrupada) */
function FilaMovimiento({
  mov,
  categoriasById,
  onSelect,
}: {
  mov: Movimiento
  categoriasById: Map<string, Categoria>
  onSelect?: (mov: Movimiento) => void
}) {
  const cat = categoriasById.get(mov.categoria_id)
  const Icono = getIconoCategoria(cat?.nombre ?? "", mov.tipo)
  const color = COLOR_TIPO[mov.tipo]
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      onClick={onSelect ? () => onSelect(mov) : undefined}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onSelect(mov)
            }
          : undefined
      }
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        onSelect && "cursor-pointer transition-colors hover:bg-white/[0.03]"
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          color.fondo
        )}
        aria-hidden
      >
        <Icono className={cn("size-[18px]", color.texto)} strokeWidth={2.2} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-neutral-100">
          {mov.concepto || cat?.nombre || "Movimiento"}
        </p>
        <p className="truncate pt-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          {cat?.nombre ?? "Sin categoría"} · {formatFechaCorta(mov.fecha)}
        </p>
      </div>

      <p
        className={cn(
          "shrink-0 font-display text-[15px] font-semibold tabular-nums",
          color.texto
        )}
      >
        {SIGNO[mov.tipo]}
        {formatEUR(mov.importe_cents)}
      </p>
    </motion.li>
  )
}

export function MovimientosList({
  movimientos,
  categoriasById,
  cargando,
  onSelect,
  onAdd,
  filtro,
}: Props) {
  // Agrupa por semana del mes (1–7, 8–14…) preservando el orden desc.
  // La clave incluye el mes para ser correcta aunque llegaran varios meses.
  const semanas = useMemo(() => {
    if (!filtro) return null
    const mapa = new Map<
      string,
      { nombre: number; rango: string; movs: Movimiento[] }
    >()
    for (const m of movimientos) {
      const n = semanaDelMes(m.fecha)
      const clave = `${m.fecha.slice(0, 7)}#${n}`
      const grupo = mapa.get(clave)
      if (grupo) grupo.movs.push(m)
      else
        mapa.set(clave, {
          nombre: n,
          rango: rangoSemanaDelMes(m.fecha),
          movs: [m],
        })
    }
    return [...mapa.entries()].map(([clave, g]) => ({
      clave,
      nombre: g.nombre,
      rango: g.rango,
      movs: g.movs,
      subtotal: subtotalSemana(g.movs, filtro),
    }))
  }, [movimientos, filtro])

  if (cargando) {
    return (
      <div className="card divide-y divide-white/[0.04] overflow-hidden" aria-busy>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse bg-white/[0.02]" />
        ))}
      </div>
    )
  }

  if (movimientos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[1.25rem] border border-dashed border-white/10 px-6 py-12 text-center">
        <LogoBarras size={40} />
        <div>
          <p className="font-display text-base font-semibold text-neutral-200">
            Aún no hay movimientos
          </p>
          <p className="pt-1 text-sm text-neutral-500">
            Apuntar uno tarda tres toques.
          </p>
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_-6px_rgba(163,230,53,0.5)] transition-all active:scale-[0.97] cursor-pointer"
          >
            Añadir movimiento
          </button>
        )}
      </div>
    )
  }

  // Vista agrupada por semanas
  if (semanas) {
    return (
      <div className="space-y-5">
        {semanas.map((s) => (
          <div key={s.clave}>
            <div className="flex items-baseline justify-between px-1 pb-1.5">
              <span className="micro-label">
                Semana {s.nombre}{" "}
                <span className="text-neutral-600">· {s.rango}</span>
              </span>
              <span
                className={cn(
                  "font-display text-sm font-semibold tabular-nums",
                  s.subtotal.clase
                )}
              >
                {s.subtotal.texto}
              </span>
            </div>
            <ul className="card divide-y divide-white/[0.04] overflow-hidden">
              <AnimatePresence initial={false}>
                {s.movs.map((mov) => (
                  <FilaMovimiento
                    key={mov.id}
                    mov={mov}
                    categoriasById={categoriasById}
                    onSelect={onSelect}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </div>
        ))}
      </div>
    )
  }

  // Vista plana (p. ej. aportaciones en la pestaña de inversión)
  return (
    <ul className="card divide-y divide-white/[0.04] overflow-hidden">
      <AnimatePresence initial={false}>
        {movimientos.map((mov) => (
          <FilaMovimiento
            key={mov.id}
            mov={mov}
            categoriasById={categoriasById}
            onSelect={onSelect}
          />
        ))}
      </AnimatePresence>
    </ul>
  )
}
