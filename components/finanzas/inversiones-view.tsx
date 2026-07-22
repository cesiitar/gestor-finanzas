"use client"

import { useMemo, useState } from "react"
import { Plus, TrendingUp, RefreshCw, Trash2 } from "lucide-react"
import { Line, LineChart, XAxis, YAxis } from "recharts"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import {
  formatEUR,
  formatPct,
  hoyISO,
  parseImporteToCents,
  partesEUR,
} from "@/lib/finanzas/format"
import { useFinanzasCtx } from "./finanzas-provider"
import type { Posicion, Valoracion } from "@/lib/finanzas/types"

const TIPOS_POS = [
  { valor: "fondo", etiqueta: "Fondo" },
  { valor: "accion", etiqueta: "Acción" },
  { valor: "cripto", etiqueta: "Cripto" },
  { valor: "otro", etiqueta: "Otro" },
]

function eurConSigno(cents: number): string {
  return `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${formatEUR(Math.abs(cents))}`
}
function colorGanancia(cents: number): string {
  if (cents > 0) return "text-emerald-400"
  if (cents < 0) return "text-rose-400"
  return "text-neutral-400"
}

/** Importe con signo (permite negativos y 0): "−71,83" → -7183 */
function parseGananciaToCents(input: string): number | null {
  const t = input.trim().replace(/[€\s]/g, "")
  if (t === "") return 0
  const neg = /^[-−]/.test(t)
  let num = t.replace(/^[-−]/, "")
  num = num.includes(",") ? num.replace(/\./g, "").replace(",", ".") : num
  const v = Number(num)
  if (!Number.isFinite(v)) return null
  return Math.round((neg ? -v : v) * 100)
}

/** "2026-07-18" → "18 jul" */
function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
    .toLocaleDateString("es-ES", { day: "numeric", month: "short" })
    .replace(".", "")
}

/**
 * Inversiones: cartera con coste sembrado + histórico de valoraciones.
 * Ganancia = valor actual − (coste inicial + aportaciones vinculadas).
 */
export function InversionesView() {
  const {
    categorias,
    movimientos,
    posiciones,
    valoraciones,
    addPosicion,
    setValorPosicion,
    borrarPosicion,
    addMovimiento,
  } = useFinanzasCtx()

  const [nuevaAbierta, setNuevaAbierta] = useState(false)
  const [detalle, setDetalle] = useState<Posicion | null>(null)

  const aportaciones = useMemo(
    () => movimientos.filter((m) => m.tipo === "inversion"),
    [movimientos]
  )

  /** Aportado por posición = coste sembrado + aportaciones vinculadas */
  const aportadoPorPosicion = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const p of posiciones) mapa.set(p.id, p.coste_inicial_cents)
    for (const m of aportaciones) {
      if (m.posicion_id)
        mapa.set(m.posicion_id, (mapa.get(m.posicion_id) ?? 0) + m.importe_cents)
    }
    return mapa
  }, [posiciones, aportaciones])

  const valorCartera = posiciones.reduce((s, p) => s + p.valor_actual_cents, 0)
  const aportadoTotal = posiciones.reduce(
    (s, p) => s + (aportadoPorPosicion.get(p.id) ?? 0),
    0
  )
  const ganancia = valorCartera - aportadoTotal
  const rentabilidad = aportadoTotal > 0 ? ganancia / aportadoTotal : 0

  // Posición actualizada en vivo (para que el detalle refleje cambios)
  const detalleVivo = detalle
    ? (posiciones.find((p) => p.id === detalle.id) ?? null)
    : null

  return (
    <>
      <header className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-3">
        <p className="micro-label">Gestor de finanzas</p>
        <h1 className="pt-1 font-display text-[26px] font-semibold leading-none tracking-tight">
          Inversiones
        </h1>
      </header>

      <main className="space-y-6 px-4">
        {/* KPIs de cartera */}
        <section className="relative overflow-hidden rounded-[1.75rem] border border-sky-500/25 bg-gradient-to-b from-sky-500/[0.09] to-[#0d1319] p-5 shadow-[0_0_90px_-20px_rgba(56,189,248,0.35)]">
          <div
            aria-hidden
            className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_75%)]"
          />
          <div className="relative">
            <p className="micro-label">Valor de la cartera</p>
            <p className="pt-2 font-display leading-none tabular-nums">
              <span className="text-[44px] font-semibold">
                {partesEUR(valorCartera).entero}
              </span>
              <span className="text-2xl font-medium text-neutral-500">
                {partesEUR(valorCartera).resto}
              </span>
            </p>
            <p
              className={cn(
                "pt-1.5 text-sm font-medium tabular-nums",
                colorGanancia(ganancia)
              )}
            >
              {eurConSigno(ganancia)}
              {aportadoTotal > 0 && ` · ${formatPct(rentabilidad, true)}`}
            </p>
            <p className="pt-3 text-xs text-neutral-500">
              Invertido: <span className="tabular-nums">{formatEUR(aportadoTotal)}</span>
            </p>
          </div>
        </section>

        {/* Posiciones */}
        <section>
          <div className="flex items-center justify-between px-1.5 pb-3">
            <h2 className="micro-label">Mis fondos</h2>
            <button
              onClick={() => setNuevaAbierta(true)}
              className="flex h-9 items-center gap-1 rounded-full border border-primary/30 bg-primary/[0.08] px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/[0.14] cursor-pointer"
            >
              <Plus className="size-3.5" aria-hidden /> Nuevo
            </button>
          </div>

          {posiciones.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-800 px-6 py-10 text-center">
              <TrendingUp className="size-7 text-neutral-600" aria-hidden />
              <p className="text-sm text-neutral-400">
                Añade tus fondos con su valor y su ganancia actual
                <br />
                (los ves en tu bróker) y sigue su evolución aquí.
              </p>
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
                      onClick={() => setDetalle(pos)}
                      className="card flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#181b21] cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-neutral-100">
                          {pos.nombre}
                        </p>
                        <p className="pt-0.5 text-xs text-neutral-500 tabular-nums">
                          {pos.tipo && (
                            <span className="mr-1.5 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
                              {pos.tipo}
                            </span>
                          )}
                          Invertido {formatEUR(aportado)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-display text-[15px] font-semibold tabular-nums">
                          {formatEUR(pos.valor_actual_cents)}
                        </p>
                        <p
                          className={cn(
                            "text-xs font-medium tabular-nums",
                            colorGanancia(gananciaPos)
                          )}
                        >
                          {eurConSigno(gananciaPos)}
                          {aportado > 0 && ` · ${formatPct(rentPos, true)}`}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>

      <NuevaPosicionDrawer
        open={nuevaAbierta}
        onOpenChange={setNuevaAbierta}
        onCrear={addPosicion}
      />
      <DetallePosicionDrawer
        posicion={detalleVivo}
        valoraciones={valoraciones}
        aportado={detalleVivo ? (aportadoPorPosicion.get(detalleVivo.id) ?? 0) : 0}
        categoriaInversionId={
          categorias.find((c) => c.tipo === "inversion")?.id ?? null
        }
        onOpenChange={(o) => !o && setDetalle(null)}
        onActualizarValor={setValorPosicion}
        onAportar={addMovimiento}
        onBorrar={borrarPosicion}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Nueva posición: valor actual + ganancia → coste derivado
// ---------------------------------------------------------------------------
function NuevaPosicionDrawer({
  open,
  onOpenChange,
  onCrear,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCrear: (datos: {
    nombre: string
    tipo?: string | null
    valorCents: number
    costeCents: number
  }) => Promise<Posicion | null>
}) {
  const [nombre, setNombre] = useState("")
  const [tipo, setTipo] = useState("fondo")
  const [valor, setValor] = useState("")
  const [ganancia, setGanancia] = useState("")

  const valorCents = parseImporteToCents(valor)
  const gananciaCents = parseGananciaToCents(ganancia)
  const costeCents =
    valorCents !== null && gananciaCents !== null ? valorCents - gananciaCents : null
  const valido =
    nombre.trim() !== "" &&
    valorCents !== null &&
    costeCents !== null &&
    costeCents >= 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valido || valorCents === null || costeCents === null) return
    onOpenChange(false)
    await onCrear({ nombre: nombre.trim(), tipo, valorCents, costeCents })
    setNombre("")
    setValor("")
    setGanancia("")
    setTipo("fondo")
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="border-white/[0.08] bg-[#101216]">
        <DrawerHeader>
          <DrawerTitle>Nuevo fondo o posición</DrawerTitle>
        </DrawerHeader>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
            placeholder="Nombre (p. ej. True Value Fi)"
            aria-label="Nombre"
            className="h-12 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-base outline-none placeholder:text-neutral-600 focus-visible:ring-2 focus-visible:ring-sky-500/40"
          />

          <div className="flex gap-1.5">
            {TIPOS_POS.map((t) => (
              <button
                key={t.valor}
                type="button"
                onClick={() => setTipo(t.valor)}
                className={cn(
                  "h-9 flex-1 rounded-full border text-sm transition-colors cursor-pointer",
                  tipo === t.valor
                    ? "border-sky-500/40 bg-sky-500/10 font-medium text-sky-400"
                    : "border-white/[0.07] bg-white/[0.02] text-neutral-400"
                )}
              >
                {t.etiqueta}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="micro-label">Valor actual</span>
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
                placeholder="3.629,54"
                aria-label="Valor actual en euros"
                className="h-12 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-base tabular-nums outline-none placeholder:text-neutral-600 focus-visible:ring-2 focus-visible:ring-sky-500/40"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="micro-label">Ganancia</span>
              <input
                value={ganancia}
                onChange={(e) => setGanancia(e.target.value)}
                inputMode="text"
                placeholder="429,48 / −71,83"
                aria-label="Ganancia o pérdida en euros"
                className="h-12 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-base tabular-nums outline-none placeholder:text-neutral-600 focus-visible:ring-2 focus-visible:ring-sky-500/40"
              />
            </label>
          </div>

          {/* Coste derivado, para que se vea qué se va a guardar */}
          <p className="px-1 text-xs text-neutral-500">
            {costeCents !== null && costeCents >= 0 ? (
              <>
                Invertido (calculado): {" "}
                <span className="tabular-nums text-neutral-300">
                  {formatEUR(costeCents)}
                </span>
              </>
            ) : costeCents !== null && costeCents < 0 ? (
              <span className="text-rose-400">
                La ganancia no puede ser mayor que el valor.
              </span>
            ) : (
              "Mete el valor actual y la ganancia que ves en tu bróker."
            )}
          </p>

          <button
            type="submit"
            disabled={!valido}
            className="h-12 rounded-2xl bg-sky-500 text-base font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
          >
            Añadir a la cartera
          </button>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

// ---------------------------------------------------------------------------
// Detalle de una posición: gráfica + actualizar valor + aportar + borrar
// ---------------------------------------------------------------------------
const CONFIG_VAL = { valor: { label: "Valor", color: "#38bdf8" } } satisfies ChartConfig

function DetallePosicionDrawer({
  posicion,
  valoraciones,
  aportado,
  categoriaInversionId,
  onOpenChange,
  onActualizarValor,
  onAportar,
  onBorrar,
}: {
  posicion: Posicion | null
  valoraciones: Valoracion[]
  aportado: number
  categoriaInversionId: string | null
  onOpenChange: (o: boolean) => void
  onActualizarValor: (id: string, valorCents: number, fecha?: string) => void
  onAportar: (m: {
    fecha: string
    tipo: "inversion"
    categoria_id: string
    concepto: string
    importe_cents: number
    posicion_id: string
  }) => void
  onBorrar: (id: string) => void
}) {
  const [modo, setModo] = useState<"valor" | "aportar">("valor")
  const [entrada, setEntrada] = useState("")
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)

  const serie = useMemo(() => {
    if (!posicion) return []
    return valoraciones
      .filter((v) => v.posicion_id === posicion.id)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((v) => ({ fecha: fechaCorta(v.fecha), valor: v.valor_cents / 100 }))
  }, [valoraciones, posicion])

  if (!posicion) return null

  const gananciaPos = posicion.valor_actual_cents - aportado
  const cents = parseImporteToCents(entrada)

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!posicion || cents === null) return
    if (modo === "valor") {
      onActualizarValor(posicion.id, cents)
    } else if (categoriaInversionId) {
      onAportar({
        fecha: hoyISO(),
        tipo: "inversion",
        categoria_id: categoriaInversionId,
        concepto: `Aportación · ${posicion.nombre}`,
        importe_cents: cents,
        posicion_id: posicion.id,
      })
    }
    setEntrada("")
  }

  return (
    <Drawer open={posicion !== null} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="border-white/[0.08] bg-[#101216]">
        <DrawerHeader>
          <DrawerTitle className="truncate">{posicion.nombre}</DrawerTitle>
        </DrawerHeader>

        <div className="space-y-5 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {/* Cifras */}
          <div className="flex items-end justify-between">
            <div>
              <p className="micro-label">Valor actual</p>
              <p className="pt-1 font-display text-3xl font-semibold tabular-nums">
                {formatEUR(posicion.valor_actual_cents)}
              </p>
            </div>
            <p
              className={cn(
                "pb-1 text-sm font-medium tabular-nums",
                colorGanancia(gananciaPos)
              )}
            >
              {eurConSigno(gananciaPos)}
              {aportado > 0 && ` · ${formatPct(gananciaPos / aportado, true)}`}
            </p>
          </div>

          {/* Gráfica de evolución */}
          {serie.length >= 2 ? (
            <ChartContainer config={CONFIG_VAL} className="h-40 w-full">
              <LineChart data={serie} margin={{ left: 4, right: 8, top: 8 }}>
                <XAxis
                  dataKey="fecha"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#898781", fontSize: 11 }}
                  minTickGap={24}
                />
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(v) => (
                        <span className="font-medium tabular-nums">
                          {formatEUR(Math.round(Number(v) * 100))}
                        </span>
                      )}
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="valor"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-neutral-500">
              La gráfica aparece cuando haya al menos dos valoraciones.
              Actualiza el valor cada semana.
            </p>
          )}

          {/* Selector actualizar valor / aportar */}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setModo("valor")}
              className={cn(
                "h-9 flex-1 rounded-full border text-sm transition-colors cursor-pointer",
                modo === "valor"
                  ? "border-sky-500/40 bg-sky-500/10 font-medium text-sky-400"
                  : "border-white/[0.07] text-neutral-400"
              )}
            >
              Actualizar valor
            </button>
            <button
              type="button"
              onClick={() => setModo("aportar")}
              disabled={!categoriaInversionId}
              className={cn(
                "h-9 flex-1 rounded-full border text-sm transition-colors cursor-pointer disabled:opacity-40",
                modo === "aportar"
                  ? "border-primary/40 bg-primary/10 font-medium text-primary"
                  : "border-white/[0.07] text-neutral-400"
              )}
            >
              Meter dinero
            </button>
          </div>

          <form onSubmit={guardar} className="flex gap-2">
            <input
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              inputMode="decimal"
              autoFocus
              placeholder={
                modo === "valor"
                  ? `Valor de hoy (${(posicion.valor_actual_cents / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 })})`
                  : "Cuánto aportas"
              }
              aria-label={modo === "valor" ? "Nuevo valor" : "Aportación"}
              className="h-12 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-base tabular-nums outline-none placeholder:text-neutral-600 focus-visible:ring-2 focus-visible:ring-white/20"
            />
            <button
              type="submit"
              disabled={cents === null}
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-xl text-white transition-all active:scale-95 disabled:opacity-40 cursor-pointer",
                modo === "valor" ? "bg-sky-500" : "bg-primary text-primary-foreground"
              )}
              aria-label="Guardar"
            >
              <RefreshCw className="size-5" aria-hidden />
            </button>
          </form>
          {modo === "aportar" && (
            <p className="-mt-3 px-1 text-xs text-neutral-500">
              Cuenta como inversión: sale de tu dinero disponible este mes.
            </p>
          )}

          {/* Borrar */}
          {confirmarBorrado ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.06] px-4 py-3">
              <span className="text-sm text-rose-300">¿Borrar {posicion.nombre}?</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmarBorrado(false)}
                  className="rounded-lg px-3 py-1.5 text-sm text-neutral-400 cursor-pointer"
                >
                  No
                </button>
                <button
                  onClick={() => {
                    onBorrar(posicion.id)
                    onOpenChange(false)
                    setConfirmarBorrado(false)
                  }}
                  className="rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-medium text-white cursor-pointer"
                >
                  Sí, borrar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmarBorrado(true)}
              className="flex w-full items-center justify-center gap-1.5 py-1 text-xs text-neutral-500 transition-colors hover:text-rose-400 cursor-pointer"
            >
              <Trash2 className="size-3.5" aria-hidden /> Borrar posición
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
