'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '../utils/supabase/client'
import { useState, useEffect } from 'react'

type NavItem =
  | { section: string }
  | { href: string; label: string; icon: string; badge?: boolean }

const NAV: NavItem[] = [
  { section: 'Principal' },
  { href: '/admin',              label: 'Dashboard',         icon: '▦' },
  { section: 'Producción' },
  { href: '/admin/productores',  label: 'Productores',       icon: '👨‍🌾' },
  { href: '/admin/fincas',       label: 'Fincas',            icon: '🌿' },
  { href: '/admin/lotes',        label: 'Lotes de Café',     icon: '☕' },
  { href: '/admin/procesos',     label: 'Procesos',          icon: '⚙️' },
  { href: '/admin/registros',    label: 'Registros',         icon: '📋' },
  { section: 'Inventario' },
  { href: '/admin/almacenes',    label: 'Almacenes',         icon: '🏭' },
  { href: '/admin/movimientos',  label: 'Movimientos',       icon: '↕️' },
  { section: 'Comercial' },
  { href: '/admin/clientes',     label: 'Clientes',          icon: '🤝' },
  { href: '/admin/ventas',       label: 'Ventas',            icon: '💰' },
  { section: 'Sistema' },
  { href: '/admin/roles',        label: 'Roles',             icon: '🔐' },
  { href: '/admin/usuarios',     label: 'Usuarios',          icon: '👥' },
  { href: '/admin/solicitudes',  label: 'Solicitudes',       icon: '📬', badge: true },
]

interface Props { userName?: string; userEmail?: string }

export default function AdminSidebar({ userName = '', userEmail = '' }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [pendientes, setPendientes] = useState(0)

  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const load = async () => {
      const { count } = await supabase.from('solicitud_rol')
        .select('*', { count: 'exact', head: true }).eq('estado_revision', 'pendiente')
      setPendientes(count ?? 0)
    }
    load()
    const iv = setInterval(load, 60000)
    return () => clearInterval(iv)
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
      <div className="mobile-topbar">
        <button className="hamburger" onClick={() => setOpen(v => !v)} aria-label="Menu">
          <span /><span /><span />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem' }}>☕</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--text)', fontWeight: 700 }}>CaféTrace</span>
        </div>
      </div>

      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">☕</div>
          <div>
            <span className="sidebar-brand-name">CaféTrace</span>
            <span className="sidebar-brand-role">Administrador</span>
          </div>
        </div>

        {userName && (
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials || '👤'}</div>
            <div style={{ overflow: 'hidden' }}>
              <div className="sidebar-user-name">{userName}</div>
              <div className="sidebar-user-email">{userEmail}</div>
            </div>
          </div>
        )}

        <nav className="sidebar-nav">
          {NAV.map((item, i) =>
            'section' in item ? (
              <div key={i} className="sidebar-section">{item.section}</div>
            ) : (
              <Link key={item.href} href={item.href}
                className={`sidebar-link${pathname === item.href ? ' active' : ''}`}>
                <span className="sidebar-icon">{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && pendientes > 0 && (
                  <span className="sidebar-badge">{pendientes}</span>
                )}
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
