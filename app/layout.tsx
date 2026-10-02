import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CaféTrace — Sistema de Trazabilidad',
  description: 'Plataforma de trazabilidad para el café colombiano',
}

// Script inline: aplica el tema ANTES del primer paint para evitar
// el flash de tema incorrecto al cargar. Lee localStorage.cafetrace-theme
// o cae en la preferencia del sistema.
const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('cafetrace-theme');
    if (t !== 'light' && t !== 'dark') {
      t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)
        ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', t);
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,400&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
