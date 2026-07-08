import type { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { enviarMensaje } from "@/lib/telegram/api"
import { formatEUR, hoyISO } from "@/lib/finanzas/format"
import type { GastoFijo } from "@/lib/finanzas/types"

/**
 * Cron diario (Vercel Cron, ver vercel.json): registra los gastos fijos que
 * tocan hoy y avisa por Telegram. Idempotente: si un fijo ya generó movimiento
 * este mes, no lo duplica aunque el cron corra dos veces.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${(process.env.CRON_SECRET ?? "").trim()}`) {
    return new Response("unauthorized", { status: 401 })
  }

  const supabase = createAdminClient()
  const userId = (process.env.BOT_USER_ID ?? "").trim()
  const chatId = (process.env.TELEGRAM_CHAT_ID ?? "").trim()

  const hoy = hoyISO()
  const [y, m, d] = hoy.split("-").map(Number)
  const ultimoDiaMes = new Date(y, m, 0).getDate()

  const { data: fijos, error } = await supabase
    .from("gastos_fijos")
    .select("*")
    .eq("user_id", userId)
    .eq("activo", true)

  if (error) {
    console.error("cron diario: error leyendo gastos_fijos:", error.message)
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }

  const registrados: string[] = []

  for (const fijo of (fijos ?? []) as GastoFijo[]) {
    // Día 31 en un mes de 30 → se carga el último día del mes
    const diaEfectivo = Math.min(fijo.dia_mes, ultimoDiaMes)
    if (diaEfectivo !== d) continue

    // Idempotencia: ¿ya existe el movimiento de este fijo este mes?
    const { data: existente } = await supabase
      .from("movimientos")
      .select("id")
      .eq("gasto_fijo_id", fijo.id)
      .gte("fecha", `${hoy.slice(0, 7)}-01`)
      .limit(1)
    if (existente && existente.length > 0) continue

    const { error: errInsert } = await supabase.from("movimientos").insert({
      user_id: userId,
      fecha: hoy,
      tipo: "gasto",
      categoria_id: fijo.categoria_id,
      concepto: fijo.nombre,
      importe_cents: fijo.importe_cents,
      gasto_fijo_id: fijo.id,
    })
    if (errInsert) {
      console.error(`cron diario: fallo al registrar "${fijo.nombre}":`, errInsert.message)
      continue
    }
    registrados.push(`🔁 ${fijo.nombre} · ${formatEUR(fijo.importe_cents)}`)
  }

  if (registrados.length > 0 && chatId) {
    await enviarMensaje(
      chatId,
      `<b>Gastos fijos de hoy registrados</b>\n${registrados.join("\n")}`
    )
  }

  return Response.json({ ok: true, registrados: registrados.length })
}
