"use client"

import { motion, useReducedMotion } from "motion/react"

/**
 * Transición entre pestañas: un fundido con un empujón mínimo hacia arriba.
 * Next re-monta este template en cada navegación, así que basta con animar
 * la entrada. Si el sistema pide reducir movimiento, solo funde.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const sinMovimiento = useReducedMotion()
  return (
    <motion.div
      initial={{ opacity: 0, y: sinMovimiento ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
