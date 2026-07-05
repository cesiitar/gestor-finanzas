import { defaultCache } from "@serwist/next/worker"
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist"
import { Serwist } from "serwist"

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
  // Estrategias por defecto de Serwist para Next.js (páginas network-first,
  // estáticos stale-while-revalidate). Las llamadas a Supabase no se cachean.
  runtimeCaching: defaultCache,
})

serwist.addEventListeners()
