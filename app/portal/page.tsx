'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../utils/supabase/client'
import PortalCliente from '../../components/portal/PortalCliente'
import PortalProductor from '../../components/portal/PortalProductor'
import PortalCatador from '../../components/portal/PortalCatador'
import PortalTransportista from '../../components/portal/PortalTransportista'

interface UsuarioPortal {
  idusuario: number
  nombre: string
  email: string
  estado_aprobacion: string
  rol: { nombre: string } | null
}

function getRolIcon(rol: string) {
  return { Cliente: '🤝', Productor: '👨‍🌾', Transportista: '🚛', Catador: '🔬', Operador: '⚙️', Vendedor: '💼' }[rol] ?? '👤'
}

export default function PortalPage() {
  const supabase = createClient()
  const [usuario, setUsuario] = useState<UsuarioPortal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      // Try by auth_uid first, then fallback to email
      let { data } = await supabase
        .from('usuario')
        .select('idusuario, nombre, email, estado_aprobacion, rol:idrol(nombre)')
        .eq('auth_uid', user.id)
        .maybeSingle()

      if (!data && user.email) {
        const byEmail = await supabase
          .from('usuario')
          .select('idusuario, nombre, email, estado_aprobacion, rol:idrol(nombre)')
          .eq('email', user.email)
          .maybeSingle()
        if (byEmail.data) {
          data = byEmail.data
          // Auto-link auth_uid
          await supabase.from('usuario').update({ auth_uid: user.id }).eq('idusuario', byEmail.data.idusuario)
        }
      }

      if (!data) {
        setError('No se encontró tu perfil. Contacta al administrador.')
      } else {
        const rol = (data as any).rol?.nombre
        if (rol === 'Administrador') { window.location.href = '/admin'; return }
        if (rol === 'Vendedor')      { window.location.href = '/vendedor'; return }
        if (rol === 'Operador')      { window.location.href = '/operador'; return }
        setUsuario(data as any)
      }
      setLoading(false)
    })()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>☕</div>
        <div className="loading-center"><div className="spinner" /><span>Cargando portal…</span></div>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '2rem', textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
        <p style={{ color: 'var(--text-soft)', marginBottom: '1.25rem' }}>{error}</p>
        <button className="btn btn-secondary" onClick={handleLogout}>Cerrar sesión</button>
      </div>
    </div>
  )

  if (!usuario) return null

  if (usuario.estado_aprobacion === 'pendiente') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '2.5rem 2rem', textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: '0.75rem', color: 'var(--text)' }}>
          Hola, {usuario.nombre}
        </h2>
        <p style={{ color: 'var(--text-soft)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
          Tu cuenta está <strong style={{ color: 'var(--amber)' }}>pendiente de aprobación</strong>.
          El administrador revisará tu solicitud pronto.
        </p>
        <button className="btn btn-secondary" onClick={handleLogout}>Cerrar sesión</button>
      </div>
    </div>
  )

  if (usuario.estado_aprobacion === 'rechazado') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '2.5rem 2rem', textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: '0.75rem', color: 'var(--text)' }}>Acceso denegado</h2>
        <p style={{ color: 'var(--text-soft)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
          Tu solicitud fue <strong style={{ color: 'var(--red)' }}>rechazada</strong>. Contacta al administrador para más información.
        </p>
        <button className="btn btn-secondary" onClick={handleLogout}>Cerrar sesión</button>
      </div>
    </div>
  )

  const rolNombre = (usuario as any).rol?.nombre ?? 'Sin rol'

  return (
    <div className="portal-layout">
      <header className="portal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, var(--primary), var(--primary-deep))', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', boxShadow: '0 2px 10px var(--primary-glow)' }}>☕</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>CaféTrace</div>
            <div style={{ fontSize: '0.67rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {getRolIcon(rolNombre)} {rolNombre}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.84rem', color: 'var(--text)', fontWeight: 600 }}>{usuario.nombre}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{usuario.email}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Salir</button>
        </div>
      </header>

      <main className="portal-main">
        {rolNombre === 'Cliente'       && <PortalCliente       usuario={usuario} />}
        {rolNombre === 'Productor'     && <PortalProductor     usuario={usuario} />}
        {rolNombre === 'Catador'       && <PortalCatador       usuario={usuario} />}
        {rolNombre === 'Transportista' && <PortalTransportista usuario={usuario} />}
        {!['Cliente','Productor','Catador','Transportista'].includes(rolNombre) && (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-soft)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔧</div>
            <p>Rol <strong>{rolNombre}</strong> no tiene portal configurado aún. Contacta al administrador.</p>
          </div>
        )}
      </main>
    </div>
  )
}
