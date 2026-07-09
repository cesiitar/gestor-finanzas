import type { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { enviarMensaje, enviarDocumento } from "@/lib/telegram/api"
import { formatEUR, hoyISO } from "@/lib/finanzas/format"
import { construirFilas, generarCSV } from "@/lib/finanzas/csv"
import type { Categoria, GastoFijo, Movimiento } from "@/lib/finanzas/types"

/**
 * Cron diario (Vercel Cron, ver vercel.json): registra los gastos fijos que
 * tocan hoy y avisa por Telegram. Idempotente: si un fijo ya generó movimiento
 * este mes, no lo duplica aunque el cron corra dos veces.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${(process.env.CRON_SECRET ?? "").trim()}`) {
    // Diagnóstico sin exponer el secreto: ¿existe la variable? ¿qué longitud tiene?
    console.warn(
      `cron diario: auth fallida. CRON_SECRET definido=${process.env.CRON_SECRET !== undefined} len=${(process.env.CRON_SECRET ?? "").trim().length}`
    )
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

  // Día 1: copia de seguridad del mes anterior por Telegram (CSV)
  let backup = false
  if (d === 1 && chatId) {
    try {
      const mesAnterior = new Date(y, m - 2, 1) // m es 1-based; -2 = mes previo
      const prevIni = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, "0")}-01`
      const esteIni = `${y}-${String(m).padStart(2, "0")}-01`

      const [{ data: movs }, { data: cats }] = await Promise.all([
        supabase
          .from("movimientos")
          .select("*")
          .eq("user_id", userId)
          .gte("fecha", prevIni)
          .lt("fecha", esteIni)
          .order("fecha"),
        supabase.from("categorias").select("*").eq("user_id", userId),
      ])

      if (movs && movs.length > 0) {
        const categoriasById = new Map(
          ((cats ?? []) as Categoria[]).map((c) => [c.id, c])
        )
        const csv = generarCSV(construirFilas(movs as Movimiento[], categoriasById))
        const etiqueta = mesAnterior.toLocaleDateString("es-ES", {
          month: "long",
          year: "numeric",
        })
        await enviarDocumento(
          chatId,
          `finanzas-${prevIni.slice(0, 7)}.csv`,
          csv,
          `📦 Copia de seguridad de ${etiqueta} (${movs.length} movimientos). Guárdala donde quieras.`
        )
        backup = true
      }
    } catch (e) {
      console.error("cron diario: fallo el backup mensual:", e)
      await enviarMensaje(
        chatId,
        "⚠️ El backup mensual automático falló. Puedes exportarlo a mano desde la pestaña Tabla."
      )
    }
  }

  return Response.json({ ok: true, registrados: registrados.length, backup })
}
