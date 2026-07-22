import Anthropic from "@anthropic-ai/sdk"
import { hoyISO } from "@/lib/finanzas/format"
import type { Categoria, TipoMovimiento } from "@/lib/finanzas/types"

/**
 * Capa de lenguaje natural del bot (Claude Haiku).
 *
 * Se usa como FALLBACK: el parser de reglas (parser.ts) resuelve gratis el
 * formato "12,50 cena mercadona"; esta capa entra cuando el mensaje es una
 * frase natural ("ayer me dejé 30 pavos cenando con los del curro").
 *
 * Si no hay ANTHROPIC_API_KEY o la llamada falla, devuelve null y el bot
 * sigue funcionando solo con reglas: la IA solo puede sumar, nunca romper.
 */

export interface MovimientoIA {
  tipo: TipoMovimiento
  importeCents: number
  concepto: string
  /** Nombre de categoría elegido por la IA de entre las del usuario */
  categoriaNombre: string | null
  /** YYYY-MM-DD, ya validada y nunca en el futuro */
  fecha: string
}

/** Salida estructurada: Haiku SIEMPRE responde con este JSON exacto */
const ESQUEMA = {
  type: "object" as const,
  properties: {
    es_movimiento: {
      type: "boolean" as const,
      description:
        "true solo si el mensaje describe un movimiento de dinero concreto a registrar",
    },
    tipo: { type: "string" as const, enum: ["gasto", "ingreso", "inversion"] },
    importe_eur: {
      type: "number" as const,
      description: "Importe en euros, positivo",
    },
    concepto: {
      type: "string" as const,
      description: "Descripción corta en minúsculas, sin el importe",
    },
    categoria: {
      type: "string" as const,
      description: "EXACTAMENTE una de las categorías disponibles del tipo elegido",
    },
    fecha: {
      type: "string" as const,
      description: "Fecha del movimiento en formato YYYY-MM-DD",
    },
  },
  required: ["es_movimiento", "tipo", "importe_eur", "concepto", "categoria", "fecha"],
  additionalProperties: false as const,
}

export async function interpretarMovimientoIA(
  texto: string,
  categorias: Categoria[]
): Promise<MovimientoIA | null> {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim()
  if (!apiKey) return null

  const nombresPorTipo = (tipo: TipoMovimiento) =>
    categorias
      .filter((c) => c.tipo === tipo)
      .map((c) => c.nombre)
      .join(", ")

  const hoy = hoyISO()
  const [hy, hm, hd] = hoy.split("-").map(Number)
  const DIAS = [
    "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
  ]
  // Tabla de los últimos 10 días ya resueltos: la IA calcula fatal el día de
  // la semana de una fecha, así que se lo damos hecho y solo tiene que mirar.
  const calendario = [...Array(10)].map((_, i) => {
    const d = new Date(Date.UTC(hy, hm - 1, hd - i))
    const marca = i === 0 ? " (hoy)" : i === 1 ? " (ayer)" : ""
    return `  ${d.toISOString().slice(0, 10)} = ${DIAS[d.getUTCDay()]}${marca}`
  })

  const system = [
    "Eres el intérprete de mensajes de un bot de finanzas personales en español.",
    `Hoy es ${DIAS[new Date(Date.UTC(hy, hm - 1, hd)).getUTCDay()]} ${hoy}.`,
    "Calendario reciente ya resuelto (CONSÚLTALO, no calcules fechas tú):",
    ...calendario,
    "Extrae del mensaje el movimiento de dinero, si lo hay.",
    "Categorías disponibles (elige EXACTAMENTE una del tipo correspondiente):",
    `- gasto: ${nombresPorTipo("gasto")}`,
    `- ingreso: ${nombresPorTipo("ingreso")}`,
    `- inversion: ${nombresPorTipo("inversion")}`,
    "Reglas:",
    "- 'pavos', 'euros', 'eur', '€' significan euros. Si no se indica moneda, son euros.",
    "- Resuelve las fechas relativas mirando el calendario de arriba, no calculando.",
    "- 'el finde' o 'el fin de semana' = el sábado más reciente del calendario.",
    "- 'la semana pasada' = usa el lunes de la semana anterior (día laborable medio).",
    "- Si la fecha resultante sería futura, usa hoy. Si no se menciona fecha, usa hoy.",
    "- Si el mensaje es una pregunta, un saludo o no describe un movimiento concreto, es_movimiento=false (rellena el resto con valores vacíos o 0).",
  ].join("\n")

  try {
    const client = new Anthropic({ apiKey })
    const respuesta = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 300,
      system,
      messages: [{ role: "user", content: texto }],
      output_config: {
        format: { type: "json_schema", schema: ESQUEMA },
      },
    })

    const bloque = respuesta.content.find((b) => b.type === "text")
    if (!bloque || bloque.type !== "text") return null

    const datos = JSON.parse(bloque.text) as {
      es_movimiento: boolean
      tipo: TipoMovimiento
      importe_eur: number
      concepto: string
      categoria: string
      fecha: string
    }

    if (!datos.es_movimiento) return null

    const importeCents = Math.round(Number(datos.importe_eur) * 100)
    if (!Number.isFinite(importeCents) || importeCents <= 0) return null

    // La fecha debe ser válida y no futura; si no, hoy
    const fecha =
      /^\d{4}-\d{2}-\d{2}$/.test(datos.fecha) && datos.fecha <= hoy
        ? datos.fecha
        : hoy

    return {
      tipo: datos.tipo,
      importeCents,
      concepto: (datos.concepto ?? "").trim(),
      categoriaNombre: datos.categoria?.trim() || null,
      fecha,
    }
  } catch (e) {
    // La IA nunca debe tumbar el bot: se loguea y se cae al mensaje de ayuda
    console.error("NLU (Haiku) falló:", e)
    return null
  }
}
