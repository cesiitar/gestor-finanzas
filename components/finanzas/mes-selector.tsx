"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { hoyISO } from "@/lib/finanzas/format"
import { etiquetaMes, sumarMeses } from "@/lib/finanzas/mes"

/** Selector de mes con flechas; no permite ir más allá del mes actual */
export function MesSelector({
  mes,
  onChange,
}: {
  mes: string
  onChange: (mes: string) => void
}) {
  const mesActual = hoyISO().slice(0, 7)

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-2">
      <button
        onClick={() => onChange(sumarMeses(mes, -1))}
        aria-label="Mes anterior"
        className="flex size-11 items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-white cursor-pointer"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      <p className="w-40 text-center font-display text-base font-medium capitalize">
        {etiquetaMes(mes)}
      </p>
      <button
        onClick={() => onChange(sumarMeses(mes, 1))}
        disabled={mes >= mesActual}
        aria-label="Mes siguiente"
        className="flex size-11 items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
      >
        <ChevronRight className="size-5" aria-hidden />
      </button>
    </div>
  )
}
