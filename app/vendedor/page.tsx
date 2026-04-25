'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '../../utils/supabase/client'

interface UsuarioPortal { idusuario: number; nombre: string; email: string }

const IS = (active: boolean, w?: number): React.CSSProperties => ({
  height: 36, width: w, flex: w ? undefined : 1,
  background: active ? 'rgba(196,122,44,0.08)' : 'var(--bg-input)',
  border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
  borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '0.83rem',
  fontFamily: 'var(--font-body)', padding: '0 0.55rem', outline: 'none',
})

const SEP = () => <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>–</span>

const FS: React.CSSProperties = {
  fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.3rem', display: 'block',
}

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
        const r = await supabase.from('usuario').select('idusuario, nombre, email, rol:idrol(nombre)').eq('email', user.email).maybeSingle()
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
  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}><div className="loading-center"><div className="spinner" /><span>Cargando…</span></div></div>
  if (!usuario) return null
  return <PortalVendedor usuario={usuario} onLogout={handleLogout} />
}

const sbv = createClient()

function PortalVendedor({ usuario, onLogout }: { usuario: UsuarioPortal; onLogout: () => void }) {
  const [tab, setTab] = useState<'ventas' | 'lotes' | 'clientes'>('ventas')
  const [ventas,   setVentas]   = useState<any[]>([])
  const [lotes,    setLotes]    = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)

  // Ventas filters
  const [vSearch,   setVSearch]   = useState('')
  const [vDesde,    setVDesde]    = useState('')
  const [vHasta,    setVHasta]    = useState('')
  const [vCopMin,   setVCopMin]   = useState('')
  const [vCopMax,   setVCopMax]   = useState('')
  const [vCliente,  setVCliente]  = useState('')
  const [vPanel,    setVPanel]    = useState(false)

  // Lotes filters
  const [lSearch,   setLSearch]   = useState('')
  const [lPrecMin,  setLPrecMin]  = useState('')
  const [lPrecMax,  setLPrecMax]  = useState('')
  const [lStockMin, setLStockMin] = useState('')
  const [lStockMax, setLStockMax] = useState('')
  const [lPanel,    setLPanel]    = useState(false)

  // Clientes filters
  const [cSearch,   setCSearch]   = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    const [vr, lr, cr] = await Promise.all([
      sbv.from('venta').select(`
        idventa, fecha_venta, total_kg, precio_kg, notas,
        cliente(idcliente, nombre, email, telefono),
        detalle_venta(cantidad, precio_venta, lote_cafe(variedad))
      `).order('fecha_venta', { ascending: false }).limit(200),
      sbv.from('lote_cafe').select('idlote_cafe, variedad, peso_kg, estado, precio_kg, finca(nombre)')
        .eq('estado', 'disponible').order('variedad'),
      sbv.from('cliente').select('idcliente, nombre, email, telefono, created_at').order('nombre'),
    ])
    setVentas(vr.data ?? [])
    setLotes(lr.data ?? [])
    setClientes(cr.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const totalCOP  = ventas.reduce((s, v) => s + (v.detalle_venta ?? []).reduce((ds: number, d: any) => ds + d.cantidad * d.precio_venta, 0), 0)
  const totalKg   = ventas.reduce((s, v) => s + (v.detalle_venta ?? []).reduce((ds: number, d: any) => ds + d.cantidad, 0), 0)
  const kgDisp    = lotes.reduce((s, l) => s + Number(l.peso_kg ?? 0), 0)

  const clienteOpts = useMemo(() => {
    const map = new Map<number, string>()
    ventas.forEach(v => { if (v.cliente) map.set(v.cliente.idcliente, v.cliente.nombre) })
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }))
  }, [ventas])

  const ventasFiltradas = useMemo(() => {
    return ventas.filter(v => {
      const kgV  = (v.detalle_venta ?? []).reduce((s: number, d: any) => s + d.cantidad, 0)
      const copV = (v.detalle_venta ?? []).reduce((s: number, d: any) => s + d.cantidad * d.precio_venta, 0)
      if (vSearch) {
        const q = vSearch.toLowerCase()
        const matchCliente = v.cliente?.nombre?.toLowerCase().includes(q) || v.cliente?.email?.toLowerCase().includes(q)
        const matchLote    = (v.detalle_venta ?? []).some((d: any) => d.lote_cafe?.variedad?.toLowerCase().includes(q))
        if (!matchCliente && !matchLote) return false
      }
      if (vCliente && String(v.cliente?.idcliente) !== vCliente) return false
      if (vDesde && v.fecha_venta < vDesde) return false
      if (vHasta && v.fecha_venta > vHasta + 'T23:59:59') return false
      if (vCopMin && copV < Number(vCopMin)) return false
      if (vCopMax && copV > Number(vCopMax)) return false
      return true
    })
  }, [ventas, vSearch, vCliente, vDesde, vHasta, vCopMin, vCopMax])

  const lotesFiltrados = useMemo(() => {
    return lotes.filter(l => {
      if (lSearch) {
        const q = lSearch.toLowerCase()
        if (!l.variedad?.toLowerCase().includes(q) && !l.finca?.nombre?.toLowerCase().includes(q)) return false
      }
      if (lPrecMin && Number(l.precio_kg ?? 0) < Number(lPrecMin)) return false
      if (lPrecMax && Number(l.precio_kg ?? 0) > Number(lPrecMax)) return false
      if (lStockMin && Number(l.peso_kg ?? 0) < Number(lStockMin)) return false
      if (lStockMax && Number(l.peso_kg ?? 0) > Number(lStockMax)) return false
      return true
    })
  }, [lotes, lSearch, lPrecMin, lPrecMax, lStockMin, lStockMax])

  const clientesFiltrados = useMemo(() => {
    if (!cSearch) return clientes
    const q = cSearch.toLowerCase()
    return clientes.filter(c => c.nombre?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.telefono?.includes(q))
  }, [clientes, cSearch])

  const vActiveF = [vCliente, vDesde || vHasta, vCopMin || vCopMax].filter(Boolean).length
  const lActiveF = [lPrecMin || lPrecMax, lStockMin || lStockMax].filter(Boolean).length

  const clearV = () => { setVSearch(''); setVCliente(''); setVDesde(''); setVHasta(''); setVCopMin(''); setVCopMax('') }
  const clearL = () => { setLSearch(''); setLPrecMin(''); setLPrecMax(''); setLStockMin(''); setLStockMax('') }

  // Summary stats for filtered ventas
  const vTotalCOP  = ventasFiltradas.reduce((s, v) => s + (v.detalle_venta ?? []).reduce((ds: number, d: any) => ds + d.cantidad * d.precio_venta, 0), 0)
  const vTotalKg   = ventasFiltradas.reduce((s, v) => s + (v.detalle_venta ?? []).reduce((ds: number, d: any) => ds + d.cantidad, 0), 0)

  const filterBtn = (active: boolean, panel: boolean, setPanel: (v: boolean) => void, count: number) => (
    <button onClick={() => setPanel(!panel)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', height: 36, padding: '0 0.9rem', borderRadius: 'var(--r-md)', border: panel || count > 0 ? '1px solid var(--primary)' : '1px solid var(--border)', background: panel || count > 0 ? 'rgba(196,122,44,0.12)' : 'var(--bg-input)', color: panel || count > 0 ? 'var(--primary)' : 'var(--text-soft)', fontSize: '0.82rem', fontFamily: 'var(--font-body)', cursor: 'pointer', fontWeight: count > 0 ? 600 : 400 }}>
      🎯 Filtros
      {count > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 99, background: 'var(--primary)', color: '#fff', fontSize: '0.62rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>}
      <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>{panel ? '▲' : '▼'}</span>
    </button>
  )

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
        <div style={{ marginBottom: '1.25rem' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.2rem' }}>Portal Vendedor</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.84rem' }}>Consulta ventas, catálogo disponible y directorio de clientes.</p>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          {[
            { icon: '💰', label: 'Total ventas',     val: ventas.length,                                              color: 'var(--primary)' },
            { icon: '📦', label: 'Kg vendidos',      val: `${totalKg.toLocaleString('es-CO')} kg`,                    color: 'var(--green)' },
            { icon: '💵', label: 'Ingresos totales', val: `$${totalCOP.toLocaleString('es-CO')}`,                     color: 'var(--amber)' },
            { icon: '☕', label: 'Lotes disponibles', val: `${lotes.length} (${(kgDisp/1000).toFixed(1)}t)`,          color: 'var(--blue)' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ '--accent': s.color } as any}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value" style={{ fontSize: s.label === 'Ingresos totales' ? '0.88rem' : undefined }}>{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="tabs">
          {([['ventas', `💰 Ventas (${ventas.length})`], ['lotes', `☕ Disponibles (${lotes.length})`], ['clientes', `🤝 Clientes (${clientes.length})`]] as const).map(([t, lbl]) => (
            <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{lbl}</button>
          ))}
        </div>

        {loading ? <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div> : (

          /* ── VENTAS ── */
          tab === 'ventas' ? (
            <div>
              {/* Toolbar */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 380 }}>
                  <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none' }}>🔍</span>
                  <input type="text" placeholder="Buscar cliente o variedad…" value={vSearch} onChange={e => setVSearch(e.target.value)}
                    style={{ width: '100%', height: 36, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0 0.9rem 0 2.1rem', color: 'var(--text)', fontSize: '0.83rem', fontFamily: 'var(--font-body)', outline: 'none' }} />
                </div>
                {filterBtn(vPanel, vPanel, setVPanel, vActiveF)}
                {(vSearch || vActiveF > 0) && <button onClick={clearV} style={{ height: 36, padding: '0 0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>✕ Limpiar</button>}
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 500, marginLeft: 'auto' }}>
                  {ventasFiltradas.length} venta{ventasFiltradas.length !== 1 ? 's' : ''}
                  {ventasFiltradas.length !== ventas.length && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / {ventas.length}</span>}
                </span>
              </div>

              {/* Filter panel */}
              {vPanel && (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: 160 }}>
                      <label style={FS}>Cliente</label>
                      <select value={vCliente} onChange={e => setVCliente(e.target.value)}
                        style={{ ...IS(!!vCliente), flex: 'none', minWidth: 160, cursor: 'pointer' }}>
                        <option value="">— Todos —</option>
                        {clienteOpts.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label style={FS}>📅 Fecha</label>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <input type="date" value={vDesde} onChange={e => setVDesde(e.target.value)} style={{ ...IS(!!(vDesde || vHasta)), width: 140 }} />
                        <SEP />
                        <input type="date" value={vHasta} onChange={e => setVHasta(e.target.value)} style={{ ...IS(!!(vDesde || vHasta)), width: 140 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label style={FS}>Total COP</label>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <input type="number" placeholder="Mín" value={vCopMin} onChange={e => setVCopMin(e.target.value)} style={{ ...IS(!!(vCopMin || vCopMax)), width: 110 }} />
                        <SEP />
                        <input type="number" placeholder="Máx" value={vCopMax} onChange={e => setVCopMax(e.target.value)} style={{ ...IS(!!(vCopMin || vCopMax)), width: 110 }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary strip when filtered */}
              {ventasFiltradas.length !== ventas.length && ventasFiltradas.length > 0 && (
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Ventas filtradas', val: ventasFiltradas.length, color: 'var(--primary)' },
                    { label: 'kg', val: `${vTotalKg.toLocaleString('es-CO')} kg`, color: 'var(--green)' },
                    { label: 'Total', val: `$${vTotalCOP.toLocaleString('es-CO')}`, color: 'var(--amber)' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-md)', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-dim)' }}>{s.label}: </span>
                      <strong style={{ color: s.color }}>{s.val}</strong>
                    </div>
                  ))}
                </div>
              )}

              {/* Ventas list */}
              {ventasFiltradas.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">💰</div><p>Sin resultados con esos filtros.</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {ventasFiltradas.map((v: any) => {
                    const kgV  = (v.detalle_venta ?? []).reduce((s: number, d: any) => s + d.cantidad, 0)
                    const copV = (v.detalle_venta ?? []).reduce((s: number, d: any) => s + d.cantidad * d.precio_venta, 0)
                    return (
                      <div key={v.idventa} className="venta-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              Venta #{v.idventa} <span className="badge badge-green" style={{ fontSize: '0.64rem' }}>✓</span>
                            </div>
                            <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '0.1rem' }}>
                              {new Date(v.fecha_venta).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                            {v.cliente && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-soft)', marginTop: '0.15rem' }}>
                                🤝 <strong>{v.cliente.nombre}</strong>{v.cliente.email ? <span style={{ color: 'var(--text-dim)' }}> · {v.cliente.email}</span> : ''}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1rem' }}>${copV.toLocaleString('es-CO')} COP</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600 }}>{kgV.toLocaleString('es-CO')} kg</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--amber)', fontWeight: 700 }}>📦 {(kgV / 70).toFixed(2)} bultos</div>
                          </div>
                        </div>
                        {(v.detalle_venta ?? []).length > 0 && (
                          <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            {v.detalle_venta.map((d: any, i: number) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-soft)' }}>
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
              )}
            </div>

          /* ── LOTES ── */
          ) : tab === 'lotes' ? (
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 380 }}>
                  <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none' }}>🔍</span>
                  <input type="text" placeholder="Buscar variedad o finca…" value={lSearch} onChange={e => setLSearch(e.target.value)}
                    style={{ width: '100%', height: 36, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0 0.9rem 0 2.1rem', color: 'var(--text)', fontSize: '0.83rem', fontFamily: 'var(--font-body)', outline: 'none' }} />
                </div>
                {filterBtn(lPanel, lPanel, setLPanel, lActiveF)}
                {(lSearch || lActiveF > 0) && <button onClick={clearL} style={{ height: 36, padding: '0 0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>✕ Limpiar</button>}
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 500, marginLeft: 'auto' }}>
                  {lotesFiltrados.length}{lotesFiltrados.length !== lotes.length && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / {lotes.length}</span>} lotes
                </span>
              </div>

              {lPanel && (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label style={FS}>Stock (kg)</label>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <input type="number" placeholder="Mín" value={lStockMin} onChange={e => setLStockMin(e.target.value)} style={{ ...IS(!!(lStockMin || lStockMax)), width: 100 }} />
                        <SEP />
                        <input type="number" placeholder="Máx" value={lStockMax} onChange={e => setLStockMax(e.target.value)} style={{ ...IS(!!(lStockMin || lStockMax)), width: 100 }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label style={FS}>Precio / kg (COP)</label>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <input type="number" placeholder="Mín" value={lPrecMin} onChange={e => setLPrecMin(e.target.value)} style={{ ...IS(!!(lPrecMin || lPrecMax)), width: 110 }} />
                        <SEP />
                        <input type="number" placeholder="Máx" value={lPrecMax} onChange={e => setLPrecMax(e.target.value)} style={{ ...IS(!!(lPrecMin || lPrecMax)), width: 110 }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="data-table-wrap table-responsive">
                <table className="data-table">
                  <thead><tr><th>#</th><th>Variedad</th><th>Finca</th><th>Stock</th><th>Bultos</th><th>Precio/kg</th><th>Valor total</th></tr></thead>
                  <tbody>
                    {lotesFiltrados.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin resultados.</td></tr>
                    ) : lotesFiltrados.map((l: any) => (
                      <tr key={l.idlote_cafe}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{l.idlote_cafe}</td>
                        <td><strong style={{ color: 'var(--text)' }}>{l.variedad}</strong></td>
                        <td style={{ color: 'var(--text-soft)' }}>{l.finca?.nombre ?? '—'}</td>
                        <td><strong style={{ color: 'var(--primary)' }}>{Number(l.peso_kg).toLocaleString('es-CO')} kg</strong></td>
                        <td style={{ color: 'var(--text-soft)', fontSize: '0.82rem' }}>{(l.peso_kg / 70).toFixed(2)}</td>
                        <td style={{ color: 'var(--text-soft)' }}>${Number(l.precio_kg ?? 0).toLocaleString('es-CO')}</td>
                        <td><strong style={{ color: 'var(--green)' }}>${(l.peso_kg * (l.precio_kg ?? 0)).toLocaleString('es-CO')}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          /* ── CLIENTES ── */
          ) : (
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 380 }}>
                  <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none' }}>🔍</span>
                  <input type="text" placeholder="Buscar nombre, email o teléfono…" value={cSearch} onChange={e => setCSearch(e.target.value)}
                    style={{ width: '100%', height: 36, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0 0.9rem 0 2.1rem', color: 'var(--text)', fontSize: '0.83rem', fontFamily: 'var(--font-body)', outline: 'none' }} />
                </div>
                {cSearch && <button onClick={() => setCSearch('')} style={{ height: 36, padding: '0 0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>✕</button>}
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 500, marginLeft: 'auto' }}>
                  {clientesFiltrados.length}{clientesFiltrados.length !== clientes.length && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / {clientes.length}</span>} clientes
                </span>
              </div>
              <div className="data-table-wrap table-responsive">
                <table className="data-table">
                  <thead><tr><th>#</th><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Registrado</th></tr></thead>
                  <tbody>
                    {clientesFiltrados.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin resultados.</td></tr>
                    ) : clientesFiltrados.map((c: any) => (
                      <tr key={c.idcliente}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{c.idcliente}</td>
                        <td><strong style={{ color: 'var(--text)' }}>{c.nombre}</strong></td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-soft)' }}>{c.email ?? '—'}</td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-soft)' }}>{c.telefono ?? '—'}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{c.created_at ? new Date(c.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </main>
    </div>
  )
}
