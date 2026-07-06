import { createClient } from "@/lib/supabase/server"
import { LogoutButton } from "@/components/finanzas/logout-button"
import { AjustesPresupuestos } from "@/components/finanzas/ajustes-presupuestos"
import { Tags } from "lucide-react"

/** Ajustes: sesión + (próximamente) gestión de categorías y presupuestos */
export default async function AjustesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <>
      <header className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-3">
        <p className="micro-label">Gestor de finanzas</p>
        <h1 className="pt-1 font-display text-[26px] font-semibold leading-none tracking-tight">
          Ajustes
        </h1>
      </header>
      <main className="space-y-5 px-4">
        <section className="card flex items-center justify-between px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-100">Sesión</p>
            <p className="truncate text-xs text-neutral-500">{user?.email}</p>
          </div>
          <LogoutButton />
        </section>

        <AjustesPresupuestos />

        <section className="flex items-center gap-3 rounded-[1.25rem] border border-dashed border-white/10 px-4 py-6">
          <Tags className="size-5 shrink-0 text-neutral-600" aria-hidden />
          <p className="text-sm text-neutral-400">
            Crear, renombrar y borrar categorías llegará en la segunda iteración.
          </p>
        </section>
      </main>
    </>
  )
}
