'use client'
import { useState, useMemo } from 'react'
import { useCrud, useRead } from '../../../hooks/useCrud'

const PAGE_SIZE_LOTES = 6

const btnStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
  height: 38, padding: '0 1rem', borderRadius: 'var(--r-md)',
  border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
  background: active ? 'rgba(196,122,44,0.12)' : 'var(--bg-input)',
  color: active ? 'var(--primary)' : 'var(--text-soft)',
  fontSize: '0.84rem', fontFamily: 'var(--font-body)', cursor: 'pointer', fontWeight: active ? 600 : 400,
})

const labelStyle: React.CSSProperties = {
  fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--text-muted)',
}

const calColor = (v: number) =>
  v >= 8.5 ? 'var(--green)' : v >= 6 ? 'var(--amber)' : 'var(--red,#f87171)'

export default function RegistrosPage() {
  const { data, loading, error, insert, update, remove } = useCrud(
    'registro_proceso', 'idregistro_proceso',
    'idregistro_proceso, fecha_inicio, fecha_fin, notas, calificacion, idproceso, idlote_cafe, lote_cafe:idlote_cafe(variedad), proceso:idproceso(nombre)',
    'fecha_inicio'
  )
  const { data: procesos } = useRead('proceso',   'idproceso, nombre',    'nombre')
  const { data: lotes }    = useRead('lote_cafe', 'idlote_cafe, variedad', 'variedad')

  const [search,    setSearch]    = useState('')
  const [fProceso,  setFProceso]  = useState('')
  const [fDesde,    setFDesde]    = useState('')
  const [fHasta,    setFHasta]    = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [lotePage,  setLotePage]  = useState(1)
  const [expanded,  setExpanded]  = useState<number | null>(null)
  const [collapsedLotes, setCollapsedLotes] = useState<Set<number>>(new Set())

  const [editModal, setEditModal] = useState(false)
  const [editRec,   setEditRec]   = useState<any>(null)
  const [form,      setForm]      = useState<Record<string, any>>({})
  const [saving,    setSaving]    = useState(false)
  const [formErr,   setFormErr]   = useState<string | null>(null)
  const [deleteId,  setDeleteId]  = useState<any>(null)
  const [deleting,  setDeleting]  = useState(false)

  const rows = data as any[]
  const activeFilters = [fProceso, fDesde || fHasta].filter(Boolean).length
  const hasActive = !!(search || activeFilters)
  const clearAll = () => { setSearch(''); setFProceso(''); setFDesde(''); setFHasta(''); setLotePage(1) }

  const filtered = useMemo(() => {
    let r = rows
    if (search) {
      const q = search.toLowerCase()
      r = r.filter((x: any) =>
        (x.lote_cafe?.variedad ?? '').toLowerCase().includes(q) ||
        (x.proceso?.nombre ?? '').toLowerCase().includes(q) ||
        (x.notas ?? '').toLowerCase().includes(q)
      )
    }
    if (fProceso) r = r.filter((x: any) => String(x.idproceso) === fProceso)
    if (fDesde)   r = r.filter((x: any) => x.fecha_inicio >= fDesde)
    if (fHasta)   r = r.filter((x: any) => x.fecha_inicio <= fHasta + 'T23:59:59')
    return r
  }, [rows, search, fProceso, fDesde, fHasta])

  // Group by lote
  const grouped = useMemo(() => {
    const map = new Map<number, { variedad: string; registros: any[] }>()
    filtered.forEach((r: any) => {
      const id = r.idlote_cafe
      if (!map.has(id)) map.set(id, { variedad: r.lote_cafe?.variedad ?? `Lote #${id}`, registros: [] })
      map.get(id)!.registros.push(r)
    })
    // Sort each group by date desc
    map.forEach(g => g.registros.sort((a, b) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime()))
    // Return sorted by most recent entry
    return Array.from(map.entries())
      .sort((a, b) => new Date(b[1].registros[0].fecha_inicio).getTime() - new Date(a[1].registros[0].fecha_inicio).getTime())
  }, [filtered])

  const lotePageCount = Math.ceil(grouped.length / PAGE_SIZE_LOTES)
  const pagedGroups = grouped.slice((lotePage - 1) * PAGE_SIZE_LOTES, lotePage * PAGE_SIZE_LOTES)

  const fmtDate = (v: string | null) =>
    v ? new Date(v).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  const avgCal = (registros: any[]) => {
    const vals = registros.filter(r => r.calificacion != null).map(r => Number(r.calificacion))
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }

  const toggleLote = (id: number) => {
    setCollapsedLotes(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const openCreate = () => {
    setForm({ fecha_inicio: new Date().toISOString().slice(0, 16) })
    setEditRec(null); setFormErr(null); setEditModal(true)
  }
  const openEdit = (r: any) => {
    setForm({ idlote_cafe: r.idlote_cafe, idproceso: r.idproceso, calificacion: r.calificacion ?? '', fecha_inicio: r.fecha_inicio?.slice(0, 16) ?? '', fecha_fin: r.fecha_fin?.slice(0, 16) ?? '', notas: r.notas ?? '' })
    setEditRec(r); setFormErr(null); setEditModal(true)
  }
  const handleSave = async () => {
    if (!form.idlote_cafe || !form.idproceso || !form.fecha_inicio) { setFormErr('Lote, proceso y fecha son obligatorios.'); return }
    setSaving(true); setFormErr(null)
    const payload = { idlote_cafe: Number(form.idlote_cafe), idproceso: Number(form.idproceso), calificacion: form.calificacion !== '' ? Number(form.calificacion) : null, fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin || null, notas: form.notas || null }
    try { if (editRec) await update(editRec.idregistro_proceso, payload); else await insert(payload); setEditModal(false) }
    catch (e: any) { setFormErr(e.message) }
    setSaving(false)
  }
  const handleDelete = async () => {
    setDeleting(true); try { await remove(deleteId) } catch {}
    setDeleting(false); setDeleteId(null)
  }

  const totalReseñas = rows.filter((r: any) => r.notas).length
  const totalCal = rows.filter((r: any) => r.calificacion != null).length

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-icon">📋</div>
          <div><h2>Registros de Proceso</h2><p className="page-subtitle">Seguimiento del beneficio por lote</p></div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button style={btnStyle(panelOpen || activeFilters > 0)} onClick={() => setPanelOpen(v => !v)}>
            🎯 Filtros
            {activeFilters > 0 && <span style={{ minWidth: 20, height: 20, borderRadius: 99, background: 'var(--primary)', color: '#fff', fontSize: '0.65rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilters}</span>}
            <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>{panelOpen ? '▲' : '▼'}</span>
          </button>
          <button className="btn btn-primary" onClick={openCreate}>+ Nuevo</button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {error}</div>}

      {/* Stats */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { icon: '📋', label: 'Registros',    val: rows.length,   color: 'var(--primary)' },
          { icon: '📝', label: 'Con reseña',   val: totalReseñas,  color: 'var(--blue)' },
          { icon: '⭐', label: 'Calificados',  val: totalCal,      color: 'var(--green)' },
          { icon: '☕', label: 'Lotes únicos', val: grouped.length, color: 'var(--amber)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-lg)', padding: '0.6rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem' }}>{s.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: s.color, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + clear */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 400 }}>
          <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none' }}>🔍</span>
          <input type="text" placeholder="Buscar lote, proceso o reseña…" value={search} onChange={e => { setSearch(e.target.value); setLotePage(1) }}
            style={{ width: '100%', height: 36, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0 0.9rem 0 2.1rem', color: 'var(--text)', fontSize: '0.84rem', fontFamily: 'var(--font-body)', outline: 'none' }} />
        </div>
        {hasActive && <button onClick={clearAll} style={{ height: 36, padding: '0 0.8rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>✕ Limpiar</button>}
        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 500, marginLeft: 'auto' }}>
          {grouped.length} lote{grouped.length !== 1 ? 's' : ''} · {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Filter panel */}
      {panelOpen && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={labelStyle}>Proceso</label>
              <select value={fProceso} onChange={e => { setFProceso(e.target.value); setLotePage(1) }}
                style={{ height: 38, minWidth: 160, background: fProceso ? 'rgba(196,122,44,0.08)' : 'var(--bg-input)', border: fProceso ? '1px solid var(--primary)' : '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '0.84rem', fontFamily: 'var(--font-body)', padding: '0 0.6rem', outline: 'none', cursor: 'pointer' }}>
                <option value="">— Todos —</option>
                {(procesos as any[]).map((p: any) => <option key={p.idproceso} value={p.idproceso}>{p.nombre}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={labelStyle}>Tipo de reseña</label>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {(['todos', 'catador'] as const).map(t => (
                  <button key={t} style={{ height: 38, padding: '0 0.85rem', borderRadius: 'var(--r-md)', border: t === 'catador' ? '1px solid var(--primary)' : '1px solid var(--border)', background: t === 'catador' ? 'rgba(196,122,44,0.12)' : 'var(--bg-input)', color: t === 'catador' ? 'var(--primary)' : 'var(--text-soft)', fontSize: '0.8rem', fontFamily: 'var(--font-body)', cursor: 'default', fontWeight: 400 }}>
                    {t === 'todos' ? 'Todos' : '🎯 Catador'}
                  </button>
                ))}
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', alignSelf: 'center', marginLeft: '0.25rem' }}>Reseñas de clientes → ver en Lotes</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={labelStyle}>📅 Fecha inicio</label>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input type="date" value={fDesde} onChange={e => { setFDesde(e.target.value); setLotePage(1) }}
                  style={{ height: 38, width: 140, background: (fDesde || fHasta) ? 'rgba(196,122,44,0.08)' : 'var(--bg-input)', border: (fDesde || fHasta) ? '1px solid var(--primary)' : '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '0.84rem', fontFamily: 'var(--font-body)', padding: '0 0.5rem', outline: 'none' }} />
                <span style={{ color: 'var(--text-muted)' }}>–</span>
                <input type="date" value={fHasta} onChange={e => { setFHasta(e.target.value); setLotePage(1) }}
                  style={{ height: 38, width: 140, background: (fDesde || fHasta) ? 'rgba(196,122,44,0.08)' : 'var(--bg-input)', border: (fDesde || fHasta) ? '1px solid var(--primary)' : '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '0.84rem', fontFamily: 'var(--font-body)', padding: '0 0.5rem', outline: 'none' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : grouped.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>No hay registros{hasActive ? ' que coincidan' : ''}.</p>
          {hasActive && <button className="btn btn-ghost btn-sm" onClick={clearAll} style={{ marginTop: '0.5rem' }}>✕ Limpiar filtros</button>}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pagedGroups.map(([loteId, grupo]) => {
              const avg = avgCal(grupo.registros)
              const conRes = grupo.registros.filter((r: any) => r.notas).length
              const collapsed = collapsedLotes.has(loteId)
              return (
                <div key={loteId} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-xl)', overflow: 'hidden' }}>

                  {/* Lote header — click to collapse */}
                  <div onClick={() => toggleLote(loteId)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.1rem', cursor: 'pointer', borderBottom: collapsed ? 'none' : '1px solid var(--border-soft)', background: 'var(--bg-1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>☕</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>{grupo.variedad}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                          {grupo.registros.length} proceso{grupo.registros.length !== 1 ? 's' : ''}
                          {conRes > 0 && <span style={{ marginLeft: '0.5rem' }}>· 📝 {conRes} reseña{conRes !== 1 ? 's' : ''}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {avg != null && (
                        <div style={{ textAlign: 'center', background: 'var(--bg)', borderRadius: 'var(--r-md)', padding: '0.25rem 0.65rem', border: `1px solid ${calColor(avg)}30` }}>
                          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: calColor(avg), lineHeight: 1 }}>{avg.toFixed(1)}</div>
                          <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>prom.</div>
                        </div>
                      )}
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', opacity: 0.6 }}>{collapsed ? '▼' : '▲'}</span>
                    </div>
                  </div>

                  {/* Registros grid */}
                  {!collapsed && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem', padding: '0.85rem 1rem' }}>
                      {grupo.registros.map((r: any) => {
                        const isExp = expanded === r.idregistro_proceso
                        const cal = r.calificacion != null ? Number(r.calificacion) : null
                        return (
                          <div key={r.idregistro_proceso} style={{ background: 'var(--bg)', borderRadius: 'var(--r-lg)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid var(--border-soft)' }}>

                            {/* Process + score */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 99, background: 'rgba(196,122,44,0.12)', color: 'var(--primary)' }}>🎯 Catador</span>
                                <span className="badge badge-amber" style={{ fontSize: '0.72rem' }}>{r.proceso?.nombre ?? '—'}</span>
                              </div>
                              {cal != null && (
                                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: calColor(cal) }}>
                                  {cal.toFixed(1)}<span style={{ fontSize: '0.6rem', opacity: 0.6 }}>/10</span>
                                </span>
                              )}
                            </div>

                            {/* Dates */}
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                              {fmtDate(r.fecha_inicio)}{r.fecha_fin ? ` → ${fmtDate(r.fecha_fin)}` : <span style={{ color: 'var(--amber)', fontWeight: 600 }}> · En curso</span>}
                            </div>

                            {/* Note */}
                            {r.notas ? (
                              <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--r-md)', padding: '0.5rem 0.65rem', flex: 1 }}>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-soft)', lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', ...(isExp ? {} : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }) }}>
                                  {r.notas}
                                </p>
                                {r.notas.length > 100 && (
                                  <button onClick={() => setExpanded(isExp ? null : r.idregistro_proceso)}
                                    style={{ marginTop: '0.25rem', fontSize: '0.7rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)' }}>
                                    {isExp ? '▲ Menos' : '▼ Ver completo'}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin reseña</div>
                            )}

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '0.4rem', paddingTop: '0.1rem' }}>
                              <button className="btn btn-secondary btn-sm" style={{ flex: 1, fontSize: '0.76rem' }} onClick={() => openEdit(r)}>✏ Editar</button>
                              <button className="btn btn-danger btn-sm" style={{ fontSize: '0.76rem' }} onClick={() => setDeleteId(r.idregistro_proceso)}>🗑</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pagination by lote group */}
          {lotePageCount > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{(lotePage - 1) * PAGE_SIZE_LOTES + 1}–{Math.min(lotePage * PAGE_SIZE_LOTES, grouped.length)} de {grouped.length} lotes</span>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button className="btn btn-ghost btn-sm" disabled={lotePage === 1} onClick={() => setLotePage(p => p - 1)}>‹ Ant</button>
                {Array.from({ length: Math.min(lotePageCount, 5) }, (_, i) => Math.max(1, Math.min(lotePageCount - 4, lotePage - 2)) + i).map(p => (
                  <button key={p} className={`btn btn-sm ${p === lotePage ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setLotePage(p)}>{p}</button>
                ))}
                <button className="btn btn-ghost btn-sm" disabled={lotePage === lotePageCount} onClick={() => setLotePage(p => p + 1)}>Sig ›</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit/Create modal */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title">{editRec ? 'Editar Registro' : 'Nuevo Registro'}</h3>
              <button className="modal-close" onClick={() => setEditModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {formErr && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {formErr}</div>}
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Lote de café <span className="form-required">*</span></label>
                  <select className="form-select" value={form.idlote_cafe ?? ''} onChange={e => setForm(p => ({ ...p, idlote_cafe: e.target.value }))}>
                    <option value="">— Seleccionar —</option>
                    {(lotes as any[]).map((l: any) => <option key={l.idlote_cafe} value={l.idlote_cafe}>{l.variedad} #{l.idlote_cafe}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Proceso <span className="form-required">*</span></label>
                  <select className="form-select" value={form.idproceso ?? ''} onChange={e => setForm(p => ({ ...p, idproceso: e.target.value }))}>
                    <option value="">— Seleccionar —</option>
                    {(procesos as any[]).map((p: any) => <option key={p.idproceso} value={p.idproceso}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Calificación (0–10)</label>
                  <input className="form-input" type="number" min="0" max="10" step="0.1" placeholder="Ej: 8.5"
                    value={form.calificacion ?? ''} onChange={e => setForm(p => ({ ...p, calificacion: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha inicio <span className="form-required">*</span></label>
                  <input className="form-input" type="datetime-local" value={form.fecha_inicio ?? ''} onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha fin</label>
                  <input className="form-input" type="datetime-local" value={form.fecha_fin ?? ''} onChange={e => setForm(p => ({ ...p, fecha_fin: e.target.value }))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Reseña / Notas</label>
                  <textarea className="form-textarea" rows={5} style={{ minHeight: 110, resize: 'vertical' }}
                    placeholder="Observaciones, notas de cata, condiciones del proceso…"
                    value={form.notas ?? ''} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditModal(false)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : editRec ? 'Guardar cambios' : 'Crear registro'}</button>
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
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>{deleting ? 'Eliminando…' : 'Sí, eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
