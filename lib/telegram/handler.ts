import { createAdminClient } from "@/lib/supabase/admin"
import { formatEUR, hoyISO } from "@/lib/finanzas/format"
import type { Categoria, Movimiento, TipoMovimiento } from "@/lib/finanzas/types"
import { enviarMensaje, editarMensaje, responderCallback, type BotonInline } from "./api"
import { parsearMovimiento, sugerirCategoria, CATEGORIA_FALLBACK } from "./parser"
import { interpretarMovimientoIA } from "./nlu"

/**
 * Lógica del bot. Todo lee/escribe con el cliente admin (se salta RLS),
 * así que SIEMPRE se filtra/inserta con el user_id del dueño (BOT_USER_ID).
 */

// .trim() en todas las env vars: un espacio/tab colado al pegarlas en Vercel
// no puede volver a romper el bot en silencio
const USER_ID = () => (process.env.BOT_USER_ID ?? "").trim()

const EMOJI_TIPO: Record<TipoMovimiento, string> = {
  gasto: "🔴",
  ingreso: "🟢",
  inversion: "🔵",
}
const NOMBRE_TIPO: Record<TipoMovimiento, string> = {
  gasto: "Gasto",
  ingreso: "Ingreso",
  inversion: "Inversión",
}

/* uuid ↔ hex32 para caber en los 64 bytes del callback_data de Telegram */
const sinGuiones = (uuid: string) => uuid.replace(/-/g, "")
const conGuiones = (hex: string) =>
  `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`

// ---------------------------------------------------------------------------
// Tipos mínimos del update de Telegram (solo lo que usamos)
// ---------------------------------------------------------------------------
interface TgUpdate {
  message?: {
    message_id: number
    text?: string
    chat: { id: number }
  }
  callback_query?: {
    id: string
    data?: string
    message?: { message_id: number; chat: { id: number } }
  }
}

// ---------------------------------------------------------------------------
// Entrada principal
// ---------------------------------------------------------------------------
export async function manejarUpdate(update: TgUpdate) {
  const chatPermitido = (process.env.TELEGRAM_CHAT_ID ?? "").trim()

  if (update.callback_query) {
    const cb = update.callback_query
    // Allowlist: solo el dueño puede pulsar botones
    if (String(cb.message?.chat.id) !== chatPermitido) {
      await responderCallback(cb.id)
      return
    }
    await manejarCallback(cb.id, cb.data ?? "", cb.message!.chat.id, cb.message!.message_id)
    return
  }

  const msg = update.message
  if (!msg?.text) return
  // Allowlist: mensajes de desconocidos se ignoran en silencio
  if (String(msg.chat.id) !== chatPermitido) {
    // Log de diagnóstico: permite ver en Vercel qué chat llegó vs el permitido
    console.warn(
      `Chat no permitido: llego "${msg.chat.id}", esperado "${chatPermitido}"`
    )
    return
  }

  await manejarTexto(msg.chat.id, msg.text.trim())
}

// ---------------------------------------------------------------------------
// Mensajes de texto
// ---------------------------------------------------------------------------
async function manejarTexto(chatId: number, texto: string) {
  // Normaliza comandos: "/resumen" o "/resumen@gestor_finanzas_bot" → "resumen"
  const t = texto.toLowerCase().replace(/^\/(\w+)(@\w+)?/, "$1")

  if (t === "start" || t === "ayuda" || t === "help") {
    await enviarMensaje(chatId, TEXTO_AYUDA)
    return
  }
  if (/borra.*(ultimo|último)/.test(t)) {
    await borrarUltimo(chatId)
    return
  }
  if (/(cu[aá]nto).*(llevo|mes)|^resumen/.test(t)) {
    await resumenMes(chatId)
    return
  }
  if (/^([uú]ltimos?)( \d+)?$/.test(t)) {
    await ultimosMovimientos(chatId)
    return
  }
  const comoVa = t.match(/c[oó]mo va (.+)/)
  if (comoVa) {
    await estadoPresupuesto(chatId, comoVa[1].trim())
    return
  }

  // Si no es un comando, intentamos registrarlo como movimiento:
  // 1º el parser de reglas (gratis e instantáneo para "12,50 cena mercadona")
  const parseado = parsearMovimiento(texto)
  if (parseado) {
    await registrarMovimiento(chatId, parseado)
    return
  }

  // 2º la IA (Haiku) para lenguaje natural: "ayer me dejé 30 pavos cenando"
  const supabase = createAdminClient()
  const { data: cats } = await supabase
    .from("categorias")
    .select("*")
    .eq("user_id", USER_ID())
    .order("created_at")

  const ia =
    cats && cats.length > 0
      ? await interpretarMovimientoIA(texto, cats as Categoria[])
      : null

  if (ia) {
    await registrarMovimiento(
      chatId,
      {
        tipo: ia.tipo,
        importeCents: ia.importeCents,
        concepto: ia.concepto,
        fecha: ia.fecha,
        categoriaNombre: ia.categoriaNombre ?? undefined,
      },
      "🤖 "
    )
    return
  }

  await enviarMensaje(
    chatId,
    "No te he entendido 🤔\nPara registrar: <code>12,50 cena mercadona</code>\nEscribe <b>ayuda</b> para ver todo lo que sé hacer."
  )
}

// ---------------------------------------------------------------------------
// Registrar movimiento
// ---------------------------------------------------------------------------
async function registrarMovimiento(
  chatId: number,
  p: {
    tipo: TipoMovimiento
    importeCents: number
    concepto: string
    /** YYYY-MM-DD; por defecto hoy */
    fecha?: string
    /** Nombre de categoría ya elegido (p. ej. por la IA); tiene prioridad */
    categoriaNombre?: string
  },
  prefijo = ""
) {
  const supabase = createAdminClient()

  const { data: categorias, error: errCats } = await supabase
    .from("categorias")
    .select("*")
    .eq("user_id", USER_ID())
    .order("created_at")
  if (errCats || !categorias?.length) {
    await enviarMensaje(chatId, "⚠️ No pude leer tus categorías. Prueba de nuevo.")
    return
  }

  const delTipo = (categorias as Categoria[]).filter((c) => c.tipo === p.tipo)

  // Elegir categoría: nombre explícito (IA) → keywords → fallback del tipo → la primera
  const sugerida = sugerirCategoria(p.concepto)
  const categoria =
    (p.categoriaNombre &&
      delTipo.find(
        (c) => c.nombre.toLowerCase() === p.categoriaNombre!.toLowerCase()
      )) ||
    (sugerida && delTipo.find((c) => c.nombre.toLowerCase() === sugerida.toLowerCase())) ||
    delTipo.find(
      (c) => c.nombre.toLowerCase() === CATEGORIA_FALLBACK[p.tipo].toLowerCase()
    ) ||
    delTipo[0]

  if (!categoria) {
    await enviarMensaje(chatId, `⚠️ No tienes categorías de tipo ${p.tipo}.`)
    return
  }

  const { data: mov, error } = await supabase
    .from("movimientos")
    .insert({
      user_id: USER_ID(),
      fecha: p.fecha ?? hoyISO(),
      tipo: p.tipo,
      categoria_id: categoria.id,
      concepto: p.concepto,
      importe_cents: p.importeCents,
    })
    .select("*")
    .single()

  if (error || !mov) {
    await enviarMensaje(chatId, `⚠️ No se pudo guardar: ${error?.message ?? "error"}`)
    return
  }

  // Alerta de presupuesto: solo cuando ESTE gasto cruza el 80% o el 100%
  let alerta = ""
  if (p.tipo === "gasto" && categoria.presupuesto_mensual_cents != null) {
    const mes = hoyISO().slice(0, 7)
    const { data: movsCat } = await supabase
      .from("movimientos")
      .select("importe_cents")
      .eq("user_id", USER_ID())
      .eq("categoria_id", categoria.id)
      .gte("fecha", `${mes}-01`)
    const total = ((movsCat ?? []) as { importe_cents: number }[]).reduce(
      (s, m) => s + m.importe_cents,
      0
    )
    const limite = categoria.presupuesto_mensual_cents
    if (limite > 0) {
      const antes = (total - p.importeCents) / limite
      const despues = total / limite
      if (antes < 1 && despues >= 1) {
        alerta = `\n\n🚨 <b>Presupuesto de ${categoria.nombre} superado</b>: ${formatEUR(total)} de ${formatEUR(limite)}`
      } else if (antes < 0.8 && despues >= 0.8) {
        alerta = `\n\n⚠️ ${categoria.nombre} al ${Math.round(despues * 100)}% del presupuesto (${formatEUR(total)} de ${formatEUR(limite)})`
      }
    }
  }

  await enviarMensaje(
    chatId,
    prefijo + textoConfirmacion(mov as Movimiento, categoria.nombre) + alerta,
    botonesMovimiento(mov as Movimiento, delTipo, categoria.id)
  )
}

function textoConfirmacion(mov: Movimiento, nombreCategoria: string): string {
  // Si el movimiento no es de hoy (p. ej. "ayer..."), se muestra la fecha
  const fecha = mov.fecha !== hoyISO() ? ` · ${mov.fecha.slice(8, 10)}/${mov.fecha.slice(5, 7)}` : ""
  const partes = [
    `${EMOJI_TIPO[mov.tipo]} <b>${NOMBRE_TIPO[mov.tipo]}</b>  ${formatEUR(mov.importe_cents)}`,
    `${nombreCategoria}${mov.concepto ? ` · ${mov.concepto}` : ""}${fecha}`,
  ]
  return partes.join("\n")
}

/** Botones: cambiar a otra categoría del mismo tipo + borrar */
function botonesMovimiento(
  mov: Movimiento,
  categoriasDelTipo: Categoria[],
  categoriaActualId: string
): BotonInline[][] {
  const otras = categoriasDelTipo.filter((c) => c.id !== categoriaActualId).slice(0, 6)
  const filasCategorias: BotonInline[][] = []
  for (let i = 0; i < otras.length; i += 3) {
    filasCategorias.push(
      otras.slice(i, i + 3).map((c, j) => ({
        text: c.nombre,
        // r|<mov hex32>|<índice global en la lista de su tipo>
        callback_data: `r|${sinGuiones(mov.id)}|${categoriasDelTipo.findIndex((x) => x.id === otras[i + j].id)}`,
      }))
    )
  }
  return [...filasCategorias, [{ text: "🗑 Borrar", callback_data: `d|${sinGuiones(mov.id)}` }]]
}

// ---------------------------------------------------------------------------
// Callbacks de botones (recategorizar / borrar)
// ---------------------------------------------------------------------------
async function manejarCallback(
  callbackId: string,
  data: string,
  chatId: number,
  messageId: number
) {
  const supabase = createAdminClient()
  const [accion, movHex, extra] = data.split("|")
  const movId = conGuiones(movHex ?? "")

  if (accion === "d") {
    const { data: mov } = await supabase
      .from("movimientos")
      .delete()
      .eq("id", movId)
      .eq("user_id", USER_ID())
      .select("*")
      .single()
    await responderCallback(callbackId, mov ? "Borrado" : "Ya no existe")
    if (mov)
      await editarMensaje(
        chatId,
        messageId,
        `🗑 Borrado: ${NOMBRE_TIPO[(mov as Movimiento).tipo]} ${formatEUR((mov as Movimiento).importe_cents)}`
      )
    return
  }

  if (accion === "r") {
    // Recuperar el movimiento y la lista de categorías de su tipo (mismo orden)
    const { data: mov } = await supabase
      .from("movimientos")
      .select("*")
      .eq("id", movId)
      .eq("user_id", USER_ID())
      .single()
    if (!mov) {
      await responderCallback(callbackId, "Ya no existe")
      return
    }
    const { data: cats } = await supabase
      .from("categorias")
      .select("*")
      .eq("user_id", USER_ID())
      .order("created_at")
    const delTipo = ((cats ?? []) as Categoria[]).filter(
      (c) => c.tipo === (mov as Movimiento).tipo
    )
    const nueva = delTipo[Number(extra)]
    if (!nueva) {
      await responderCallback(callbackId, "Categoría no encontrada")
      return
    }
    await supabase
      .from("movimientos")
      .update({ categoria_id: nueva.id })
      .eq("id", movId)
      .eq("user_id", USER_ID())
    await responderCallback(callbackId, `→ ${nueva.nombre}`)
    await editarMensaje(
      chatId,
      messageId,
      textoConfirmacion({ ...(mov as Movimiento), categoria_id: nueva.id }, nueva.nombre),
      botonesMovimiento(mov as Movimiento, delTipo, nueva.id)
    )
  }
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------
async function resumenMes(chatId: number) {
  const supabase = createAdminClient()
  const mes = hoyISO().slice(0, 7)
  const { data } = await supabase
    .from("movimientos")
    .select("tipo, importe_cents")
    .eq("user_id", USER_ID())
    .gte("fecha", `${mes}-01`)

  let ingresos = 0
  let gastos = 0
  let invertido = 0
  for (const m of (data ?? []) as Pick<Movimiento, "tipo" | "importe_cents">[]) {
    if (m.tipo === "ingreso") ingresos += m.importe_cents
    else if (m.tipo === "gasto") gastos += m.importe_cents
    else invertido += m.importe_cents
  }
  const ahorro = ingresos - gastos
  const tasa = ingresos > 0 ? ` (${Math.round((ahorro / ingresos) * 100)}% de tasa de ahorro)` : ""

  await enviarMensaje(
    chatId,
    [
      `📊 <b>Este mes</b>`,
      `🟢 Ingresos  ${formatEUR(ingresos)}`,
      `🔴 Gastos  ${formatEUR(gastos)}`,
      `🔵 Invertido  ${formatEUR(invertido)}`,
      `💰 Ahorro  <b>${formatEUR(ahorro)}</b>${tasa}`,
    ].join("\n")
  )
}

async function ultimosMovimientos(chatId: number) {
  const supabase = createAdminClient()
  const { data: movs } = await supabase
    .from("movimientos")
    .select("*, categorias(nombre)")
    .eq("user_id", USER_ID())
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5)

  if (!movs?.length) {
    await enviarMensaje(chatId, "No hay movimientos todavía.")
    return
  }
  const lineas = (movs as (Movimiento & { categorias: { nombre: string } | null })[]).map(
    (m) =>
      `${EMOJI_TIPO[m.tipo]} ${formatEUR(m.importe_cents)} · ${m.categorias?.nombre ?? "?"}${m.concepto ? ` · ${m.concepto}` : ""} · ${m.fecha.slice(8, 10)}/${m.fecha.slice(5, 7)}`
  )
  await enviarMensaje(chatId, `🧾 <b>Últimos movimientos</b>\n${lineas.join("\n")}`)
}

async function borrarUltimo(chatId: number) {
  const supabase = createAdminClient()
  const { data: ultimo } = await supabase
    .from("movimientos")
    .select("*, categorias(nombre)")
    .eq("user_id", USER_ID())
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (!ultimo) {
    await enviarMensaje(chatId, "No hay nada que borrar.")
    return
  }
  await supabase.from("movimientos").delete().eq("id", (ultimo as Movimiento).id)
  const u = ultimo as Movimiento & { categorias: { nombre: string } | null }
  await enviarMensaje(
    chatId,
    `🗑 Borrado: ${NOMBRE_TIPO[u.tipo]} ${formatEUR(u.importe_cents)} · ${u.categorias?.nombre ?? ""}${u.concepto ? ` · ${u.concepto}` : ""}`
  )
}

async function estadoPresupuesto(chatId: number, nombre: string) {
  const supabase = createAdminClient()
  const { data: cats } = await supabase
    .from("categorias")
    .select("*")
    .eq("user_id", USER_ID())
    .eq("tipo", "gasto")

  const cat = ((cats ?? []) as Categoria[]).find((c) =>
    c.nombre.toLowerCase().includes(nombre.toLowerCase())
  )
  if (!cat) {
    await enviarMensaje(chatId, `No encuentro la categoría "${nombre}".`)
    return
  }

  const mes = hoyISO().slice(0, 7)
  const { data: movs } = await supabase
    .from("movimientos")
    .select("importe_cents")
    .eq("user_id", USER_ID())
    .eq("categoria_id", cat.id)
    .gte("fecha", `${mes}-01`)
  const gastado = ((movs ?? []) as { importe_cents: number }[]).reduce(
    (s, m) => s + m.importe_cents,
    0
  )

  if (cat.presupuesto_mensual_cents == null) {
    await enviarMensaje(
      chatId,
      `<b>${cat.nombre}</b>: llevas ${formatEUR(gastado)} este mes (sin presupuesto definido).`
    )
    return
  }

  const limite = cat.presupuesto_mensual_cents
  const pct = limite > 0 ? Math.round((gastado / limite) * 100) : 0
  const estado = pct > 100 ? "🚨 superado" : pct >= 80 ? "⚠️ al límite" : "✅ bien"
  await enviarMensaje(
    chatId,
    `<b>${cat.nombre}</b>: ${formatEUR(gastado)} de ${formatEUR(limite)} (${pct}%) ${estado}`
  )
}

const TEXTO_AYUDA = [
  "🤖 <b>Tu gestor de finanzas</b>",
  "",
  "<b>Registrar</b> (por defecto es gasto):",
  "<code>12,50 cena mercadona</code>",
  "<code>ingreso 1200 nomina</code>",
  "<code>inversion 200 indexado</code>",
  "Con fecha: <code>11 peluquero ayer</code>, <code>nomina 1200 el día 1</code>, <code>30 regalo 05/07</code>",
  "",
  "<b>Consultar</b>:",
  "· <code>resumen</code> o <code>cuánto llevo este mes</code>",
  "· <code>últimos</code> — últimos movimientos",
  "· <code>cómo va comida</code> — presupuesto de una categoría",
  "",
  "<b>Corregir</b>:",
  "· <code>borra el último</code>",
  "· o usa los botones bajo cada registro",
].join("\n")
