/**
 * Marca de la app: tres barras ascendentes gris → gris claro → lima.
 * Misma pieza que el icono de la PWA; se usa en el login y en estados vacíos.
 */
export function LogoBarras({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
      <rect x="164" y="226" width="44" height="130" rx="22" fill="#3f4550" />
      <rect x="236" y="166" width="44" height="190" rx="22" fill="#767d8b" />
      <rect x="308" y="106" width="44" height="250" rx="22" fill="#a3e635" />
    </svg>
  )
}
