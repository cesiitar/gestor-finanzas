import { createAdminClient } from "@/lib/supabase/admin"
import {
  formatEUR,
  formatPct,
  hoyISO,
  parseImporteToCents,
  parseNumeroToCents,
} from "@/lib/finanzas/format"
import type { Movimiento, Posicion } from "@/lib/finanzas/types"
import { enviarMensaje } from "./api"

/** Importe en céntimos → "3629,54" (coma decimal, sin miles ni €) */
const numPlano = (cents: number) =>
  (cents / 100).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  })

/** Línea pre-rellenada para actualizar valores: solo hay que cambiar números */
export function construirLineaValores(posiciones: Posicion[]): string {
  return (
    "valores " +
    posiciones
      .map((p) => `${p.nombre} ${numPlano(p.valor_actual_cents)}`)
      .join("; ")
  )
}

/**
 * Inversiones por Telegram: ver la cartera, actualizar valores por lista
 * ("valores true value 3650, allianz 1260") y emparejar aportaciones a un
 * fondo por su nombre. Todo con el cliente admin, filtrando por BOT_USER_ID.
 */

const USER_ID = () => (process.env.BOT_USER_ID ?? "").trim()

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()

/**
 * Empareja un texto con la posición cuyo nombre comparte más palabras
 * significativas (≥4 letras). Devuelve null si no hay ninguna coincidencia.
 */
export function emparejarPosicion(
  texto: string,
  posiciones: Posicion[]
): Posicion | null {
  const t = norm(texto)
  let mejor: Posicion | null = null
  let mejorScore = 0
  for (const p of posiciones) {
    const palabras = norm(p.nombre)
      .split(/\s+/)
      .filter((w) => w.length >= 4)
    const score = palabras.filter((w) => t.includes(w)).length
    if (score > mejorScore) {
      mejorScore = score
      mejor = p
    }
  }
  return mejorScore > 0 ? mejor : null
}

async function cargarPosiciones(): Promise<Posicion[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("posiciones")
    .select("*")
    .eq("user_id", USER_ID())
    .order("created_at")
  return (data ?? []) as Posicion[]
}

/** /fondos — resumen de la cartera con valor y ganancia por fondo */
export async function resumenFondosBot(chatId: number | string) {
  const supabase = createAdminClient()
  const [posiciones, { data: movs }] = await Promise.all([
    cargarPosiciones(),
    supabase
      .from("movimientos")
      .select("importe_cents, posicion_id, tipo")
      .eq("user_id", USER_ID())
      .eq("tipo", "inversion"),
  ])

  if (posiciones.length === 0) {
    await enviarMensaje(
      chatId,
      "Aún no tienes fondos. Añádelos desde la app (pestaña Cartera)."
    )
    return
  }

  // Aportado por posición = coste inicial + aportaciones vinculadas
  const aportado = new Map<string, number>()
  for (const p of posiciones) aportado.set(p.id, p.coste_inicial_cents)
  for (const m of (movs ?? []) as Pick<Movimiento, "importe_cents" | "posicion_id">[]) {
    if (m.posicion_id)
      aportado.set(m.posicion_id, (aportado.get(m.posicion_id) ?? 0) + m.importe_cents)
  }

  let valorTotal = 0
  let aportadoTotal = 0
  const lineas = posiciones.map((p) => {
    const ap = aportado.get(p.id) ?? 0
    const gan = p.valor_actual_cents - ap
    valorTotal += p.valor_actual_cents
    aportadoTotal += ap
    const pct = ap > 0 ? ` (${formatPct(gan / ap, true)})` : ""
    const emoji = gan > 0 ? "🟢" : gan < 0 ? "🔴" : "⚪"
    return `${emoji} <b>${p.nombre}</b>: ${formatEUR(p.valor_actual_cents)}${pct}`
  })

  const ganTotal = valorTotal - aportadoTotal
  const pctTotal = aportadoTotal > 0 ? ` (${formatPct(ganTotal / aportadoTotal, true)})` : ""

  await enviarMensaje(
    chatId,
    [
      "📊 <b>Tu cartera</b>",
      ...lineas,
      "",
      `Valor total: <b>${formatEUR(valorTotal)}</b>`,
      `Ganancia: ${formatEUR(ganTotal)}${pctTotal}`,
    ].join("\n")
  )
}

/**
 * Actualiza valores por lista: "true value 3650, allianz 1260, natixis 1400".
 * Registra la foto de hoy en cada fondo y responde con la variación semanal.
 */
export async function actualizarValoresBot(chatId: number | string, resto: string) {
  const supabase = createAdminClient()
  const posiciones = await cargarPosiciones()
  if (posiciones.length === 0) {
    await enviarMensaje(chatId, "Aún no tienes fondos que actualizar.")
    return
  }

  const hoy = hoyISO()
  // Separadores: salto de línea, ';' o coma SOLO si no es decimal (la coma
  // entre dígitos, "3629,54", no separa; la coma antes de un nombre, sí).
  const items = resto
    .split(/[\n;]+|,(?=\s*[^\d\s])/)
    .map((s) => s.trim())
    .filter(Boolean)

  const lineas: string[] = []
  for (const item of items) {
    // El número (valor) está al final del item
    const mNum = item.match(/([\d.,]+)\s*€?\s*$/)
    if (!mNum) {
      lineas.push(`❓ No entendí "${item}"`)
      continue
    }
    const cents = parseImporteToCents(mNum[1])
    const nombreTexto = item.slice(0, item.length - mNum[0].length)
    const pos = emparejarPosicion(nombreTexto, posiciones)
    if (!pos || cents === null) {
      lineas.push(`❓ No reconocí el fondo en "${item}"`)
      continue
    }

    // Foto anterior (para la variación)
    const { data: prev } = await supabase
      .from("valoraciones")
      .select("valor_cents")
      .eq("posicion_id", pos.id)
      .lt("fecha", hoy)
      .order("fecha", { ascending: false })
      .limit(1)

    await supabase.from("valoraciones").upsert(
      { user_id: USER_ID(), posicion_id: pos.id, fecha: hoy, valor_cents: cents },
      { onConflict: "posicion_id,fecha" }
    )
    await supabase
      .from("posiciones")
      .update({ valor_actual_cents: cents })
      .eq("id", pos.id)
      .eq("user_id", USER_ID())

    let variacion = ""
    const antes = (prev?.[0] as { valor_cents: number } | undefined)?.valor_cents
    if (antes && antes > 0) {
      const dif = cents - antes
      const flecha = dif > 0 ? "🟢" : dif < 0 ? "🔴" : "⚪"
      variacion = ` ${flecha} ${dif >= 0 ? "+" : "−"}${formatPct(Math.abs(dif / antes))}`
    }
    lineas.push(`${pos.nombre}: ${formatEUR(cents)}${variacion}`)
  }

  await enviarMensaje(
    chatId,
    ["📈 <b>Valores actualizados</b>", ...lineas].join("\n")
  )
}

/**
 * Envía la línea pre-rellenada con los valores actuales: el usuario solo
 * cambia los números y la reenvía (no tiene que escribir los nombres).
 */
export async function plantillaActualizarBot(chatId: number | string) {
  const posiciones = await cargarPosiciones()
  if (posiciones.length === 0) {
    await enviarMensaje(chatId, "Aún no tienes fondos. Añade uno con «nuevo fondo».")
    return
  }
  await enviarMensaje(
    chatId,
    [
      "📈 <b>Actualizar valores</b>",
      "Copia esto, cambia solo los números y envíamelo:",
      "",
      `<code>${construirLineaValores(posiciones)}</code>`,
    ].join("\n")
  )
}

/**
 * Crea un fondo desde el bot: "nuevo fondo Nombre; valor; ganancia".
 * La ganancia es opcional (por defecto 0). Separador ';' para no chocar con
 * la coma decimal.
 */
export async function crearFondoBot(chatId: number | string, resto: string) {
  const partes = resto.split(";").map((s) => s.trim())
  const nombre = partes[0] ?? ""
  const valor = parseImporteToCents(partes[1] ?? "")
  const ganancia = partes[2] !== undefined && partes[2] !== "" ? parseNumeroToCents(partes[2]) : 0

  if (!nombre || valor === null || ganancia === null) {
    await enviarMensaje(
      chatId,
      [
        "Para añadir un fondo:",
        "<code>nuevo fondo Nombre; valor; ganancia</code>",
        "Ejemplo:",
        "<code>nuevo fondo True Value Fi; 3629,54; 429,48</code>",
        "(la ganancia puede ser negativa o dejarse vacía)",
      ].join("\n")
    )
    return
  }

  const coste = valor - ganancia
  if (coste < 0) {
    await enviarMensaje(chatId, "⚠️ La ganancia no puede ser mayor que el valor.")
    return
  }

  const supabase = createAdminClient()
  const { data: existe } = await supabase
    .from("posiciones")
    .select("id")
    .eq("user_id", USER_ID())
    .eq("nombre", nombre)
    .limit(1)
  if (existe && existe.length > 0) {
    await enviarMensaje(chatId, `Ya tienes un fondo llamado «${nombre}».`)
    return
  }

  const { data: pos, error } = await supabase
    .from("posiciones")
    .insert({
      user_id: USER_ID(),
      nombre,
      tipo: "fondo",
      valor_actual_cents: valor,
      coste_inicial_cents: coste,
    })
    .select("*")
    .single()
  if (error || !pos) {
    await enviarMensaje(chatId, `⚠️ No se pudo crear: ${error?.message ?? "error"}`)
    return
  }

  await supabase.from("valoraciones").insert({
    user_id: USER_ID(),
    posicion_id: (pos as Posicion).id,
    fecha: hoyISO(),
    valor_cents: valor,
  })

  const signo = ganancia > 0 ? "+" : ganancia < 0 ? "−" : ""
  await enviarMensaje(
    chatId,
    [
      `✅ <b>Fondo añadido</b>: ${nombre}`,
      `Valor ${formatEUR(valor)} · Ganancia ${signo}${formatEUR(Math.abs(ganancia))}`,
    ].join("\n")
  )
}
