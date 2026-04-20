'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '../../utils/supabase/client'

interface UsuarioPortal { idusuario: number; nombre: string; email: string }

const PAGE_SIZE = 12

export default function PortalCatador({ usuario }: { usuario: UsuarioPortal }) {
  const supabase = createClient()
  const [registros, setRegistros] = useState<any[]>([])
  const [lotes, setLotes]         = useState<any[]>([])
  const [procesos, setProcesos]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)

  // Filters
  const [busqueda, setBusqueda]         = useState('')
  const [filtroProceso, setFiltroProceso] = useState('')
  const [showFilters, setShowFilters]     = useState(false)
  const [page, setPage] = useState(1)

  // New record form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ idlote_cafe: '', idproceso: '', fecha_inicio: '', fecha_fin: '', notas: '' })
  const [saving, setSaving]   = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const [regRes, lotesRes, procRes] = await Promise.all([
      supabase.from('registro_proceso').select(`
        idregistro_proceso, fecha_inicio, fecha_fin, notas,
        lote_cafe:idlote_cafe(variedad, peso_kg, finca:idfinca(nombre)),
        proceso:idproceso(nombre)
      `).order('fecha_inicio', { ascending: false }),
      supabase.from('lote_cafe').select('idlote_cafe, variedad, finca:idfinca(nombre)').order('variedad'),
      supabase.from('proceso').select('idproceso, nombre').order('nombre'),
    ])
    setRegistros(regRes.data ?? [])
    setLotes(lotesRes.data ?? [])
    setProcesos(procRes.data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { cargar() }, [cargar])

  const procesosUnicos = useMemo(() =>
    Array.from(new Set(registros.map(r => r.proceso?.nombre).filter(Boolean))), [registros])

  const filtrados = useMemo(() => {
    let rows = registros
    if (busqueda) {
      const q = busqueda.toLowerCase()
      rows = rows.filter(r =>
        (r.lote_cafe?.variedad ?? '').toLowerCase().includes(q) ||
        (r.lote_cafe?.finca?.nombre ?? '').toLowerCase().includes(q) ||
        (r.proceso?.nombre ?? '').toLowerCase().includes(q)
      )
    }
    if (filtroProceso) rows = rows.filter(r => r.proceso?.nombre === filtroProceso)
    return rows
  }, [registros, busqueda, filtroProceso])

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const paginated  = filtrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const diffDias = (r: any) => {
    if (!r.fecha_inicio || !r.fecha_fin) return null
    const h = (new Date(r.fecha_fin).getTime() - new Date(r.fecha_inicio).getTime()) / 36e5
    return h < 24 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`
  }

  const handleSave = async () => {
    if (!form.idlote_cafe || !form.idproceso || !form.fecha_inicio || !form.fecha_fin) {
      setFormError('Lote, proceso, inicio y fin son obligatorios.')
      return
    }
    setSaving(true); setFormError(null)
    const { error } = await supabase.from('registro_proceso').insert({
      idlote_cafe: Number(form.idlote_cafe),
      idproceso: Number(form.idproceso),
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin,
      notas: form.notas || null,
      idusuario: usuario.idusuario,
    })
    if (error) { setFormError(error.message); setSaving(false); return }
    setForm({ idlote_cafe: '', idproceso: '', fecha_inicio: '', fecha_fin: '', notas: '' })
    setShowForm(false)
    await cargar()
    setSaving(false)
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.2rem' }}>
            Portal Catador
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.84rem' }}>
            Registros de procesos de beneficio para evaluación.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(v => !v); setFormError(null) }}>
          {showForm ? '✕ Cancelar' : '+ Nuevo registro'}
        </button>
      </div>

      {/* New record form */}
      {showForm && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--primary)', borderRadius: 'var(--r-xl)',
          padding: '1.25rem', marginBottom: '1.5rem',
        }}>
          <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.88rem', marginBottom: '1rem' }}>
            🔬 Nuevo registro de proceso
          </div>
          {formError && <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>⚠ {formError}</div>}
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Lote de café <span className="form-required">*</span></label>
              <select className="form-select" value={form.idlote_cafe}
                onChange={e => setForm(p => ({ ...p, idlote_cafe: e.target.value }))}>
                <option value="">— Seleccionar lote —</option>
                {lotes.map((l: any) => (
                  <option key={l.idlote_cafe} value={l.idlote_cafe}>
                    {l.variedad}{l.finca?.nombre ? ` · ${l.finca.nombre}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Proceso <span className="form-required">*</span></label>
              <select className="form-select" value={form.idproceso}
                onChange={e => setForm(p => ({ ...p, idproceso: e.target.value }))}>
                <option value="">— Seleccionar proceso —</option>
                {procesos.map((p: any) => (
                  <option key={p.idproceso} value={p.idproceso}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Fecha inicio <span className="form-required">*</span></label>
              <input type="datetime-local" className="form-input" value={form.fecha_inicio}
                onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha fin <span className="form-required">*</span></label>
              <input type="datetime-local" className="form-input" value={form.fecha_fin}
                onChange={e => setForm(p => ({ ...p, fecha_fin: e.target.value }))} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Notas de evaluación</label>
              <textarea className="form-textarea" value={form.notas}
                onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                placeholder="Temperatura, pH, observaciones sensoriales, puntaje…" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '⏳ Guardando…' : '✓ Guardar registro'}
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {[
          { icon: '📋', label: 'Total registros', val: registros.length, color: 'var(--primary)' },
          { icon: '🔬', label: 'Procesos únicos', val: procesosUnicos.length, color: 'var(--blue)' },
          { icon: '☕', label: 'Lotes evaluados', val: new Set(registros.map(r => r.lote_cafe?.variedad)).size, color: 'var(--amber)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ '--accent': s.color } as any}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : registros.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔬</div>
          <p>No hay registros de proceso. ¡Crea el primero!</p>
        </div>
      ) : (
        <>
          <div className="toolbar-v2">
            <div className="toolbar-search" style={{ flex: 1, minWidth: 180 }}>
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Buscar variedad, finca o proceso…"
                value={busqueda} onChange={e => { setBusqueda(e.target.value); setPage(1) }} />
            </div>
            {procesosUnicos.length > 0 && (
              <button className="btn btn-secondary btn-sm"
                onClick={() => setShowFilters(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                ⚙ Filtros
                {filtroProceso && <span className="filter-badge">1</span>}
              </button>
            )}
            {(busqueda || filtroProceso) && (
              <button className="filter-clear" onClick={() => { setBusqueda(''); setFiltroProceso(''); setPage(1) }}>
                ✕ Limpiar
              </button>
            )}
            <span className="toolbar-count">{filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}</span>
          </div>

          {showFilters && procesosUnicos.length > 0 && (
            <div className="filter-bar">
              <div className="filter-row">
                <span className="filter-label">Proceso</span>
                <div className="filter-chips">
                  <button className={`filter-chip${filtroProceso === '' ? ' active' : ''}`}
                    onClick={() => { setFiltroProceso(''); setPage(1) }}>Todos</button>
                  {procesosUnicos.map(p => (
                    <button key={p}
                      className={`filter-chip chip-amber${filtroProceso === p ? ' active' : ''}`}
                      onClick={() => { setFiltroProceso(p); setPage(1) }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {filtrados.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div><p>Sin registros con esos filtros.</p>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem' }}
                onClick={() => { setBusqueda(''); setFiltroProceso(''); setPage(1) }}>Limpiar</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.85rem' }}>
                {paginated.map((r: any) => {
                  const dur = diffDias(r)
                  return (
                    <div key={r.idregistro_proceso} className="record-card">
                      <div className="record-card-header">
                        <div>
                          <div className="record-card-title">☕ {r.lote_cafe?.variedad ?? '—'}</div>
                          <div className="record-card-meta">🌿 {r.lote_cafe?.finca?.nombre ?? '—'}</div>
                        </div>
                        <span className="badge badge-amber">{r.proceso?.nombre ?? '—'}</span>
                      </div>
                      <div className="record-card-body">
                        <div className="record-field">
                          <span className="record-field-label">Inicio</span>
                          <span className="record-field-value">
                            {new Date(r.fecha_inicio).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="record-field">
                          <span className="record-field-label">Fin</span>
                          <span className="record-field-value">
                            {r.fecha_fin ? new Date(r.fecha_fin).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </span>
                        </div>
                        {dur && (
                          <div className="record-field">
                            <span className="record-field-label">Duración</span>
                            <span className="record-field-value" style={{ color: 'var(--blue)' }}>{dur}</span>
                          </div>
                        )}
                        {r.lote_cafe?.peso_kg && (
                          <div className="record-field">
                            <span className="record-field-label">Peso lote</span>
                            <span className="record-field-value">{r.lote_cafe.peso_kg} kg</span>
                          </div>
                        )}
                      </div>
                      {r.notas && (
                        <div style={{ marginTop: '0.65rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border-soft)', fontSize: '0.77rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                          📝 {String(r.notas).slice(0, 120)}{r.notas.length > 120 ? '…' : ''}
                        </div>
                      )}
                    </div>
                  )
                })}
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
