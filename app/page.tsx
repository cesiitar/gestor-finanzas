import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { LogoutButton } from "@/components/logout-button"

/**
 * Home provisional: comprueba la sesión y confirma que el login funciona.
 * Aquí irá el registro rápido de movimientos (paso 2 de la Fase 1).
 */
export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6">
      <p className="text-lg">
        ✅ Sesión iniciada como <span className="font-semibold">{user.email}</span>
      </p>
      <p className="text-sm text-muted-foreground">
        Supabase conectado. Siguiente paso: registro rápido de movimientos.
      </p>
      <LogoutButton />
    </main>
  )
}
