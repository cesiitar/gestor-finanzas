import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { HomeClient } from "@/components/finanzas/home-client"

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  return <HomeClient />
}
