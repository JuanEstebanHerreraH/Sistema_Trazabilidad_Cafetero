'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '../utils/supabase/client'

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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="sidebar">
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
  )
}
