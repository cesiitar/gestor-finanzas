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

  // Importe y concepto pueden venir por query o por body (form/JSON).
  // Se aceptan alias porque cada app de automatización nombra distinto sus
  // variables, y depurar en el móvil a ciegas cuesta mucho más que esto.
  const q = (...claves: string[]) => {
    for (const k of claves) {
      const v = url.searchParams.get(k)
      if (v) return v
    }
    return ""
  }
  let importeStr = q("importe", "texto", "notificacion")
  let concepto = q("concepto", "titulo", "comercio")
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

  // El importe puede venir "sucio" (p. ej. "14,98 € con Tú NX ••0332"):
  // se extrae el primer número con 2 decimales; si no, se intenta tal cual.
  const trozo = importeStr.match(/\d{1,7}[.,]\d{2}/)
  const importeCents = parseImporteToCents(trozo ? trozo[0] : importeStr)
  const chatId = Number((process.env.TELEGRAM_CHAT_ID ?? "").trim())

  if (importeCents === null) {
    return Response.json(
      { ok: false, error: "importe no válido", recibido: importeStr },
      { status: 400 }
    )
  }

  // Reutiliza toda la lógica del bot: categoría automática, aviso de
  // presupuesto y confirmación por Telegram con botones.
  // Modo prueba: valida y responde sin registrar nada. Existe porque este
  // endpoint escribe, y comprobarlo con llamadas normales llenaba la cuenta
  // de gastos falsos. Nunca sondear un endpoint que escribe.
  if (url.searchParams.get("dry") === "1") {
    return Response.json({
      ok: true,
      dry: true,
      concepto: concepto.trim() || "(VACIO)",
      importe: importeStr,
      importeCents,
    })
  }

  await registrarMovimiento(
    chatId,
    { tipo: "gasto", importeCents, concepto: concepto.trim() },
    "💳 "
  )

  // Se devuelve lo recibido, no solo "ok": la respuesta se pinta en una
  // notificación del móvil, y es la única forma de ver qué manda de verdad
  // la automatización sin poder depurarla desde aquí.
  return Response.json({
    ok: true,
    concepto: concepto.trim() || "(VACIO)",
    importe: importeStr,
  })
}

export async function POST(req: NextRequest) {
  return manejar(req)
}

export async function GET(req: NextRequest) {
  return manejar(req)
}
