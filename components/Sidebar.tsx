'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '../utils/supabase/client'
import { useState, useEffect } from 'react'

const NAV = [
  { section: 'Principal' },
  { href: '/admin',             label: 'Dashboard',     icon: '📊' },

  { section: 'Producción' },
  { href: '/admin/productores', label: 'Productores',   icon: '👨‍🌾' },
  { href: '/admin/fincas',      label: 'Fincas',        icon: '🌿' },
  { href: '/admin/lotes',       label: 'Lotes de Café', icon: '☕' },
  { href: '/admin/procesos',    label: 'Procesos',      icon: '⚙️' },
  { href: '/admin/registros',   label: 'Registros',     icon: '📋' },

  { section: 'Inventario' },
  { href: '/admin/almacenes',   label: 'Almacenes',     icon: '🏭' },
  { href: '/admin/movimientos', label: 'Movimientos',   icon: '↕️' },

  { section: 'Comercial' },
  { href: '/admin/clientes',    label: 'Clientes',      icon: '🤝' },
  { href: '/admin/ventas',      label: 'Ventas',        icon: '💰' },

  { section: 'Sistema' },
  { href: '/admin/roles',       label: 'Roles',         icon: '🔐' },
  { href: '/admin/usuarios',    label: 'Usuarios',      icon: '👥' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Current page label for mobile topbar
  const currentItem = NAV.find(i => 'href' in i && i.href === pathname)
  const currentLabel = currentItem && 'label' in currentItem ? currentItem.label : 'CaféAdmin'

  return (
    <>
      {/* ── Mobile topbar (hidden on desktop) ── */}
      <div className="mobile-topbar">
        <button
          className={`hamburger${open ? ' open' : ''}`}
          onClick={() => setOpen(v => !v)}
          aria-label="Toggle sidebar"
        >
          <span />
          <span />
          <span />
        </button>
        <span className="mobile-topbar-title">☕ {currentLabel}</span>
      </div>

      {/* ── Backdrop overlay for mobile ── */}
      {open && (
        <div
          className="sidebar-overlay"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar drawer ── */}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">☕</div>
          <div>
            <span className="sidebar-brand-name">CaféAdmin</span>
            <span className="sidebar-brand-sub">Panel de control</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item, i) =>
            'section' in item ? (
              <div key={i} className="sidebar-section">{item.section}</div>
            ) : (
              <Link
                key={item.href}
                href={item.href!}
                className={`sidebar-link${pathname === item.href ? ' active' : ''}`}
              >
                <span className="sidebar-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          )}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-logout" onClick={handleLogout}>
            <span>🚪</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  )
}
