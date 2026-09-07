"use client"

import { useEffect } from "react"

/**
 * Registra el service worker (solo en producción; en dev molesta con la caché).
 *
 * Además se recarga sola cuando se despliega una versión nueva: con
 * skipWaiting el service worker nuevo toma el control al instante, pero la
 * página ya cargada seguiría mostrando los archivos viejos. Al detectar el
 * cambio de controlador, recargamos una vez. Sin esto había que cerrar y
 * reabrir la app para ver los cambios.
 */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return

    // Si ya había controlador, un cambio significa "versión nueva activa".
    // En la primera visita no lo hay, y entonces no hay que recargar nada.
    const habiaControlador = Boolean(navigator.serviceWorker.controller)
    let recargado = false

    const alCambiar = () => {
      if (!habiaControlador || recargado) return
      recargado = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener("controllerchange", alCambiar)

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sin service worker la app sigue funcionando; solo pierde offline/instalación
    })

    return () =>
      navigator.serviceWorker.removeEventListener("controllerchange", alCambiar)
  }, [])
  return null
}
