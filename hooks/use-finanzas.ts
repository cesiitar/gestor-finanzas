"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { CATEGORIAS_DEFAULT } from "@/lib/finanzas/categorias-default"
import { formatEUR } from "@/lib/finanzas/format"
import type {
  Categoria,
  GastoFijo,
  Movimiento,
  NuevoMovimiento,
  Posicion,
  TipoMovimiento,
} from "@/lib/finanzas/types"

/** Orden de la lista: fecha más reciente primero; a igual fecha, lo último registrado arriba */
function ordenarMovimientos(movs: Movimiento[]): Movimiento[] {
  return [...movs].sort(
    (a, b) =>
      b.fecha.localeCompare(a.fecha) || b.created_at.localeCompare(a.created_at)
  )
}

/**
 * Estado central de finanzas en cliente: categorías, movimientos y posiciones.
 *
 * Escrituras con optimistic UI: el cambio se pinta al instante y se sincroniza
 * con Supabase por detrás; si falla, se revierte y se avisa con un toast.
 */
export function useFinanzas() {
  const supabase = useMemo(() => createClient(), [])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [posiciones, setPosiciones] = useState<Posicion[]>([])
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(
    async (silencioso = false) => {
      // 1. Categorías (si el usuario no tiene ninguna, se siembran las de serie)
      const { data: cats, error: errorCats } = await supabase
        .from("categorias")
        .select("*")
        .order("created_at")

      if (errorCats) {
        if (!silencioso) {
          toast.error("No se pudieron cargar las categorías", {
            description: errorCats.message,
          })
        }
        setCargando(false)
        return
      }

      let categoriasFinal = cats ?? []
      if (categoriasFinal.length === 0) {
        // user_id lo rellena la BD (default auth.uid())
        const { data: sembradas, error: errorSeed } = await supabase
          .from("categorias")
          .insert(CATEGORIAS_DEFAULT)
          .select("*")
        if (errorSeed) {
          if (!silencioso)
            toast.error("No se pudieron crear las categorías iniciales", {
              description: errorSeed.message,
            })
        } else {
          categoriasFinal = sembradas ?? []
        }
      }

      // 2. Movimientos (todos: es una app personal, el volumen es pequeño;
      //    si algún día crece, aquí se pagina)
      const { data: movs, error: errorMovs } = await supabase
        .from("movimientos")
        .select("*")
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })

      if (errorMovs && !silencioso) {
        toast.error("No se pudieron cargar los movimientos", {
          description: errorMovs.message,
        })
      }

      // 3. Posiciones de inversión
      const { data: pos, error: errorPos } = await supabase
        .from("posiciones")
        .select("*")
        .order("created_at")

      if (errorPos && !silencioso) {
        toast.error("No se pudieron cargar las posiciones", {
          description: errorPos.message,
        })
      }

      // 4. Gastos fijos
      const { data: fijos, error: errorFijos } = await supabase
        .from("gastos_fijos")
        .select("*")
        .order("dia_mes")

      // Si la tabla aún no existe (migración sin ejecutar), no rompemos la app
      if (errorFijos) {
        console.warn("gastos_fijos no disponible:", errorFijos.message)
      }

      setCategorias(categoriasFinal)
      setMovimientos(movs ?? [])
      setPosiciones(pos ?? [])
      setGastosFijos(fijos ?? [])
      setCargando(false)
    },
    [supabase]
  )

  // Carga inicial
  useEffect(() => {
    cargar()
  }, [cargar])

  // Refresco al volver a la app: la PWA instalada no tiene botón de recargar,
  // y lo registrado por el bot debe aparecer sin matar la app. Al recuperar
  // visibilidad/foco tras >15s, se recargan los datos en silencio.
  useEffect(() => {
    let ultimaCarga = Date.now()
    const alVolver = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible")
        return
      if (Date.now() - ultimaCarga < 15_000) return
      ultimaCarga = Date.now()
      cargar(true)
    }
    document.addEventListener("visibilitychange", alVolver)
    window.addEventListener("focus", alVolver)
    return () => {
      document.removeEventListener("visibilitychange", alVolver)
      window.removeEventListener("focus", alVolver)
    }
  }, [cargar])

  const addMovimiento = useCallback(
    async (nuevo: NuevoMovimiento) => {
      // 1. Aparece al instante con un id temporal
      const tempId = `temp-${crypto.randomUUID()}`
      const optimista: Movimiento = {
        id: tempId,
        user_id: "",
        created_at: new Date().toISOString(),
        posicion_id: null,
        ...nuevo,
      }
      setMovimientos((prev) => ordenarMovimientos([optimista, ...prev]))

      // 2. Sincronización real por detrás
      const { data, error } = await supabase
        .from("movimientos")
        .insert({ ...nuevo })
        .select("*")
        .single()

      if (error) {
        // 3. Rollback + aviso
        setMovimientos((prev) => prev.filter((m) => m.id !== tempId))
        toast.error("No se pudo guardar el movimiento", {
          description: error.message,
        })
        return
      }

      // 4. Se sustituye el temporal por la fila real
      setMovimientos((prev) =>
        ordenarMovimientos(prev.map((m) => (m.id === tempId ? data : m)))
      )

      // Confirmación visible desde cualquier pestaña (la animación de la
      // lista solo se ve desde Inicio)
      toast.success(`Guardado · ${formatEUR(nuevo.importe_cents)}`, {
        duration: 2000,
      })
    },
    [supabase]
  )

  const addPosicion = useCallback(
    async (nombre: string): Promise<Posicion | null> => {
      const { data, error } = await supabase
        .from("posiciones")
        .insert({ nombre })
        .select("*")
        .single()

      if (error) {
        toast.error("No se pudo crear la posición", {
          description: error.message,
        })
        return null
      }
      setPosiciones((prev) => [...prev, data])
      return data
    },
    [supabase]
  )

  const setValorPosicion = useCallback(
    async (id: string, valorCents: number) => {
      // Optimista con rollback
      let anterior: Posicion[] = []
      setPosiciones((prev) => {
        anterior = prev
        return prev.map((p) =>
          p.id === id ? { ...p, valor_actual_cents: valorCents } : p
        )
      })

      const { error } = await supabase
        .from("posiciones")
        .update({ valor_actual_cents: valorCents })
        .eq("id", id)

      if (error) {
        setPosiciones(anterior)
        toast.error("No se pudo actualizar el valor", {
          description: error.message,
        })
      }
    },
    [supabase]
  )

  const setPresupuestoCategoria = useCallback(
    async (id: string, presupuestoCents: number | null) => {
      // Optimista con rollback
      let anterior: Categoria[] = []
      setCategorias((prev) => {
        anterior = prev
        return prev.map((c) =>
          c.id === id ? { ...c, presupuesto_mensual_cents: presupuestoCents } : c
        )
      })

      const { error } = await supabase
        .from("categorias")
        .update({ presupuesto_mensual_cents: presupuestoCents })
        .eq("id", id)

      if (error) {
        setCategorias(anterior)
        toast.error("No se pudo guardar el presupuesto", {
          description: error.message,
        })
      }
    },
    [supabase]
  )

  // ---- Editar / borrar movimientos (optimista con rollback) ----
  const updateMovimiento = useCallback(
    async (id: string, cambios: Partial<NuevoMovimiento>) => {
      let anterior: Movimiento[] = []
      setMovimientos((prev) => {
        anterior = prev
        return ordenarMovimientos(
          prev.map((m) => (m.id === id ? { ...m, ...cambios } : m))
        )
      })
      const { error } = await supabase.from("movimientos").update(cambios).eq("id", id)
      if (error) {
        setMovimientos(anterior)
        toast.error("No se pudo guardar el cambio", { description: error.message })
      }
    },
    [supabase]
  )

  const deleteMovimiento = useCallback(
    async (id: string) => {
      let anterior: Movimiento[] = []
      setMovimientos((prev) => {
        anterior = prev
        return prev.filter((m) => m.id !== id)
      })
      const { error } = await supabase.from("movimientos").delete().eq("id", id)
      if (error) {
        setMovimientos(anterior)
        toast.error("No se pudo borrar", { description: error.message })
      }
    },
    [supabase]
  )

  // ---- Gastos fijos ----
  const addGastoFijo = useCallback(
    async (fijo: Pick<GastoFijo, "nombre" | "categoria_id" | "importe_cents" | "dia_mes">) => {
      const { data, error } = await supabase
        .from("gastos_fijos")
        .insert(fijo)
        .select("*")
        .single()
      if (error) {
        toast.error("No se pudo crear el gasto fijo", { description: error.message })
        return
      }
      setGastosFijos((prev) =>
        [...prev, data as GastoFijo].sort((a, b) => a.dia_mes - b.dia_mes)
      )
    },
    [supabase]
  )

  const updateGastoFijo = useCallback(
    async (id: string, cambios: Partial<GastoFijo>) => {
      let anterior: GastoFijo[] = []
      setGastosFijos((prev) => {
        anterior = prev
        return prev
          .map((f) => (f.id === id ? { ...f, ...cambios } : f))
          .sort((a, b) => a.dia_mes - b.dia_mes)
      })
      const { error } = await supabase.from("gastos_fijos").update(cambios).eq("id", id)
      if (error) {
        setGastosFijos(anterior)
        toast.error("No se pudo guardar el gasto fijo", { description: error.message })
      }
    },
    [supabase]
  )

  const deleteGastoFijo = useCallback(
    async (id: string) => {
      let anterior: GastoFijo[] = []
      setGastosFijos((prev) => {
        anterior = prev
        return prev.filter((f) => f.id !== id)
      })
      const { error } = await supabase.from("gastos_fijos").delete().eq("id", id)
      if (error) {
        setGastosFijos(anterior)
        toast.error("No se pudo borrar el gasto fijo", { description: error.message })
      }
    },
    [supabase]
  )

  // ---- Categorías ----
  const addCategoria = useCallback(
    async (nombre: string, tipo: TipoMovimiento) => {
      const { data, error } = await supabase
        .from("categorias")
        .insert({ nombre, tipo })
        .select("*")
        .single()
      if (error) {
        toast.error("No se pudo crear la categoría", { description: error.message })
        return
      }
      setCategorias((prev) => [...prev, data as Categoria])
    },
    [supabase]
  )

  const renombrarCategoria = useCallback(
    async (id: string, nombre: string) => {
      let anterior: Categoria[] = []
      setCategorias((prev) => {
        anterior = prev
        return prev.map((c) => (c.id === id ? { ...c, nombre } : c))
      })
      const { error } = await supabase.from("categorias").update({ nombre }).eq("id", id)
      if (error) {
        setCategorias(anterior)
        toast.error("No se pudo renombrar", { description: error.message })
      }
    },
    [supabase]
  )

  /**
   * Borra una categoría. Si tiene movimientos o gastos fijos, hay que pasar
   * `reasignarA` (otra categoría del mismo tipo): primero se reasignan y
   * después se borra — nunca borrado en cascada silencioso.
   */
  const borrarCategoria = useCallback(
    async (id: string, reasignarA?: string) => {
      if (reasignarA) {
        const { error: e1 } = await supabase
          .from("movimientos")
          .update({ categoria_id: reasignarA })
          .eq("categoria_id", id)
        const { error: e2 } = await supabase
          .from("gastos_fijos")
          .update({ categoria_id: reasignarA })
          .eq("categoria_id", id)
        if (e1 || e2) {
          toast.error("No se pudieron reasignar los movimientos", {
            description: (e1 ?? e2)?.message,
          })
          return false
        }
        setMovimientos((prev) =>
          prev.map((m) => (m.categoria_id === id ? { ...m, categoria_id: reasignarA } : m))
        )
        setGastosFijos((prev) =>
          prev.map((f) => (f.categoria_id === id ? { ...f, categoria_id: reasignarA } : f))
        )
      }
      const { error } = await supabase.from("categorias").delete().eq("id", id)
      if (error) {
        toast.error("No se pudo borrar la categoría", { description: error.message })
        return false
      }
      setCategorias((prev) => prev.filter((c) => c.id !== id))
      return true
    },
    [supabase]
  )

  const categoriasById = useMemo(
    () => new Map(categorias.map((c) => [c.id, c])),
    [categorias]
  )

  return {
    categorias,
    categoriasById,
    movimientos,
    posiciones,
    gastosFijos,
    cargando,
    addMovimiento,
    updateMovimiento,
    deleteMovimiento,
    addPosicion,
    setValorPosicion,
    setPresupuestoCategoria,
    addGastoFijo,
    updateGastoFijo,
    deleteGastoFijo,
    addCategoria,
    renombrarCategoria,
    borrarCategoria,
  }
}
