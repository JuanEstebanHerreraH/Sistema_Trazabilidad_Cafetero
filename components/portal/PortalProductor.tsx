'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '../../utils/supabase/client'

interface UsuarioPortal { idusuario: number; nombre: string; email: string }
interface Finca { idfinca: number; nombre: string; ubicacion: string | null; area_hectareas: number | null }
interface Lote {
  idlote_cafe: number; variedad: string; fecha_cosecha: string
  peso_kg: number; estado: string; precio_kg: number
  finca: { nombre: string; idfinca: number } | null
}

const estadoBadge: Record<string, string> = {
  disponible: 'badge-green', en_proceso: 'badge-amber', vendido: 'badge-muted', exportado: 'badge-blue',
}
const estadoColor: Record<string, string> = {
  disponible: 'var(--green)', en_proceso: 'var(--amber)', vendido: 'var(--text-dim)', exportado: 'var(--blue)',
}

export default function PortalProductor({ usuario }: { usuario: UsuarioPortal }) {
  const supabase = createClient()
  const [fincas, setFincas] = useState<Finca[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'fincas' | 'lotes'>('fincas')

  // Filters for lotes
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroFinca, setFiltroFinca] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    // Buscar productor por nombre exacto primero, luego por contacto/email
    let { data: prod } = await supabase.from('productor').select('idproductor')
      .eq('nombre', usuario.nombre).maybeSingle()

    if (!prod) {
      const { data: byContacto } = await supabase.from('productor').select('idproductor')
        .eq('contacto', usuario.email).maybeSingle()
      prod = byContacto
    }

    if (!prod) {
      const { data: nuevo } = await supabase.from('productor')
        .insert({ nombre: usuario.nombre, contacto: usuario.email }).select('idproductor').single()
      prod = nuevo as any
    }

    const pid = (prod as any)?.idproductor ?? null

    if (pid) {
      const [{ data: f }, { data: fincaIds }] = await Promise.all([
        supabase.from('finca').select('idfinca, nombre, ubicacion, area_hectareas').eq('idproductor', pid),
        supabase.from('finca').select('idfinca').eq('idproductor', pid),
      ])
      setFincas((f ?? []) as any)

      if (fincaIds && fincaIds.length > 0) {
        const { data: l } = await supabase
          .from('lote_cafe')
          .select('idlote_cafe, variedad, fecha_cosecha, peso_kg, estado, precio_kg, finca:idfinca(nombre, idfinca)')
          .in('idfinca', fincaIds.map(f => f.idfinca))
          .order('fecha_cosecha', { ascending: false })
        setLotes((l ?? []) as any)
      }
    }
    setLoading(false)
  }, [usuario.nombre, usuario.email, supabase])

  useEffect(() => { cargar() }, [cargar])

  const lotesFiltrados = useMemo(() => {
    let rows = lotes
    if (busqueda) {
      const q = busqueda.toLowerCase()
      rows = rows.filter(l => l.variedad.toLowerCase().includes(q) || (l.finca?.nombre ?? '').toLowerCase().includes(q))
    }
    if (filtroEstado) rows = rows.filter(l => l.estado === filtroEstado)
    if (filtroFinca)  rows = rows.filter(l => String((l.finca as any)?.idfinca ?? '') === filtroFinca)
    return rows
  }, [lotes, busqueda, filtroEstado, filtroFinca])

  const activeFilters = [filtroEstado, filtroFinca].filter(Boolean).length

  const totalKgDisponible = lotes.filter(l => l.estado === 'disponible').reduce((s, l) => s + l.peso_kg, 0)
  const totalKgVendido    = lotes.filter(l => l.estado === 'vendido').reduce((s, l) => s + l.peso_kg, 0)
  const totalKgExportado  = lotes.filter(l => l.estado === 'exportado').reduce((s, l) => s + l.peso_kg, 0)

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.2rem' }}>
          Portal Productor
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.84rem' }}>
          Seguimiento de tus fincas y lotes de café.
        </p>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {[
          { icon: '🌿', label: 'Mis fincas',     val: fincas.length,              color: 'var(--green)' },
          { icon: '☕', label: 'Total lotes',     val: lotes.length,               color: 'var(--primary)' },
          { icon: '✅', label: 'Kg disponibles', val: `${totalKgDisponible} kg`,  color: 'var(--amber)' },
          { icon: '💰', label: 'Kg vendidos',    val: `${totalKgVendido} kg`,     color: 'var(--blue)' },
          { icon: '✈', label: 'Kg exportados',  val: `${totalKgExportado} kg`,   color: 'var(--purple)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ '--accent': s.color } as any}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="tabs">
        <button className={`tab-btn${tab === 'fincas' ? ' active' : ''}`} onClick={() => setTab('fincas')}>
          🌿 Mis fincas ({fincas.length})
        </button>
        <button className={`tab-btn${tab === 'lotes' ? ' active' : ''}`} onClick={() => setTab('lotes')}>
          ☕ Mis lotes ({lotes.length})
        </button>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : tab === 'fincas' ? (
        fincas.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🌿</div>
            <p>No tienes fincas registradas. Contacta al administrador.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {fincas.map(f => {
              const fincaLotes = lotes.filter(l => (l.finca as any)?.idfinca === f.idfinca)
              const kgTotal = fincaLotes.reduce((s, l) => s + l.peso_kg, 0)
              return (
                <div key={f.idfinca} className="record-card">
                  <div className="record-card-header">
                    <div>
                      <div className="record-card-title">🌿 {f.nombre}</div>
                      {f.ubicacion && <div className="record-card-meta">📍 {f.ubicacion}</div>}
                    </div>
                    {f.area_hectareas && (
                      <span className="badge badge-green">{f.area_hectareas} ha</span>
                    )}
                  </div>
                  <div className="record-card-body" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className="record-field">
                      <span className="record-field-label">Lotes</span>
                      <span className="record-field-value" style={{ color: 'var(--primary)' }}>{fincaLotes.length}</span>
                    </div>
                    <div className="record-field">
                      <span className="record-field-label">Stock total</span>
                      <span className="record-field-value">{kgTotal.toLocaleString('es-CO')} kg</span>
                    </div>
                    <div className="record-field">
                      <span className="record-field-label">Disponibles</span>
                      <span className="record-field-value" style={{ color: 'var(--green)' }}>
                        {fincaLotes.filter(l => l.estado === 'disponible').length} lotes
                      </span>
                    </div>
                    <div className="record-field">
                      <span className="record-field-label">Vendidos</span>
                      <span className="record-field-value" style={{ color: 'var(--text-dim)' }}>
                        {fincaLotes.filter(l => l.estado === 'vendido').length} lotes
                      </span>
                    </div>
                  </div>
                  <div className="record-card-footer">
                    {fincaLotes.length > 0 && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setFiltroFinca(String(f.idfinca)); setTab('lotes') }}
                      >
                        Ver lotes →
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        /* ── Tab lotes ── */
        <>
          {/* Toolbar */}
          <div className="toolbar-v2">
            <div className="toolbar-search" style={{ flex: 1, minWidth: 180 }}>
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Buscar variedad o finca…"
                value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            </div>
            <button className="btn btn-secondary btn-sm"
              onClick={() => setShowFilters(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              ⚙ Filtros
              {activeFilters > 0 && <span className="filter-badge">{activeFilters}</span>}
            </button>
            {(busqueda || activeFilters > 0) && (
              <button className="filter-clear" onClick={() => { setBusqueda(''); setFiltroEstado(''); setFiltroFinca('') }}>
                ✕ Limpiar
              </button>
            )}
            <span className="toolbar-count">{lotesFiltrados.length} lote{lotesFiltrados.length !== 1 ? 's' : ''}</span>
          </div>

          {showFilters && (
            <div className="filter-bar">
              <div className="filter-row">
                <span className="filter-label">Estado</span>
                <div className="filter-chips">
                  {[
                    { v: '', l: 'Todos' },
                    { v: 'disponible', l: '✅ Disponible' },
                    { v: 'en_proceso', l: '⚙ En proceso' },
                    { v: 'vendido',    l: '💰 Vendido' },
                    { v: 'exportado',  l: '✈ Exportado' },
                  ].map(opt => (
                    <button key={opt.v}
                      className={`filter-chip${filtroEstado === opt.v ? ' active' : ''}`}
                      onClick={() => setFiltroEstado(opt.v)}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
              {fincas.length > 1 && (
                <div className="filter-row">
                  <span className="filter-label">Finca</span>
                  <div className="filter-chips">
                    <button className={`filter-chip${filtroFinca === '' ? ' active' : ''}`}
                      onClick={() => setFiltroFinca('')}>Todas</button>
                    {fincas.map(f => (
                      <button key={f.idfinca}
                        className={`filter-chip${filtroFinca === String(f.idfinca) ? ' active' : ''}`}
                        onClick={() => setFiltroFinca(String(f.idfinca))}>
                        {f.nombre}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {lotesFiltrados.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">☕</div>
              <p>No hay lotes{busqueda || activeFilters ? ' con esos filtros' : ' asociados a tus fincas'}.</p>
              {(busqueda || activeFilters > 0) && (
                <button className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem' }}
                  onClick={() => { setBusqueda(''); setFiltroEstado(''); setFiltroFinca('') }}>
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {lotesFiltrados.map(l => (
                <div key={l.idlote_cafe} className="record-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.92rem' }}>
                      ☕ {l.variedad}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                      🌿 {(l.finca as any)?.nombre ?? '—'} · Cosecha {new Date(l.fecha_cosecha).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="record-field">
                      <span className="record-field-label">Stock</span>
                      <span className="record-field-value" style={{ color: 'var(--primary)' }}>
                        {l.peso_kg.toLocaleString('es-CO')} kg
                      </span>
                    </div>
                    <div className="record-field">
                      <span className="record-field-label">Precio/kg</span>
                      <span className="record-field-value">${Number(l.precio_kg).toLocaleString('es-CO')}</span>
                    </div>
                    <div className="record-field">
                      <span className="record-field-label">Bultos</span>
                      <span className="record-field-value" style={{ color: 'var(--amber)' }}>
                        {(l.peso_kg / 70).toFixed(1)}
                      </span>
                    </div>
                    <span className={`badge ${estadoBadge[l.estado] ?? 'badge-muted'}`}>{l.estado.replace('_', ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
