"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
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
      className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-neutral-800 px-3.5 text-sm text-neutral-400 transition-colors hover:text-neutral-100 cursor-pointer"
    >
      <LogOut className="size-4" aria-hidden />
      Salir
    </button>
  )
}
