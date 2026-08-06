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

/** Registra una deuda: tipo 'cobro' (me deben) o 'pago' (yo debo) */
export async function registrarDeudaBot(
  chatId: number | string,
  resto: string,
  tipo: "cobro" | "pago"
) {
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
  if (cents === null) {
    await enviarMensaje(
      chatId,
      tipo === "cobro"
        ? "Formato: <code>me debe Juan 20 la cena</code>"
        : "Formato: <code>debo Maria 50 la comida</code>"
    )
    return
  }

  // Persona = palabras antes del importe (quitando una 'a' suelta: "debo a Maria")
  const persona = tokens
    .slice(0, idx)
    .filter((t) => !/^a$/i.test(t))
    .join(" ")
    .trim()
  const concepto = tokens.slice(idx + 1).join(" ").trim()

  const supabase = createAdminClient()
  const { error } = await supabase.from("pendientes").insert({
    user_id: USER_ID(),
    tipo,
    concepto: concepto || (tipo === "cobro" ? "Te deben" : "Debes"),
    persona: persona || null,
    importe_cents: cents,
  })
  if (error) {
    await enviarMensaje(chatId, `⚠️ No se pudo apuntar: ${error.message}`)
    return
  }

  const quien = persona || "alguien"
  const linea =
    tipo === "cobro"
      ? `📥 <b>${quien}</b> te debe ${formatEUR(cents)}`
      : `📤 Debes ${formatEUR(cents)} a <b>${quien}</b>`
  await enviarMensaje(
    chatId,
    `✅ Apuntado\n${linea}${concepto ? ` · ${concepto}` : ""}`
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
