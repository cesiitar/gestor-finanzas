"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await createClient().auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      Cerrar sesión
    </button>
  )
}
