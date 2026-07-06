"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Bar, BarChart, Cell, Pie, PieChart, XAxis } from "recharts"
import {
  TriangleAlert,
  ChartPie,
  TrendingUp,
  TrendingDown,
  Flame,
} from "lucide-react"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { formatEUR, formatPct, hoyISO, formatFechaCorta } from "@/lib/finanzas/format"
import { sumarMeses } from "@/lib/finanzas/mes"
import { useFinanzasCtx } from "./finanzas-provider"
import { MesSelector } from "./mes-selector"
import type { Movimiento } from "@/lib/finanzas/types"

/**
 * Paleta categórica del donut (validada para CVD sobre superficie oscura
 * con el validador del skill dataviz; orden fijo, "Otros" en gris neutro).
 */
const PALETA = ["#3987e5", "#199e70", "#c98500", "#008300", "#9085e9", "#e66767"]
const COLOR_OTROS = "#737373"
const MAX_SEGMENTOS = 5

/** Colores de estado (reservados para estado, nunca de serie) */
function estadoPresupuesto(ratio: number) {
  if (ratio > 1)
    return { color: "#d03b3b", texto: "text-[#e66767]", etiqueta: "superado" }
  if (ratio >= 0.8)
    return { color: "#fab219", texto: "text-[#fab219]", etiqueta: "al límite" }
  return { color: "#0ca30c", texto: "text-neutral-400", etiqueta: "" }
}

/**
 * Benchmark clásico de tasa de ahorro personal:
 * ≥20% excelente · 10–20% bien · 0–10% justo · <0 en negativo.
 */
function estadoTasaAhorro(tasa: number) {
  if (tasa >= 0.2) return { etiqueta: "excelente", clase: "text-emerald-400" }
  if (tasa >= 0.1) return { etiqueta: "bien", clase: "text-emerald-300" }
  if (tasa >= 0) return { etiqueta: "justo", clase: "text-[#fab219]" }
  return { etiqueta: "en negativo", clase: "text-rose-400" }
}

function resumenDe(movs: Movimiento[]) {
  let ingresos = 0
  let gastos = 0
  let invertido = 0
  for (const m of movs) {
    if (m.tipo === "ingreso") ingresos += m.importe_cents
    else if (m.tipo === "gasto") gastos += m.importe_cents
    else invertido += m.importe_cents
  }
  return { ingresos, gastos, invertido, ahorro: ingresos - gastos }
}

/** Variación relativa entre dos importes; null si no hay base de comparación */
function delta(actual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return (actual - anterior) / anterior
}

/** Chip de variación vs mes anterior. `alSubir` marca si subir es bueno o malo. */
function DeltaChip({
  valor,
  alSubir,
}: {
  valor: number | null
  alSubir: "bueno" | "malo"
}) {
  if (valor === null || !Number.isFinite(valor)) return null
  const sube = valor > 0
  const positivo = alSubir === "bueno" ? sube : !sube
  const Icono = sube ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        valor === 0
          ? "text-neutral-500"
          : positivo
            ? "text-emerald-400"
            : "text-rose-400"
      )}
    >
      <Icono className="size-3" aria-hidden />
      {formatPct(Math.abs(valor))}
      <span className="font-normal text-neutral-500"> vs mes ant.</span>
    </span>
  )
}

export function DashboardView() {
  const { movimientos, categorias, categoriasById, cargando } = useFinanzasCtx()
  const [mes, setMes] = useState(hoyISO().slice(0, 7))
  const esMesActual = mes === hoyISO().slice(0, 7)

  const delMes = useMemo(
    () => movimientos.filter((m) => m.fecha.startsWith(mes)),
    [movimientos, mes]
  )
  const delMesAnterior = useMemo(() => {
    const prev = sumarMeses(mes, -1)
    return movimientos.filter((m) => m.fecha.startsWith(prev))
  }, [movimientos, mes])

  const r = useMemo(() => resumenDe(delMes), [delMes])
  const rPrev = useMemo(() => resumenDe(delMesAnterior), [delMesAnterior])

  // ---- KPIs derivados ----
  const tasaAhorro = r.ingresos > 0 ? r.ahorro / r.ingresos : null
  const tasaInversion = r.ingresos > 0 ? r.invertido / r.ingresos : null
  const deltaGastos = delta(r.gastos, rPrev.gastos)
  const deltaIngresos = delta(r.ingresos, rPrev.ingresos)

  // ---- Ritmo de gasto (solo tiene sentido en el mes en curso) ----
  const ritmo = useMemo(() => {
    if (!esMesActual) return null
    const hoy = new Date()
    const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
    const diaHoy = hoy.getDate()
    const gastoDiario = r.gastos / diaHoy
    return {
      gastoDiario,
      proyeccion: gastoDiario * diasMes,
      diasRestantes: diasMes - diaHoy,
    }
  }, [esMesActual, r.gastos])

  // ---- Presupuesto global: disponible por día restante ----
  const presupuestoGlobal = useMemo(() => {
    const conPresupuesto = categorias.filter(
      (c) => c.tipo === "gasto" && c.presupuesto_mensual_cents != null
    )
    if (conPresupuesto.length === 0) return null
    const limite = conPresupuesto.reduce(
      (s, c) => s + (c.presupuesto_mensual_cents ?? 0),
      0
    )
    // Solo el gasto de categorías presupuestadas cuenta contra el límite global
    const ids = new Set(conPresupuesto.map((c) => c.id))
    const gastado = delMes
      .filter((m) => m.tipo === "gasto" && ids.has(m.categoria_id))
      .reduce((s, m) => s + m.importe_cents, 0)
    return { limite, gastado, disponible: limite - gastado }
  }, [categorias, delMes])

  // ---- Evolución de los últimos 6 meses (terminando en el mes elegido) ----
  const evolucion = useMemo(() => {
    return [...Array(6)]
      .map((_, i) => {
        const mesI = sumarMeses(mes, -(5 - i))
        const res = resumenDe(movimientos.filter((m) => m.fecha.startsWith(mesI)))
        const [y, mm] = mesI.split("-").map(Number)
        return {
          mes: new Date(y, mm - 1, 1)
            .toLocaleDateString("es-ES", { month: "short" })
            .replace(".", ""),
          ingresos: res.ingresos / 100,
          gastos: res.gastos / 100,
        }
      })
  }, [movimientos, mes])
  const hayEvolucion = evolucion.some((e) => e.ingresos > 0 || e.gastos > 0)

  // ---- Reparto de gastos por categoría ----
  const gastoPorCategoria = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const m of delMes) {
      if (m.tipo === "gasto")
        mapa.set(m.categoria_id, (mapa.get(m.categoria_id) ?? 0) + m.importe_cents)
    }
    return mapa
  }, [delMes])

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
    if (resto.length > 0)
      filas.push({
        nombre: "Otros",
        cents: resto.reduce((s, f) => s + f.cents, 0),
        color: COLOR_OTROS,
      })
    return filas.map((f) => ({ ...f, euros: f.cents / 100 }))
  }, [gastoPorCategoria, categoriasById])

  // ---- Presupuestos por categoría ----
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

  // ---- Top gastos del mes ----
  const topGastos = useMemo(
    () =>
      delMes
        .filter((m) => m.tipo === "gasto")
        .sort((a, b) => b.importe_cents - a.importe_cents)
        .slice(0, 3),
    [delMes]
  )

  const configDonut = { euros: { label: "Gasto" } } satisfies ChartConfig
  const configEvolucion = {
    ingresos: { label: "Ingresos", color: "#34d399" },
    gastos: { label: "Gastos", color: "#fb7185" },
  } satisfies ChartConfig

  const estadoAhorro = tasaAhorro !== null ? estadoTasaAhorro(tasaAhorro) : null

  return (
    <>
      <header className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
        <h1 className="text-xl font-semibold tracking-tight">Panel</h1>
      </header>

      <MesSelector mes={mes} onChange={setMes} />

      {cargando ? (
        <main className="space-y-3 px-4" aria-busy>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-neutral-900" />
          ))}
        </main>
      ) : (
        <main className="space-y-6 px-4">
          {/* ── KPI héroe: ahorro y tasa de ahorro ─────────────────── */}
          <section
            className="rounded-3xl bg-gradient-to-b from-emerald-500/10 to-neutral-900/60 p-5 ring-1 ring-emerald-500/15"
            aria-label="Ahorro del mes"
          >
            <p className="text-sm text-neutral-400">Ahorro del mes</p>
            <p
              className={cn(
                "pt-1 text-4xl font-semibold tabular-nums",
                r.ahorro < 0 && "text-rose-400"
              )}
            >
              {r.ahorro < 0 && "−"}
              {formatEUR(Math.abs(r.ahorro))}
            </p>
            <p className="pt-1.5 text-sm">
              {tasaAhorro !== null && estadoAhorro ? (
                <>
                  <span className={cn("font-medium tabular-nums", estadoAhorro.clase)}>
                    {formatPct(tasaAhorro)} de tus ingresos
                  </span>
                  <span className="text-neutral-500"> · {estadoAhorro.etiqueta}</span>
                </>
              ) : (
                <span className="text-neutral-500">
                  Sin ingresos este mes, no hay tasa de ahorro.
                </span>
              )}
            </p>
          </section>

          {/* ── Ingresos / Gastos / Invertido con tendencia ────────── */}
          <section className="grid grid-cols-2 gap-2.5" aria-label="Resumen del mes">
            <div className="rounded-2xl bg-neutral-900/70 p-4">
              <p className="text-xs text-neutral-500">Ingresos</p>
              <p className="pt-1 text-2xl font-semibold tabular-nums text-emerald-400">
                {formatEUR(r.ingresos)}
              </p>
              <DeltaChip valor={deltaIngresos} alSubir="bueno" />
            </div>
            <div className="rounded-2xl bg-neutral-900/70 p-4">
              <p className="text-xs text-neutral-500">Gastos</p>
              <p className="pt-1 text-2xl font-semibold tabular-nums text-rose-400">
                {formatEUR(r.gastos)}
              </p>
              <DeltaChip valor={deltaGastos} alSubir="malo" />
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-2xl bg-neutral-900/70 p-4">
              <div>
                <p className="text-xs text-neutral-500">Invertido</p>
                <p className="pt-1 text-2xl font-semibold tabular-nums text-sky-400">
                  {formatEUR(r.invertido)}
                </p>
              </div>
              {tasaInversion !== null && (
                <p className="text-right text-xs text-neutral-500">
                  <span className="block text-base font-medium tabular-nums text-neutral-300">
                    {formatPct(tasaInversion)}
                  </span>
                  de tus ingresos
                </p>
              )}
            </div>
          </section>

          {/* ── Ritmo de gasto (solo mes en curso) ─────────────────── */}
          {ritmo && r.gastos > 0 && (
            <section
              className="rounded-2xl bg-neutral-900/70 p-4"
              aria-label="Ritmo de gasto"
            >
              <h2 className="flex items-center gap-1.5 text-sm font-medium text-neutral-400">
                <Flame className="size-4" aria-hidden /> Ritmo de gasto
              </h2>
              <div className="grid grid-cols-2 gap-3 pt-3">
                <div>
                  <p className="text-xs text-neutral-500">Media diaria</p>
                  <p className="pt-0.5 text-lg font-semibold tabular-nums">
                    {formatEUR(Math.round(ritmo.gastoDiario))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Proyección fin de mes</p>
                  <p
                    className={cn(
                      "pt-0.5 text-lg font-semibold tabular-nums",
                      presupuestoGlobal && ritmo.proyeccion > presupuestoGlobal.limite
                        ? "text-[#fab219]"
                        : "text-neutral-200"
                    )}
                  >
                    ≈ {formatEUR(Math.round(ritmo.proyeccion))}
                  </p>
                </div>
              </div>
              {presupuestoGlobal && ritmo.diasRestantes > 0 && (
                <p className="pt-3 text-sm text-neutral-400">
                  {presupuestoGlobal.disponible >= 0 ? (
                    <>
                      Te quedan{" "}
                      <span className="font-medium tabular-nums text-neutral-100">
                        {formatEUR(presupuestoGlobal.disponible)}
                      </span>{" "}
                      de presupuesto para {ritmo.diasRestantes} días →{" "}
                      <span className="font-medium tabular-nums text-neutral-100">
                        {formatEUR(
                          Math.round(presupuestoGlobal.disponible / ritmo.diasRestantes)
                        )}
                        /día
                      </span>
                    </>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[#e66767]">
                      <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
                      Presupuesto global superado en{" "}
                      <span className="font-medium tabular-nums">
                        {formatEUR(-presupuestoGlobal.disponible)}
                      </span>
                    </span>
                  )}
                </p>
              )}
            </section>
          )}

          {/* ── Evolución 6 meses ──────────────────────────────────── */}
          <section className="rounded-2xl bg-neutral-900/70 p-4" aria-label="Evolución">
            <h2 className="text-sm font-medium text-neutral-400">
              Ingresos vs gastos · últimos 6 meses
            </h2>
            {!hayEvolucion ? (
              <p className="py-8 text-center text-sm text-neutral-500">
                Aún no hay historial suficiente.
              </p>
            ) : (
              <>
                <ChartContainer config={configEvolucion} className="mt-3 h-40 w-full">
                  <BarChart data={evolucion} barGap={2}>
                    <XAxis
                      dataKey="mes"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#898781", fontSize: 11 }}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <span className="flex w-full items-center justify-between gap-3">
                              <span className="text-muted-foreground">
                                {name === "ingresos" ? "Ingresos" : "Gastos"}
                              </span>
                              <span className="font-medium tabular-nums">
                                {formatEUR(Math.round(Number(value) * 100))}
                              </span>
                            </span>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="ingresos" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={18} />
                    <Bar dataKey="gastos" fill="#fb7185" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ChartContainer>
                {/* Leyenda (identidad nunca solo por color) */}
                <div className="flex items-center gap-4 pt-2 text-xs text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-[#34d399]" aria-hidden />
                    Ingresos
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-[#fb7185]" aria-hidden />
                    Gastos
                  </span>
                </div>
              </>
            )}
          </section>

          {/* ── Reparto de gastos ──────────────────────────────────── */}
          <section className="rounded-2xl bg-neutral-900/70 p-4">
            <h2 className="text-sm font-medium text-neutral-400">Reparto de gastos</h2>
            {segmentos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <ChartPie className="size-7 text-neutral-600" aria-hidden />
                <p className="text-sm text-neutral-500">Sin gastos este mes.</p>
              </div>
            ) : (
              <>
                <div className="relative mx-auto max-w-60">
                  <ChartContainer config={configDonut} className="aspect-square w-full">
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
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-xs text-neutral-500">Total</p>
                    <p className="text-xl font-semibold tabular-nums">
                      {formatEUR(r.gastos)}
                    </p>
                  </div>
                </div>
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
                        {formatPct(r.gastos > 0 ? s.cents / r.gastos : 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* ── Presupuestos por categoría ─────────────────────────── */}
          <section className="rounded-2xl bg-neutral-900/70 p-4">
            <h2 className="text-sm font-medium text-neutral-400">Presupuestos</h2>
            {presupuestos.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-500">
                No hay presupuestos definidos.{" "}
                <Link
                  href="/ajustes"
                  className="text-neutral-300 underline underline-offset-2"
                >
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

          {/* ── Top gastos del mes ─────────────────────────────────── */}
          {topGastos.length > 0 && (
            <section className="rounded-2xl bg-neutral-900/70 p-4" aria-label="Top gastos">
              <h2 className="text-sm font-medium text-neutral-400">
                Mayores gastos del mes
              </h2>
              <ul className="divide-y divide-neutral-800/60 pt-1">
                {topGastos.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-neutral-200">
                        {m.concepto ||
                          categoriasById.get(m.categoria_id)?.nombre ||
                          "Gasto"}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {categoriasById.get(m.categoria_id)?.nombre} ·{" "}
                        {formatFechaCorta(m.fecha)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-rose-400">
                      −{formatEUR(m.importe_cents)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>
      )}
    </>
  )
}
