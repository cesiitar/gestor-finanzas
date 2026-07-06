import type { NextConfig } from "next";

// El service worker (Serwist) se compila aparte con `serwist build`
// (ver serwist.config.mjs); así no interfiere con Turbopack.
const nextConfig: NextConfig = {
  // Cabeceras de seguridad aplicadas a todas las rutas
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Anti-clickjacking: nadie puede embeber la app en un iframe
          { key: "X-Frame-Options", value: "DENY" },
          // El navegador no "adivina" tipos MIME (evita ejecutar como script algo que no lo es)
          { key: "X-Content-Type-Options", value: "nosniff" },
          // No filtrar la URL completa (con tokens) a sitios externos
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Revoca APIs sensibles que la app no usa
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
