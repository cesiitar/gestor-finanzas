/**
 * Mini-cliente de la Bot API de Telegram (solo los métodos que usamos).
 * Docs: https://core.telegram.org/bots/api
 */

const BASE = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

/** Botón inline (los botoncitos bajo un mensaje) */
export interface BotonInline {
  text: string
  callback_data: string
}

async function llamar(metodo: string, payload: Record<string, unknown>) {
  const res = await fetch(`${BASE()}/${metodo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    // Log para Vercel; el bot nunca debe tirar el webhook por un fallo de envío
    console.error(`Telegram ${metodo} fallo:`, res.status, await res.text())
  }
  return res
}

export async function enviarMensaje(
  chatId: number | string,
  texto: string,
  botones?: BotonInline[][]
) {
  return llamar("sendMessage", {
    chat_id: chatId,
    text: texto,
    parse_mode: "HTML",
    ...(botones ? { reply_markup: { inline_keyboard: botones } } : {}),
  })
}

/** Edita un mensaje ya enviado (p. ej. tras pulsar un botón) */
export async function editarMensaje(
  chatId: number | string,
  messageId: number,
  texto: string,
  botones?: BotonInline[][]
) {
  return llamar("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: texto,
    parse_mode: "HTML",
    ...(botones ? { reply_markup: { inline_keyboard: botones } } : {}),
  })
}

/** Confirma un callback (quita el relojito del botón pulsado) */
export async function responderCallback(callbackId: string, texto?: string) {
  return llamar("answerCallbackQuery", {
    callback_query_id: callbackId,
    ...(texto ? { text: texto } : {}),
  })
}
