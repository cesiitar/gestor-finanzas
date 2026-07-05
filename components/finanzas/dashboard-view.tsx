"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Pie, PieChart, Cell } from "recharts"
import { TriangleAlert, ChartPie } from "lucide-react"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { formatEUR, formatPct, hoyISO } from "@/lib/finanzas/format"
import { useFinanzasCtx } from "./finanzas-provider"
import { MesSelector } from "./mes-selector"

/**
 * Paleta categórica del donut (validada para CVD sobre superficie oscura con
 * scripts del skill dataviz; orden fijo, "Otros" en gris neutro).
 */
const PALETA = ["#3987e5", "#199e70", "#c98500", "#008300", "#9085e9", "#e66767"]
const COLOR_OTROS = "#737373"
const MAX_SEGMENTOS = 5

/** Colores de estado del presupuesto (reservados, nunca de serie) */
function estadoPresupuesto(ratio: number) {
  if (ratio > 1)
    return { color: "#d03b3b", texto: "text-[#e66767]", etiqueta: "superado" }
  if (ratio >= 0.8)
    return { color: "#fab219", texto: "text-[#fab219]", etiqueta: "al límite" }
  return { color: "#0ca30c", texto: "text-neutral-400", etiqueta: "" }
}

export function DashboardView() {
  const { movimientos, categorias, categoriasById, cargando } = useFinanzasCtx()
  const [mes, setMes] = useState(hoyISO().slice(0, 7))

  const delMes = useMemo(
    () => movimientos.filter((m) => m.fecha.startsWith(mes)),
    [movimientos, mes]
  )

  // ---- KPIs ----
  const kpis = useMemo(() => {
    let ingresos = 0
    let gastos = 0
    let invertido = 0
    for (const m of delMes) {
      if (m.tipo === "ingreso") ingresos += m.importe_cents
      else if (m.tipo === "gasto") gastos += m.importe_cents
      else invertido += m.importe_cents
    }
    return { ingresos, gastos, invertido, ahorro: ingresos - gastos }
  }, [delMes])

  // ---- Gasto por categoría (para donut y presupuestos) ----
  const gastoPorCategoria = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const m of delMes) {
      if (m.tipo === "gasto")
        mapa.set(m.categoria_id, (mapa.get(m.categoria_id) ?? 0) + m.importe_cents)
    }
    return mapa
  }, [delMes])

  /** Segmentos del donut: top 5 categorías + "Otros" agrupado, colores en orden fijo */
  const segmentos = useMemo(() => {
    const ordenadas = [...gastoPorCategoria.entries()]
      .map(([id, cents]) => ({
        nombre: categoriasById.get(id)?.nombre ?? "Sin categoría",
        cents,
      }))
      .sort((a, b) => b.cents - a.cents)

    const top = ordenadas.slice(0, MAX_SEGMENTOS)
    const resto = ordenadas.slice(MAX_SEGMENTOS)
    const filas = top.map((f, i) => ({ ...f, color: PALETA[i] }))
    if (resto.length > 0) {
      filas.push({
        nombre: "Otros",
        cents: resto.reduce((s, f) => s + f.cents, 0),
        color: COLOR_OTROS,
      })
    }
    return filas.map((f) => ({ ...f, euros: f.cents / 100 }))
  }, [gastoPorCategoria, categoriasById])

  /** Presupuestos: categorías de gasto con presupuesto definido */
  const presupuestos = useMemo(
    () =>
      categorias
        .filter((c) => c.tipo === "gasto" && c.presupuesto_mensual_cents != null)
        .map((c) => {
          const gastado = gastoPorCategoria.get(c.id) ?? 0
          const limite = c.presupuesto_mensual_cents!
          return { cat: c, gastado, limite, ratio: limite > 0 ? gastado / limite : 0 }
        })
        .sort((a, b) => b.ratio - a.ratio),
    [categorias, gastoPorCategoria]
  )

  const chartConfig = { euros: { label: "Gasto" } } satisfies ChartConfig

  return (
    <>
      <header className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
        <h1 className="text-xl font-semibold tracking-tight">Panel</h1>
      </header>

      <MesSelector mes={mes} onChange={setMes} />

      {cargando ? (
        <main className="space-y-3 px-4" aria-busy>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-neutral-900" />
          ))}
        </main>
      ) : (
        <main className="space-y-6 px-4">
          {/* KPIs del mes */}
          <section className="grid grid-cols-2 gap-2.5" aria-label="Resumen del mes">
            <div className="rounded-2xl bg-neutral-900/70 p-4">
              <p className="text-xs text-neutral-500">Ingresos</p>
              <p className="pt-1 text-2xl font-semibold tabular-nums text-emerald-400">
                {formatEUR(kpis.ingresos)}
              </p>
            </div>
            <div className="rounded-2xl bg-neutral-900/70 p-4">
              <p className="text-xs text-neutral-500">Gastos</p>
              <p className="pt-1 text-2xl font-semibold tabular-nums text-rose-400">
                {formatEUR(kpis.gastos)}
              </p>
            </div>
            <div className="rounded-2xl bg-neutral-900/70 p-4">
              <p className="text-xs text-neutral-500">Ahorro</p>
              <p
                className={cn(
                  "pt-1 text-2xl font-semibold tabular-nums",
                  kpis.ahorro >= 0 ? "text-neutral-100" : "text-rose-400"
                )}
              >
                {kpis.ahorro < 0 && "−"}
                {formatEUR(Math.abs(kpis.ahorro))}
              </p>
            </div>
            <div className="rounded-2xl bg-neutral-900/70 p-4">
              <p className="text-xs text-neutral-500">Invertido</p>
              <p className="pt-1 text-2xl font-semibold tabular-nums text-sky-400">
                {formatEUR(kpis.invertido)}
              </p>
            </div>
          </section>

          {/* Reparto de gastos */}
          <section className="rounded-2xl bg-neutral-900/70 p-4">
            <h2 className="text-sm font-medium text-neutral-400">
              Reparto de gastos
            </h2>
            {segmentos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <ChartPie className="size-7 text-neutral-600" aria-hidden />
                <p className="text-sm text-neutral-500">Sin gastos este mes.</p>
              </div>
            ) : (
              <>
                <div className="relative mx-auto max-w-60">
                  <ChartContainer config={chartConfig} className="aspect-square w-full">
                    <PieChart>
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, _name, item) => (
                              <span className="flex w-full items-center justify-between gap-3">
                                <span className="text-muted-foreground">
                                  {item?.payload?.nombre}
                                </span>
                                <span className="font-medium tabular-nums">
                                  {formatEUR(Number(value) * 100)}
                                </span>
                              </span>
                            )}
                          />
                        }
                      />
                      <Pie
                        data={segmentos}
                        dataKey="euros"
                        nameKey="nombre"
                        innerRadius="62%"
                        outerRadius="90%"
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {segmentos.map((s) => (
                          <Cell key={s.nombre} fill={s.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  {/* Cifra héroe en el centro del donut */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-xs text-neutral-500">Total</p>
                    <p className="text-xl font-semibold tabular-nums">
                      {formatEUR(kpis.gastos)}
                    </p>
                  </div>
                </div>

                {/* Leyenda con etiquetas directas (identidad nunca solo por color) */}
                <ul className="space-y-1.5 pt-2">
                  {segmentos.map((s) => (
                    <li key={s.nombre} className="flex items-center gap-2.5 text-sm">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-neutral-300">
                        {s.nombre}
                      </span>
                      <span className="tabular-nums text-neutral-400">
                        {formatEUR(s.cents)}
                      </span>
                      <span className="w-12 text-right text-xs tabular-nums text-neutral-500">
                        {formatPct(kpis.gastos > 0 ? s.cents / kpis.gastos : 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* Gasto vs presupuesto */}
          <section className="rounded-2xl bg-neutral-900/70 p-4">
            <h2 className="text-sm font-medium text-neutral-400">Presupuestos</h2>
            {presupuestos.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-500">
                No hay presupuestos definidos.{" "}
                <Link href="/ajustes" className="text-neutral-300 underline underline-offset-2">
                  Ponlos en Ajustes
                </Link>
                .
              </p>
            ) : (
              <ul className="space-y-4 pt-3">
                {presupuestos.map(({ cat, gastado, limite, ratio }) => {
                  const estado = estadoPresupuesto(ratio)
                  return (
                    <li key={cat.id}>
                      <div className="flex items-baseline justify-between gap-2 pb-1.5 text-sm">
                        <span className="flex min-w-0 items-center gap-1.5 truncate text-neutral-200">
                          {cat.nombre}
                          {ratio > 1 && (
                            <TriangleAlert
                              className="size-3.5 shrink-0 text-[#e66767]"
                              aria-hidden
                            />
                          )}
                        </span>
                        <span className={cn("shrink-0 text-xs tabular-nums", estado.texto)}>
                          {formatEUR(gastado)} / {formatEUR(limite)}
                          {estado.etiqueta && ` · ${estado.etiqueta}`}
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-valuenow={Math.round(ratio * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Presupuesto de ${cat.nombre}`}
                        className="h-2 overflow-hidden rounded-full bg-neutral-800"
                      >
                        <div
                          className="h-full rounded-full transition-[width] duration-300"
                          style={{
                            width: `${Math.min(ratio, 1) * 100}%`,
                            backgroundColor: estado.color,
                          }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </main>
      )}
    </>
  )
}
