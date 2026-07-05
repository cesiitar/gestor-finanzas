"use client"

import { createContext, useContext, useState } from "react"
import { useFinanzas } from "@/hooks/use-finanzas"
import { QuickAddDrawer } from "./quick-add-drawer"
import { TabBar } from "./tab-bar"

type FinanzasCtx = ReturnType<typeof useFinanzas> & {
  abrirRegistro: () => void
}

const Ctx = createContext<FinanzasCtx | null>(null)

/**
 * Provider de la zona autenticada: un único estado de finanzas compartido
 * por todas las pestañas + el registro rápido accesible desde cualquiera
 * (botón central de la tab bar).
 */
export function FinanzasProvider({ children }: { children: React.ReactNode }) {
  const finanzas = useFinanzas()
  const [registroAbierto, setRegistroAbierto] = useState(false)

  return (
    <Ctx.Provider
      value={{ ...finanzas, abrirRegistro: () => setRegistroAbierto(true) }}
    >
      {children}

      <TabBar onAdd={() => setRegistroAbierto(true)} />

      <QuickAddDrawer
        open={registroAbierto}
        onOpenChange={setRegistroAbierto}
        categorias={finanzas.categorias}
        posiciones={finanzas.posiciones}
        onAdd={finanzas.addMovimiento}
      />
    </Ctx.Provider>
  )
}

export function useFinanzasCtx(): FinanzasCtx {
  const ctx = useContext(Ctx)
  if (!ctx)
    throw new Error("useFinanzasCtx debe usarse dentro de FinanzasProvider")
  return ctx
}
