"use client"

import { AnimatePresence, motion } from "motion/react"
import { LogoBarras } from "@/components/ui/logo-barras"
import { cn } from "@/lib/utils"
import { formatEUR, formatFechaCorta } from "@/lib/finanzas/format"
import { getIconoCategoria, COLOR_TIPO } from "@/lib/finanzas/iconos"
import type { Categoria, Movimiento } from "@/lib/finanzas/types"

const SIGNO = { gasto: "−", ingreso: "+", inversion: "" } as const

interface Props {
  movimientos: Movimiento[]
  categoriasById: Map<string, Categoria>
  cargando: boolean
  /** Si se pasa, cada fila es tocable (p. ej. para editar el movimiento) */
  onSelect?: (mov: Movimiento) => void
  /** Si se pasa, el estado vacío muestra un botón para abrir el registro */
  onAdd?: () => void
}

export function MovimientosList({ movimientos, categoriasById, cargando, onSelect, onAdd }: Props) {
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

  return (
    <ul className="card divide-y divide-white/[0.04] overflow-hidden">
      <AnimatePresence initial={false}>
        {movimientos.map((mov) => {
          const cat = categoriasById.get(mov.categoria_id)
          const Icono = getIconoCategoria(cat?.nombre ?? "", mov.tipo)
          const color = COLOR_TIPO[mov.tipo]
          return (
            <motion.li
              key={mov.id}
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
        })}
      </AnimatePresence>
    </ul>
  )
}
