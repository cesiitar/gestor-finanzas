import { createBrowserClient } from "@supabase/ssr"

/**
 * Cliente de Supabase para componentes de cliente ("use client").
 * Usa la clave publishable: el RLS es lo que protege los datos.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
