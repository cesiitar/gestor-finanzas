import { defaultCache } from "@serwist/next/worker"
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist"
import { NetworkOnly, Serwist } from "serwist"

// El manifest de precache lo inyecta @serwist/next en build
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Supabase (auth y datos) SIEMPRE va directo a la red, sin caché.
    // Va la primera: Serwist evalúa en orden y gana la primera coincidencia.
    // Sin esto, la regla cross-origin de defaultCache (NetworkFirst con
    // timeout) interceptaba el login y provocaba "Failed to fetch" en móvil.
    {
      matcher: ({ url }) => url.hostname.endsWith("supabase.co"),
      handler: new NetworkOnly(),
    },
    // Resto: estrategias por defecto de Serwist para Next.js
    ...defaultCache,
  ],
})

serwist.addEventListeners()
