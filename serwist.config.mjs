import { serwist } from "@serwist/next/config";

// Modo "configurator" de Serwist: compatible con Turbopack porque el
// service worker se compila con `serwist build` tras el build de Next.
export default serwist({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});
