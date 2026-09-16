import { createAdminClient } from "@/lib/supabase/admin"
import { formatEUR, parseImporteToCents } from "@/lib/finanzas/format"
import type { Pendiente } from "@/lib/finanzas/types"
import { enviarMensaje } from "./api"

/**
 * Pendientes por Telegram: captura rápida de deudas ("me debe Juan 20 cena",
 * "debo Maria 50 comida"), notas ("nota cancelar Netflix") y consulta de
 * quién te debe. Los recordatorios con fecha se ponen desde la app (allí
 * está el selector de día y de avisos). Todo con user_id = BOT_USER_ID.
 */

const USER_ID = () => (process.env.BOT_USER_ID ?? "").trim()

/** Palabras de moneda que no son concepto: "20 euros la cena" → "la cena" */
const MONEDA = /^(?:euros?|eur|€|pavos?|lereles)$/i
/** Relleno delante del concepto: "de la cena" → "la cena" */
const RELLENO = /^(?:de|del|por|en|para|lo|los|las)$/i
/** Preposición que marca a quién: "30 a Pablo", "20 de Pedro" */
const A_QUIEN = /^(?:a|al|de|del)$/i
/** Arranque de persona de dos palabras: "a mi madre", "a su hermano" */
const POSESIVO = /^(?:mi|mis|tu|tus|su|sus)$/i

export interface DeudaParseada {
  tipo: "cobro" | "pago"
  persona: string | null
  cents: number
  concepto: string
}

/**
 * Entiende una deuda escrita en lenguaje normal, con el nombre delante o
 * detrás del importe. Se probó contra las formas que sale escribir de verdad:
 *   "Juan me debe 20 euros" · "me debe Juan 20 la cena"
 *   "me deben 15,50 Pedro del taxi" · "le debo 30 a Pablo"
 * Devuelve null si no es una deuda (el handler sigue con otras reglas).
 */
export function parsearDeuda(texto: string): DeudaParseada | null {
  const limpio = texto.trim()
  let tipo: "cobro" | "pago" | null = null
  let resto = ""
  let personaDelante: string | null = null

  // "Juan me debe 20" / "mi hermano me debe 50" (el nombre va primero)
  let m = limpio.match(/^(.{1,40}?)\s+me\s+deben?\b\s*([\s\S]*)$/i)
  if (m) {
    tipo = "cobro"
    personaDelante = m[1].trim()
    resto = m[2]
  }
  // "me debe Juan 20 la cena" / "me deben 20 euros Juan"
  if (!tipo && (m = limpio.match(/^\s*me\s+deben?\b\s*([\s\S]+)$/i))) {
    tipo = "cobro"
    resto = m[1]
  }
  // "debo Maria 50" / "le debo a Maria 50" / "yo debo 20 a Pablo"
  if (!tipo && (m = limpio.match(/^\s*(?:yo\s+)?(?:les?\s+)?debo\b\s*([\s\S]+)$/i))) {
    tipo = "pago"
    resto = m[1]
  }
  // "tengo que pagarle 20 a Juan"
  if (!tipo && (m = limpio.match(/^\s*tengo\s+que\s+pagar(?:les?)?\b\s*([\s\S]+)$/i))) {
    tipo = "pago"
    resto = m[1]
  }
  if (!tipo) return null

  const tokens = resto.trim().split(/\s+/).filter(Boolean)
  let idx = -1
  let cents: number | null = null
  for (let i = 0; i < tokens.length; i++) {
    const c = parseImporteToCents(tokens[i])
    if (c !== null) {
      cents = c
      idx = i
      break
    }
  }
  if (cents === null) return null

  const antes = tokens.slice(0, idx).filter((t) => !A_QUIEN.test(t))
  let despues = tokens.slice(idx + 1).filter((t) => !MONEDA.test(t))

  let persona = personaDelante ?? (antes.length > 0 ? antes.join(" ") : null)

  // Sin nombre delante: buscarlo detrás, pero solo cuando está marcado
  // ("a Pablo") o viene en mayúscula (un nombre). Si no, es concepto:
  // "me debe 20 la cena" no puede acabar con persona="la".
  if (!persona && despues.length > 0) {
    if (A_QUIEN.test(despues[0]) && despues.length > 1) {
      // "a mi madre" son dos palabras; "a Pablo la cena" solo una
      const largo = POSESIVO.test(despues[1]) && despues.length > 2 ? 2 : 1
      persona = despues.slice(1, 1 + largo).join(" ")
      despues = despues.slice(1 + largo)
    } else if (/^[A-ZÁÉÍÓÚÑ]/.test(despues[0])) {
      persona = despues[0]
      despues = despues.slice(1)
    }
  }

  while (despues.length > 0 && RELLENO.test(despues[0])) despues = despues.slice(1)

  return {
    tipo,
    persona: persona && persona.length > 0 ? persona : null,
    cents,
    concepto: despues.join(" ").trim(),
  }
}

/** Registra una deuda ya interpretada por parsearDeuda */
export async function registrarDeudaBot(
  chatId: number | string,
  deuda: DeudaParseada
) {
  const { tipo, persona, cents, concepto } = deuda
  const supabase = createAdminClient()
  const { error } = await supabase.from("pendientes").insert({
    user_id: USER_ID(),
    tipo,
    concepto: concepto || (tipo === "cobro" ? "Te deben" : "Debes"),
    persona,
    importe_cents: cents,
  })
  if (error) {
    await enviarMensaje(chatId, `⚠️ No se pudo apuntar: ${error.message}`)
    return
  }

  const quien = persona ?? "alguien"
  const linea =
    tipo === "cobro"
      ? `📥 <b>${quien}</b> te debe ${formatEUR(cents)}`
      : `📤 Debes ${formatEUR(cents)} a <b>${quien}</b>`
  await enviarMensaje(
    chatId,
    `✅ Apuntado
${linea}${concepto ? ` · ${concepto}` : ""}`
  )
}

/** Registra una nota/recordatorio sin importe */
export async function registrarNotaBot(chatId: number | string, texto: string) {
  const concepto = texto.trim()
  if (!concepto) {
    await enviarMensaje(chatId, "Formato: <code>nota cancelar Netflix</code>")
    return
  }
  const supabase = createAdminClient()
  const { error } = await supabase.from("pendientes").insert({
    user_id: USER_ID(),
    tipo: "tarea",
    concepto,
  })
  if (error) {
    await enviarMensaje(chatId, `⚠️ No se pudo apuntar: ${error.message}`)
    return
  }
  await enviarMensaje(
    chatId,
    `✅ Apuntado: ${concepto}\nSi quieres aviso con fecha, ponlo en la app (Inicio → 🗓)`
  )
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()

/**
 * Marca un pendiente como hecho por su persona o concepto:
 * "cobrado Juan", "pagado Maria", "hecho Netflix". El verbo orienta el tipo
 * (cobrado→cobro, pagado→pago) para desempatar.
 */
export async function marcarHechoBot(
  chatId: number | string,
  texto: string,
  prefiere: "cobro" | "pago" | null
) {
  const busqueda = norm(texto)
  if (!busqueda) {
    await enviarMensaje(chatId, "Dime cuál: <code>cobrado Juan</code>")
    return
  }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from("pendientes")
    .select("*")
    .eq("user_id", USER_ID())
    .eq("hecho", false)

  const todos = (data ?? []) as Pendiente[]
  // Todas las palabras buscadas deben aparecer (por palabra, no substring del todo)
  const palabras = busqueda.split(/\s+/).filter(Boolean)
  const casa = (heno: string) => palabras.every((w) => norm(heno).includes(w))

  // Prioridad: primero por NOMBRE de la persona; si no, por persona+concepto
  const porPersona = todos.filter((p) => p.persona && casa(p.persona))
  let candidatos =
    porPersona.length > 0
      ? porPersona
      : todos.filter((p) => casa(`${p.persona ?? ""} ${p.concepto}`))

  // El verbo orienta el tipo (cobrado→cobro, pagado→pago) para desempatar
  if (prefiere && candidatos.filter((p) => p.tipo === prefiere).length > 0) {
    candidatos = candidatos.filter((p) => p.tipo === prefiere)
  }

  if (candidatos.length === 0) {
    await enviarMensaje(chatId, `No encuentro nada pendiente con «${texto}».`)
    return
  }
  if (candidatos.length > 1) {
    const lista = candidatos
      .slice(0, 6)
      .map(
        (p) =>
          `· ${p.persona ?? "—"}: ${p.concepto}${p.importe_cents != null ? ` (${formatEUR(p.importe_cents)})` : ""}`
      )
      .join("\n")
    await enviarMensaje(
      chatId,
      `Hay varios de esa persona. Añade el concepto (p. ej. <code>cobrado ${texto} ${candidatos[0].concepto}</code>):\n${lista}`
    )
    return
  }

  const p = candidatos[0]
  await supabase.from("pendientes").update({ hecho: true }).eq("id", p.id)
  const detalle = `${p.persona ?? p.concepto}${p.importe_cents != null ? ` · ${formatEUR(p.importe_cents)}` : ""}`
  await enviarMensaje(chatId, `✅ Hecho: ${detalle}`)
}

/** "quién me debe" / "deudas" → lista de cobros y pagos con totales */
export async function consultarDeudasBot(chatId: number | string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("pendientes")
    .select("*")
    .eq("user_id", USER_ID())
    .eq("hecho", false)
    .in("tipo", ["cobro", "pago"])

  const pendientes = (data ?? []) as Pendiente[]
  const cobros = pendientes.filter((p) => p.tipo === "cobro")
  const pagos = pendientes.filter((p) => p.tipo === "pago")

  if (cobros.length === 0 && pagos.length === 0) {
    await enviarMensaje(chatId, "No tienes deudas apuntadas. 🎉")
    return
  }

  const linea = (p: Pendiente) =>
    `· ${p.persona ?? "?"}: ${formatEUR(p.importe_cents ?? 0)}${p.concepto ? ` (${p.concepto})` : ""}`
  const totalCobros = cobros.reduce((s, p) => s + (p.importe_cents ?? 0), 0)
  const totalPagos = pagos.reduce((s, p) => s + (p.importe_cents ?? 0), 0)

  const partes: string[] = []
  if (cobros.length > 0) {
    partes.push(`📥 <b>Te deben ${formatEUR(totalCobros)}</b>`, ...cobros.map(linea))
  }
  if (pagos.length > 0) {
    if (partes.length) partes.push("")
    partes.push(`📤 <b>Debes ${formatEUR(totalPagos)}</b>`, ...pagos.map(linea))
  }
  await enviarMensaje(chatId, partes.join("\n"))
}
