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
  /** Si el movimiento lo generó un gasto fijo, referencia a su origen */
  gasto_fijo_id?: string | null
  created_at: string
}

/** Gasto que se repite igual todos los meses; el cron lo registra solo */
export interface GastoFijo {
  id: string
  user_id: string
  nombre: string
  categoria_id: string
  importe_cents: number
  /** Día del mes en que se carga (1-31, ajustado en meses cortos) */
  dia_mes: number
  activo: boolean
  created_at: string
}

export interface Posicion {
  id: string
  user_id: string
  nombre: string
  /** Última valoración conocida (denormalizada para leer rápido) */
  valor_actual_cents: number
  /** Coste base sembrado al crear la posición (aportaciones previas al registro) */
  coste_inicial_cents: number
  /** Etiqueta libre: 'fondo', 'accion', 'cripto', 'otro'… */
  tipo: string | null
  created_at: string
}

/** Foto del valor de una posición en una fecha (para la gráfica de evolución) */
export interface Valoracion {
  id: string
  user_id: string
  posicion_id: string
  /** Fecha YYYY-MM-DD */
  fecha: string
  valor_cents: number
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
