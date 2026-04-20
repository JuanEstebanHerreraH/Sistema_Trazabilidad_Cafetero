'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
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

// ── Filter helpers ──────────────────────────────────────────────
function useFilter<T extends Record<string, any>>(data: T[]) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)

  const clearAll = useCallback(() => {
    setSearch(''); setFilters({}); setDesde(''); setHasta('')
  }, [])

  const setFilter = useCallback((key: string, val: string) => {
    setFilters(p => ({ ...p, [key]: val }))
  }, [])

  return { search, setSearch, filters, setFilter, desde, setDesde, hasta, setHasta, panelOpen, setPanelOpen, clearAll }
}

function FilterChips({ chips, onClear }: {
  chips: { label: string; value: string; onRemove: () => void }[]
  onClear: () => void
}) {
  if (!chips.length) return null
  return (
    <div className="filter-chips">
      {chips.map(c => (
        <span key={c.label} className="filter-chip">
          <span style={{ color: 'var(--text-dim)', fontWeight: 500 }}>{c.label}:</span> {c.value}
          <button className="filter-chip-remove" onClick={c.onRemove}>✕</button>
        </span>
      ))}
      <button className="filter-chips-clear" onClick={onClear}>Limpiar filtros</button>
    </div>
  )
}

// ── Main portal ──────────────────────────────────────────────────
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
      supabase.from('lote_cafe').select('idlote_cafe, variedad, peso_kg, estado, precio_kg, finca:idfinca(nombre)').order('created_at', { ascending: false }).limit(200),
      supabase.from('movimiento_inventario').select('idmovimiento_inventario, tipo, fecha_movimiento, cantidad, notas, lote_cafe:idlote_cafe(variedad), almacen_origen:idalmacen_origen(nombre), almacen_destino:idalmacen_destino(nombre)').order('fecha_movimiento', { ascending: false }).limit(200),
      supabase.from('registro_proceso').select('idregistro_proceso, fecha_inicio, fecha_fin, notas, lote_cafe:idlote_cafe(variedad, peso_kg), proceso:idproceso(nombre)').order('fecha_inicio', { ascending: false }).limit(200),
    ])
    setLotes(l ?? [])
    setMovimientos(m ?? [])
    setRegistros(r ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { cargar() }, [cargar])

  // ── Lotes filter state ──────────────────────────────
  const [lSearch, setLSearch] = useState('')
  const [lEstado, setLEstado] = useState('')
  const [lPanelOpen, setLPanelOpen] = useState(false)

  const filteredLotes = useMemo(() => {
    let r = lotes
    if (lSearch) { const q = lSearch.toLowerCase(); r = r.filter(l => l.variedad?.toLowerCase().includes(q) || l.finca?.nombre?.toLowerCase().includes(q)) }
    if (lEstado) r = r.filter(l => l.estado === lEstado)
    return r
  }, [lotes, lSearch, lEstado])

  const lChips: { label: string; value: string; onRemove: () => void }[] = []
  if (lEstado) lChips.push({ label: 'Estado', value: lEstado.replace('_', ' '), onRemove: () => setLEstado('') })

  // ── Movimientos filter state ────────────────────────
  const [mSearch, setMSearch] = useState('')
  const [mTipo, setMTipo] = useState('')
  const [mDesde, setMDesde] = useState('')
  const [mHasta, setMHasta] = useState('')
  const [mPanelOpen, setMPanelOpen] = useState(false)

  const filteredMov = useMemo(() => {
    let r = movimientos
    if (mSearch) {
      const q = mSearch.toLowerCase()
      r = r.filter(m => m.tipo?.includes(q) || m.lote_cafe?.variedad?.toLowerCase().includes(q) ||
        m.almacen_origen?.nombre?.toLowerCase().includes(q) || m.almacen_destino?.nombre?.toLowerCase().includes(q))
    }
    if (mTipo) r = r.filter(m => m.tipo === mTipo)
    if (mDesde) r = r.filter(m => m.fecha_movimiento && new Date(m.fecha_movimiento) >= new Date(mDesde))
    if (mHasta) r = r.filter(m => m.fecha_movimiento && new Date(m.fecha_movimiento) <= new Date(mHasta + 'T23:59:59'))
    return r
  }, [movimientos, mSearch, mTipo, mDesde, mHasta])

  const mChips: { label: string; value: string; onRemove: () => void }[] = []
  if (mTipo) mChips.push({ label: 'Tipo', value: mTipo, onRemove: () => setMTipo('') })
  if (mDesde || mHasta) mChips.push({ label: 'Fecha', value: [mDesde && `desde ${mDesde}`, mHasta && `hasta ${mHasta}`].filter(Boolean).join(' '), onRemove: () => { setMDesde(''); setMHasta('') } })

  // ── Registros filter state ──────────────────────────
  const [rSearch, setRSearch] = useState('')
  const [rProceso, setRProceso] = useState('')
  const [rDesde, setRDesde] = useState('')
  const [rHasta, setRHasta] = useState('')
  const [rPanelOpen, setRPanelOpen] = useState(false)

  const procesosUnicos = useMemo(() => {
    const set = new Set<string>()
    registros.forEach(r => { if (r.proceso?.nombre) set.add(r.proceso.nombre) })
    return Array.from(set).sort()
  }, [registros])

  const filteredReg = useMemo(() => {
    let r = registros
    if (rSearch) { const q = rSearch.toLowerCase(); r = r.filter(x => x.proceso?.nombre?.toLowerCase().includes(q) || x.lote_cafe?.variedad?.toLowerCase().includes(q) || x.notas?.toLowerCase().includes(q)) }
    if (rProceso) r = r.filter(x => x.proceso?.nombre === rProceso)
    if (rDesde) r = r.filter(x => x.fecha_inicio && new Date(x.fecha_inicio) >= new Date(rDesde))
    if (rHasta) r = r.filter(x => x.fecha_inicio && new Date(x.fecha_inicio) <= new Date(rHasta + 'T23:59:59'))
    return r
  }, [registros, rSearch, rProceso, rDesde, rHasta])

  const rChips: { label: string; value: string; onRemove: () => void }[] = []
  if (rProceso) rChips.push({ label: 'Proceso', value: rProceso, onRemove: () => setRProceso('') })
  if (rDesde || rHasta) rChips.push({ label: 'Fecha', value: [rDesde && `desde ${rDesde}`, rHasta && `hasta ${rHasta}`].filter(Boolean).join(' '), onRemove: () => { setRDesde(''); setRHasta('') } })

  const estadoBadge: Record<string, string> = { disponible: 'badge-green', en_proceso: 'badge-amber', vendido: 'badge-blue', exportado: 'badge-purple' }
  const tipoBadge: Record<string, string> = { entrada: 'badge-green', salida: 'badge-red', traslado: 'badge-blue' }
  const tipoIcon: Record<string, string> = { entrada: '📥', salida: '📤', traslado: '🔄' }

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
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.2rem' }}>Portal Operador</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.84rem' }}>Gestión operativa de inventario, lotes y procesos de beneficio.</p>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          {[
            { icon: '☕', label: 'Lotes totales',   val: lotes.length,                 color: 'var(--primary)' },
            { icon: '✅', label: 'Kg disponibles',  val: `${totalKgDisponible.toLocaleString('es-CO')} kg`, color: 'var(--green)' },
            { icon: '⚙️', label: 'Kg en proceso',   val: `${totalKgEnProceso.toLocaleString('es-CO')} kg`,  color: 'var(--amber)' },
            { icon: '🔄', label: 'Movimientos hoy', val: movimientos.filter(m => new Date(m.fecha_movimiento).toDateString() === new Date().toDateString()).length, color: 'var(--blue)' },
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
            ['lotes',       `☕ Lotes (${filteredLotes.length}${filteredLotes.length !== lotes.length ? `/${lotes.length}` : ''})`],
            ['movimientos', `🔄 Movimientos (${filteredMov.length}${filteredMov.length !== movimientos.length ? `/${movimientos.length}` : ''})`],
            ['registros',   `⚙️ Procesos (${filteredReg.length}${filteredReg.length !== registros.length ? `/${registros.length}` : ''})`],
          ] as const).map(([t, lbl]) => (
            <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{lbl}</button>
          ))}
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
        ) : (
          <>
            {/* ── LOTES TAB ── */}
            {tab === 'lotes' && (
              <>
                <div className="filter-bar">
                  <div className="filter-row">
                    <div className="toolbar-search">
                      <span className="search-icon">🔍</span>
                      <input type="text" placeholder="Buscar variedad o finca…" value={lSearch} onChange={e => setLSearch(e.target.value)} />
                    </div>
                    {/* Estado segments */}
                    <div className="filter-segments">
                      {[
                        { v: '', lbl: 'Todos' },
                        { v: 'disponible', lbl: '🟢 Disponible' },
                        { v: 'en_proceso', lbl: '🟡 En proceso' },
                        { v: 'vendido',    lbl: '🔵 Vendido' },
                        { v: 'exportado',  lbl: '🟣 Exportado' },
                      ].map(o => (
                        <button key={o.v} className={`filter-seg${lEstado === o.v ? ' active' : ''}`}
                          onClick={() => setLEstado(o.v)}>{o.lbl}</button>
                      ))}
                    </div>
                    <span className="toolbar-count" style={{ marginLeft: 'auto' }}>
                      {filteredLotes.length}{filteredLotes.length !== lotes.length && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> de {lotes.length}</span>} lotes
                    </span>
                  </div>
                  <FilterChips chips={lChips} onClear={() => { setLSearch(''); setLEstado('') }} />
                </div>
                <div className="data-table-wrap table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr><th>#</th><th>Variedad</th><th>Finca</th><th>Stock</th><th>Precio/kg</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      {filteredLotes.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin resultados</td></tr>
                      ) : filteredLotes.map((l: any) => (
                        <tr key={l.idlote_cafe}>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{l.idlote_cafe}</td>
                          <td><strong style={{ color: 'var(--text)' }}>{l.variedad}</strong></td>
                          <td>{l.finca?.nombre ?? '—'}</td>
                          <td>
                            <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>{Number(l.peso_kg).toLocaleString('es-CO')} kg</strong><br />
                            <span style={{ fontSize: '0.8rem', color: 'var(--amber)', fontWeight: 700 }}>📦 {(l.peso_kg / 70).toFixed(2)} bts</span>
                          </td>
                          <td>${Number(l.precio_kg ?? 0).toLocaleString('es-CO')}</td>
                          <td><span className={`badge ${estadoBadge[l.estado] ?? 'badge-muted'}`}>{l.estado?.replace('_', ' ')}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ── MOVIMIENTOS TAB ── */}
            {tab === 'movimientos' && (
              <>
                <div className="filter-bar">
                  <div className="filter-row">
                    <div className="toolbar-search">
                      <span className="search-icon">🔍</span>
                      <input type="text" placeholder="Buscar por lote, almacén…" value={mSearch} onChange={e => setMSearch(e.target.value)} />
                    </div>
                    <div className="filter-segments">
                      {[
                        { v: '', lbl: 'Todos' },
                        { v: 'entrada',  lbl: '📥 Entrada' },
                        { v: 'salida',   lbl: '📤 Salida' },
                        { v: 'traslado', lbl: '🔄 Traslado' },
                      ].map(o => (
                        <button key={o.v} className={`filter-seg${mTipo === o.v ? ' active' : ''}`}
                          onClick={() => setMTipo(o.v)}>{o.lbl}</button>
                      ))}
                    </div>
                    <button className={`btn-filter${mPanelOpen ? ' active' : ''}`}
                      onClick={() => setMPanelOpen(p => !p)}>
                      <span>📅 Fecha</span>
                      {(mDesde || mHasta) && <span className="filter-badge">1</span>}
                    </button>
                    <span className="toolbar-count" style={{ marginLeft: 'auto' }}>
                      {filteredMov.length}{filteredMov.length !== movimientos.length && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> de {movimientos.length}</span>} movimientos
                    </span>
                  </div>
                  {mPanelOpen && (
                    <div className="filter-panel" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
                      <div className="filter-group" style={{ gridColumn: 'span 2' }}>
                        <span className="filter-label">📅 Rango de fechas</span>
                        <div className="filter-date-range">
                          <input type="date" value={mDesde} onChange={e => setMDesde(e.target.value)} />
                          <input type="date" value={mHasta} onChange={e => setMHasta(e.target.value)} />
                        </div>
                      </div>
                      {(mDesde || mHasta) && (
                        <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
                          <span className="filter-label">&nbsp;</span>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setMDesde(''); setMHasta('') }}>✕ Limpiar</button>
                        </div>
                      )}
                    </div>
                  )}
                  <FilterChips chips={mChips} onClear={() => { setMSearch(''); setMTipo(''); setMDesde(''); setMHasta('') }} />
                </div>
                <div className="data-table-wrap table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr><th>Tipo</th><th>Lote</th><th>Cantidad</th><th>Origen</th><th>Destino</th><th>Fecha</th><th>Notas</th></tr>
                    </thead>
                    <tbody>
                      {filteredMov.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin resultados</td></tr>
                      ) : filteredMov.map((m: any) => (
                        <tr key={m.idmovimiento_inventario}>
                          <td><span className={`badge ${tipoBadge[m.tipo] ?? 'badge-muted'}`}>{tipoIcon[m.tipo]} {m.tipo}</span></td>
                          <td>{m.lote_cafe?.variedad ?? '—'}</td>
                          <td><strong style={{ color: 'var(--primary)' }}>{m.cantidad} kg</strong></td>
                          <td style={{ fontSize: '0.82rem' }}>{m.almacen_origen?.nombre ?? '—'}</td>
                          <td style={{ fontSize: '0.82rem' }}>{m.almacen_destino?.nombre ?? '—'}</td>
                          <td style={{ fontSize: '0.78rem' }}>{new Date(m.fecha_movimiento).toLocaleDateString('es-CO')}</td>
                          <td style={{ fontSize: '0.76rem', maxWidth: 160 }}>{m.notas ? String(m.notas).slice(0, 50) + (m.notas.length > 50 ? '…' : '') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ── REGISTROS / PROCESOS TAB ── */}
            {tab === 'registros' && (
              <>
                <div className="filter-bar">
                  <div className="filter-row">
                    <div className="toolbar-search">
                      <span className="search-icon">🔍</span>
                      <input type="text" placeholder="Buscar por proceso, variedad…" value={rSearch} onChange={e => setRSearch(e.target.value)} />
                    </div>
                    {procesosUnicos.length > 0 && (
                      <div className="filter-segments">
                        <button className={`filter-seg${rProceso === '' ? ' active' : ''}`} onClick={() => setRProceso('')}>Todos</button>
                        {procesosUnicos.map(p => (
                          <button key={p} className={`filter-seg${rProceso === p ? ' active' : ''}`}
                            onClick={() => setRProceso(p)}>{p}</button>
                        ))}
                      </div>
                    )}
                    <button className={`btn-filter${rPanelOpen ? ' active' : ''}`}
                      onClick={() => setRPanelOpen(p => !p)}>
                      <span>📅 Fecha</span>
                      {(rDesde || rHasta) && <span className="filter-badge">1</span>}
                    </button>
                    <span className="toolbar-count" style={{ marginLeft: 'auto' }}>
                      {filteredReg.length}{filteredReg.length !== registros.length && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> de {registros.length}</span>} procesos
                    </span>
                  </div>
                  {rPanelOpen && (
                    <div className="filter-panel" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
                      <div className="filter-group" style={{ gridColumn: 'span 2' }}>
                        <span className="filter-label">📅 Rango de fechas inicio</span>
                        <div className="filter-date-range">
                          <input type="date" value={rDesde} onChange={e => setRDesde(e.target.value)} />
                          <input type="date" value={rHasta} onChange={e => setRHasta(e.target.value)} />
                        </div>
                      </div>
                      {(rDesde || rHasta) && (
                        <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
                          <span className="filter-label">&nbsp;</span>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setRDesde(''); setRHasta('') }}>✕ Limpiar</button>
                        </div>
                      )}
                    </div>
                  )}
                  <FilterChips chips={rChips} onClear={() => { setRSearch(''); setRProceso(''); setRDesde(''); setRHasta('') }} />
                </div>
                <div className="data-table-wrap table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr><th>Proceso</th><th>Lote</th><th>Kg lote</th><th>Inicio</th><th>Fin</th><th>Notas</th></tr>
                    </thead>
                    <tbody>
                      {filteredReg.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin resultados</td></tr>
                      ) : filteredReg.map((r: any) => (
                        <tr key={r.idregistro_proceso}>
                          <td><span className="badge badge-amber">{r.proceso?.nombre ?? '—'}</span></td>
                          <td><strong style={{ color: 'var(--text)' }}>{r.lote_cafe?.variedad ?? '—'}</strong></td>
                          <td>
                            {r.lote_cafe?.peso_kg ? (
                              <>
                                <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>{Number(r.lote_cafe.peso_kg).toLocaleString('es-CO')} kg</strong><br />
                                <span style={{ fontSize: '0.8rem', color: 'var(--amber)', fontWeight: 700 }}>📦 {(r.lote_cafe.peso_kg / 70).toFixed(2)} bts</span>
                              </>
                            ) : '—'}
                          </td>
                          <td style={{ fontSize: '0.78rem' }}>{new Date(r.fecha_inicio).toLocaleDateString('es-CO')}</td>
                          <td style={{ fontSize: '0.78rem' }}>{r.fecha_fin ? new Date(r.fecha_fin).toLocaleDateString('es-CO') : <span style={{ color: 'var(--amber)' }}>En curso</span>}</td>
                          <td style={{ fontSize: '0.76rem', maxWidth: 200 }}>{r.notas ? String(r.notas).slice(0, 60) + (r.notas.length > 60 ? '…' : '') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
