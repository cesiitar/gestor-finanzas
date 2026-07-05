import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { FinanzasProvider } from "@/components/finanzas/finanzas-provider"

/**
 * Layout de la zona autenticada: guard de sesión + estado de finanzas
 * compartido + tab bar inferior. Cada page dentro de (app) es una pestaña.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  return (
    <FinanzasProvider>
      {/* pb amplio para que el contenido nunca quede tapado por la tab bar */}
      <div className="mx-auto min-h-dvh w-full max-w-md bg-background pb-28">
        {children}
      </div>
    </FinanzasProvider>
  )
}
