'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../utils/supabase/client'
import PortalCliente from '../../components/portal/PortalCliente'
import PortalProductor from '../../components/portal/PortalProductor'
import PortalTransportista from '../../components/portal/PortalTransportista'
import PortalCatador from '../../components/portal/PortalCatador'

interface UsuarioPortal {
  idusuario: number
  nombre: string
  email: string
  estado_aprobacion: string
  rol: { nombre: string } | null
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

      const { data, error: err } = await supabase
        .from('usuario')
        .select('idusuario, nombre, email, estado_aprobacion, rol!usuario_idrol_fkey(nombre)')
        .eq('auth_uid', user.id)
        .single()

      if (err || !data) {
        setError('No se encontró tu perfil. Contacta al administrador.')
      } else {
        // Si es admin, redirigir al panel
        const rolNombre = (data as any).rol?.nombre
        if (rolNombre === 'Administrador') {
          window.location.href = '/admin'
          return
        }
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
      <div style={{ textAlign: 'center', color: 'var(--text-soft)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>☕</div>
        <p>Cargando tu portal…</p>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '2rem', textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
        <p style={{ color: 'var(--text-soft)', marginBottom: '1.25rem' }}>{error}</p>
        <button className="btn btn-secondary" onClick={handleLogout}>Cerrar sesión</button>
      </div>
    </div>
  )

  if (!usuario) return null

  // Cuenta pendiente de aprobación
  if (usuario.estado_aprobacion === 'pendiente') return (
    <PendienteView nombre={usuario.nombre} onLogout={handleLogout} />
  )

  if (usuario.estado_aprobacion === 'rechazado') return (
    <RechazadoView nombre={usuario.nombre} onLogout={handleLogout} />
  )

  const rolNombre = (usuario as any).rol?.nombre ?? 'Sin rol'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* ── Top bar ── */}
      <header style={{
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.4rem' }}>☕</span>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>
              Café Almacén
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              {getRolIcon(rolNombre)} {rolNombre}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.84rem', color: 'var(--text)', fontWeight: 600 }}>{usuario.nombre}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{usuario.email}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Salir</button>
        </div>
      </header>

      {/* ── Contenido por rol ── */}
      <main style={{ padding: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>
        {rolNombre === 'Cliente'       && <PortalCliente       usuario={usuario} />}
        {rolNombre === 'Productor'     && <PortalProductor     usuario={usuario} />}
        {rolNombre === 'Transportista' && <PortalTransportista usuario={usuario} />}
        {rolNombre === 'Catador'       && <PortalCatador       usuario={usuario} />}
        {!['Cliente','Productor','Transportista','Catador'].includes(rolNombre) && (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-soft)' }}>
            <p>Rol <strong>{rolNombre}</strong> no tiene portal configurado. Contacta al administrador.</p>
          </div>
        )}
      </main>
    </div>
  )
}

function getRolIcon(rol: string) {
  const icons: Record<string, string> = {
    Cliente: '🤝', Productor: '👨‍🌾', Transportista: '🚛', Catador: '🔬', Administrador: '⚙️',
  }
  return icons[rol] ?? '👤'
}

function PendienteView({ nombre, onLogout }: { nombre: string; onLogout: () => void }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '2.5rem 2rem', textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: '0.75rem', color: 'var(--text)' }}>
          Hola, {nombre}
        </h2>
        <p style={{ color: 'var(--text-soft)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '0.5rem' }}>
          Tu cuenta está <strong style={{ color: 'var(--amber)' }}>pendiente de aprobación</strong> por parte del administrador.
        </p>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          Recibirás acceso una vez que tu solicitud sea revisada. Puedes volver a intentar más tarde.
        </p>
        <button className="btn btn-secondary" onClick={onLogout}>Cerrar sesión</button>
      </div>
    </div>
  )
}

function RechazadoView({ nombre, onLogout }: { nombre: string; onLogout: () => void }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1rem' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '2.5rem 2rem', textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: '0.75rem', color: 'var(--text)' }}>
          Acceso denegado, {nombre}
        </h2>
        <p style={{ color: 'var(--text-soft)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
          Tu solicitud fue <strong style={{ color: 'var(--red)' }}>rechazada</strong>. Contacta al administrador para más información.
        </p>
        <button className="btn btn-secondary" onClick={onLogout}>Cerrar sesión</button>
      </div>
    </div>
  )
}
