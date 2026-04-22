'use client'
import { useState, useMemo } from 'react'
import { useCrud, useRead } from '../../hooks/useCrud'
import Modal from '../Modal'

interface RegistroProceso {
  idregistro_proceso: number
  idlote_cafe: number
  idproceso: number
  idusuario: number | null
  fecha_inicio: string
  fecha_fin: string | null
  notas: string | null
  calificacion: number | null
  lote_cafe: { variedad: string; finca: { nombre: string } | null } | null
  proceso: { nombre: string } | null
  usuario: { nombre: string } | null
}

const PAGE_SIZE = 15

const filterBtnStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
  height: '36px', padding: '0 0.9rem', borderRadius: 'var(--r-md)',
  border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
  background: active ? 'rgba(196,122,44,0.12)' : 'var(--bg-input)',
  color: active ? 'var(--primary)' : 'var(--text-soft)',
  fontSize: '0.82rem', fontFamily: 'var(--font-body)', cursor: 'pointer',
  whiteSpace: 'nowrap', fontWeight: active ? 600 : 400,
})

export default function Registros() {
  const { data, loading, error, insert, update, remove } = useCrud(
    'registro_proceso', 'idregistro_proceso',
    '*, lote_cafe(variedad, finca(nombre)), proceso(nombre), usuario(nombre)',
    'fecha_inicio'
  )
  const { data: lotes }    = useRead('lote_cafe', 'idlote_cafe, variedad', 'variedad')
  const { data: procesos } = useRead('proceso',   'idproceso, nombre',     'nombre')
  const { data: usuarios } = useRead('usuario',   'idusuario, nombre',     'nombre')

  // Filters
  const [search,        setSearch]        = useState('')
  const [filtroProceso, setFiltroProceso] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [filtroDesde,   setFiltroDesde]   = useState('')
  const [filtroHasta,   setFiltroHasta]   = useState('')
  const [filtroCal,     setFiltroCal]     = useState('')
  const [sortDir,       setSortDir]       = useState<'asc' | 'desc'>('desc')
  const [page,          setPage]          = useState(1)
  const [panelOpen,     setPanelOpen]     = useState(false)

  // Modal
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editRecord, setEditRecord] = useState<RegistroProceso | null>(null)
  const [viewRecord, setViewRecord] = useState<RegistroProceso | null>(null)
  const [form,       setForm]       = useState<Record<string, any>>({})
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState<string | null>(null)
  const [deleteId,   setDeleteId]   = useState<number | null>(null)
  const [deleting,   setDeleting]   = useState(false)

  const rows = data as RegistroProceso[]

  const activeFilters = [filtroProceso, filtroUsuario, filtroDesde || filtroHasta, filtroCal].filter(Boolean).length
  const hasActiveFilter = !!(search || activeFilters)

  const clearAll = () => {
    setSearch(''); setFiltroProceso(''); setFiltroUsuario('')
    setFiltroDesde(''); setFiltroHasta(''); setFiltroCal(''); setPage(1)
  }

  const filtered = useMemo(() => {
    let r = rows
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(x =>
        x.lote_cafe?.variedad?.toLowerCase().includes(q) ||
        x.lote_cafe?.finca?.nombre?.toLowerCase().includes(q) ||
        x.proceso?.nombre?.toLowerCase().includes(q) ||
        x.usuario?.nombre?.toLowerCase().includes(q) ||
        (x.notas ?? '').toLowerCase().includes(q)
      )
    }
    if (filtroProceso) r = r.filter(x => x.idproceso === Number(filtroProceso))
    if (filtroUsuario) r = r.filter(x => x.idusuario === Number(filtroUsuario))
    if (filtroDesde)   r = r.filter(x => x.fecha_inicio >= filtroDesde)
    if (filtroHasta)   r = r.filter(x => x.fecha_inicio <= filtroHasta + 'T23:59:59')
    if (filtroCal === 'alta')  r = r.filter(x => x.calificacion != null && Number(x.calificacion) >= 8.5)
    if (filtroCal === 'media') r = r.filter(x => x.calificacion != null && Number(x.calificacion) >= 6 && Number(x.calificacion) < 8.5)
    if (filtroCal === 'baja')  r = r.filter(x => x.calificacion != null && Number(x.calificacion) < 6)
    if (filtroCal === 'sin')   r = r.filter(x => x.calificacion == null)
    return [...r].sort((a, b) => {
      const d = new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime()
      return sortDir === 'asc' ? d : -d
    })
  }, [rows, search, filtroProceso, filtroUsuario, filtroDesde, filtroHasta, filtroCal, sortDir])

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const openCreate = () => {
    setForm({ fecha_inicio: new Date().toISOString().slice(0, 16) })
    setEditRecord(null); setFormError(null); setModalOpen(true)
  }
  const openEdit = (r: RegistroProceso) => {
    setForm({
      idlote_cafe: r.idlote_cafe, idproceso: r.idproceso,
      idusuario: r.idusuario ?? '', fecha_inicio: r.fecha_inicio?.slice(0, 16) ?? '',
      fecha_fin: r.fecha_fin?.slice(0, 16) ?? '', notas: r.notas ?? '',
      calificacion: r.calificacion ?? '',
    })
    setEditRecord(r); setFormError(null); setModalOpen(true)
  }
  const saveForm = async () => {
    if (!form.idlote_cafe || !form.idproceso || !form.fecha_inicio) {
      setFormError('Lote, proceso y fecha de inicio son obligatorios.'); return
    }
    setSaving(true); setFormError(null)
    const payload = {
      idlote_cafe: Number(form.idlote_cafe), idproceso: Number(form.idproceso),
      idusuario: form.idusuario ? Number(form.idusuario) : null,
      fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin || null,
      notas: form.notas || null,
      calificacion: form.calificacion !== '' && form.calificacion != null ? Number(form.calificacion) : null,
    }
    try {
      if (editRecord) await update(editRecord.idregistro_proceso, payload)
      else await insert(payload)
      setModalOpen(false)
    } catch (e: any) { setFormError(e.message) }
    setSaving(false)
  }
  const confirmDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try { await remove(deleteId) } catch {}
    setDeleting(false); setDeleteId(null)
  }

  const estrellas = (cal: number | null) => {
    if (cal == null) return <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
    const v = Number(cal)
    const color = v >= 9 ? 'var(--green)' : v >= 7 ? 'var(--amber)' : v >= 5 ? 'var(--primary)' : 'var(--red,#f87171)'
    return <span style={{ fontWeight: 700, color, fontSize: '0.9rem' }}>{v.toFixed(1)}<span style={{ fontSize: '0.65rem', marginLeft: '0.2rem', opacity: 0.7 }}>/10</span></span>
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-icon">📋</div>
          <div>
            <h2>Registros de Proceso</h2>
            <p className="page-subtitle">Seguimiento del beneficio por lote</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Nuevo</button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {error}</div>}

      {/* Toolbar */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: '180px', maxWidth: '360px' }}>
            <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: '0.85rem', pointerEvents: 'none' }}>🔍</span>
            <input type="text" placeholder="Buscar lote, proceso, responsable, notas…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              style={{ width: '100%', height: '36px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0 0.9rem 0 2.2rem', color: 'var(--text)', fontSize: '0.84rem', fontFamily: 'var(--font-body)', outline: 'none' }} />
          </div>

          {/* Filter toggle */}
          <button style={filterBtnStyle(panelOpen || activeFilters > 0)} onClick={() => setPanelOpen(v => !v)}>
            🎯 Filtros
            {activeFilters > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '18px', height: '18px', borderRadius: '99px', background: 'var(--primary)', color: '#fff', fontSize: '0.65rem', fontWeight: 700 }}>
                {activeFilters}
              </span>
            )}
            <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{panelOpen ? '▲' : '▼'}</span>
          </button>

          {/* Sort */}
          <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            style={{ height: '36px', padding: '0 0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-soft)', fontSize: '0.8rem', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
            {sortDir === 'desc' ? '↓ Reciente' : '↑ Antiguo'}
          </button>

          {hasActiveFilter && (
            <button onClick={clearAll}
              style={{ height: '36px', padding: '0 0.8rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
              ✕ Limpiar
            </button>
          )}

          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 500, marginLeft: 'auto' }}>
            {filtered.length}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/{rows.length}</span>
          </span>
        </div>

        {/* Filter panel */}
        {panelOpen && (
          <div style={{ marginTop: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
            {/* Proceso */}
            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Proceso</label>
              <select value={filtroProceso} onChange={e => { setFiltroProceso(e.target.value); setPage(1) }}
                style={{ width: '100%', height: '36px', background: filtroProceso ? 'rgba(196,122,44,0.08)' : 'var(--bg-input)', border: filtroProceso ? '1px solid var(--primary)' : '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '0.82rem', fontFamily: 'var(--font-body)', padding: '0 0.5rem', outline: 'none', cursor: 'pointer' }}>
                <option value="">— Todos —</option>
                {(procesos as any[]).map((p: any) => <option key={p.idproceso} value={p.idproceso}>{p.nombre}</option>)}
              </select>
            </div>

            {/* Responsable */}
            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Responsable</label>
              <select value={filtroUsuario} onChange={e => { setFiltroUsuario(e.target.value); setPage(1) }}
                style={{ width: '100%', height: '36px', background: filtroUsuario ? 'rgba(196,122,44,0.08)' : 'var(--bg-input)', border: filtroUsuario ? '1px solid var(--primary)' : '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '0.82rem', fontFamily: 'var(--font-body)', padding: '0 0.5rem', outline: 'none', cursor: 'pointer' }}>
                <option value="">— Todos —</option>
                {(usuarios as any[]).map((u: any) => <option key={u.idusuario} value={u.idusuario}>{u.nombre}</option>)}
              </select>
            </div>

            {/* Calificación */}
            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Calificación</label>
              <select value={filtroCal} onChange={e => { setFiltroCal(e.target.value); setPage(1) }}
                style={{ width: '100%', height: '36px', background: filtroCal ? 'rgba(196,122,44,0.08)' : 'var(--bg-input)', border: filtroCal ? '1px solid var(--primary)' : '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '0.82rem', fontFamily: 'var(--font-body)', padding: '0 0.5rem', outline: 'none', cursor: 'pointer' }}>
                <option value="">— Todas —</option>
                <option value="alta">🟢 Alta (≥ 8.5)</option>
                <option value="media">🟡 Media (6–8.4)</option>
                <option value="baja">🔴 Baja (&lt; 6)</option>
                <option value="sin">⏳ Sin calificar</option>
              </select>
            </div>

            {/* Fechas */}
            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>📅 Fecha inicio</label>
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <input type="date" value={filtroDesde} onChange={e => { setFiltroDesde(e.target.value); setPage(1) }}
                  style={{ flex: 1, height: '36px', background: (filtroDesde || filtroHasta) ? 'rgba(196,122,44,0.08)' : 'var(--bg-input)', border: (filtroDesde || filtroHasta) ? '1px solid var(--primary)' : '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '0.78rem', fontFamily: 'var(--font-body)', padding: '0 0.4rem', outline: 'none' }} />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>–</span>
                <input type="date" value={filtroHasta} onChange={e => { setFiltroHasta(e.target.value); setPage(1) }}
                  style={{ flex: 1, height: '36px', background: (filtroDesde || filtroHasta) ? 'rgba(196,122,44,0.08)' : 'var(--bg-input)', border: (filtroDesde || filtroHasta) ? '1px solid var(--primary)' : '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '0.78rem', fontFamily: 'var(--font-body)', padding: '0 0.4rem', outline: 'none' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>No hay registros{hasActiveFilter ? ' que coincidan' : ''}.</p>
          {hasActiveFilter && <button className="btn btn-ghost btn-sm" onClick={clearAll} style={{ marginTop: '0.5rem' }}>✕ Limpiar filtros</button>}
        </div>
      ) : (
        <>
          <div className="data-table-wrap table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Lote</th><th>Proceso</th><th>Inicio</th><th>Fin</th>
                  <th>Responsable</th><th>Calificación</th><th>Notas</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(r => (
                  <tr key={r.idregistro_proceso}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{r.idregistro_proceso}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{r.lote_cafe?.variedad ?? '—'}</div>
                      {r.lote_cafe?.finca && <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{r.lote_cafe.finca.nombre}</div>}
                    </td>
                    <td><span className="badge badge-amber" style={{ fontSize: '0.72rem' }}>{r.proceso?.nombre ?? '—'}</span></td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-soft)' }}>{r.fecha_inicio ? new Date(r.fecha_inicio).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td style={{ fontSize: '0.8rem', color: r.fecha_fin ? 'var(--text-soft)' : 'var(--amber)' }}>{r.fecha_fin ? new Date(r.fecha_fin).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : 'En curso'}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-soft)' }}>{r.usuario ? `👤 ${r.usuario.nombre}` : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ textAlign: 'center' }}>{estrellas(r.calificacion)}</td>
                    <td style={{ maxWidth: 200, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      {r.notas ? (
                        <span title={r.notas} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden', lineHeight: 1.4 }}>
                          {r.notas}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <div className="actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => setViewRecord(r)}>👁</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>✏</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(r.idregistro_proceso)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)} de {filtered.length}</span>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button className="btn btn-ghost btn-sm" disabled={page===1} onClick={() => setPage(p => p-1)}>‹ Ant</button>
                {Array.from({length: Math.min(pageCount,5)}, (_,i) => Math.max(1,Math.min(pageCount-4,page-2))+i).map(p => (
                  <button key={p} className={`btn btn-sm ${p===page?'btn-primary':'btn-ghost'}`} onClick={() => setPage(p)}>{p}</button>
                ))}
                <button className="btn btn-ghost btn-sm" disabled={page===pageCount} onClick={() => setPage(p => p+1)}>Sig ›</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* View modal */}
      {viewRecord && (
        <div className="modal-overlay" onClick={() => setViewRecord(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title">📋 Registro #{viewRecord.idregistro_proceso}</h3>
              <button className="modal-close" onClick={() => setViewRecord(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {[
                  { label: 'Lote',        val: viewRecord.lote_cafe?.variedad ?? '—' },
                  { label: 'Finca',       val: viewRecord.lote_cafe?.finca?.nombre ?? '—' },
                  { label: 'Proceso',     val: viewRecord.proceso?.nombre ?? '—' },
                  { label: 'Responsable', val: viewRecord.usuario?.nombre ?? '—' },
                  { label: 'Inicio',      val: viewRecord.fecha_inicio ? new Date(viewRecord.fecha_inicio).toLocaleDateString('es-CO', { dateStyle: 'long' }) : '—' },
                  { label: 'Fin',         val: viewRecord.fecha_fin ? new Date(viewRecord.fecha_fin).toLocaleDateString('es-CO', { dateStyle: 'long' }) : 'En curso' },
                ].map(item => (
                  <div key={item.label} style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: '0.45rem 0.65rem' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>{item.label}</div>
                    <div style={{ fontSize: '0.86rem', color: 'var(--text-soft)', fontWeight: 600, marginTop: '0.1rem' }}>{item.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--r-lg)', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Calificación de cata</div>
                  {viewRecord.usuario && <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>por {viewRecord.usuario.nombre}</div>}
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: viewRecord.calificacion != null ? (Number(viewRecord.calificacion) >= 8.5 ? 'var(--green)' : Number(viewRecord.calificacion) >= 6 ? 'var(--amber)' : 'var(--red,#f87171)') : 'var(--text-muted)' }}>
                  {viewRecord.calificacion != null ? `${Number(viewRecord.calificacion).toFixed(1)}/10` : '—'}
                </div>
              </div>
              {viewRecord.notas && (
                <div style={{ background: 'var(--bg)', borderRadius: 'var(--r-lg)', padding: '0.75rem 1rem' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Notas del proceso</div>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-soft)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{viewRecord.notas}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewRecord(null)}>Cerrar</button>
              <button className="btn btn-primary" onClick={() => { setViewRecord(null); openEdit(viewRecord) }}>✏ Editar</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3 className="modal-title">{editRecord ? 'Editar Registro' : 'Nuevo Registro de Proceso'}</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              {formError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {formError}</div>}
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Lote de café <span className="form-required">*</span></label>
                  <select className="form-select" value={form.idlote_cafe ?? ''} onChange={e => setForm(p => ({ ...p, idlote_cafe: e.target.value }))}>
                    <option value="">— Seleccionar —</option>
                    {(lotes as any[]).map((l: any) => <option key={l.idlote_cafe} value={l.idlote_cafe}>{l.variedad}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Proceso aplicado <span className="form-required">*</span></label>
                  <select className="form-select" value={form.idproceso ?? ''} onChange={e => setForm(p => ({ ...p, idproceso: e.target.value }))}>
                    <option value="">— Seleccionar —</option>
                    {(procesos as any[]).map((p: any) => <option key={p.idproceso} value={p.idproceso}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Responsable / Catador</label>
                  <select className="form-select" value={form.idusuario ?? ''} onChange={e => setForm(p => ({ ...p, idusuario: e.target.value }))}>
                    <option value="">— Sin asignar —</option>
                    {(usuarios as any[]).map((u: any) => <option key={u.idusuario} value={u.idusuario}>{u.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Calificación (0–10)</label>
                  <input className="form-input" type="number" min="0" max="10" step="0.1" placeholder="Ej: 8.5"
                    value={form.calificacion ?? ''} onChange={e => setForm(p => ({ ...p, calificacion: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de inicio <span className="form-required">*</span></label>
                  <input className="form-input" type="datetime-local" value={form.fecha_inicio ?? ''} onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de finalización</label>
                  <input className="form-input" type="datetime-local" value={form.fecha_fin ?? ''} onChange={e => setForm(p => ({ ...p, fecha_fin: e.target.value }))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Notas</label>
                  <textarea className="form-textarea" rows={5} placeholder="Temperatura, pH, condiciones climáticas, observaciones detalladas…"
                    value={form.notas ?? ''} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                    style={{ minHeight: '120px', resize: 'vertical' }} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveForm} disabled={saving}>{saving ? 'Guardando…' : editRecord ? 'Guardar cambios' : 'Crear registro'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header"><h3 className="modal-title">⚠ Confirmar eliminación</h3></div>
            <div className="modal-body"><p>¿Estás seguro? Esta acción no se puede deshacer.</p></div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)} disabled={deleting}>Cancelar</button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Eliminando…' : 'Sí, eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
