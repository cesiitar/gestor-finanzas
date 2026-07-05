"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "motion/react"
import { Home, ChartPie, Plus, Table2, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

const TABS = [
  { href: "/", etiqueta: "Inicio", Icono: Home },
  { href: "/dashboard", etiqueta: "Panel", Icono: ChartPie },
  null, // hueco del botón +
  { href: "/tabla", etiqueta: "Tabla", Icono: Table2 },
  { href: "/inversiones", etiqueta: "Cartera", Icono: TrendingUp },
] as const

/** Barra de navegación inferior fija, estilo app nativa, con registro rápido en el centro */
export function TabBar({ onAdd }: { onAdd: () => void }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-800/80 bg-neutral-950/90 backdrop-blur-lg"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {TABS.map((tab, i) => {
          if (tab === null) {
            return (
              <div key={i} className="flex justify-center">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onAdd}
                  aria-label="Añadir movimiento"
                  className="flex size-13 -translate-y-3 items-center justify-center rounded-full bg-white text-neutral-950 shadow-lg shadow-black/50 cursor-pointer"
                >
                  <Plus className="size-6" strokeWidth={2.5} aria-hidden />
                </motion.button>
              </div>
            )
          }

          const activa = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={activa ? "page" : undefined}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg transition-colors",
                activa ? "text-white" : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              <tab.Icono className="size-5" strokeWidth={activa ? 2.4 : 2} aria-hidden />
              <span className="text-[10px] font-medium">{tab.etiqueta}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
