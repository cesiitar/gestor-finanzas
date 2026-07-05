"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { CATEGORIAS_DEFAULT } from "@/lib/finanzas/categorias-default"
import type { Categoria, Movimiento, NuevoMovimiento } from "@/lib/finanzas/types"

/** Orden de la lista: fecha más reciente primero; a igual fecha, lo último registrado arriba */
function ordenarMovimientos(movs: Movimiento[]): Movimiento[] {
  return [...movs].sort(
    (a, b) =>
      b.fecha.localeCompare(a.fecha) || b.created_at.localeCompare(a.created_at)
  )
}

/**
 * Estado central de finanzas en cliente: categorías + movimientos recientes.
 *
 * Registro con optimistic UI: el movimiento aparece en la lista al instante
 * con un id temporal y se sincroniza con Supabase por detrás; si falla,
 * se retira de la lista y se avisa con un toast (rollback).
 */
export function useFinanzas() {
  const supabase = useMemo(() => createClient(), [])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      // 1. Categorías (si el usuario no tiene ninguna, se siembran las de serie)
      const { data: cats, error: errorCats } = await supabase
        .from("categorias")
        .select("*")
        .order("created_at")

      if (errorCats) {
        if (!cancelado) {
          toast.error("No se pudieron cargar las categorías", {
            description: errorCats.message,
          })
          setCargando(false)
        }
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
          if (!cancelado)
            toast.error("No se pudieron crear las categorías iniciales", {
              description: errorSeed.message,
            })
        } else {
          categoriasFinal = sembradas ?? []
        }
      }

      // 2. Últimos movimientos
      const { data: movs, error: errorMovs } = await supabase
        .from("movimientos")
        .select("*")
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30)

      if (errorMovs && !cancelado) {
        toast.error("No se pudieron cargar los movimientos", {
          description: errorMovs.message,
        })
      }

      if (!cancelado) {
        setCategorias(categoriasFinal)
        setMovimientos(movs ?? [])
        setCargando(false)
      }
    }

    cargar()
    return () => {
      cancelado = true
    }
  }, [supabase])

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
    },
    [supabase]
  )

  const categoriasById = useMemo(
    () => new Map(categorias.map((c) => [c.id, c])),
    [categorias]
  )

  return { categorias, categoriasById, movimientos, cargando, addMovimiento }
}
