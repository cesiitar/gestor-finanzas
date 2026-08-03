/**
 * Registra el menú de comandos del bot (los que salen al escribir "/").
 * Reproducible: lee TELEGRAM_BOT_TOKEN de .env.local (nunca se escribe la
 * clave aquí). Ejecutar tras cambiar la lista:  node scripts/set-comandos-telegram.mjs
 */
import { readFileSync } from "node:fs"

// Cargar TELEGRAM_BOT_TOKEN desde .env.local
let token = process.env.TELEGRAM_BOT_TOKEN
if (!token) {
  for (const linea of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = linea.match(/^TELEGRAM_BOT_TOKEN=(.+)$/)
    if (m) token = m[1].trim()
  }
}
if (!token) {
  console.error("Falta TELEGRAM_BOT_TOKEN (en el entorno o en .env.local)")
  process.exit(1)
}

const comandos = [
  { command: "resumen", description: "Resumen del mes" },
  { command: "ultimos", description: "Últimos movimientos" },
  { command: "fondos", description: "Estado de tu cartera" },
  { command: "actualizar", description: "Actualizar el valor de tus fondos" },
  { command: "nuevofondo", description: "Añadir un fondo nuevo" },
  { command: "deudas", description: "Quién te debe y a quién debes" },
  { command: "ayuda", description: "Ver todo lo que sé hacer" },
]

const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ commands: comandos }),
})
const data = await res.json()
console.log(data.ok ? "✅ Comandos registrados" : "❌ Error", data)
