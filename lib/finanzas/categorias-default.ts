import type { TipoMovimiento } from "./types"

/**
 * Categorías que se crean automáticamente la primera vez que el usuario
 * entra sin tener ninguna. Después son suyas: podrá renombrarlas,
 * borrarlas o añadir más desde Ajustes.
 */
export const CATEGORIAS_DEFAULT: { nombre: string; tipo: TipoMovimiento }[] = [
  // Gastos
  { nombre: "Comida", tipo: "gasto" },
  { nombre: "Transporte", tipo: "gasto" },
  { nombre: "Ocio", tipo: "gasto" },
  { nombre: "Hogar", tipo: "gasto" },
  { nombre: "Salud", tipo: "gasto" },
  { nombre: "Compras", tipo: "gasto" },
  { nombre: "Suscripciones", tipo: "gasto" },
  { nombre: "Otros gastos", tipo: "gasto" },
  // Ingresos
  { nombre: "Nómina", tipo: "ingreso" },
  { nombre: "Otros ingresos", tipo: "ingreso" },
  // Inversión
  { nombre: "Aportación", tipo: "inversion" },
]
