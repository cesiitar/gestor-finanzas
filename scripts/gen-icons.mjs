// Genera los iconos PWA en public/icons/ a partir de un SVG.
// Diseño: tres barras redondeadas (rojo gasto, verde ingreso, azul inversión)
// sobre fondo oscuro. El maskable mete el dibujo en la zona segura central.
import sharp from "sharp"
import { mkdirSync } from "node:fs"
import { resolve } from "node:path"

const outDir = resolve(process.argv[2] ?? "public/icons")
mkdirSync(outDir, { recursive: true })

// factor: cuánto se encoge el dibujo hacia el centro (maskable necesita margen)
function svgIcono(factor = 1) {
  const cx = 256
  const cy = 256
  // Barras: [x relativo al centro, altura, color]
  const barras = [
    [-92, 130, "#fb7185"], // gasto
    [-20, 190, "#34d399"], // ingreso
    [52, 250, "#38bdf8"], // inversión
  ]
  const ancho = 44 * factor
  const baseY = cy + 125 * factor
  const rects = barras
    .map(([dx, h, color]) => {
      const x = cx + dx * factor
      const alto = h * factor
      return `<rect x="${x}" y="${baseY - alto}" width="${ancho}" height="${alto}" rx="${ancho / 2}" fill="${color}"/>`
    })
    .join("\n  ")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" fill="#0a0a0a"/>
  ${rects}
</svg>`
}

const normal = Buffer.from(svgIcono(1))
const maskable = Buffer.from(svgIcono(0.78))

await sharp(normal).resize(192, 192).png().toFile(`${outDir}/icon-192.png`)
await sharp(normal).resize(512, 512).png().toFile(`${outDir}/icon-512.png`)
await sharp(maskable).resize(512, 512).png().toFile(`${outDir}/icon-maskable-512.png`)
await sharp(normal).resize(180, 180).png().toFile(`${outDir}/apple-touch-icon.png`)

console.log("Iconos generados en", outDir)
