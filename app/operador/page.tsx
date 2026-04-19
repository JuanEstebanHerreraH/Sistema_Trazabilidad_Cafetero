'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '../../utils/supabase/client'

interface UsuarioPortal { idusuario: number; nombre: string; email: string }

export default function OperadorPage() {
  const supabase = createClient()
  const [usuario, setUsuario] = useState<UsuarioPortal | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      let { data } = await supabase.from('usuario')
        .select('idusuario, nombre, email, rol:idrol(nombre)')
        .eq('auth_uid', user.id).maybeSingle()
      if (!data && user.email) {
        const r = await supabase.from('usuario')
          .select('idusuario, nombre, email, rol:idrol(nombre)')
          .eq('email', user.email).maybeSingle()
        data = r.data
      }
      const rol = (data as any)?.rol?.nombre
      if (rol === 'Administrador') { window.location.href = '/admin'; return }
      if (rol !== 'Operador') { window.location.href = '/portal'; return }
      setUsuario(data as any)
      setLoading(false)
    })()
  }, [])

  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = '/login' }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="loading-center"><div className="spinner" /><span>Cargando portal operador…</span></div>
    </div>
  )

  if (!usuario) return null
  return <PortalOperador usuario={usuario} onLogout={handleLogout} />
}

function PortalOperador({ usuario, onLogout }: { usuario: UsuarioPortal; onLogout: () => void }) {
  const supabase = createClient()
  const [tab, setTab] = useState<'lotes' | 'movimientos' | 'registros'>('lotes')
  const [lotes, setLotes] = useState<any[]>([])
  const [movimientos, setMovimientos] = useState<any[]>([])
  const [registros, setRegistros] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: l }, { data: m }, { data: r }] = await Promise.all([
      supabase.from('lote_cafe').select('idlote_cafe, variedad, peso_kg, estado, precio_kg, finca:idfinca(nombre)').order('created_at', { ascending: false }).limit(60),
      supabase.from('movimiento_inventario').select('idmovimiento_inventario, tipo, fecha_movimiento, cantidad, notas, lote_cafe:idlote_cafe(variedad), almacen_origen:idalmacen_origen(nombre), almacen_destino:idalmacen_destino(nombre)').order('fecha_movimiento', { ascending: false }).limit(60),
      supabase.from('registro_proceso').select('idregistro_proceso, fecha_inicio, fecha_fin, notas, lote_cafe:idlote_cafe(variedad, peso_kg), proceso:idproceso(nombre)').order('fecha_inicio', { ascending: false }).limit(60),
    ])
    setLotes(l ?? [])
    setMovimientos(m ?? [])
    setRegistros(r ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { cargar() }, [cargar])

  const estadoBadge: Record<string, string> = { disponible: 'badge-green', en_proceso: 'badge-amber', vendido: 'badge-blue', exportado: 'badge-purple' }
  const tipoBadge: Record<string, string> = { entrada: 'badge-green', salida: 'badge-red', traslado: 'badge-blue' }

  const totalKgDisponible = lotes.filter(l => l.estado === 'disponible').reduce((s: number, l: any) => s + Number(l.peso_kg ?? 0), 0)
  const totalKgEnProceso  = lotes.filter(l => l.estado === 'en_proceso').reduce((s: number, l: any) => s + Number(l.peso_kg ?? 0), 0)

  return (
    <div className="portal-layout">
      <header className="portal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, var(--primary), var(--primary-deep))', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', boxShadow: '0 2px 10px var(--primary-glow)' }}>☕</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>CaféTrace</div>
            <div style={{ fontSize: '0.67rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>⚙️ Operador</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.84rem', color: 'var(--text)', fontWeight: 600 }}>{usuario.nombre}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{usuario.email}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onLogout}>Salir</button>
        </div>
      </header>

      <main className="portal-main">
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.2rem' }}>
            Portal Operador
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.84rem' }}>
            Gestión operativa de inventario, lotes y procesos de beneficio.
          </p>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          {[
            { icon: '☕', label: 'Lotes totales',     val: lotes.length,         color: 'var(--primary)' },
            { icon: '✅', label: 'Kg disponibles',    val: `${totalKgDisponible.toLocaleString('es-CO')} kg`, color: 'var(--green)' },
            { icon: '⚙️', label: 'Kg en proceso',    val: `${totalKgEnProceso.toLocaleString('es-CO')} kg`,  color: 'var(--amber)' },
            { icon: '🔄', label: 'Movimientos hoy',   val: movimientos.filter(m => new Date(m.fecha_movimiento).toDateString() === new Date().toDateString()).length, color: 'var(--blue)' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ '--accent': s.color } as any}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="tabs">
          {([
            ['lotes',       `☕ Lotes (${lotes.length})`],
            ['movimientos', `🔄 Movimientos (${movimientos.length})`],
            ['registros',   `⚙️ Procesos (${registros.length})`],
          ] as const).map(([t, lbl]) => (
            <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{lbl}</button>
          ))}
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
        ) : tab === 'lotes' ? (
          <div className="data-table-wrap table-responsive">
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Variedad</th><th>Finca</th><th>Stock</th><th>Precio/kg</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {lotes.map((l: any) => (
                  <tr key={l.idlote_cafe}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{l.idlote_cafe}</td>
                    <td><strong style={{ color: 'var(--text)' }}>{l.variedad}</strong></td>
                    <td>{l.finca?.nombre ?? '—'}</td>
                    <td><strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>{Number(l.peso_kg).toLocaleString('es-CO')} kg</strong><br /><span style={{ fontSize: '0.8rem', color: 'var(--amber)', fontWeight: 700 }}>📦 {(l.peso_kg / 70).toFixed(2)} bts</span></td>
                    <td>${Number(l.precio_kg ?? 0).toLocaleString('es-CO')}</td>
                    <td><span className={`badge ${estadoBadge[l.estado] ?? 'badge-muted'}`}>{l.estado?.replace('_', ' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === 'movimientos' ? (
          <div className="data-table-wrap table-responsive">
            <table className="data-table">
              <thead>
                <tr><th>Tipo</th><th>Lote</th><th>Cantidad</th><th>Origen</th><th>Destino</th><th>Fecha</th><th>Notas</th></tr>
              </thead>
              <tbody>
                {movimientos.map((m: any) => (
                  <tr key={m.idmovimiento_inventario}>
                    <td><span className={`badge ${tipoBadge[m.tipo] ?? 'badge-muted'}`}>{m.tipo}</span></td>
                    <td>{m.lote_cafe?.variedad ?? '—'}</td>
                    <td><strong style={{ color: 'var(--primary)' }}>{m.cantidad} kg</strong></td>
                    <td>{m.almacen_origen?.nombre ?? '—'}</td>
                    <td>{m.almacen_destino?.nombre ?? '—'}</td>
                    <td style={{ fontSize: '0.78rem' }}>{new Date(m.fecha_movimiento).toLocaleDateString('es-CO')}</td>
                    <td style={{ fontSize: '0.76rem', maxWidth: 160 }}>{m.notas ? String(m.notas).slice(0, 50) + (m.notas.length > 50 ? '…' : '') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="data-table-wrap table-responsive">
            <table className="data-table">
              <thead>
                <tr><th>Proceso</th><th>Lote</th><th>Kg lote</th><th>Inicio</th><th>Fin</th><th>Notas</th></tr>
              </thead>
              <tbody>
                {registros.map((r: any) => (
                  <tr key={r.idregistro_proceso}>
                    <td><span className="badge badge-amber">{r.proceso?.nombre ?? '—'}</span></td>
                    <td><strong style={{ color: 'var(--text)' }}>{r.lote_cafe?.variedad ?? '—'}</strong></td>
                    <td>{r.lote_cafe?.peso_kg ? <><strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>{Number(r.lote_cafe.peso_kg).toLocaleString('es-CO')} kg</strong><br /><span style={{ fontSize: '0.8rem', color: 'var(--amber)', fontWeight: 700 }}>📦 {(r.lote_cafe.peso_kg / 70).toFixed(2)} bts</span></> : '—'}</td>
                    <td style={{ fontSize: '0.78rem' }}>{new Date(r.fecha_inicio).toLocaleDateString('es-CO')}</td>
                    <td style={{ fontSize: '0.78rem' }}>{new Date(r.fecha_fin).toLocaleDateString('es-CO')}</td>
                    <td style={{ fontSize: '0.76rem', maxWidth: 200 }}>{r.notas ? String(r.notas).slice(0, 60) + (r.notas.length > 60 ? '…' : '') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
