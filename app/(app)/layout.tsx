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
      {/* pb amplio para que el contenido nunca quede tapado por la tab bar flotante */}
      <div className="relative mx-auto min-h-dvh w-full max-w-md bg-background pb-36">
        <div className="page-glow" aria-hidden />
        <div className="relative">{children}</div>
      </div>
    </FinanzasProvider>
  )
}
