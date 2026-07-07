import { createClient } from "@supabase/supabase-js"

/**
 * Cliente de Supabase con la CLAVE SECRETA: se salta el RLS.
 * SOLO puede usarse en el servidor (API routes, cron). Nunca en componentes.
 *
 * Como se salta el RLS, todo lo que escriba debe llevar user_id explícito
 * (el bot usa BOT_USER_ID) y todo lo que lea debe filtrar por user_id.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
