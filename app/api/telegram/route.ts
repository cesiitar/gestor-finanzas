import type { NextRequest } from "next/server"
import { manejarUpdate } from "@/lib/telegram/handler"

/**
 * Webhook del bot de Telegram. Telegram hace POST aquí por cada mensaje.
 *
 * Seguridad en dos capas:
 * 1. Cabecera secreta: al registrar el webhook le damos a Telegram un
 *    secret_token que reenvía en cada llamada. Sin él → 401.
 * 2. Allowlist de chat: dentro del handler, cualquier chat que no sea el
 *    del dueño se ignora en silencio.
 */
export async function POST(req: NextRequest) {
  const secreto = req.headers.get("x-telegram-bot-api-secret-token")
  if (!secreto || secreto !== (process.env.TELEGRAM_WEBHOOK_SECRET ?? "").trim()) {
    return new Response("unauthorized", { status: 401 })
  }

  let update: unknown
  try {
    update = await req.json()
  } catch {
    return new Response("bad request", { status: 400 })
  }

  try {
    await manejarUpdate(update as Parameters<typeof manejarUpdate>[0])
  } catch (e) {
    // Nunca devolvemos error a Telegram: si no, reintenta el mismo update en bucle
    console.error("Error procesando update de Telegram:", e)
  }

  return Response.json({ ok: true })
}
