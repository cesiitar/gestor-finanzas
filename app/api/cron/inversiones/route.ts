import type { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { enviarMensaje } from "@/lib/telegram/api"
import { construirLineaValores } from "@/lib/telegram/inversiones"
import { formatEUR } from "@/lib/finanzas/format"
import type { Posicion } from "@/lib/finanzas/types"

/**
 * Cron de los viernes por la tarde (ver vercel.json): recuerda actualizar el
 * valor de los fondos y explica cómo hacerlo por el bot con una sola lista.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${(process.env.CRON_SECRET ?? "").trim()}`) {
    return new Response("unauthorized", { status: 401 })
  }

  const supabase = createAdminClient()
  const userId = (process.env.BOT_USER_ID ?? "").trim()
  const chatId = (process.env.TELEGRAM_CHAT_ID ?? "").trim()
  if (!chatId) return Response.json({ ok: true, aviso: "sin chat" })

  const { data: pos } = await supabase
    .from("posiciones")
    .select("*")
    .eq("user_id", userId)
    .order("created_at")

  const posiciones = (pos ?? []) as Posicion[]
  if (posiciones.length === 0) return Response.json({ ok: true, fondos: 0 })

  const lineas = [
    "📈 <b>Toca actualizar tus fondos</b>",
    "Repaso quincenal: ¿cómo van?",
    "",
    ...posiciones.map((p) => `· ${p.nombre}: ${formatEUR(p.valor_actual_cents)}`),
    "",
    "Copia esto, cambia solo los números y envíamelo:",
    `<code>${construirLineaValores(posiciones)}</code>`,
  ]

  await enviarMensaje(chatId, lineas.join("\n"))
  return Response.json({ ok: true, fondos: posiciones.length })
}
