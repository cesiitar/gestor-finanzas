import type { NextRequest } from "next/server"
import { parseImporteToCents } from "@/lib/finanzas/format"
import { registrarMovimiento } from "@/lib/telegram/handler"

/**
 * Captura automática de gastos desde el móvil (MacroDroid → esta URL).
 * Al pagar, MacroDroid lee la notificación de Google Pay, saca el importe y
 * (opcional) un concepto, y hace un POST/GET aquí. Se registra como gasto y
 * llega el recibo por Telegram con los botones de recategorizar/borrar.
 *
 * Protegido con CAPTURA_SECRET (cabecera x-captura-secret o ?secret=). Solo
 * para gastos con tarjeta; Bizum y efectivo siguen por el bot.
 */
async function manejar(req: NextRequest): Promise<Response> {
  const url = new URL(req.url)
  const secretoOk = (process.env.CAPTURA_SECRET ?? "").trim()
  const secreto =
    req.headers.get("x-captura-secret")?.trim() ||
    url.searchParams.get("secret")?.trim() ||
    ""
  if (!secretoOk || secreto !== secretoOk) {
    return new Response("unauthorized", { status: 401 })
  }

  // Importe y concepto pueden venir por query o por body (form/JSON)
  let importeStr = url.searchParams.get("importe") ?? ""
  let concepto = url.searchParams.get("concepto") ?? ""
  if (req.method === "POST" && !importeStr) {
    const ct = req.headers.get("content-type") ?? ""
    try {
      if (ct.includes("application/json")) {
        const b = (await req.json()) as { importe?: string; concepto?: string }
        importeStr = b.importe ?? ""
        concepto = b.concepto ?? concepto
      } else {
        const f = await req.formData()
        importeStr = String(f.get("importe") ?? "")
        concepto = String(f.get("concepto") ?? concepto)
      }
    } catch {
      /* body vacío o no parseable: seguimos con lo de la query */
    }
  }

  const importeCents = parseImporteToCents(importeStr)
  const chatId = Number((process.env.TELEGRAM_CHAT_ID ?? "").trim())

  if (importeCents === null) {
    return Response.json(
      { ok: false, error: "importe no válido", recibido: importeStr },
      { status: 400 }
    )
  }

  // Reutiliza toda la lógica del bot: categoría automática, aviso de
  // presupuesto y confirmación por Telegram con botones.
  await registrarMovimiento(
    chatId,
    { tipo: "gasto", importeCents, concepto: concepto.trim() },
    "💳 "
  )

  return Response.json({ ok: true })
}

export async function POST(req: NextRequest) {
  return manejar(req)
}

export async function GET(req: NextRequest) {
  return manejar(req)
}
