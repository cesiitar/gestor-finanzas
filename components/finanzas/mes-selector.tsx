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
    <div className="flex items-center justify-center gap-3 px-5 pb-2">
      <button
        onClick={() => onChange(sumarMeses(mes, -1))}
        aria-label="Mes anterior"
        className="control flex size-10 shrink-0 items-center justify-center rounded-full cursor-pointer"
      >
        <ChevronLeft className="size-[18px]" aria-hidden />
      </button>
      <p className="min-w-[9.5rem] text-center font-display text-[15px] font-medium tracking-tight text-neutral-200">
        {etiquetaMes(mes)}
      </p>
      <button
        onClick={() => onChange(sumarMeses(mes, 1))}
        disabled={mes >= mesActual}
        aria-label="Mes siguiente"
        className="control flex size-10 shrink-0 items-center justify-center rounded-full cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
      >
        <ChevronRight className="size-[18px]" aria-hidden />
      </button>
    </div>
  )
}
