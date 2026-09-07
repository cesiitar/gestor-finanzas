import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { RegisterSW } from "@/components/register-sw";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display: titulares e importes. Geométrica y limpia; al ser variable
// tenemos todos los pesos, que es lo que pide el diseño (cifras grandes finas).
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestor de finanzas",
  description: "Finanzas personales: gastos, ingresos e inversiones",
  // Instalación como app en iOS (en Android manda el manifest)
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Finanzas",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0c0f",
  width: "device-width",
  initialScale: 1,
  // La app es mobile-first tipo nativa: viewport-fit para respetar el notch
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Modo oscuro por defecto (clase "dark" fija; los tokens viven en globals.css)
    <html
      lang="es"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" richColors />
        <RegisterSW />
      </body>
    </html>
  );
}
