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
      <div className="grid grid-cols-5 items-center rounded-full border border-white/[0.08] bg-[#111318]/85 px-2 py-1.5 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        {TABS.map((tab, i) => {
          if (tab === null) {
            return (
              <div key={i} className="flex justify-center">
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={onAdd}
                  aria-label="Añadir movimiento"
                  className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_24px_-4px_rgba(163,230,53,0.55)] cursor-pointer"
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
