"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import {
  ChevronLeft,
  Plus,
  Check,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CalendarClock,
} from "lucide-react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { formatEUR, formatFechaCorta, parseImporteToCents } from "@/lib/finanzas/format"
import { useFinanzasCtx } from "./finanzas-provider"
import type { Pendiente, TipoPendiente } from "@/lib/finanzas/types"

const TIPOS: { valor: TipoPendiente; etiqueta: string; Icono: typeof Bell }[] = [
  { valor: "cobro", etiqueta: "Me deben", Icono: ArrowDownLeft },
  { valor: "pago", etiqueta: "Yo debo", Icono: ArrowUpRight },
  { valor: "tarea", etiqueta: "Recordar", Icono: Bell },
]

const ESTILO_TIPO: Record<TipoPendiente, { texto: string; fondo: string }> = {
  cobro: { texto: "text-emerald-400", fondo: "bg-emerald-500/12" },
  pago: { texto: "text-rose-400", fondo: "bg-rose-500/12" },
  tarea: { texto: "text-oro", fondo: "bg-oro/12" },
}

const OPCIONES_AVISO = [
  { dias: 0, etiqueta: "El día" },
  { dias: 1, etiqueta: "1 día antes" },
  { dias: 3, etiqueta: "3 días antes" },
  { dias: 7, etiqueta: "1 semana antes" },
]

/** Orden: pendientes con fecha más próxima primero; sin fecha, al final */
function ordenar(a: Pendiente, b: Pendiente): number {
  if (a.fecha && b.fecha) return a.fecha.localeCompare(b.fecha)
  if (a.fecha) return -1
  if (b.fecha) return 1
  return b.created_at.localeCompare(a.created_at)
}

export function PendientesView() {
  const { pendientes, togglePendienteHecho, borrarPendiente } = useFinanzasCtx()
  const [drawerAbierto, setDrawerAbierto] = useState(false)
  const [editando, setEditando] = useState<Pendiente | null>(null)

  const abiertos = useMemo(
    () => pendientes.filter((p) => !p.hecho).sort(ordenar),
    [pendientes]
  )
  const hechos = useMemo(
    () => pendientes.filter((p) => p.hecho),
    [pendientes]
  )

  const teDeben = abiertos
    .filter((p) => p.tipo === "cobro")
    .reduce((s, p) => s + (p.importe_cents ?? 0), 0)
  const debes = abiertos
    .filter((p) => p.tipo === "pago")
    .reduce((s, p) => s + (p.importe_cents ?? 0), 0)

  function abrirNuevo() {
    setEditando(null)
    setDrawerAbierto(true)
  }
  function abrirEdicion(p: Pendiente) {
    setEditando(p)
    setDrawerAbierto(true)
  }

  return (
    <>
      <header className="flex items-center justify-between px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-5">
        <div className="flex items-center gap-1">
          <Link
            href="/"
            aria-label="Volver"
            className="flex size-9 items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-neutral-100"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <div>
            <p className="micro-label">Gestor de finanzas</p>
            <h1 className="titulo-pantalla pt-1">
              Pendientes
            </h1>
          </div>
        </div>
        <button
          onClick={abrirNuevo}
          aria-label="Añadir pendiente"
          className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_20px_-6px_rgba(163,230,53,0.5)] transition-transform active:scale-90 cursor-pointer"
        >
          <Plus className="size-5" strokeWidth={2.5} aria-hidden />
        </button>
      </header>

      <main className="space-y-8 px-4">
        {/* Totales de deudas */}
        {(teDeben > 0 || debes > 0) && (
          <section className="grid grid-cols-2 gap-3">
            <div className="card p-5">
              <p className="text-xs text-neutral-500">Te deben</p>
              <p className="pt-1 font-display text-2xl font-semibold tabular-nums text-emerald-400">
                {formatEUR(teDeben)}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-xs text-neutral-500">Debes</p>
              <p className="pt-1 font-display text-2xl font-semibold tabular-nums text-rose-400">
                {formatEUR(debes)}
              </p>
            </div>
          </section>
        )}

        {/* Lista de pendientes */}
        {abiertos.length === 0 && hechos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[1.25rem] border border-dashed border-white/10 px-6 py-12 text-center">
            <CalendarClock className="size-8 text-neutral-600" aria-hidden />
            <p className="text-sm text-neutral-400">
              Apunta lo que te deben, lo que debes
              <br />o algo que quieras recordar (con aviso).
            </p>
            <button
              onClick={abrirNuevo}
              className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all active:scale-[0.97] cursor-pointer"
            >
              Añadir el primero
            </button>
          </div>
        ) : (
          <ul className="space-y-1.5">
            <AnimatePresence initial={false}>
              {abiertos.map((p) => (
                <FilaPendiente
                  key={p.id}
                  p={p}
                  onToggle={() => togglePendienteHecho(p.id, p.hecho)}
                  onEditar={() => abrirEdicion(p)}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}

        {/* Hechos (colapsable simple) */}
        {hechos.length > 0 && (
          <section>
            <h2 className="micro-label px-1.5 pb-2">Hechos</h2>
            <ul className="space-y-1.5">
              {hechos.map((p) => (
                <FilaPendiente
                  key={p.id}
                  p={p}
                  onToggle={() => togglePendienteHecho(p.id, p.hecho)}
                  onEditar={() => borrarPendiente(p.id)}
                  editarEsBorrar
                />
              ))}
            </ul>
          </section>
        )}
      </main>

      <PendienteDrawer
        open={drawerAbierto}
        onOpenChange={setDrawerAbierto}
        editando={editando}
      />
    </>
  )
}

function FilaPendiente({
  p,
  onToggle,
  onEditar,
  editarEsBorrar = false,
}: {
  p: Pendiente
  onToggle: () => void
  onEditar: () => void
  editarEsBorrar?: boolean
}) {
  const est = ESTILO_TIPO[p.tipo]
  const Icono = TIPOS.find((t) => t.valor === p.tipo)!.Icono
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className="card flex items-center gap-3 px-3.5 py-3"
    >
      {/* Marcar hecho */}
      <button
        onClick={onToggle}
        aria-label={p.hecho ? "Marcar como pendiente" : "Marcar como hecho"}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors cursor-pointer",
          p.hecho
            ? "border-primary/40 bg-primary/15 text-primary"
            : cn("border-white/[0.08]", est.fondo, est.texto)
        )}
      >
        {p.hecho ? (
          <Check className="size-4" strokeWidth={2.6} aria-hidden />
        ) : (
          <Icono className="size-[18px]" strokeWidth={2.2} aria-hidden />
        )}
      </button>

      {/* Texto */}
      <button
        onClick={onEditar}
        className="min-w-0 flex-1 text-left cursor-pointer"
      >
        <p
          className={cn(
            "truncate text-[15px] font-medium",
            p.hecho ? "text-neutral-500 line-through" : "text-neutral-100"
          )}
        >
          {p.concepto}
        </p>
        <p className="truncate pt-0.5 text-xs text-neutral-500">
          {p.persona && <span>{p.persona}</span>}
          {p.persona && p.fecha && " · "}
          {p.fecha && (
            <span className="capitalize">{formatFechaCorta(p.fecha)}</span>
          )}
          {p.recordar_dias && p.recordar_dias.length > 0 && !p.hecho && (
            <span className="ml-1 text-neutral-600">🔔</span>
          )}
        </p>
      </button>

      {/* Importe (o icono de borrar en hechos) */}
      {p.importe_cents != null ? (
        <span
          className={cn(
            "shrink-0 font-display text-[15px] font-semibold tabular-nums",
            p.hecho ? "text-neutral-600 line-through" : est.texto
          )}
        >
          {formatEUR(p.importe_cents)}
        </span>
      ) : editarEsBorrar ? (
        <button
          onClick={onEditar}
          aria-label="Borrar"
          className="flex size-8 shrink-0 items-center justify-center text-neutral-600 hover:text-rose-400 cursor-pointer"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      ) : null}
    </motion.li>
  )
}

// ---------------------------------------------------------------------------
// Drawer de añadir / editar
// ---------------------------------------------------------------------------
function PendienteDrawer({
  open,
  onOpenChange,
  editando,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  editando: Pendiente | null
}) {
  const { addPendiente, updatePendiente, borrarPendiente } = useFinanzasCtx()

  const [tipo, setTipo] = useState<TipoPendiente>("cobro")
  const [concepto, setConcepto] = useState("")
  const [persona, setPersona] = useState("")
  const [importe, setImporte] = useState("")
  const [fecha, setFecha] = useState("")
  const [avisos, setAvisos] = useState<number[]>([])

  // Al abrir, precargar si es edición (o limpiar si es nuevo)
  const [idCargado, setIdCargado] = useState<string | null>(null)
  const claveActual = open ? (editando?.id ?? "nuevo") : "cerrado"
  if (open && idCargado !== claveActual) {
    setIdCargado(claveActual)
    setTipo(editando?.tipo ?? "cobro")
    setConcepto(editando?.concepto ?? "")
    setPersona(editando?.persona ?? "")
    setImporte(
      editando?.importe_cents != null
        ? (editando.importe_cents / 100).toLocaleString("es-ES", {
            minimumFractionDigits: 2,
          })
        : ""
    )
    setFecha(editando?.fecha ?? "")
    setAvisos(editando?.recordar_dias ?? [])
  }

  const esDeuda = tipo === "cobro" || tipo === "pago"
  const importeCents = importe.trim() ? parseImporteToCents(importe) : null
  const valido =
    concepto.trim() !== "" && (!esDeuda || importeCents !== null)

  function toggleAviso(dias: number) {
    setAvisos((prev) =>
      prev.includes(dias) ? prev.filter((d) => d !== dias) : [...prev, dias]
    )
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!valido) return
    const datos = {
      tipo,
      concepto: concepto.trim(),
      persona: esDeuda && persona.trim() ? persona.trim() : null,
      importeCents: esDeuda ? importeCents : null,
      fecha: fecha || null,
      recordarDias: fecha && avisos.length > 0 ? [...avisos].sort((a, b) => a - b) : null,
    }
    if (editando) {
      await updatePendiente(editando.id, {
        tipo: datos.tipo,
        concepto: datos.concepto,
        persona: datos.persona,
        importe_cents: datos.importeCents,
        fecha: datos.fecha,
        recordar_dias: datos.recordarDias,
      })
    } else {
      await addPendiente(datos)
    }
    onOpenChange(false)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="border-white/[0.08] bg-[#0b0d11]/95 backdrop-blur-2xl">
        <DrawerHeader>
          <DrawerTitle>{editando ? "Editar" : "Nuevo pendiente"}</DrawerTitle>
        </DrawerHeader>
        <form
          onSubmit={guardar}
          className="flex flex-col gap-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          {/* Tipo */}
          <div className="flex gap-1.5">
            {TIPOS.map((t) => (
              <button
                key={t.valor}
                type="button"
                onClick={() => setTipo(t.valor)}
                className={cn(
                  "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border text-sm transition-colors cursor-pointer",
                  tipo === t.valor
                    ? "border-primary/40 bg-primary/10 font-medium text-primary"
                    : "border-white/[0.07] text-neutral-400"
                )}
              >
                <t.Icono className="size-4" aria-hidden />
                {t.etiqueta}
              </button>
            ))}
          </div>

          <input
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            autoFocus
            placeholder={
              tipo === "tarea" ? "Qué recordar (p. ej. cancelar Netflix)" : "Concepto (p. ej. la cena)"
            }
            aria-label="Concepto"
            className="h-12 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-base outline-none placeholder:text-neutral-600 focus-visible:ring-2 focus-visible:ring-primary/40"
          />

          {esDeuda && (
            <div className="grid grid-cols-2 gap-3">
              <input
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                placeholder={tipo === "cobro" ? "Quién te debe" : "A quién debes"}
                aria-label="Persona"
                className="h-12 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-base outline-none placeholder:text-neutral-600 focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              <input
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                inputMode="decimal"
                placeholder="Importe €"
                aria-label="Importe"
                className="h-12 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-base tabular-nums outline-none placeholder:text-neutral-600 focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
          )}

          {/* Fecha */}
          <label className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5">
            <span className="text-sm text-neutral-400">Fecha (opcional)</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              aria-label="Fecha"
              className="bg-transparent text-right text-base text-neutral-100 outline-none [color-scheme:dark]"
            />
          </label>

          {/* Avisos (solo si hay fecha) */}
          {fecha && (
            <div>
              <p className="micro-label pb-2">Avisarme por Telegram</p>
              <div className="flex flex-wrap gap-1.5">
                {OPCIONES_AVISO.map((o) => (
                  <button
                    key={o.dias}
                    type="button"
                    onClick={() => toggleAviso(o.dias)}
                    className={cn(
                      "h-9 rounded-full border px-3.5 text-sm transition-colors cursor-pointer",
                      avisos.includes(o.dias)
                        ? "border-primary/40 bg-primary/10 font-medium text-primary"
                        : "border-white/[0.07] text-neutral-400"
                    )}
                  >
                    {o.etiqueta}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={!valido}
            className="h-12 rounded-2xl bg-primary text-base font-semibold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
          >
            {editando ? "Guardar cambios" : "Añadir"}
          </button>

          {editando && (
            <button
              type="button"
              onClick={async () => {
                await borrarPendiente(editando.id)
                onOpenChange(false)
              }}
              className="flex items-center justify-center gap-1.5 py-1 text-xs text-neutral-500 transition-colors hover:text-rose-400 cursor-pointer"
            >
              <Trash2 className="size-3.5" aria-hidden /> Borrar
            </button>
          )}
        </form>
      </DrawerContent>
    </Drawer>
  )
}
