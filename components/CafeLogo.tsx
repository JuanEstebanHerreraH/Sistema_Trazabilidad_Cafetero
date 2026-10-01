/**
 * Logo CaféTrace — grano de café estilizado con hoja
 * SVG inline, escalable, sin dependencias.
 */
export default function CafeLogo({ size = 32, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
    >
      {/* Grano de café */}
      <ellipse cx="24" cy="26" rx="11" ry="15" fill={color} opacity="0.95" />
      {/* Surco central del grano */}
      <path
        d="M24 11 Q19 26 24 41"
        stroke="#FAF4E8"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Hoja verde arriba (planta) */}
      <path
        d="M24 11 Q15 7 12 2 Q17 5 24 9"
        fill="#4A6741"
      />
      <path
        d="M24 11 Q19 8 18 4"
        stroke="#3A5231"
        strokeWidth="0.8"
        fill="none"
      />
    </svg>
  )
}
