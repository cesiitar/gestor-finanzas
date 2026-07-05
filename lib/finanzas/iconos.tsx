import {
  UtensilsCrossed,
  Bus,
  Gamepad2,
  Home,
  HeartPulse,
  ShoppingBag,
  RefreshCw,
  Receipt,
  Briefcase,
  Coins,
  TrendingUp,
  CircleDollarSign,
  type LucideIcon,
} from "lucide-react"
import type { TipoMovimiento } from "./types"

/**
 * Icono por categoría, resuelto por nombre (con fallback por tipo).
 * Cuando las categorías sean editables, esto puede pasar a ser un campo en BD.
 */
const ICONOS_POR_NOMBRE: Record<string, LucideIcon> = {
  comida: UtensilsCrossed,
  transporte: Bus,
  ocio: Gamepad2,
  hogar: Home,
  salud: HeartPulse,
  compras: ShoppingBag,
  suscripciones: RefreshCw,
  "otros gastos": Receipt,
  nómina: Briefcase,
  "otros ingresos": Coins,
  aportación: TrendingUp,
}

const ICONO_POR_TIPO: Record<TipoMovimiento, LucideIcon> = {
  gasto: Receipt,
  ingreso: Coins,
  inversion: TrendingUp,
}

export function getIconoCategoria(nombre: string, tipo: TipoMovimiento): LucideIcon {
  return ICONOS_POR_NOMBRE[nombre.toLowerCase()] ?? ICONO_POR_TIPO[tipo] ?? CircleDollarSign
}

/** Color de acento por tipo de movimiento (verde ingreso, rojo gasto, azul inversión) */
export const COLOR_TIPO: Record<TipoMovimiento, { texto: string; fondo: string }> = {
  ingreso: { texto: "text-emerald-400", fondo: "bg-emerald-400/10" },
  gasto: { texto: "text-rose-400", fondo: "bg-rose-400/10" },
  inversion: { texto: "text-sky-400", fondo: "bg-sky-400/10" },
}
