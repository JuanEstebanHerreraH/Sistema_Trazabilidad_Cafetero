'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../../utils/supabase/client'
import Modal from '../../../components/Modal'

interface Almacen {
  idalmacen: number
  nombre: string
  ubicacion: string | null
  capacidad_kg: number | null
  stock_actual?: number
  porcentaje_ocupacion?: number | null
}

interface LoteEnAlmacen {
  idlote_cafe: number
  variedad: string
  kg_en_almacen: number
}

const PAGE_SIZE = 12

export default function AlmacenesPage() {
  const supabase = createClient()
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [capMin, setCapMin] = useState('')
  const [capMax, setCapMax] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [page, setPage] = useState(1)

  // Detail modal (stock + lotes)
  const [detalleAlm, setDetalleAlm] = useState<Almacen | null>(null)
  const [lotes, setLotes] = useState<LoteEnAlmacen[]>([])
  const [loadingLotes, setLoadingLotes] = useState(false)

  // Edit/Create modal
  const [editModal, setEditModal] = useState(false)
  const [editRec, setEditRec] = useState<Almacen | null>(null)
  const [form, setForm] = useState({ nombre: '', ubicacion: '', capacidad_kg: '' })
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    // Try stock view first, fall back to raw table
    const { data: stockData, error: stockErr } = await supabase
      .from('v_almacen_stock').select('*').order('nombre')
    if (!stockErr && stockData) {
      setAlmacenes(stockData as Almacen[])
    } else {
      const { data: raw, error: rawErr } = await supabase
        .from('almacen').select('*').order('nombre')
      if (rawErr) setError(rawErr.message)
      else setAlmacenes((raw ?? []).map((a: any) => ({ ...a, stock_actual: 0, porcentaje_ocupacion: null })))
    }
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const verDetalle = async (alm: Almacen) => {
    setDetalleAlm(alm)
    setLoadingLotes(true)
    setLotes([])
    const { data } = await supabase.rpc('fn_contenido_almacen', { p_idalmacen: alm.idalmacen })
    setLotes((data ?? []) as LoteEnAlmacen[])
    setLoadingLotes(false)
  }

  const openCreate = () => {
    setForm({ nombre: '', ubicacion: '', capacidad_kg: '' })
    setEditRec(null); setFormErr(null); setEditModal(true)
  }
  const openEdit = (alm: Almacen) => {
    setForm({ nombre: alm.nombre, ubicacion: alm.ubicacion ?? '', capacidad_kg: alm.capacidad_kg?.toString() ?? '' })
    setEditRec(alm); setFormErr(null); setEditModal(true)
  }
  const handleSave = async () => {
    if (!form.nombre.trim()) { setFormErr('El nombre es obligatorio.'); return }
    setSaving(true); setFormErr(null)
    const payload = {
      nombre: form.nombre.trim(),
      ubicacion: form.ubicacion.trim() || null,
      capacidad_kg: form.capacidad_kg ? Number(form.capacidad_kg) : null,
    }
    let err: any
    if (editRec) {
      const res = await supabase.from('almacen').update(payload).eq('idalmacen', editRec.idalmacen)
      err = res.error
    } else {
      const res = await supabase.from('almacen').insert(payload)
      err = res.error
    }
    if (err) { setFormErr(err.message); setSaving(false); return }
    setSaving(false); setEditModal(false); await cargar()
  }
  const handleDelete = async () => {
    setDeleting(true)
    await supabase.from('almacen').delete().eq('idalmacen', deleteId)
    setDeleting(false); setDeleteId(null); await cargar()
  }

  const [stockMin, setStockMin] = useState('')
  const [stockMax, setStockMax] = useState('')

  const filtered = almacenes.filter(a => {
    const ms = !search || a.nombre.toLowerCase().includes(search.toLowerCase()) || (a.ubicacion ?? '').toLowerCase().includes(search.toLowerCase())
    const stock = a.stock_actual ?? 0
    const mStock = (!stockMin || stock >= Number(stockMin)) && (!stockMax || stock <= Number(stockMax))
    const mc = (!capMin || (a.capacidad_kg != null && a.capacidad_kg >= Number(capMin))) &&
               (!capMax || (a.capacidad_kg != null && a.capacidad_kg <= Number(capMax)))
    return ms && mc && mStock
  })
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const hasActive = !!(search || capMin || capMax || stockMin || stockMax)
  const clearAll = () => { setSearch(''); setCapMin(''); setCapMax(''); setStockMin(''); setStockMax(''); setPage(1) }
  const activeFilters = [capMin || capMax, stockMin || stockMax].filter(Boolean).length

  const getBarColor = (pct: number) => pct >= 95 ? 'var(--red,#e05050)' : pct >= 80 ? 'var(--amber)' : pct >= 50 ? 'var(--blue)' : 'var(--green)'
  const getBadge = (alm: Almacen) => {
    if (!alm.capacidad_kg || alm.capacidad_kg <= 0) return null
    const pct = alm.porcentaje_ocupacion ?? 0
    if (pct >= 100) return { cls: 'badge-red', label: '🔴 LLENO' }
    if (pct >= 80) return { cls: 'badge-amber', label: '🟡 Casi lleno' }
    if (pct >= 50) return { cls: 'badge-blue', label: '🔵 Medio' }
    return { cls: 'badge-green', label: '🟢 Disponible' }
  }

  const totalStock = almacenes.reduce((s, a) => s + (a.stock_actual ?? 0), 0)
  const totalCap = almacenes.reduce((s, a) => s + (a.capacidad_kg ?? 0), 0)

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    height: 38, padding: '0 1rem', borderRadius: 'var(--r-md)',
    border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
    background: active ? 'rgba(196,122,44,0.12)' : 'var(--bg-input)',
    color: active ? 'var(--primary)' : 'var(--text-soft)',
    fontSize: '0.84rem', fontFamily: 'var(--font-body)', cursor: 'pointer', fontWeight: active ? 600 : 400,
  })

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-icon">🏭</div>
          <div><h2>Almacenes</h2><p className="page-subtitle">Gestión de bodegas y almacenes</p></div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={filterBtnStyle(panelOpen || activeFilters > 0)} onClick={() => setPanelOpen(v => !v)}>
            🎯 Filtros
            {activeFilters > 0 && <span style={{ minWidth: 20, height: 20, borderRadius: 99, background: 'var(--primary)', color: '#fff', fontSize: '0.65rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilters}</span>}
            <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>{panelOpen ? '▲' : '▼'}</span>
          </button>
          <button className="btn btn-primary" onClick={openCreate}>+ Nuevo</button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {error}</div>}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { icon: '🏭', label: 'Almacenes', val: almacenes.length, color: 'var(--primary)' },
          { icon: '⚖️', label: 'Stock total', val: `${totalStock.toLocaleString('es-CO')} kg`, color: 'var(--blue)' },
          { icon: '📦', label: 'Capacidad total', val: totalCap > 0 ? `${totalCap.toLocaleString('es-CO')} kg` : '—', color: 'var(--green)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-lg)', padding: '0.8rem 1rem' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + clear */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 380 }}>
          <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none' }}>🔍</span>
          <input type="text" placeholder="Buscar almacén o ubicación…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ width: '100%', height: 36, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0 0.9rem 0 2.1rem', color: 'var(--text)', fontSize: '0.84rem', fontFamily: 'var(--font-body)', outline: 'none' }} />
        </div>
        {hasActive && <button onClick={clearAll} style={{ height: 36, padding: '0 0.8rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>✕ Limpiar</button>}
        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 500, marginLeft: 'auto' }}>{filtered.length} almacén{filtered.length !== 1 ? 'es' : ''}</span>
      </div>

      {/* Filter panel */}
      {panelOpen && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>⚖️ Stock actual (kg)</label>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input type="number" placeholder="Mín" value={stockMin} onChange={e => { setStockMin(e.target.value); setPage(1) }}
                  style={{ height: 38, width: 110, background: (stockMin || stockMax) ? 'rgba(196,122,44,0.08)' : 'var(--bg-input)', border: (stockMin || stockMax) ? '1px solid var(--primary)' : '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '0.84rem', fontFamily: 'var(--font-body)', padding: '0 0.5rem', outline: 'none' }} />
                <span style={{ color: 'var(--text-muted)' }}>–</span>
                <input type="number" placeholder="Máx" value={stockMax} onChange={e => { setStockMax(e.target.value); setPage(1) }}
                  style={{ height: 38, width: 110, background: (stockMin || stockMax) ? 'rgba(196,122,44,0.08)' : 'var(--bg-input)', border: (stockMin || stockMax) ? '1px solid var(--primary)' : '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '0.84rem', fontFamily: 'var(--font-body)', padding: '0 0.5rem', outline: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>📦 Capacidad máx. (kg)</label>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input type="number" placeholder="Mín" value={capMin} onChange={e => { setCapMin(e.target.value); setPage(1) }}
                  style={{ height: 38, width: 110, background: (capMin || capMax) ? 'rgba(196,122,44,0.08)' : 'var(--bg-input)', border: (capMin || capMax) ? '1px solid var(--primary)' : '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '0.84rem', fontFamily: 'var(--font-body)', padding: '0 0.5rem', outline: 'none' }} />
                <span style={{ color: 'var(--text-muted)' }}>–</span>
                <input type="number" placeholder="Máx" value={capMax} onChange={e => { setCapMax(e.target.value); setPage(1) }}
                  style={{ height: 38, width: 110, background: (capMin || capMax) ? 'rgba(196,122,44,0.08)' : 'var(--bg-input)', border: (capMin || capMax) ? '1px solid var(--primary)' : '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '0.84rem', fontFamily: 'var(--font-body)', padding: '0 0.5rem', outline: 'none' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cards grid */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏭</div>
          <p>No hay almacenes{hasActive ? ' que coincidan' : ''}.</p>
          {hasActive && <button className="btn btn-ghost btn-sm" onClick={clearAll} style={{ marginTop: '0.5rem' }}>✕ Limpiar filtros</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px,1fr))', gap: '1rem' }}>
          {paged.map(alm => {
            const badge = getBadge(alm)
            const pct = alm.porcentaje_ocupacion ?? 0
            const stock = alm.stock_actual ?? 0
            const libre = alm.capacidad_kg ? Math.max(0, alm.capacidad_kg - stock) : null

            return (
              <div key={alm.idalmacen} style={{
                background: 'var(--bg-card)',
                border: `1px solid ${pct >= 100 ? 'var(--red,#e05050)' : pct >= 80 ? 'var(--amber)' : 'var(--border-soft)'}`,
                borderRadius: 'var(--r-xl)', padding: '1.25rem', transition: 'border-color 0.2s',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>🏭 {alm.nombre}</div>
                    {alm.ubicacion && <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>📍 {alm.ubicacion}</div>}
                  </div>
                  {badge && <span className={`badge ${badge.cls}`}>{badge.label}</span>}
                </div>

                {/* Stock + Capacidad */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)', padding: '0.5rem 0.75rem' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Stock actual</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)', marginTop: '0.1rem' }}>{stock.toLocaleString('es-CO')} kg</div>
                  </div>
                  <div style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)', padding: '0.5rem 0.75rem' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Capacidad</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-soft)', marginTop: '0.1rem' }}>
                      {alm.capacidad_kg ? `${alm.capacidad_kg.toLocaleString('es-CO')} kg` : '∞ Sin límite'}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                {alm.capacidad_kg && alm.capacidad_kg > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '0.3rem' }}>
                      <span>{pct}% ocupado</span>
                      <span style={{ color: libre === 0 ? 'var(--red,#e05050)' : 'var(--text-dim)' }}>
                        {libre != null ? `${libre.toLocaleString('es-CO')} kg libres` : ''}
                      </span>
                    </div>
                    <div style={{ background: 'var(--bg)', borderRadius: 99, height: 10, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: getBarColor(pct), borderRadius: 99, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => verDetalle(alm)}>
                    📦 Ver contenido
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(alm)}>✏</button>
                  <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(alm.idalmacen)}>🗑</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && pageCount > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}</span>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Ant</button>
            {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => Math.max(1, Math.min(pageCount - 4, page - 2)) + i).map(p => (
              <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button className="btn btn-ghost btn-sm" disabled={page === pageCount} onClick={() => setPage(p => p + 1)}>Sig ›</button>
          </div>
        </div>
      )}

      {/* ── DETALLE MODAL ── */}
      <Modal isOpen={!!detalleAlm} onClose={() => setDetalleAlm(null)}
        title={`📦 ${detalleAlm?.nombre ?? ''}`}
        footer={<button className="btn btn-secondary" onClick={() => setDetalleAlm(null)}>Cerrar</button>}>
        {detalleAlm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              {[
                { label: 'Stock actual', val: `${(detalleAlm.stock_actual ?? 0).toLocaleString('es-CO')} kg`, color: 'var(--primary)' },
                { label: 'Capacidad',   val: detalleAlm.capacidad_kg ? `${detalleAlm.capacidad_kg.toLocaleString('es-CO')} kg` : '∞', color: 'var(--text-soft)' },
                { label: 'Ocupación',   val: detalleAlm.capacidad_kg ? `${detalleAlm.porcentaje_ocupacion ?? 0}%` : '—', color: getBarColor(detalleAlm.porcentaje_ocupacion ?? 0) },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)', padding: '0.6rem 0.8rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>{s.label}</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: s.color, marginTop: '0.2rem' }}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            {detalleAlm.capacidad_kg && detalleAlm.capacidad_kg > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '0.3rem' }}>
                  <span>{detalleAlm.porcentaje_ocupacion ?? 0}% ocupado</span>
                  <span>{Math.max(0, detalleAlm.capacidad_kg - (detalleAlm.stock_actual ?? 0)).toLocaleString('es-CO')} kg libres</span>
                </div>
                <div style={{ background: 'var(--bg)', borderRadius: 99, height: 12, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, detalleAlm.porcentaje_ocupacion ?? 0)}%`, background: getBarColor(detalleAlm.porcentaje_ocupacion ?? 0), borderRadius: 99 }} />
                </div>
              </div>
            )}

            {/* Lotes */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>
                ☕ Lotes almacenados
              </div>
              {loadingLotes ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-dim)' }}>Calculando contenido…</div>
              ) : lotes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--bg)', borderRadius: 'var(--r-lg)', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                  📭 Este almacén está vacío
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {lotes.map(l => {
                    const pctLote = detalleAlm.stock_actual && detalleAlm.stock_actual > 0
                      ? Math.round((l.kg_en_almacen / detalleAlm.stock_actual) * 100)
                      : 0
                    return (
                      <div key={l.idlote_cafe} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg)', borderRadius: 'var(--r-md)', padding: '0.6rem 0.8rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.88rem' }}>☕ {l.variedad}</span>
                            <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>{l.kg_en_almacen.toLocaleString('es-CO')} kg</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ flex: 1, background: 'var(--border)', borderRadius: 99, height: 5, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pctLote}%`, background: 'var(--primary)', borderRadius: 99 }} />
                            </div>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{pctLote}% del stock · Lote #{l.idlote_cafe}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {/* Total */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.8rem', borderTop: '1px solid var(--border-soft)', marginTop: '0.25rem', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                    <span>{lotes.length} lote{lotes.length !== 1 ? 's' : ''}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-soft)' }}>Total: {lotes.reduce((s, l) => s + l.kg_en_almacen, 0).toLocaleString('es-CO')} kg</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── EDIT/CREATE MODAL ── */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)}
        title={editRec ? `Editar — ${editRec.nombre}` : 'Nuevo Almacén'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEditModal(false)} disabled={saving}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : editRec ? 'Guardar cambios' : 'Crear almacén'}</button>
          </>
        }>
        {formErr && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {formErr}</div>}
        <div className="form-grid-2">
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Nombre <span className="form-required">*</span></label>
            <input className="form-input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Bodega Central" />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Ubicación</label>
            <input className="form-input" value={form.ubicacion} onChange={e => setForm(p => ({ ...p, ubicacion: e.target.value }))} placeholder="Ej: Bogotá, Calle 80" />
          </div>
          <div className="form-group">
            <label className="form-label">Capacidad máxima (kg)</label>
            <input className="form-input" type="number" value={form.capacidad_kg} onChange={e => setForm(p => ({ ...p, capacidad_kg: e.target.value }))} placeholder="Ej: 10000" step="1" min="0" />
            <p className="form-hint">💡 Dejar vacío para almacén sin límite de capacidad.</p>
          </div>
        </div>
      </Modal>

      {/* ── DELETE MODAL ── */}
      <Modal isOpen={deleteId !== null} onClose={() => setDeleteId(null)} title="Confirmar eliminación"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteId(null)} disabled={deleting}>Cancelar</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>{deleting ? 'Eliminando…' : 'Sí, eliminar'}</button>
          </>
        }>
        <p style={{ color: 'var(--text-soft)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          ¿Estás seguro de que deseas eliminar este almacén? Esta acción <strong>no se puede deshacer</strong>.
        </p>
      </Modal>
    </div>
  )
}
