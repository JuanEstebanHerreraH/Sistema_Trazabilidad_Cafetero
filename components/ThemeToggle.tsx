/**
 * ThemeToggle — botón sol/luna para alternar entre modo claro y oscuro.
 * - Persiste la preferencia en localStorage (clave: cafetrace-theme)
 * - Aplica el atributo data-theme al <html>
 * - Respeta la preferencia del sistema si no hay elección previa
 */
'use client'
import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'cafetrace-theme'

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored === 'light' || stored === 'dark') return stored
    // Fallback: preferencia del sistema
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light'
  } catch {}
  return 'dark'
}

function applyTheme(t: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', t)
  try { localStorage.setItem(STORAGE_KEY, t) } catch {}
}

export default function ThemeToggle({ size = 'md' }: { size?: 'sm' | 'md' }) {
  // Empezamos en 'dark' para evitar hydration mismatch; en el useEffect
  // leemos la preferencia real una vez montado.
  const [theme, setTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = readStoredTheme()
    setTheme(t)
    applyTheme(t)
    setMounted(true)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }

  // Mientras no esté montado, renderizamos placeholder del mismo tamaño
  // para evitar layout shift.
  if (!mounted) {
    return (
      <button
        className={`theme-toggle ${size === 'sm' ? 'theme-toggle-sm' : ''}`}
        aria-label="Cambiar tema"
        disabled
        style={{ opacity: 0.5 }}
      >
        <span style={{ width: size === 'sm' ? 18 : 22, height: size === 'sm' ? 18 : 22 }} />
      </button>
    )
  }

  return (
    <button
      className={`theme-toggle ${size === 'sm' ? 'theme-toggle-sm' : ''}`}
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
      title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
    >
      {theme === 'dark' ? (
        /* Icono SOL (visible cuando está en modo oscuro — invita a cambiar a claro) */
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        /* Icono LUNA (visible cuando está en modo claro) */
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}
