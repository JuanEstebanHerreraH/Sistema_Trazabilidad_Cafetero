'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '../../utils/supabase/client'

interface UsuarioPortal { idusuario: number; nombre: string; email: string }

const procesoBadge: Record<string, string> = {
  HONEY: 'badge-amber', NATURAL: 'badge-green', LAVADO: 'badge-blue',
  ANAERÓBICO: 'badge-purple', ANAEROB: 'badge-purple',
}

export default function PortalCatador({ usuario }: { usuario: UsuarioPortal }) {
  const supabase = createClient()
  const [registros, setRegistros] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [filtroEval, setFiltroEval] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 15

  // Modal catar
  const [modalOpen, setModalOpen] = useState(false)
  const [registro, setRegistro] = useState<any>(null)
  const [nota, setNota] = useState('')
  const [puntaje, setPuntaje] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('registro_proceso').select(`
      idregistro_proceso, fecha_inicio, fecha_fin, notas,
      lote_cafe:idlote_cafe(variedad, peso_kg, finca:idfinca(nombre)),
      proceso:idproceso(nombre)
    `).order('fecha_inicio', { ascending: false }).limit(60)
    setRegistros(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { cargar() }, [cargar])

  const abrirCata = (r: any) => {
    setRegistro(r)
    // Parsear nota actual si existe: formato "texto | X.X" o simplemente texto
    const notaActual = r.notas ?? ''
    const match = notaActual.match(/^(.*?)\s*\|\s*([\d.]+)$/)
    if (match) {
      setNota(match[1].trim())
      setPuntaje(match[2])
    } else {
      setNota(notaActual)
      setPuntaje('')
    }
    setSaveError(null)
    setModalOpen(true)
  }

  const guardarCata = async () => {
    if (!registro) return
    if (puntaje && (Number(puntaje) < 0 || Number(puntaje) > 10)) {
      setSaveError('El puntaje debe estar entre 0 y 10.'); return
    }
    setSaving(true); setSaveError(null)
    const notaFinal = puntaje ? `${nota.trim() || 'Sin observaciones'} | ${Number(puntaje).toFixed(1)}` : nota.trim() || null
    const { error } = await supabase.from('registro_proceso').update({ notas: notaFinal }).eq('idregistro_proceso', registro.idregistro_proceso)
    if (error) { setSaveError(error.message); setSaving(false); return }
    setSaving(false); setModalOpen(false); await cargar()
  }

  const getPuntajeColor = (puntaje: string) => {
    const n = Number(puntaje)
    if (n >= 8.5) return 'var(--green)'
    if (n >= 7) return 'var(--amber)'
    return 'var(--red)'
  }

  const parseNota = (notas: string | null) => {
    if (!notas) return { texto: null, puntaje: null }
    const match = notas.match(/^(.*?)\s*\|\s*([\d.]+)$/)
    if (match) return { texto: match[1].trim() || null, puntaje: match[2] }
    return { texto: notas, puntaje: null }
  }

  const filtrados = useMemo(() => {
    let r = registros
    if (filtro) {
      const q = filtro.toLowerCase()
      r = r.filter(x =>
        x.lote_cafe?.variedad?.toLowerCase().includes(q) ||
        x.lote_cafe?.finca?.nombre?.toLowerCase().includes(q) ||
        x.proceso?.nombre?.toLowerCase().includes(q)
      )
    }
    if (filtroEval === 'evaluado') r = r.filter(x => !!x.notas)
    if (filtroEval === 'pendiente') r = r.filter(x => !x.notas)
    return r
  }, [registros, filtro, filtroEval])

  const pageCount = Math.ceil(filtrados.length / PAGE_SIZE)
  const paged = filtrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.2rem' }}>Portal Catador</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.84rem' }}>Evalúa y califica los procesos de beneficio de café.</p>
      </div>

      {/* Stats rápidas */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {[
          { icon: '🔬', label: 'Total procesos', val: registros.length, color: 'var(--primary)' },
          { icon: '✅', label: 'Con evaluación', val: registros.filter(r => r.notas).length, color: 'var(--green)' },
          { icon: '⏳', label: 'Sin evaluar', val: registros.filter(r => !r.notas).length, color: 'var(--amber)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ '--accent': s.color } as any}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="toolbar" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div className="toolbar-search" style={{ flex: 1, minWidth: 160 }}>
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Buscar por lote, finca, proceso…" value={filtro}
            onChange={e => { setFiltro(e.target.value); setPage(1) }} />
        </div>
        <select className="form-select" style={{ flex: '0 0 auto', minWidth: 150, height: 36, fontSize: '0.82rem' }}
          value={filtroEval} onChange={e => { setFiltroEval(e.target.value); setPage(1) }}>
          <option value="">Todos</option>
          <option value="evaluado">✅ Evaluados</option>
          <option value="pendiente">⏳ Pendientes</option>
        </select>
        <span className="toolbar-count">{filtrados.length} proceso{filtrados.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🔬</div><p>No hay procesos{filtro || filtroEval ? ' que coincidan' : ''} disponibles.</p></div>
      ) : (
        <>
        <div className="data-table-wrap table-responsive">
          <table className="data-table">
            <thead>
              <tr><th>Proceso</th><th>Lote</th><th>Finca</th><th>Inicio</th><th>Fin</th><th>Evaluación</th><th>Acción</th></tr>
            </thead>
            <tbody>
              {paged.map((r: any) => {
                const { texto, puntaje } = parseNota(r.notas)
                const procNombre = r.proceso?.nombre?.toUpperCase() ?? ''
                return (
                  <tr key={r.idregistro_proceso}>
                    <td>
                      <span className={`badge ${procesoBadge[procNombre] ?? 'badge-amber'}`}>
                        {r.proceso?.nombre ?? '—'}
                      </span>
                    </td>
                    <td><strong style={{ color: 'var(--text)' }}>{r.lote_cafe?.variedad ?? '—'}</strong></td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-soft)' }}>{r.lote_cafe?.finca?.nombre ?? '—'}</td>
                    <td style={{ fontSize: '0.78rem' }}>{new Date(r.fecha_inicio).toLocaleDateString('es-CO')}</td>
                    <td style={{ fontSize: '0.78rem' }}>{r.fecha_fin ? new Date(r.fecha_fin).toLocaleDateString('es-CO') : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>
                      {puntaje ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: getPuntajeColor(puntaje) }}>{puntaje}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>/10</span>
                          {texto && <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{texto}</span>}
                        </div>
                      ) : texto ? (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{texto}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Sin evaluar</span>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => abrirCata(r)}>
                        {r.notas ? '✏ Editar' : '🔬 Catar'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtrados.length)} de {filtrados.length}
            </span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Ant</button>
              {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => Math.max(1, Math.min(pageCount - 4, page - 2)) + i).map(p => (
                <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="btn btn-ghost btn-sm" disabled={page === pageCount} onClick={() => setPage(p => p + 1)}>Sig ›</button>
            </div>
          </div>
        )}
        </>
      )}

      {/* Modal cata */}
      {modalOpen && registro && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 className="modal-title">🔬 Evaluación de cata</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              {saveError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {saveError}</div>}
              {/* Info del proceso */}
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--r-lg)', padding: '0.8rem 1rem', marginBottom: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <div>
                  <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Lote</div>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>{registro.lote_cafe?.variedad ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Finca</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-soft)' }}>{registro.lote_cafe?.finca?.nombre ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Proceso</div>
                  <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{registro.proceso?.nombre ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Período</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>{new Date(registro.fecha_inicio).toLocaleDateString('es-CO')} – {registro.fecha_fin ? new Date(registro.fecha_fin).toLocaleDateString('es-CO') : 'en curso'}</div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Puntaje (0–10)</label>
                <input className="form-input" type="number" value={puntaje} onChange={e => setPuntaje(e.target.value)} step="0.1" min="0" max="10" placeholder="Ej: 8.5" style={{ maxWidth: 140 }} />
                <p className="form-hint">Escala SCA: 0–6 Defectuoso · 7–7.9 Bueno · 8–8.9 Excelente · 9–10 Excepcional</p>
              </div>
              {puntaje && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ background: 'var(--bg)', borderRadius: '99px', height: 10, flex: 1, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, Number(puntaje) * 10)}%`, background: getPuntajeColor(puntaje), borderRadius: '99px', transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem', color: getPuntajeColor(puntaje), minWidth: 36 }}>{puntaje}</span>
                  </div>
                </div>
              )}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Notas de cata</label>
                <textarea className="form-textarea" value={nota} onChange={e => setNota(e.target.value)} placeholder="Describe aromas, sabores, acidez, cuerpo, balance, retrogusto…" style={{ minHeight: 90 }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarCata} disabled={saving}>
                {saving ? 'Guardando…' : '✓ Guardar evaluación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
