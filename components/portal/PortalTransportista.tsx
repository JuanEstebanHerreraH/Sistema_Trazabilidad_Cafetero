'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '../../utils/supabase/client'

interface UsuarioPortal { idusuario: number; nombre: string; email: string }

const tipoBadge: Record<string, string> = {
  entrada: 'badge-green', salida: 'badge-red', traslado: 'badge-blue',
}

const PAGE_SIZE = 15

export default function PortalTransportista({ usuario }: { usuario: UsuarioPortal }) {
  const supabase = createClient()
  const [movimientos, setMovimientos] = useState<any[]>([])
  const [lotes,       setLotes]       = useState<any[]>([])
  const [almacenes,   setAlmacenes]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [busqueda,     setBusqueda]     = useState('')
  const [filtroTipo,   setFiltroTipo]   = useState('')
  const [showFilters,  setShowFilters]  = useState(false)
  const [page, setPage] = useState(1)

  // New movement form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    tipo: 'entrada',
    fecha_movimiento: '',
    cantidad: '',
    idlote_cafe: '',
    idalmacen_origen: '',
    idalmacen_destino: '',
    notas: '',
  })
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const [movRes, lotesRes, almRes] = await Promise.all([
      supabase.from('movimiento_inventario').select(`
        idmovimiento_inventario, tipo, fecha_movimiento, cantidad, notas,
        lote_cafe:idlote_cafe(variedad),
        almacen_origen:idalmacen_origen(nombre),
        almacen_destino:idalmacen_destino(nombre)
      `).order('fecha_movimiento', { ascending: false }),
      supabase.from('lote_cafe').select('idlote_cafe, variedad').order('variedad'),
      supabase.from('almacen').select('idalmacen, nombre, stock_actual, capacidad_kg').order('nombre'),
    ])
    setMovimientos(movRes.data ?? [])
    setLotes(lotesRes.data ?? [])
    setAlmacenes(almRes.data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { cargar() }, [cargar])

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
    { label: 'Entradas',  val: movimientos.filter(m => m.tipo === 'entrada').length,  color: 'var(--green)',   icon: '📥' },
    { label: 'Salidas',   val: movimientos.filter(m => m.tipo === 'salida').length,   color: 'var(--red)',     icon: '📤' },
    { label: 'Traslados', val: movimientos.filter(m => m.tipo === 'traslado').length, color: 'var(--blue)',    icon: '🔄' },
    { label: 'Total kg',  val: `${movimientos.reduce((s, m) => s + Number(m.cantidad), 0).toLocaleString('es-CO')} kg`, color: 'var(--primary)', icon: '⚖' },
  ]

  const handleSave = async () => {
    if (!form.tipo || !form.fecha_movimiento || !form.cantidad || !form.idlote_cafe) {
      setFormError('Tipo, fecha, cantidad y lote son obligatorios.')
      return
    }
    if (form.tipo === 'traslado' && (!form.idalmacen_origen || !form.idalmacen_destino)) {
      setFormError('Un traslado requiere almacén origen y destino.')
      return
    }
    setSaving(true); setFormError(null)
    const { error } = await supabase.from('movimiento_inventario').insert({
      tipo: form.tipo,
      fecha_movimiento: form.fecha_movimiento,
      cantidad: Number(form.cantidad),
      idlote_cafe: Number(form.idlote_cafe),
      idalmacen_origen: form.idalmacen_origen ? Number(form.idalmacen_origen) : null,
      idalmacen_destino: form.idalmacen_destino ? Number(form.idalmacen_destino) : null,
      notas: form.notas || null,
    })
    if (error) { setFormError(error.message); setSaving(false); return }
    setForm({ tipo: 'entrada', fecha_movimiento: '', cantidad: '', idlote_cafe: '', idalmacen_origen: '', idalmacen_destino: '', notas: '' })
    setShowForm(false)
    await cargar()
    setSaving(false)
  }

  const almacenLabel = (a: any) => `${a.nombre} (${Number(a.stock_actual ?? 0).toLocaleString('es-CO')} kg)`

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.2rem' }}>
            Portal Transportista
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.84rem' }}>
            Movimientos de inventario registrados en el sistema.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(v => !v); setFormError(null) }}>
          {showForm ? '✕ Cancelar' : '+ Registrar movimiento'}
        </button>
      </div>

      {/* New movement form */}
      {showForm && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--primary)', borderRadius: 'var(--r-xl)',
          padding: '1.25rem', marginBottom: '1.5rem',
        }}>
          <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.88rem', marginBottom: '1rem' }}>
            🚛 Nuevo movimiento de inventario
          </div>
          {formError && <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>⚠ {formError}</div>}
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Tipo <span className="form-required">*</span></label>
              <select className="form-select" value={form.tipo}
                onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                <option value="entrada">📥 Entrada</option>
                <option value="salida">📤 Salida</option>
                <option value="traslado">🔄 Traslado</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Fecha y hora <span className="form-required">*</span></label>
              <input type="datetime-local" className="form-input" value={form.fecha_movimiento}
                onChange={e => setForm(p => ({ ...p, fecha_movimiento: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Lote de café <span className="form-required">*</span></label>
              <select className="form-select" value={form.idlote_cafe}
                onChange={e => setForm(p => ({ ...p, idlote_cafe: e.target.value }))}>
                <option value="">— Seleccionar lote —</option>
                {lotes.map((l: any) => (
                  <option key={l.idlote_cafe} value={l.idlote_cafe}>{l.variedad}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Cantidad (kg) <span className="form-required">*</span></label>
              <input type="number" className="form-input" min="0.01" step="0.01" placeholder="Ej: 500"
                value={form.cantidad} onChange={e => setForm(p => ({ ...p, cantidad: e.target.value }))} />
            </div>
            {(form.tipo === 'salida' || form.tipo === 'traslado') && (
              <div className="form-group">
                <label className="form-label">Almacén origen {form.tipo === 'traslado' && <span className="form-required">*</span>}</label>
                <select className="form-select" value={form.idalmacen_origen}
                  onChange={e => setForm(p => ({ ...p, idalmacen_origen: e.target.value }))}>
                  <option value="">— Seleccionar —</option>
                  {almacenes.map((a: any) => (
                    <option key={a.idalmacen} value={a.idalmacen}>{almacenLabel(a)}</option>
                  ))}
                </select>
              </div>
            )}
            {(form.tipo === 'entrada' || form.tipo === 'traslado') && (
              <div className="form-group">
                <label className="form-label">Almacén destino {form.tipo === 'traslado' && <span className="form-required">*</span>}</label>
                <select className="form-select" value={form.idalmacen_destino}
                  onChange={e => setForm(p => ({ ...p, idalmacen_destino: e.target.value }))}>
                  <option value="">— Seleccionar —</option>
                  {almacenes.map((a: any) => (
                    <option key={a.idalmacen} value={a.idalmacen}>{almacenLabel(a)}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Notas</label>
              <textarea className="form-textarea" value={form.notas}
                onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                placeholder="Observaciones del transporte, condiciones, referencias…" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '⏳ Guardando…' : '✓ Registrar movimiento'}
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
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
          <p>No hay movimientos. ¡Registra el primero!</p>
        </div>
      ) : (
        <>
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
              <button className="filter-clear" onClick={() => { setBusqueda(''); setFiltroTipo(''); setPage(1) }}>✕ Limpiar</button>
            )}
            <span className="toolbar-count">{filtrados.length} movimiento{filtrados.length !== 1 ? 's' : ''}</span>
          </div>

          {showFilters && (
            <div className="filter-bar">
              <div className="filter-row">
                <span className="filter-label">Tipo</span>
                <div className="filter-chips">
                  {[
                    { v: '', l: 'Todos' }, { v: 'entrada', l: '📥 Entrada' },
                    { v: 'salida', l: '📤 Salida' }, { v: 'traslado', l: '🔄 Traslado' },
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
              <div className="empty-icon">🔍</div><p>Sin movimientos con esos filtros.</p>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem' }}
                onClick={() => { setBusqueda(''); setFiltroTipo(''); setPage(1) }}>Limpiar</button>
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
                        acc.push(p); return acc
                      }, [])
                      .map((p, i) =>
                        p === '…' ? <span key={`e${i}`} className="page-ellipsis">…</span>
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
