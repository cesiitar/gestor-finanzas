"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { useFinanzasCtx } from "./finanzas-provider"
import { MovimientosList } from "./movimientos-list"
import type { TipoMovimiento } from "@/lib/finanzas/types"

const FILTROS: { valor: TipoMovimiento | "todos"; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "gasto", etiqueta: "Gastos" },
  { valor: "ingreso", etiqueta: "Ingresos" },
  { valor: "inversion", etiqueta: "Inversión" },
]

/** Home / Registro: últimos movimientos con filtro por tipo */
export function HomeClient() {
  const { categoriasById, movimientos, cargando, abrirRegistro } = useFinanzasCtx()
  const [filtro, setFiltro] = useState<TipoMovimiento | "todos">("todos")
  const searchParams = useSearchParams()

  // Acceso directo del icono de la PWA: /?add=1 abre el registro al entrar
  useEffect(() => {
    if (searchParams.get("add") === "1") abrirRegistro()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibles = useMemo(
    () =>
      filtro === "todos"
        ? movimientos
        : movimientos.filter((m) => m.tipo === filtro),
    [movimientos, filtro]
  )

  return (
    <>
      <header className="flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
        <h1 className="text-xl font-semibold tracking-tight">Finanzas</h1>
        <Link
          href="/ajustes"
          aria-label="Ajustes"
          className="flex size-11 items-center justify-center rounded-full text-neutral-500 transition-colors hover:text-neutral-200"
        >
          <Settings className="size-5" aria-hidden />
        </Link>
      </header>

      {/* Filtro por tipo */}
      <div
        role="radiogroup"
        aria-label="Filtrar por tipo"
        className="flex gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none]"
      >
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            role="radio"
            aria-checked={filtro === f.valor}
            onClick={() => setFiltro(f.valor)}
            className={cn(
              "h-9 shrink-0 rounded-full border px-3.5 text-sm transition-colors cursor-pointer",
              filtro === f.valor
                ? "border-white/25 bg-white/10 font-medium text-white"
                : "border-neutral-800 bg-neutral-900/60 text-neutral-400"
            )}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      <main className="px-4">
        <MovimientosList
          movimientos={visibles}
          categoriasById={categoriasById}
          cargando={cargando}
        />
      </main>
    </>
  )
}
