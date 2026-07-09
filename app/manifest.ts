import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gestor de finanzas",
    short_name: "Finanzas",
    description: "Finanzas personales: gastos, ingresos e inversiones",
    lang: "es",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0c0f",
    theme_color: "#0b0c0f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Acceso directo al registro manteniendo pulsado el icono (Android)
    shortcuts: [
      {
        name: "Añadir movimiento",
        url: "/?add=1",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  }
}
