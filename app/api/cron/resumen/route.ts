import type { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { enviarMensaje } from "@/lib/telegram/api"
import { formatEUR, hoyISO } from "@/lib/finanzas/format"
import type { Categoria, Movimiento } from "@/lib/finanzas/types"

/**
 * Cron semanal (domingos, ver vercel.json): resumen de la semana y del mes
 * por Telegram, con el estado de los presupuestos.
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
  const mes = hoy.slice(0, 7)
  const hace7 = new Date()
  hace7.setDate(hace7.getDate() - 6)
  const inicioSemana = `${hace7.getFullYear()}-${String(hace7.getMonth() + 1).padStart(2, "0")}-${String(hace7.getDate()).padStart(2, "0")}`

  const [{ data: movsMes }, { data: cats }] = await Promise.all([
    supabase
      .from("movimientos")
      .select("*")
      .eq("user_id", userId)
      .gte("fecha", `${mes}-01`),
    supabase.from("categorias").select("*").eq("user_id", userId),
  ])

  const { data: movsSemana } = await supabase
    .from("movimientos")
    .select("*")
    .eq("user_id", userId)
    .gte("fecha", inicioSemana)

  const categorias = (cats ?? []) as Categoria[]
  const nombreCat = (id: string) =>
    categorias.find((c) => c.id === id)?.nombre ?? "?"

  // Totales del mes
  let ingresos = 0
  let gastos = 0
  for (const m of (movsMes ?? []) as Movimiento[]) {
    if (m.tipo === "ingreso") ingresos += m.importe_cents
    else if (m.tipo === "gasto") gastos += m.importe_cents
  }

  // Semana: gasto total + top 3 categorías
  const gastoSemanaPorCat = new Map<string, number>()
  let gastoSemana = 0
  for (const m of (movsSemana ?? []) as Movimiento[]) {
    if (m.tipo !== "gasto") continue
    gastoSemana += m.importe_cents
    gastoSemanaPorCat.set(
      m.categoria_id,
      (gastoSemanaPorCat.get(m.categoria_id) ?? 0) + m.importe_cents
    )
  }
  const top = [...gastoSemanaPorCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, cents]) => `· ${nombreCat(id)}: ${formatEUR(cents)}`)

  // Estado de presupuestos del mes
  const gastoMesPorCat = new Map<string, number>()
  for (const m of (movsMes ?? []) as Movimiento[]) {
    if (m.tipo === "gasto")
      gastoMesPorCat.set(
        m.categoria_id,
        (gastoMesPorCat.get(m.categoria_id) ?? 0) + m.importe_cents
      )
  }
  const presupuestos = categorias
    .filter((c) => c.tipo === "gasto" && c.presupuesto_mensual_cents != null)
    .map((c) => {
      const gastado = gastoMesPorCat.get(c.id) ?? 0
      const limite = c.presupuesto_mensual_cents!
      const pct = limite > 0 ? Math.round((gastado / limite) * 100) : 0
      const icono = pct > 100 ? "🚨" : pct >= 80 ? "⚠️" : "✅"
      return `${icono} ${c.nombre}: ${pct}%`
    })

  const lineas = [
    "📬 <b>Resumen semanal</b>",
    "",
    `Esta semana has gastado <b>${formatEUR(gastoSemana)}</b>`,
    ...(top.length > 0 ? ["Donde más:", ...top] : []),
    "",
    `<b>El mes hasta hoy</b>`,
    `🟢 Ingresos ${formatEUR(ingresos)} · 🔴 Gastos ${formatEUR(gastos)}`,
    `💰 Ahorro ${formatEUR(ingresos - gastos)}`,
    ...(presupuestos.length > 0 ? ["", "<b>Presupuestos</b>", ...presupuestos] : []),
  ]

  if (chatId) await enviarMensaje(chatId, lineas.join("\n"))

  return Response.json({ ok: true })
}
