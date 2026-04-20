'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '../../utils/supabase/client'

interface UsuarioPortal { idusuario: number; nombre: string; email: string }

const tipoBadge: Record<string, string> = {
  entrada: 'badge-green', salida: 'badge-red', traslado: 'badge-blue',
}

const PAGE_SIZE = 15

export default function PortalTransportista({ usuario }: { usuario: UsuarioPortal }) {
  const supabase = createClient()
  const [movimientos, setMovimientos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    supabase.from('movimiento_inventario').select(`
      idmovimiento_inventario, tipo, fecha_movimiento, cantidad, notas,
      lote_cafe:idlote_cafe(variedad),
      almacen_origen:idalmacen_origen(nombre),
      almacen_destino:idalmacen_destino(nombre)
    `).order('fecha_movimiento', { ascending: false })
      .then(({ data }) => { setMovimientos(data ?? []); setLoading(false) })
  }, [supabase])

  const filtrados = useMemo(() => {
    let rows = movimientos
    if (busqueda) {
      const q = busqueda.toLowerCase()
      rows = rows.filter(m =>
        (m.lote_cafe?.variedad ?? '').toLowerCase().includes(q) ||
        (m.almacen_origen?.nombre ?? '').toLowerCase().includes(q) ||
        (m.almacen_destino?.nombre ?? '').toLowerCase().includes(q)
      )
    }
    if (filtroTipo) rows = rows.filter(m => m.tipo === filtroTipo)
    return rows
  }, [movimientos, busqueda, filtroTipo])

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const paginated  = filtrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const activeFilters = [filtroTipo].filter(Boolean).length

  const stats = [
    { label: 'Entradas',  val: movimientos.filter(m => m.tipo === 'entrada').length,   color: 'var(--green)',  icon: '📥' },
    { label: 'Salidas',   val: movimientos.filter(m => m.tipo === 'salida').length,    color: 'var(--red)',    icon: '📤' },
    { label: 'Traslados', val: movimientos.filter(m => m.tipo === 'traslado').length,  color: 'var(--blue)',   icon: '🔄' },
    { label: 'Total kg',  val: `${movimientos.reduce((s, m) => s + Number(m.cantidad), 0).toLocaleString('es-CO')} kg`, color: 'var(--primary)', icon: '⚖' },
  ]

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.2rem' }}>
          Portal Transportista
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.84rem' }}>
          Movimientos de inventario registrados en el sistema.
        </p>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {stats.map(s => (
          <div key={s.label} className="stat-card" style={{ '--accent': s.color } as any}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : movimientos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🚛</div>
          <p>No hay movimientos registrados.</p>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="toolbar-v2">
            <div className="toolbar-search" style={{ flex: 1, minWidth: 180 }}>
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Buscar lote, origen o destino…"
                value={busqueda} onChange={e => { setBusqueda(e.target.value); setPage(1) }} />
            </div>
            <button className="btn btn-secondary btn-sm"
              onClick={() => setShowFilters(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              ⚙ Filtros
              {activeFilters > 0 && <span className="filter-badge">{activeFilters}</span>}
            </button>
            {(busqueda || activeFilters > 0) && (
              <button className="filter-clear" onClick={() => { setBusqueda(''); setFiltroTipo(''); setPage(1) }}>
                ✕ Limpiar
              </button>
            )}
            <span className="toolbar-count">{filtrados.length} movimiento{filtrados.length !== 1 ? 's' : ''}</span>
          </div>

          {showFilters && (
            <div className="filter-bar">
              <div className="filter-row">
                <span className="filter-label">Tipo</span>
                <div className="filter-chips">
                  {[
                    { v: '',          l: 'Todos' },
                    { v: 'entrada',   l: '📥 Entrada' },
                    { v: 'salida',    l: '📤 Salida' },
                    { v: 'traslado',  l: '🔄 Traslado' },
                  ].map(opt => (
                    <button key={opt.v}
                      className={`filter-chip${filtroTipo === opt.v ? ' active' : ''}`}
                      onClick={() => { setFiltroTipo(opt.v); setPage(1) }}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {filtrados.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <p>No hay movimientos con esos filtros.</p>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem' }}
                onClick={() => { setBusqueda(''); setFiltroTipo(''); setPage(1) }}>
                Limpiar filtros
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {paginated.map((m: any) => (
                  <div key={m.idmovimiento_inventario} className="record-card"
                    style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={`badge ${tipoBadge[m.tipo] ?? 'badge-muted'}`}
                      style={{ minWidth: 70, justifyContent: 'center', flexShrink: 0 }}>
                      {m.tipo === 'entrada' ? '📥' : m.tipo === 'salida' ? '📤' : '🔄'} {m.tipo}
                    </span>
                    <div style={{ flex: '1 1 160px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.88rem' }}>
                        {m.lote_cafe?.variedad ?? '—'}
                      </div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                        {new Date(m.fecha_movimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div className="record-field">
                        <span className="record-field-label">Cantidad</span>
                        <span className="record-field-value" style={{ color: 'var(--primary)' }}>
                          {Number(m.cantidad).toLocaleString('es-CO')} kg
                        </span>
                      </div>
                      <div className="record-field">
                        <span className="record-field-label">Origen</span>
                        <span className="record-field-value">{m.almacen_origen?.nombre ?? '—'}</span>
                      </div>
                      <div className="record-field">
                        <span className="record-field-label">Destino</span>
                        <span className="record-field-value">{m.almacen_destino?.nombre ?? '—'}</span>
                      </div>
                      {m.notas && (
                        <div className="record-field" style={{ maxWidth: 180 }}>
                          <span className="record-field-label">Notas</span>
                          <span className="record-field-value" style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.75rem' }}>
                            {String(m.notas).slice(0, 50)}{m.notas.length > 50 ? '…' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination-bar">
                  <div className="pagination-info">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(filtrados.length, page * PAGE_SIZE)} de {filtrados.length}
                  </div>
                  <div className="pagination-controls">
                    <button className="page-btn page-btn-wide" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Ant</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                      .reduce<(number | '…')[]>((acc, p, i, arr) => {
                        if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('…')
                        acc.push(p)
                        return acc
                      }, [])
                      .map((p, i) =>
                        p === '…'
                          ? <span key={`e${i}`} className="page-ellipsis">…</span>
                          : <button key={p} className={`page-btn${page === p ? ' active' : ''}`}
                              onClick={() => setPage(p as number)}>{p}</button>
                      )}
                    <button className="page-btn page-btn-wide" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Sig →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
