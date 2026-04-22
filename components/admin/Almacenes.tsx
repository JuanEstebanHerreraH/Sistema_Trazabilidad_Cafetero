'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../utils/supabase/client'
import Modal from '../Modal'

interface AlmacenStock {
  idalmacen: number
  nombre: string
  ubicacion: string | null
  capacidad_kg: number | null
  stock_actual: number
  porcentaje_ocupacion: number | null
  espacio_disponible: number | null
}

interface ContenidoAlmacen {
  idlote_cafe: number
  variedad: string
  kg_en_almacen: number
}

export default function Almacenes() {
  const supabase = createClient()
  const [almacenes, setAlmacenes] = useState<AlmacenStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE_A = 12

  // Modal crear/editar
  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<any>(null)
  const [form, setForm] = useState({ nombre: '', ubicacion: '', capacidad_kg: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Modal detalle (contenido del almacén)
  const [detalleAlmacen, setDetalleAlmacen] = useState<AlmacenStock | null>(null)
  const [contenido, setContenido] = useState<ContenidoAlmacen[]>([])
  const [loadingContenido, setLoadingContenido] = useState(false)

  // Modal eliminar
  const [deleteId, setDeleteId] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('v_almacen_stock')
      .select('*')
      .order('nombre')
    if (err) {
      // Fallback: si la vista no existe aún, usar tabla directa
      const { data: raw, error: err2 } = await supabase
        .from('almacen')
        .select('*')
        .order('nombre')
      if (err2) setError(err2.message)
      else {
        setAlmacenes((raw ?? []).map((a: any) => ({
          ...a,
          stock_actual: 0,
          porcentaje_ocupacion: null,
          espacio_disponible: a.capacidad_kg ?? null,
        })))
      }
    } else {
      setAlmacenes((data ?? []) as AlmacenStock[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const verContenido = async (alm: AlmacenStock) => {
    setDetalleAlmacen(alm)
    setLoadingContenido(true)
    setContenido([])
    const { data } = await supabase.rpc('fn_contenido_almacen', { p_idalmacen: alm.idalmacen })
    setContenido((data ?? []) as ContenidoAlmacen[])
    setLoadingContenido(false)
  }

  const openCreate = () => {
    setForm({ nombre: '', ubicacion: '', capacidad_kg: '' })
    setEditRecord(null)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (record: AlmacenStock) => {
    setForm({
      nombre: record.nombre,
      ubicacion: record.ubicacion ?? '',
      capacidad_kg: record.capacidad_kg?.toString() ?? '',
    })
    setEditRecord(record)
    setFormError(null)
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.nombre.trim()) { setFormError('El nombre es obligatorio.'); return }
    setSaving(true)
    setFormError(null)
    const payload = {
      nombre: form.nombre.trim(),
      ubicacion: form.ubicacion.trim() || null,
      capacidad_kg: form.capacidad_kg ? Number(form.capacidad_kg) : null,
    }
    if (editRecord) {
      const { error } = await supabase.from('almacen').update(payload).eq('idalmacen', editRecord.idalmacen)
      if (error) { setFormError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('almacen').insert(payload)
      if (error) { setFormError(error.message); setSaving(false); return }
    }
    setSaving(false)
    setModalOpen(false)
    await cargar()
  }

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await supabase.from('almacen').delete().eq('idalmacen', deleteId)
    if (error) alert('Error al eliminar: ' + error.message)
    setDeleting(false)
    setDeleteId(null)
    await cargar()
  }

  const [filtroEstado, setFiltroEstado] = useState('')
  const [capacidadMin, setCapacidadMin] = useState('')
  const [capacidadMax, setCapacidadMax] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)

  const filtered = almacenes.filter(a => {
    const matchSearch = !search || a.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (a.ubicacion ?? '').toLowerCase().includes(search.toLowerCase())
    const pct = a.porcentaje_ocupacion ?? 0
    const matchEstado =
      !filtroEstado ? true :
      filtroEstado === 'lleno'      ? pct >= 100 :
      filtroEstado === 'casi_lleno' ? pct >= 80 && pct < 100 :
      filtroEstado === 'disponible' ? pct < 80 :
      filtroEstado === 'sin_limite' ? (a.capacidad_kg == null || a.capacidad_kg <= 0) : true
    const matchCapMin = !capacidadMin || (a.capacidad_kg != null && a.capacidad_kg >= Number(capacidadMin))
    const matchCapMax = !capacidadMax || (a.capacidad_kg != null && a.capacidad_kg <= Number(capacidadMax))
    return matchSearch && matchEstado && matchCapMin && matchCapMax
  })

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE_A)
  const paged = filtered.slice((page - 1) * PAGE_SIZE_A, page * PAGE_SIZE_A)

  const getStatusBadge = (alm: AlmacenStock) => {
    if (alm.capacidad_kg == null || alm.capacidad_kg <= 0) return null
    const pct = alm.porcentaje_ocupacion ?? 0
    if (pct >= 100) return { cls: 'badge-red', label: '🔴 LLENO' }
    if (pct >= 80) return { cls: 'badge-amber', label: '🟡 Casi lleno' }
    if (pct >= 50) return { cls: 'badge-blue', label: '🔵 Medio' }
    return { cls: 'badge-green', label: '🟢 Disponible' }
  }

  const getBarColor = (pct: number) => {
    if (pct >= 95) return 'var(--red)'
    if (pct >= 80) return 'var(--amber)'
    if (pct >= 50) return 'var(--blue)'
    return 'var(--green)'
  }

  // Totales
  const totalStock = almacenes.reduce((s, a) => s + (a.stock_actual ?? 0), 0)
  const totalCapacidad = almacenes.reduce((s, a) => s + (a.capacidad_kg ?? 0), 0)
  const almacenesLlenos = almacenes.filter(a => (a.porcentaje_ocupacion ?? 0) >= 100).length

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-icon">🏭</div>
          <div>
            <h2>Almacenes</h2>
            <p className="page-subtitle">Bodegas y puntos de almacenamiento de café</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Nuevo</button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {error}</div>}

      {/* Stats resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { icon: '🏭', label: 'Almacenes', val: almacenes.length, color: 'var(--primary)' },
          { icon: '⚖️', label: 'Stock total', val: `${totalStock.toLocaleString('es-CO')} kg`, color: 'var(--blue)' },
          { icon: '📦', label: 'Capacidad', val: totalCapacidad > 0 ? `${totalCapacidad.toLocaleString('es-CO')} kg` : '—', color: 'var(--green)' },
          { icon: '🔴', label: 'Llenos', val: almacenesLlenos, color: almacenesLlenos > 0 ? 'var(--red)' : 'var(--text-dim)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-lg)', padding: '0.8rem 1rem' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '180px', maxWidth: '360px' }}>
            <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: '0.85rem', pointerEvents: 'none' }}>🔍</span>
            <input type="text" placeholder="Buscar almacén o ubicación…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              style={{ width: '100%', height: '36px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0 0.9rem 0 2.2rem', color: 'var(--text)', fontSize: '0.84rem', fontFamily: 'var(--font-body)', outline: 'none' }} />
          </div>

          {/* Quick occupation filter (always visible) */}
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {([
              { v: '',           lbl: 'Todos' },
              { v: 'disponible', lbl: '🟢 Espacio' },
              { v: 'casi_lleno', lbl: '🟡 Casi lleno' },
              { v: 'lleno',      lbl: '🔴 Lleno' },
              { v: 'sin_limite', lbl: '∞ Sin límite' },
            ] as const).map(o => (
              <button key={o.v}
                onClick={() => { setFiltroEstado(o.v); setPage(1) }}
                style={{ height: '36px', padding: '0 0.65rem', borderRadius: 'var(--r-md)', border: filtroEstado === o.v ? '1px solid var(--primary)' : '1px solid var(--border)', background: filtroEstado === o.v ? 'rgba(196,122,44,0.12)' : 'var(--bg-input)', color: filtroEstado === o.v ? 'var(--primary)' : 'var(--text-soft)', fontSize: '0.78rem', fontFamily: 'var(--font-body)', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: filtroEstado === o.v ? 600 : 400 }}>
                {o.lbl}
              </button>
            ))}
          </div>

          {/* More filters button */}
          <button
            onClick={() => setPanelOpen(v => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', height: '36px', padding: '0 0.9rem', borderRadius: 'var(--r-md)', border: (panelOpen || capacidadMin || capacidadMax) ? '1px solid var(--primary)' : '1px solid var(--border)', background: (panelOpen || capacidadMin || capacidadMax) ? 'rgba(196,122,44,0.12)' : 'var(--bg-input)', color: (panelOpen || capacidadMin || capacidadMax) ? 'var(--primary)' : 'var(--text-soft)', fontSize: '0.82rem', fontFamily: 'var(--font-body)', cursor: 'pointer', fontWeight: (capacidadMin || capacidadMax) ? 600 : 400 }}>
            🎯 Filtros
            {(capacidadMin || capacidadMax) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '18px', height: '18px', borderRadius: '99px', background: 'var(--primary)', color: '#fff', fontSize: '0.65rem', fontWeight: 700 }}>1</span>
            )}
            <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{panelOpen ? '▲' : '▼'}</span>
          </button>

          {(search || filtroEstado || capacidadMin || capacidadMax) && (
            <button onClick={() => { setSearch(''); setFiltroEstado(''); setCapacidadMin(''); setCapacidadMax(''); setPage(1) }}
              style={{ height: '36px', padding: '0 0.8rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
              ✕ Limpiar
            </button>
          )}

          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 500, marginLeft: 'auto' }}>
            {filtered.length}{filtered.length !== almacenes.length && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> de {almacenes.length}</span>} almacenes
          </span>
        </div>

        {panelOpen && (
          <div style={{ marginTop: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Capacidad máx. (kg)</label>
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <input type="number" placeholder="Mín" value={capacidadMin} onChange={e => { setCapacidadMin(e.target.value); setPage(1) }}
                  style={{ flex: 1, height: '36px', background: (capacidadMin || capacidadMax) ? 'rgba(196,122,44,0.08)' : 'var(--bg-input)', border: (capacidadMin || capacidadMax) ? '1px solid var(--primary)' : '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '0.78rem', fontFamily: 'var(--font-body)', padding: '0 0.4rem', outline: 'none' }} />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>–</span>
                <input type="number" placeholder="Máx" value={capacidadMax} onChange={e => { setCapacidadMax(e.target.value); setPage(1) }}
                  style={{ flex: 1, height: '36px', background: (capacidadMin || capacidadMax) ? 'rgba(196,122,44,0.08)' : 'var(--bg-input)', border: (capacidadMin || capacidadMax) ? '1px solid var(--primary)' : '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '0.78rem', fontFamily: 'var(--font-body)', padding: '0 0.4rem', outline: 'none' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏭</div>
          <p>No hay almacenes{search ? ' que coincidan' : ''}.</p>
          {!search && <small>Haz clic en &quot;+ Nuevo&quot; para agregar el primero.</small>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {paged.map(alm => {
            const badge = getStatusBadge(alm)
            const pct = alm.porcentaje_ocupacion ?? 0
            return (
              <div key={alm.idalmacen} style={{
                background: 'var(--bg-card)',
                border: `1px solid ${pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--amber)' : 'var(--border-soft)'}`,
                borderRadius: 'var(--r-xl)',
                padding: '1.25rem',
                transition: 'border-color 0.3s',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>🏭 {alm.nombre}</div>
                    {alm.ubicacion && <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>📍 {alm.ubicacion}</div>}
                  </div>
                  {badge && <span className={`badge ${badge.cls}`} style={{ flexShrink: 0 }}>{badge.label}</span>}
                </div>

                {/* Stock info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.75rem' }}>
                  <div style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: '0.4rem 0.6rem' }}>
                    <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Stock actual</div>
                    <div style={{ fontSize: '1rem', color: 'var(--primary)', fontWeight: 700 }}>{alm.stock_actual.toLocaleString('es-CO')} kg</div>
                  </div>
                  <div style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: '0.4rem 0.6rem' }}>
                    <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Capacidad</div>
                    <div style={{ fontSize: '1rem', color: 'var(--text-soft)', fontWeight: 700 }}>{alm.capacidad_kg ? `${alm.capacidad_kg.toLocaleString('es-CO')} kg` : 'Sin límite'}</div>
                  </div>
                </div>

                {/* Progress bar */}
                {alm.capacidad_kg != null && alm.capacidad_kg > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>
                      <span>{pct}% ocupado</span>
                      <span>{(alm.espacio_disponible ?? 0).toLocaleString('es-CO')} kg libres</span>
                    </div>
                    <div style={{ background: 'var(--bg)', borderRadius: '99px', height: 10, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, pct)}%`,
                        background: getBarColor(pct),
                        borderRadius: '99px',
                        transition: 'width 0.6s ease, background 0.3s',
                      }} />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => verContenido(alm)}>
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

      {/* Paginación */}
      {!loading && pageCount > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {(page - 1) * PAGE_SIZE_A + 1}–{Math.min(page * PAGE_SIZE_A, filtered.length)} de {filtered.length} almacenes
          </span>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Ant</button>
            {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => Math.max(1, Math.min(pageCount - 4, page - 2)) + i).map(p => (
              <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button className="btn btn-ghost btn-sm" disabled={page === pageCount} onClick={() => setPage(p => p + 1)}>Sig ›</button>
          </div>
        </div>
      )}

      {/* Modal contenido del almacén */}
      <Modal
        isOpen={!!detalleAlmacen}
        onClose={() => setDetalleAlmacen(null)}
        title={`📦 Contenido — ${detalleAlmacen?.nombre ?? ''}`}
        footer={<button className="btn btn-secondary" onClick={() => setDetalleAlmacen(null)}>Cerrar</button>}
      >
        {detalleAlmacen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Resumen */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: '0.5rem 0.7rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontWeight: 700 }}>STOCK</div>
                <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>{detalleAlmacen.stock_actual.toLocaleString('es-CO')} kg</div>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: '0.5rem 0.7rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontWeight: 700 }}>CAPACIDAD</div>
                <div style={{ fontWeight: 700, color: 'var(--text-soft)', fontSize: '1.1rem' }}>{detalleAlmacen.capacidad_kg ? `${detalleAlmacen.capacidad_kg.toLocaleString('es-CO')} kg` : '∞'}</div>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: '0.5rem 0.7rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontWeight: 700 }}>LOTES</div>
                <div style={{ fontWeight: 700, color: 'var(--blue)', fontSize: '1.1rem' }}>{contenido.length}</div>
              </div>
            </div>

            {/* Lotes dentro */}
            {loadingContenido ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-dim)' }}>Cargando contenido…</div>
            ) : contenido.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-dim)', background: 'var(--bg)', borderRadius: 'var(--r-lg)' }}>
                📭 Este almacén está vacío
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-soft)' }}>Lotes almacenados:</div>
                {contenido.map(c => (
                  <div key={c.idlote_cafe} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--bg)', borderRadius: 'var(--r-md)', padding: '0.6rem 0.8rem',
                  }}>
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>☕ {c.variedad}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>Lote #{c.idlote_cafe}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{c.kg_en_almacen.toLocaleString('es-CO')} kg</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal Crear/Editar */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editRecord ? 'Editar Almacén' : 'Nuevo Almacén'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Guardando…' : editRecord ? 'Guardar cambios' : 'Crear almacén'}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {formError}</div>}
        <div className="form-grid-2">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Nombre <span className="form-required">*</span></label>
            <input className="form-input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Bodega Central" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Ubicación</label>
            <input className="form-input" value={form.ubicacion} onChange={e => setForm(p => ({ ...p, ubicacion: e.target.value }))} placeholder="Ej: Km 5 vía Bogotá" />
          </div>
          <div className="form-group">
            <label className="form-label">Capacidad máxima (kg)</label>
            <input className="form-input" type="number" value={form.capacidad_kg} onChange={e => setForm(p => ({ ...p, capacidad_kg: e.target.value }))} placeholder="Ej: 10000" step="0.01" min="0" />
            <p className="form-hint">💡 Si se define, el sistema bloqueará movimientos que superen esta capacidad.</p>
          </div>
        </div>
      </Modal>

      {/* Modal Eliminar */}
      <Modal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Confirmar eliminación"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteId(null)} disabled={deleting}>Cancelar</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
          </>
        }
      >
        <p style={{ color: 'var(--text-soft)', fontSize: '0.92rem', lineHeight: 1.6 }}>
          ¿Estás seguro de que deseas eliminar este almacén? Esta acción no se puede deshacer.
        </p>
      </Modal>
    </div>
  )
}
