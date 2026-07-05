"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { Plus, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useFinanzas } from "@/hooks/use-finanzas"
import { MovimientosList } from "./movimientos-list"
import { QuickAddDrawer } from "./quick-add-drawer"

/**
 * Home / Registro: lista de últimos movimientos + botón "+" que abre
 * el registro rápido. La navegación por pestañas llegará con las
 * siguientes pantallas (Dashboard, Tabla, Inversiones).
 */
export function HomeClient() {
  const { categorias, categoriasById, movimientos, cargando, addMovimiento } =
    useFinanzas()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const router = useRouter()

  async function handleLogout() {
    await createClient().auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      {/* Cabecera */}
      <header className="flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
        <h1 className="text-xl font-semibold tracking-tight">Finanzas</h1>
        <button
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          className="flex size-11 items-center justify-center rounded-full text-neutral-500 transition-colors hover:text-neutral-200 cursor-pointer"
        >
          <LogOut className="size-5" aria-hidden />
        </button>
      </header>

      {/* Últimos movimientos */}
      <main className="flex-1 px-4 pb-32">
        <h2 className="px-1.5 pb-3 pt-4 text-sm font-medium text-neutral-500">
          Últimos movimientos
        </h2>
        <MovimientosList
          movimientos={movimientos}
          categoriasById={categoriasById}
          cargando={cargando}
        />
      </main>

      {/* Botón de registro rápido */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => setDrawerOpen(true)}
        aria-label="Añadir movimiento"
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex size-16 -translate-x-1/2 items-center justify-center rounded-full bg-white text-neutral-950 shadow-lg shadow-black/40 cursor-pointer"
      >
        <Plus className="size-7" strokeWidth={2.5} aria-hidden />
      </motion.button>

      <QuickAddDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        categorias={categorias}
        onAdd={addMovimiento}
      />
    </div>
  )
}
