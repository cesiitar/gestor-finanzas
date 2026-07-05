"use client"

import { useEffect } from "react"

/** Registra el service worker (solo en producción; en dev molesta con la caché) */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sin service worker la app sigue funcionando; solo pierde offline/instalación
      })
    }
  }, [])
  return null
}
