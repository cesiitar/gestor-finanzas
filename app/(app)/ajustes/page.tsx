import { createClient } from "@/lib/supabase/server"
import { LogoutButton } from "@/components/finanzas/logout-button"
import { Tags } from "lucide-react"

/** Ajustes: sesión + (próximamente) gestión de categorías y presupuestos */
export default async function AjustesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <>
      <header className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
        <h1 className="text-xl font-semibold tracking-tight">Ajustes</h1>
      </header>
      <main className="space-y-4 px-4">
        <section className="flex items-center justify-between rounded-2xl bg-neutral-900/70 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-100">Sesión</p>
            <p className="truncate text-xs text-neutral-500">{user?.email}</p>
          </div>
          <LogoutButton />
        </section>

        <section className="flex items-center gap-3 rounded-2xl border border-dashed border-neutral-800 px-4 py-6">
          <Tags className="size-5 shrink-0 text-neutral-600" aria-hidden />
          <p className="text-sm text-neutral-400">
            La gestión de categorías y presupuestos mensuales llegará aquí en un
            próximo paso.
          </p>
        </section>
      </main>
    </>
  )
}
