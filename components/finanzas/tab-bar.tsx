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

/** Tab bar flotante tipo píldora, con el registro rápido en lima al centro */
export function TabBar({ onAdd }: { onAdd: () => void }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-sm"
    >
      <div className="luz-borde grid grid-cols-5 items-center rounded-full border border-white/[0.09] bg-white/[0.045] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_18px_44px_-16px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
        {TABS.map((tab, i) => {
          if (tab === null) {
            return (
              <div key={i} className="flex justify-center">
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={onAdd}
                  aria-label="Añadir movimiento"
                  className="btn-luz flex size-12 items-center justify-center cursor-pointer"
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
                "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-full transition-colors",
                activa ? "text-primary" : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              <tab.Icono className="size-5" strokeWidth={activa ? 2.4 : 2} aria-hidden />
              <span className="text-[10px] font-medium tracking-wide">
                {tab.etiqueta}
              </span>
              {activa && (
                <motion.span
                  layoutId="tab-activa"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-primary"
                  aria-hidden
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
