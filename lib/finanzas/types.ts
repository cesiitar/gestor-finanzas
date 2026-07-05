/**
 * Tipos del dominio. Reflejan las filas de Supabase (snake_case)
 * para no mantener una capa de mapeo que se desincronice.
 */

export type TipoMovimiento = "ingreso" | "gasto" | "inversion"

export interface Categoria {
  id: string
  user_id: string
  nombre: string
  tipo: TipoMovimiento
  presupuesto_mensual_cents: number | null
  created_at: string
}

export interface Movimiento {
  id: string
  user_id: string
  /** Fecha YYYY-MM-DD, sin hora ni timezone */
  fecha: string
  tipo: TipoMovimiento
  categoria_id: string
  concepto: string
  /** Importe en céntimos, entero y siempre positivo; el signo lo da el tipo */
  importe_cents: number
  posicion_id: string | null
  created_at: string
}

export interface Posicion {
  id: string
  user_id: string
  nombre: string
  valor_actual_cents: number
  created_at: string
}

/** Datos que introduce el usuario al registrar un movimiento */
export interface NuevoMovimiento {
  fecha: string
  tipo: TipoMovimiento
  categoria_id: string
  concepto: string
  importe_cents: number
  posicion_id?: string | null
}
