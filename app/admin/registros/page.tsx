'use client'
import { useState, useEffect, useMemo } from 'react'
import { useCrud, useRead } from '../../../hooks/useCrud'
import Modal from '../../../components/Modal'
import { createClient } from '../../../utils/supabase/client'

const PAGE_SIZE = 15

export default function RegistrosPage() {
  const { data, loading, error, insert, update, remove } = useCrud(
    'registro_proceso', 'idregistro_proceso',
    'idregistro_proceso, fecha_inicio, fecha_fin, notas, calificacion, idproceso, idusuario, lote_cafe:idlote_cafe(variedad), proceso:idproceso(nombre), usuario:idusuario(nombre)',
    'fecha_inicio'
  )
  const { data: procesos } = useRead('proceso',  'idproceso, nombre',  'nombre')
  const { data: usuarios } = useRead('usuario',  'idusuario, nombre',  'nombre')
  const { data: lotes }    = useRead('lote_cafe','idlote_cafe, variedad','variedad')

  // Filters
  const [search,   setSearch]   = useState('')
  const [fProceso, setFProceso] = useState('')
  const [fUsuario, setFUsuario] = useState('')
  const [fDesde,   setFDesde]   = useState('')
  const [fHasta,   setFHasta]   = useState('')
  const [calMin,   setCalMin]   = useState('')
  const [calMax,   setCalMax]   = useState('')
  const [panelOpen,setPanelOpen]= useState(false)
  const [page, setPage] = useState(1)

  // View modal
  const [viewRec, setViewRec] = useState<any>(null)

  // Edit/Create modal
  const [editModal, setEditModal] = useState(false)
  const [editRec,   setEditRec]   = useState<any>(null)
  const [form, setForm] = useState<Record<string,any>>({})
  const [saving, setSaving]       = useState(false)
  const [formErr, setFormErr]     = useState<string|null>(null)
  const [deleteId, setDeleteId]   = useState<any>(null)
  const [deleting, setDeleting]   = useState(false)

  const rows = data as any[]

  const activeFilters = [fProceso, fUsuario, fDesde||fHasta, calMin||calMax].filter(Boolean).length
  const hasActive = !!(search || activeFilters)
  const clearAll = () => { setSearch(''); setFProceso(''); setFUsuario(''); setFDesde(''); setFHasta(''); setCalMin(''); setCalMax(''); setPage(1) }

  const filtered = useMemo(() => {
    let r = rows
    if (search) {
      const q = search.toLowerCase()
      r = r.filter((x: any) =>
        x.lote_cafe?.variedad?.toLowerCase().includes(q) ||
        x.proceso?.nombre?.toLowerCase().includes(q) ||
        x.usuario?.nombre?.toLowerCase().includes(q) ||
        (x.notas ?? '').toLowerCase().includes(q)
      )
    }
    if (fProceso) r = r.filter((x: any) => String(x.idproceso) === fProceso)
    if (fUsuario) r = r.filter((x: any) => String(x.idusuario) === fUsuario)
    if (fDesde)   r = r.filter((x: any) => x.fecha_inicio >= fDesde)
    if (fHasta)   r = r.filter((x: any) => x.fecha_inicio <= fHasta + 'T23:59:59')
    if (calMin)   r = r.filter((x: any) => x.calificacion != null && Number(x.calificacion) >= Number(calMin))
    if (calMax)   r = r.filter((x: any) => x.calificacion != null && Number(x.calificacion) <= Number(calMax))
    return [...r].sort((a: any, b: any) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime())
  }, [rows, search, fProceso, fUsuario, fDesde, fHasta, calMin, calMax])

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

  const openCreate = () => {
    setForm({ fecha_inicio: new Date().toISOString().slice(0,16) })
    setEditRec(null); setFormErr(null); setEditModal(true)
  }
  const openEdit = (r: any) => {
    setForm({
      idlote_cafe: r.idlote_cafe, idproceso: r.idproceso, idusuario: r.idusuario ?? '',
      calificacion: r.calificacion ?? '',
      fecha_inicio: r.fecha_inicio?.slice(0,16) ?? '',
      fecha_fin: r.fecha_fin?.slice(0,16) ?? '',
      notas: r.notas ?? '',
    })
    setEditRec(r); setFormErr(null); setEditModal(true)
  }
  const handleSave = async () => {
    if (!form.idlote_cafe || !form.idproceso || !form.fecha_inicio) {
      setFormErr('Lote, proceso y fecha de inicio son obligatorios.'); return
    }
    setSaving(true); setFormErr(null)
    const payload = {
      idlote_cafe: Number(form.idlote_cafe), idproceso: Number(form.idproceso),
      idusuario: form.idusuario ? Number(form.idusuario) : null,
      calificacion: form.calificacion !== '' && form.calificacion != null ? Number(form.calificacion) : null,
      fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin || null,
      notas: form.notas || null,
    }
    try {
      if (editRec) await update(editRec.idregistro_proceso, payload)
      else await insert(payload)
      setEditModal(false)
    } catch(e: any) { setFormErr(e.message) }
    setSaving(false)
  }
  const handleDelete = async () => {
    setDeleting(true)
    try { await remove(deleteId) } catch {}
    setDeleting(false); setDeleteId(null)
  }

  const fmtDate = (v: string | null) => v ? new Date(v).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' }) : null

  // Shared button style
  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    display:'inline-flex', alignItems:'center', gap:'0.4rem',
    height:38, padding:'0 1rem', borderRadius:'var(--r-md)',
    border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
    background: active ? 'rgba(196,122,44,0.12)' : 'var(--bg-input)',
    color: active ? 'var(--primary)' : 'var(--text-soft)',
    fontSize:'0.84rem', fontFamily:'var(--font-body)', cursor:'pointer', fontWeight: active ? 600 : 400,
  })

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-icon">📋</div>
          <div><h2>Registros de Proceso</h2><p className="page-subtitle">Seguimiento del beneficio por lote</p></div>
        </div>
        <div style={{ display:'flex', gap:'0.5rem' }}>
          <button style={filterBtnStyle(panelOpen || activeFilters > 0)} onClick={() => setPanelOpen(v => !v)}>
            🎯 Filtros
            {activeFilters > 0 && <span style={{ minWidth:20, height:20, borderRadius:99, background:'var(--primary)', color:'#fff', fontSize:'0.65rem', fontWeight:700, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>{activeFilters}</span>}
            <span style={{ opacity:0.5, fontSize:'0.7rem' }}>{panelOpen?'▲':'▼'}</span>
          </button>
          <button className="btn btn-primary" onClick={openCreate}>+ Nuevo</button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom:'1rem' }}>⚠ {error}</div>}

      {/* Search + clear */}
      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap', marginBottom:'0.75rem' }}>
        <div style={{ position:'relative', flex:1, minWidth:180, maxWidth:380 }}>
          <span style={{ position:'absolute', left:'0.7rem', top:'50%', transform:'translateY(-50%)', opacity:0.4, pointerEvents:'none' }}>🔍</span>
          <input type="text" placeholder="Buscar lote, proceso, responsable…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ width:'100%', height:36, background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', padding:'0 0.9rem 0 2.1rem', color:'var(--text)', fontSize:'0.84rem', fontFamily:'var(--font-body)', outline:'none' }} />
        </div>
        {hasActive && <button onClick={clearAll} style={{ height:36, padding:'0 0.8rem', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--r-md)', color:'var(--text-muted)', fontSize:'0.8rem', fontFamily:'var(--font-body)', cursor:'pointer' }}>✕ Limpiar</button>}
        <span style={{ fontSize:'0.78rem', color:'var(--text-dim)', fontWeight:500, marginLeft:'auto' }}>{filtered.length}{rows.length !== filtered.length && <span style={{ color:'var(--text-muted)', fontWeight:400 }}> / {rows.length}</span>}</span>
      </div>

      {/* Filter panel */}
      {panelOpen && (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'1rem 1.25rem', marginBottom:'1rem' }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'1rem', alignItems:'flex-end' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem', minWidth:160 }}>
              <label style={{ fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)' }}>Proceso</label>
              <select value={fProceso} onChange={e => { setFProceso(e.target.value); setPage(1) }}
                style={{ height:38, minWidth:160, background:fProceso?'rgba(196,122,44,0.08)':'var(--bg-input)', border:fProceso?'1px solid var(--primary)':'1px solid var(--border)', borderRadius:'var(--r-md)', color:'var(--text)', fontSize:'0.84rem', fontFamily:'var(--font-body)', padding:'0 0.6rem', outline:'none', cursor:'pointer' }}>
                <option value="">— Todos —</option>
                {(procesos as any[]).map((p: any) => <option key={p.idproceso} value={p.idproceso}>{p.nombre}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem', minWidth:160 }}>
              <label style={{ fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)' }}>Responsable</label>
              <select value={fUsuario} onChange={e => { setFUsuario(e.target.value); setPage(1) }}
                style={{ height:38, minWidth:160, background:fUsuario?'rgba(196,122,44,0.08)':'var(--bg-input)', border:fUsuario?'1px solid var(--primary)':'1px solid var(--border)', borderRadius:'var(--r-md)', color:'var(--text)', fontSize:'0.84rem', fontFamily:'var(--font-body)', padding:'0 0.6rem', outline:'none', cursor:'pointer' }}>
                <option value="">— Todos —</option>
                {(usuarios as any[]).map((u: any) => <option key={u.idusuario} value={u.idusuario}>{u.nombre}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
              <label style={{ fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)' }}>📅 Fecha inicio</label>
              <div style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
                {(['fDesde','fHasta'] as const).map((k,i) => (
                  <input key={k} type="date" value={i===0?fDesde:fHasta}
                    onChange={e => { i===0?setFDesde(e.target.value):setFHasta(e.target.value); setPage(1) }}
                    style={{ height:38, width:140, background:(fDesde||fHasta)?'rgba(196,122,44,0.08)':'var(--bg-input)', border:(fDesde||fHasta)?'1px solid var(--primary)':'1px solid var(--border)', borderRadius:'var(--r-md)', color:'var(--text)', fontSize:'0.84rem', fontFamily:'var(--font-body)', padding:'0 0.5rem', outline:'none' }} />
                ))}
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
              <label style={{ fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)' }}>⭐ Calificación</label>
              <div style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
                <input type="number" placeholder="Mín" min="0" max="10" step="0.1" value={calMin} onChange={e => { setCalMin(e.target.value); setPage(1) }}
                  style={{ height:38, width:80, background:(calMin||calMax)?'rgba(196,122,44,0.08)':'var(--bg-input)', border:(calMin||calMax)?'1px solid var(--primary)':'1px solid var(--border)', borderRadius:'var(--r-md)', color:'var(--text)', fontSize:'0.84rem', fontFamily:'var(--font-body)', padding:'0 0.5rem', outline:'none' }} />
                <span style={{ color:'var(--text-muted)' }}>–</span>
                <input type="number" placeholder="Máx" min="0" max="10" step="0.1" value={calMax} onChange={e => { setCalMax(e.target.value); setPage(1) }}
                  style={{ height:38, width:80, background:(calMin||calMax)?'rgba(196,122,44,0.08)':'var(--bg-input)', border:(calMin||calMax)?'1px solid var(--primary)':'1px solid var(--border)', borderRadius:'var(--r-md)', color:'var(--text)', fontSize:'0.84rem', fontFamily:'var(--font-body)', padding:'0 0.5rem', outline:'none' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="loading-center"><div className="spinner"/><span>Cargando…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>No hay registros{hasActive?' que coincidan':''}.</p>
          {hasActive && <button className="btn btn-ghost btn-sm" onClick={clearAll} style={{ marginTop:'0.5rem' }}>✕ Limpiar filtros</button>}
        </div>
      ) : (
        <>
          <div className="data-table-wrap table-responsive">
            <table className="data-table">
              <thead><tr>
                <th>#</th><th>Lote</th><th>Proceso</th><th>Responsable</th>
                <th>Inicio</th><th>Fin</th><th>Calificación</th><th>Notas</th><th>Acciones</th>
              </tr></thead>
              <tbody>
                {paged.map((r: any) => (
                  <tr key={r.idregistro_proceso} style={{ cursor:'pointer' }} onClick={() => setViewRec(r)}>
                    <td style={{ color:'var(--text-muted)', fontSize:'0.78rem' }}>{r.idregistro_proceso}</td>
                    <td><strong style={{ fontSize:'0.88rem' }}>{r.lote_cafe?.variedad ?? '—'}</strong></td>
                    <td><span className="badge badge-amber" style={{ fontSize:'0.72rem' }}>{r.proceso?.nombre ?? '—'}</span></td>
                    <td>
                      {r.usuario?.nombre
                        ? <span style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem', fontSize:'0.84rem', color:'var(--text-soft)', background:'var(--bg-elevated)', padding:'0.2rem 0.6rem', borderRadius:99, fontWeight:500 }}>👤 {r.usuario.nombre}</span>
                        : <span style={{ color:'var(--text-muted)', fontSize:'0.78rem' }}>—</span>}
                    </td>
                    <td style={{ fontSize:'0.82rem', color:'var(--text-soft)' }}>{fmtDate(r.fecha_inicio) ?? '—'}</td>
                    <td style={{ fontSize:'0.82rem', color: r.fecha_fin ? 'var(--text-soft)' : 'var(--amber)' }}>
                      {r.fecha_fin ? fmtDate(r.fecha_fin) : <span style={{ fontWeight:600 }}>En curso</span>}
                    </td>
                    <td style={{ textAlign:'center', whiteSpace:'nowrap' }}>
                      {r.calificacion != null
                        ? <strong style={{ fontSize:'0.9rem', color: Number(r.calificacion)>=8.5?'var(--green)':Number(r.calificacion)>=6?'var(--amber)':'var(--red,#f87171)' }}>
                            {Number(r.calificacion).toFixed(1)}<span style={{ fontSize:'0.65rem', opacity:0.6 }}>/10</span>
                          </strong>
                        : <span style={{ color:'var(--text-muted)', fontSize:'0.75rem' }}>—</span>}
                    </td>
                    <td style={{ maxWidth:220, fontSize:'0.78rem', color:'var(--text-dim)' }}>
                      {r.notas
                        ? <span style={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any, overflow:'hidden' }}>{r.notas}</span>
                        : '—'}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => setViewRec(r)} title="Ver detalle">👁</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>✏ Editar</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(r.idregistro_proceso)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'0.75rem', flexWrap:'wrap', gap:'0.5rem' }}>
              <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)} de {filtered.length}</span>
              <div style={{ display:'flex', gap:'0.35rem' }}>
                <button className="btn btn-ghost btn-sm" disabled={page===1} onClick={() => setPage(p=>p-1)}>‹ Ant</button>
                {Array.from({length:Math.min(pageCount,5)},(_,i)=>Math.max(1,Math.min(pageCount-4,page-2))+i).map(p=>(
                  <button key={p} className={`btn btn-sm ${p===page?'btn-primary':'btn-ghost'}`} onClick={()=>setPage(p)}>{p}</button>
                ))}
                <button className="btn btn-ghost btn-sm" disabled={page===pageCount} onClick={() => setPage(p=>p+1)}>Sig ›</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── VIEW MODAL ── */}
      {viewRec && (
        <div className="modal-overlay" onClick={() => setViewRec(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:520 }}>
            <div className="modal-header">
              <h3 className="modal-title">📋 Registro #{viewRec.idregistro_proceso}</h3>
              <button className="modal-close" onClick={() => setViewRec(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

              {/* Info grid */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
                {[
                  { label:'Lote',     val: viewRec.lote_cafe?.variedad ?? '—', icon:'☕' },
                  { label:'Proceso',  val: viewRec.proceso?.nombre ?? '—',     icon:'⚙️' },
                  { label:'Inicio',   val: fmtDate(viewRec.fecha_inicio) ?? '—', icon:'📅' },
                  { label:'Fin',      val: viewRec.fecha_fin ? fmtDate(viewRec.fecha_fin) : 'En curso', icon:'🏁' },
                ].map(item => (
                  <div key={item.label} style={{ background:'var(--bg)', borderRadius:'var(--r-md)', padding:'0.6rem 0.8rem' }}>
                    <div style={{ fontSize:'0.62rem', color:'var(--text-muted)', textTransform:'uppercase', fontWeight:700, letterSpacing:'0.06em', marginBottom:'0.2rem' }}>{item.label}</div>
                    <div style={{ fontSize:'0.88rem', color:'var(--text-soft)', fontWeight:600 }}>{item.icon} {item.val}</div>
                  </div>
                ))}
              </div>

              {/* Responsable + Calificación */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:'0.75rem', alignItems:'stretch' }}>
                <div style={{ background: viewRec.usuario ? 'rgba(196,122,44,0.06)' : 'var(--bg)', border: viewRec.usuario ? '1px solid rgba(196,122,44,0.2)' : '1px solid var(--border-soft)', borderRadius:'var(--r-lg)', padding:'0.85rem 1rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                  <div style={{ width:42, height:42, borderRadius:'50%', background:'var(--bg-elevated)', border:'2px solid var(--border-med)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem', flexShrink:0 }}>👤</div>
                  <div>
                    <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', textTransform:'uppercase', fontWeight:700, letterSpacing:'0.06em' }}>Responsable / Catador</div>
                    <div style={{ fontSize:'1rem', fontWeight:700, color: viewRec.usuario ? 'var(--primary)' : 'var(--text-dim)', marginTop:'0.1rem' }}>
                      {viewRec.usuario?.nombre ?? 'Sin asignar'}
                    </div>
                  </div>
                </div>
                {viewRec.calificacion != null && (
                  <div style={{ background:'var(--bg)', border:'1px solid var(--border-soft)', borderRadius:'var(--r-lg)', padding:'0.85rem 1rem', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minWidth:90 }}>
                    <div style={{ fontSize:'0.62rem', color:'var(--text-muted)', textTransform:'uppercase', fontWeight:700, letterSpacing:'0.06em', marginBottom:'0.25rem' }}>Cata</div>
                    <div style={{ fontSize:'1.6rem', fontWeight:800, color: Number(viewRec.calificacion)>=8.5?'var(--green)':Number(viewRec.calificacion)>=6?'var(--amber)':'var(--red,#f87171)', lineHeight:1 }}>
                      {Number(viewRec.calificacion).toFixed(1)}
                    </div>
                    <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', marginTop:'0.1rem' }}>/10</div>
                  </div>
                )}
              </div>

              {/* Notas completas */}
              <div>
                <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', textTransform:'uppercase', fontWeight:700, letterSpacing:'0.06em', marginBottom:'0.5rem' }}>📝 Notas / Reseña</div>
                {viewRec.notas ? (
                  <div style={{ background:'var(--bg)', borderRadius:'var(--r-lg)', padding:'0.85rem 1rem', fontSize:'0.88rem', color:'var(--text-soft)', lineHeight:1.7, whiteSpace:'pre-wrap', wordBreak:'break-word', maxHeight:260, overflowY:'auto' }}>
                    {viewRec.notas}
                  </div>
                ) : (
                  <div style={{ background:'var(--bg)', borderRadius:'var(--r-lg)', padding:'0.85rem 1rem', fontSize:'0.84rem', color:'var(--text-muted)', fontStyle:'italic' }}>
                    Sin notas registradas para este proceso.
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewRec(null)}>Cerrar</button>
              <button className="btn btn-primary" onClick={() => { setViewRec(null); openEdit(viewRec) }}>✏ Editar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT/CREATE MODAL ── */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:540 }}>
            <div className="modal-header">
              <h3 className="modal-title">{editRec ? 'Editar Registro' : 'Nuevo Registro de Proceso'}</h3>
              <button className="modal-close" onClick={() => setEditModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {formErr && <div className="alert alert-error" style={{ marginBottom:'1rem' }}>⚠ {formErr}</div>}
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Lote de café <span className="form-required">*</span></label>
                  <select className="form-select" value={form.idlote_cafe??''} onChange={e=>setForm(p=>({...p,idlote_cafe:e.target.value}))}>
                    <option value="">— Seleccionar —</option>
                    {(lotes as any[]).map((l:any) => <option key={l.idlote_cafe} value={l.idlote_cafe}>{l.variedad} #{l.idlote_cafe}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Proceso <span className="form-required">*</span></label>
                  <select className="form-select" value={form.idproceso??''} onChange={e=>setForm(p=>({...p,idproceso:e.target.value}))}>
                    <option value="">— Seleccionar —</option>
                    {(procesos as any[]).map((p:any) => <option key={p.idproceso} value={p.idproceso}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Responsable / Catador</label>
                  <select className="form-select" value={form.idusuario??''} onChange={e=>setForm(p=>({...p,idusuario:e.target.value}))}>
                    <option value="">— Sin asignar —</option>
                    {(usuarios as any[]).map((u:any) => <option key={u.idusuario} value={u.idusuario}>{u.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Calificación de cata (0–10)</label>
                  <input className="form-input" type="number" min="0" max="10" step="0.1" placeholder="Ej: 8.5"
                    value={form.calificacion??''} onChange={e=>setForm(p=>({...p,calificacion:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de inicio <span className="form-required">*</span></label>
                  <input className="form-input" type="datetime-local" value={form.fecha_inicio??''} onChange={e=>setForm(p=>({...p,fecha_inicio:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de finalización</label>
                  <input className="form-input" type="datetime-local" value={form.fecha_fin??''} onChange={e=>setForm(p=>({...p,fecha_fin:e.target.value}))} />
                </div>
                <div className="form-group" style={{ gridColumn:'1/-1' }}>
                  <label className="form-label">Notas / Reseña</label>
                  <textarea className="form-textarea" rows={5} style={{ minHeight:120, resize:'vertical' }}
                    placeholder="Temperatura, pH, condiciones climáticas, notas de cata, observaciones detalladas…"
                    value={form.notas??''} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditModal(false)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'Guardando…':editRec?'Guardar cambios':'Crear registro'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE MODAL ── */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ maxWidth:400 }}>
            <div className="modal-header"><h3 className="modal-title">⚠ Confirmar eliminación</h3></div>
            <div className="modal-body"><p>¿Estás seguro? Esta acción no se puede deshacer.</p></div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)} disabled={deleting}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>{deleting?'Eliminando…':'Sí, eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
