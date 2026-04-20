'use client'
import React from 'react'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '../../utils/supabase/client'

interface UsuarioPortal { idusuario: number; nombre: string; email: string }

export default function VendedorPage() {
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
      if (rol !== 'Vendedor') { window.location.href = '/portal'; return }
      setUsuario(data as any)
      setLoading(false)
    })()
  }, [])

  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = '/login' }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="loading-center"><div className="spinner" /><span>Cargando portal vendedor…</span></div>
    </div>
  )

  if (!usuario) return null
  return <PortalVendedor usuario={usuario} onLogout={handleLogout} />
}

// ── Singleton para evitar re-renders infinitos ──
const supabaseVendedor = createClient()

function PortalVendedor({ usuario, onLogout }: { usuario: UsuarioPortal; onLogout: () => void }) {
  const supabase = supabaseVendedor
  const [tab, setTab] = useState<'ventas' | 'lotes' | 'clientes'>('ventas')
  const [ventas, setVentas] = useState<any[]>([])
  const [lotes, setLotes] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [ventasRes, lotesRes, clientesRes] = await Promise.all([
      supabase.from('venta').select(`
        idventa, fecha_venta, total_kg, precio_kg, notas,
        cliente(nombre, email, telefono),
        detalle_venta(cantidad, precio_venta, lote_cafe(variedad))
      `).order('fecha_venta', { ascending: false }).limit(80),
      supabase.from('lote_cafe').select('idlote_cafe, variedad, peso_kg, estado, precio_kg, finca(nombre)')
        .eq('estado', 'disponible').order('created_at', { ascending: false }),
      supabase.from('cliente').select('idcliente, nombre, email, telefono, created_at').order('nombre'),
    ])
    if (ventasRes.error) console.error('[Vendedor] Error ventas:', ventasRes.error)
    if (lotesRes.error) console.error('[Vendedor] Error lotes:', lotesRes.error)
    if (clientesRes.error) console.error('[Vendedor] Error clientes:', clientesRes.error)
    setVentas(ventasRes.data ?? [])
    setLotes(lotesRes.data ?? [])
    setClientes(clientesRes.data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { cargar() }, [cargar])

  // Calcular desde detalle_venta para mayor precisión (no depende del trigger)
  const totalVentasCOP = ventas.reduce((s, v) => s + (v.detalle_venta ?? []).reduce((ds: number, d: any) => ds + d.cantidad * d.precio_venta, 0), 0)
  const totalKgVendido = ventas.reduce((s, v) => s + (v.detalle_venta ?? []).reduce((ds: number, d: any) => ds + d.cantidad, 0), 0)
  const lotesDisponibles = lotes.length
  const kgDisponibles = lotes.reduce((s, l) => s + Number(l.peso_kg ?? 0), 0)

  return (
    <div className="portal-layout">
      <header className="portal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, var(--primary), var(--primary-deep))', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', boxShadow: '0 2px 10px var(--primary-glow)' }}>☕</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>CaféTrace</div>
            <div style={{ fontSize: '0.67rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>💼 Vendedor</div>
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
            Portal Vendedor
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.84rem' }}>
            Consulta ventas, catálogo disponible y directorio de clientes.
          </p>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          {[
            { icon: '💰', label: 'Total ventas',       val: ventas.length,                                   color: 'var(--primary)' },
            { icon: '📦', label: 'Kg vendidos',        val: `${totalKgVendido.toLocaleString('es-CO')} kg`,   color: 'var(--green)' },
            { icon: '💵', label: 'Ingresos totales',   val: `$${totalVentasCOP.toLocaleString('es-CO')}`,     color: 'var(--amber)' },
            { icon: '☕', label: `Lotes disponibles`,  val: `${lotesDisponibles} (${(kgDisponibles/1000).toFixed(1)}t)`, color: 'var(--blue)' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ '--accent': s.color } as any}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value" style={{ fontSize: s.label === 'Ingresos totales' ? '0.9rem' : undefined }}>{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="tabs">
          {([
            ['ventas',   `💰 Ventas (${ventas.length})`],
            ['lotes',    `☕ Disponibles (${lotesDisponibles})`],
            ['clientes', `🤝 Clientes (${clientes.length})`],
          ] as const).map(([t, lbl]) => (
            <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{lbl}</button>
          ))}
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
        ) : tab === 'ventas' ? (
          ventas.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">💰</div><p>No hay ventas registradas aún.</p></div>
          ) : (
            <VentasCompactas ventas={ventas} />
          )
        ) : tab === 'lotes' ? (
          <div className="data-table-wrap table-responsive">
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Variedad</th><th>Finca</th><th>Stock</th><th>Bultos</th><th>Precio/kg</th><th>Valor total</th></tr>
              </thead>
              <tbody>
                {lotes.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No hay lotes disponibles.</td></tr>
                ) : lotes.map((l: any) => (
                  <tr key={l.idlote_cafe}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{l.idlote_cafe}</td>
                    <td><strong style={{ color: 'var(--text)' }}>{l.variedad}</strong></td>
                    <td>{l.finca?.nombre ?? '—'}</td>
                    <td><strong style={{ color: 'var(--primary)' }}>{Number(l.peso_kg).toLocaleString('es-CO')} kg</strong></td>
                    <td style={{ color: 'var(--text-soft)', fontSize: '0.82rem' }}>{(l.peso_kg / 70).toFixed(2)}</td>
                    <td>${Number(l.precio_kg ?? 0).toLocaleString('es-CO')}</td>
                    <td style={{ fontWeight: 700, color: 'var(--green)' }}>${(l.peso_kg * l.precio_kg).toLocaleString('es-CO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="data-table-wrap table-responsive">
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Registrado</th></tr>
              </thead>
              <tbody>
                {clientes.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No hay clientes registrados.</td></tr>
                ) : clientes.map((c: any) => (
                  <tr key={c.idcliente}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{c.idcliente}</td>
                    <td><strong style={{ color: 'var(--text)' }}>{c.nombre}</strong></td>
                    <td style={{ fontSize: '0.82rem' }}>{c.email ?? '—'}</td>
                    <td style={{ fontSize: '0.82rem' }}>{c.telefono ?? '—'}</td>
                    <td style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>{c.created_at ? new Date(c.created_at).toLocaleDateString('es-CO') : '—'}</td>
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

// ── Compact expandable venta list ──────────────────────────────────────────────
function VentasCompactas({ ventas }: { ventas: any[] }) {
  const [expandedId, setExpandedId] = React.useState<number | null>(null)
  const [page, setPage] = React.useState(1)
  const PAGE = 15
  const totalPages = Math.max(1, Math.ceil(ventas.length / PAGE))
  const paged = ventas.slice((page - 1) * PAGE, page * PAGE)

  return (
    <>
      <div className="summary-strip" style={{ marginBottom: '0.65rem' }}>
        <div className="summary-item"><span>Total:</span><strong>{ventas.length} ventas</strong></div>
        <div className="summary-item" style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Clic en una fila para ver detalle
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {paged.map((v: any) => {
          const expanded = expandedId === v.idventa
          const kgV  = (v.detalle_venta ?? []).reduce((s: number, d: any) => s + d.cantidad, 0)
          const copV = (v.detalle_venta ?? []).reduce((s: number, d: any) => s + d.cantidad * d.precio_venta, 0)
          return (
            <div key={v.idventa} style={{
              background: 'var(--bg-card)',
              border: `1px solid ${expanded ? 'var(--primary)' : 'var(--border-soft)'}`,
              borderRadius: 'var(--r-lg)', overflow: 'hidden', transition: 'border-color 0.15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0.9rem', cursor: 'pointer', flexWrap: 'wrap' }}
                onClick={() => setExpandedId(expanded ? null : v.idventa)}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, minWidth: 28 }}>#{v.idventa}</span>
                <span className="badge badge-green" style={{ fontSize: '0.62rem', padding: '0.1rem 0.45rem' }}>✓</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-soft)', flex: 1, minWidth: 80 }}>
                  {new Date(v.fecha_venta).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>🤝 {v.cliente?.nombre ?? '—'}</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>{kgV} kg</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 700 }}>${copV.toLocaleString('es-CO')}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{expanded ? '▲' : '▼'}</span>
              </div>
              {expanded && (
                <div style={{ borderTop: '1px solid var(--border-soft)', padding: '0.65rem 0.9rem', background: 'var(--bg-1)' }}>
                  <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                    <div className="record-field">
                      <span className="record-field-label">Email cliente</span>
                      <span className="record-field-value">{v.cliente?.email ?? '—'}</span>
                    </div>
                    <div className="record-field">
                      <span className="record-field-label">Bultos</span>
                      <span className="record-field-value" style={{ color: 'var(--amber)' }}>📦 {(kgV / 70).toFixed(2)}</span>
                    </div>
                  </div>
                  {(v.detalle_venta ?? []).map((d: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-soft)', padding: '0.12rem 0' }}>
                      <span>☕ {d.lote_cafe?.variedad ?? '—'}</span>
                      <span style={{ fontWeight: 600 }}>{d.cantidad} kg — ${(d.cantidad * d.precio_venta).toLocaleString('es-CO')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {totalPages > 1 && (
        <div className="pagination-bar">
          <div className="pagination-info">{(page-1)*PAGE+1}–{Math.min(ventas.length, page*PAGE)} de {ventas.length}</div>
          <div className="pagination-controls">
            <button className="page-btn page-btn-wide" disabled={page<=1} onClick={() => setPage(p=>p-1)}>← Ant</button>
            {Array.from({length: totalPages},(_,i)=>i+1).map(p=>(
              <button key={p} className={`page-btn${page===p?' active':''}`} onClick={()=>setPage(p)}>{p}</button>
            ))}
            <button className="page-btn page-btn-wide" disabled={page>=totalPages} onClick={() => setPage(p=>p+1)}>Sig →</button>
          </div>
        </div>
      )}
    </>
  )
}
