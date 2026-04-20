'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '../../utils/supabase/client'

interface UsuarioPortal { idusuario: number; nombre: string; email: string }
interface AlmacenStock { idalmacen: number; nombre: string; ubicacion: string | null; capacidad_kg: number | null; stock_actual: number; porcentaje_ocupacion: number | null; espacio_disponible: number | null }
interface ContenidoOrigen { idlote_cafe: number; variedad: string; kg_en_almacen: number }

const tipoBadge: Record<string, string> = { entrada: 'badge-green', salida: 'badge-red', traslado: 'badge-blue' }
const tipoIcon: Record<string, string> = { entrada: '📥', salida: '📤', traslado: '🔄' }

const getBarColor = (pct: number) => {
  if (pct >= 95) return 'var(--red)'
  if (pct >= 75) return 'var(--amber)'
  if (pct >= 50) return 'var(--blue)'
  return 'var(--green)'
}

export default function PortalTransportista({ usuario }: { usuario: UsuarioPortal }) {
  const supabase = createClient()
  const [movimientos, setMovimientos] = useState<any[]>([])
  const [almacenes, setAlmacenes] = useState<AlmacenStock[]>([])
  const [lotes, setLotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('')

  // Modal nuevo movimiento
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ tipo: 'entrada', idlote_cafe: '', cantidad: '', idalmacen_origen: '', idalmacen_destino: '', notas: '', fecha_movimiento: new Date().toISOString().slice(0, 16) })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [contenidoOrigen, setContenidoOrigen] = useState<ContenidoOrigen[]>([])
  const [loadingOrigen, setLoadingOrigen] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [movRes, lotRes] = await Promise.all([
      supabase.from('movimiento_inventario').select(`
        idmovimiento_inventario, tipo, fecha_movimiento, cantidad, notas,
        lote_cafe:idlote_cafe(variedad),
        almacen_origen:almacen!idalmacen_origen(nombre),
        almacen_destino:almacen!idalmacen_destino(nombre)
      `).order('fecha_movimiento', { ascending: false }).limit(60),
      supabase.from('lote_cafe').select('idlote_cafe, variedad, peso_kg, estado').order('variedad'),
    ])
    setMovimientos(movRes.data ?? [])
    setLotes(lotRes.data ?? [])

    const { data: almStock } = await supabase.from('v_almacen_stock').select('*').order('nombre')
    if (almStock) setAlmacenes(almStock as AlmacenStock[])
    else {
      const { data: raw } = await supabase.from('almacen').select('idalmacen, nombre, ubicacion, capacidad_kg').order('nombre')
      setAlmacenes((raw ?? []).map((a: any) => ({ ...a, stock_actual: 0, porcentaje_ocupacion: null, espacio_disponible: a.capacidad_kg })))
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if ((form.tipo === 'salida' || form.tipo === 'traslado') && form.idalmacen_origen) {
      setLoadingOrigen(true)
      supabase.rpc('fn_contenido_almacen', { p_idalmacen: Number(form.idalmacen_origen) }).then(({ data }) => {
        setContenidoOrigen((data ?? []) as ContenidoOrigen[])
        setLoadingOrigen(false)
      })
    } else setContenidoOrigen([])
  }, [form.idalmacen_origen, form.tipo, supabase])

  const openModal = () => {
    setForm({ tipo: 'entrada', idlote_cafe: '', cantidad: '', idalmacen_origen: '', idalmacen_destino: '', notas: '', fecha_movimiento: new Date().toISOString().slice(0, 16) })
    setFormError(null); setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.idlote_cafe || !form.cantidad || Number(form.cantidad) <= 0) {
      setFormError('Selecciona un lote y una cantidad mayor a 0.'); return
    }
    if (form.tipo === 'traslado' && (!form.idalmacen_origen || !form.idalmacen_destino)) {
      setFormError('Un traslado requiere origen y destino.'); return
    }
    if (form.tipo === 'entrada' && !form.idalmacen_destino) {
      setFormError('Una entrada requiere almacén destino.'); return
    }
    if (form.tipo === 'salida' && !form.idalmacen_origen) {
      setFormError('Una salida requiere almacén origen.'); return
    }
    // Validar stock en origen
    if ((form.tipo === 'salida' || form.tipo === 'traslado') && form.idalmacen_origen) {
      const loteEnOrigen = contenidoOrigen.find(c => c.idlote_cafe === Number(form.idlote_cafe))
      if (!loteEnOrigen) { setFormError('🚫 El lote no está en el almacén origen.'); return }
      if (Number(form.cantidad) > loteEnOrigen.kg_en_almacen) {
        setFormError(`🚫 Solo hay ${loteEnOrigen.kg_en_almacen.toLocaleString('es-CO')} kg de "${loteEnOrigen.variedad}" en este almacén.`); return
      }
    }
    // Validar capacidad destino
    if (form.idalmacen_destino && (form.tipo === 'entrada' || form.tipo === 'traslado')) {
      const dest = almacenes.find(a => a.idalmacen === Number(form.idalmacen_destino))
      if (dest && dest.capacidad_kg && dest.capacidad_kg > 0) {
        const libre = dest.espacio_disponible ?? (dest.capacidad_kg - dest.stock_actual)
        if (Number(form.cantidad) > libre) {
          setFormError(`⚠️ "${dest.nombre}" solo tiene ${libre.toLocaleString('es-CO')} kg disponibles.`); return
        }
      }
    }
    setSaving(true); setFormError(null)
    const payload: any = {
      tipo: form.tipo, fecha_movimiento: form.fecha_movimiento || new Date().toISOString(),
      cantidad: Number(form.cantidad), idlote_cafe: Number(form.idlote_cafe),
      idalmacen_origen: form.idalmacen_origen ? Number(form.idalmacen_origen) : null,
      idalmacen_destino: form.idalmacen_destino ? Number(form.idalmacen_destino) : null,
      idusuario_responsable: usuario.idusuario || null,
      notas: form.notas || null,
    }
    const { error } = await supabase.from('movimiento_inventario').insert(payload)
    if (error) {
      const msg = error.message || ''
      setFormError(msg.includes('CAPACIDAD_EXCEDIDA') ? `🚫 ${msg.replace(/.*CAPACIDAD_EXCEDIDA:\s*/, '').replace(/\s*CONTEXT:.*/, '')}` : msg)
      setSaving(false); return
    }
    setSaving(false); setModalOpen(false); await cargar()
  }

  const filtered = movimientos.filter(m => !filtroTipo || m.tipo === filtroTipo)
  const stats = [
    { label: 'Entradas',  val: movimientos.filter(m => m.tipo === 'entrada').length,  color: 'var(--green)' },
    { label: 'Salidas',   val: movimientos.filter(m => m.tipo === 'salida').length,   color: 'var(--red)'   },
    { label: 'Traslados', val: movimientos.filter(m => m.tipo === 'traslado').length, color: 'var(--blue)'  },
    { label: 'Total kg',  val: `${movimientos.reduce((s, m) => s + Number(m.cantidad), 0).toLocaleString('es-CO')} kg`, color: 'var(--primary)' },
  ]

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.2rem' }}>Portal Transportista</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.84rem' }}>Movimientos de inventario entre almacenes.</p>
        </div>
        <button className="btn btn-primary" onClick={openModal}>+ Nuevo movimiento</button>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {stats.map(s => (
          <div key={s.label} className="stat-card" style={{ '--accent': s.color } as any}>
            <div className="stat-value">{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Almacenes con barras */}
      {almacenes.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.6rem' }}>Estado de almacenes</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.6rem' }}>
            {almacenes.map(alm => {
              const pct = alm.porcentaje_ocupacion ?? (alm.capacidad_kg && alm.capacidad_kg > 0 ? Math.round((alm.stock_actual / alm.capacidad_kg) * 100) : 0)
              const barColor = getBarColor(pct)
              const status = pct >= 95 ? '🔴 Lleno' : pct >= 75 ? '🟡 Casi lleno' : pct >= 40 ? '🔵 Medio' : '🟢 Disponible'
              return (
                <div key={alm.idalmacen} style={{ background: 'var(--bg-card)', border: `1px solid ${pct >= 95 ? 'var(--red)' : pct >= 75 ? 'var(--amber)' : 'var(--border-soft)'}`, borderRadius: 'var(--r-lg)', padding: '0.8rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>🏭 {alm.nombre}</div>
                    <span style={{ fontSize: '0.7rem', color: pct >= 95 ? 'var(--red)' : pct >= 75 ? 'var(--amber)' : 'var(--green)' }}>{status}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                    <strong style={{ color: 'var(--primary)' }}>{alm.stock_actual.toLocaleString('es-CO')} kg</strong>
                    {alm.capacidad_kg ? ` / ${alm.capacidad_kg.toLocaleString('es-CO')} kg` : ' (sin límite)'}
                  </div>
                  {alm.capacidad_kg && alm.capacidad_kg > 0 && (
                    <div style={{ background: 'var(--bg)', borderRadius: '99px', height: 7, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: barColor, borderRadius: '99px', transition: 'width 0.5s ease' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filtro y tabla */}
      <div className="toolbar" style={{ marginBottom: '1rem' }}>
        <select className="form-select" style={{ flex: '0 0 auto', minWidth: 160 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="entrada">📥 Entrada</option>
          <option value="salida">📤 Salida</option>
          <option value="traslado">🔄 Traslado</option>
        </select>
        <span className="toolbar-count">{filtered.length} movimiento{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🚛</div><p>No hay movimientos{filtroTipo ? ' de este tipo' : ''} registrados.</p></div>
      ) : (
        <div className="data-table-wrap table-responsive">
          <table className="data-table">
            <thead>
              <tr><th>Tipo</th><th>Lote</th><th>Cantidad</th><th>Origen</th><th>Destino</th><th>Fecha</th><th>Notas</th></tr>
            </thead>
            <tbody>
              {filtered.map((m: any) => (
                <tr key={m.idmovimiento_inventario}>
                  <td><span className={`badge ${tipoBadge[m.tipo] ?? 'badge-muted'}`}>{tipoIcon[m.tipo]} {m.tipo}</span></td>
                  <td><strong style={{ color: 'var(--text)' }}>{m.lote_cafe?.variedad ?? '—'}</strong></td>
                  <td><strong style={{ color: 'var(--primary)' }}>{Number(m.cantidad).toLocaleString('es-CO')} kg</strong></td>
                  <td style={{ fontSize: '0.82rem' }}>{m.almacen_origen?.nombre ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td style={{ fontSize: '0.82rem' }}>{m.almacen_destino?.nombre ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>{new Date(m.fecha_movimiento).toLocaleDateString('es-CO')}</td>
                  <td style={{ fontSize: '0.78rem', maxWidth: 140, color: 'var(--text-dim)' }}>{m.notas ? String(m.notas).slice(0, 50) + (m.notas.length > 50 ? '…' : '') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nuevo Movimiento */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3 className="modal-title">Nuevo movimiento de inventario</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              {formError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {formError}</div>}
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Tipo <span className="form-required">*</span></label>
                  <select className="form-select" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value, idlote_cafe: '', cantidad: '', idalmacen_origen: '', idalmacen_destino: '' }))}>
                    <option value="entrada">📥 Entrada</option>
                    <option value="salida">📤 Salida</option>
                    <option value="traslado">🔄 Traslado</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha y hora</label>
                  <input className="form-input" type="datetime-local" value={form.fecha_movimiento} onChange={e => setForm(p => ({ ...p, fecha_movimiento: e.target.value }))} />
                </div>
                {/* Origen (salida/traslado) */}
                {(form.tipo === 'salida' || form.tipo === 'traslado') && (
                  <div className="form-group">
                    <label className="form-label">Almacén origen <span className="form-required">*</span></label>
                    <select className="form-select" value={form.idalmacen_origen} onChange={e => setForm(p => ({ ...p, idalmacen_origen: e.target.value, idlote_cafe: '', cantidad: '' }))}>
                      <option value="">— Seleccionar —</option>
                      {almacenes.map(a => <option key={a.idalmacen} value={a.idalmacen}>{a.nombre} · {a.stock_actual.toLocaleString('es-CO')} kg</option>)}
                    </select>
                  </div>
                )}
                {/* Destino (entrada/traslado) */}
                {(form.tipo === 'entrada' || form.tipo === 'traslado') && (
                  <div className="form-group">
                    <label className="form-label">Almacén destino <span className="form-required">*</span></label>
                    <select className="form-select" value={form.idalmacen_destino} onChange={e => setForm(p => ({ ...p, idalmacen_destino: e.target.value }))}>
                      <option value="">— Seleccionar —</option>
                      {almacenes.map(a => {
                        const libre = a.espacio_disponible ?? (a.capacidad_kg ? a.capacidad_kg - a.stock_actual : Infinity)
                        const lleno = a.capacidad_kg && a.capacidad_kg > 0 && libre <= 0
                        return (
                          <option key={a.idalmacen} value={a.idalmacen} disabled={!!lleno}>
                            {lleno ? '🔴 ' : ''}{a.nombre}{a.capacidad_kg ? ` · libre: ${(libre as number).toLocaleString('es-CO')} kg` : ''}
                          </option>
                        )
                      })}
                    </select>
                    {form.idalmacen_destino && (() => {
                      const dest = almacenes.find(a => a.idalmacen === Number(form.idalmacen_destino))
                      if (!dest || !dest.capacidad_kg) return null
                      const pct = Math.round((dest.stock_actual / dest.capacidad_kg) * 100)
                      const libre = dest.espacio_disponible ?? (dest.capacidad_kg - dest.stock_actual)
                      return (
                        <p className="form-hint" style={{ color: pct >= 80 ? 'var(--amber)' : 'var(--text-dim)' }}>
                          {pct >= 80 ? '⚠️' : '✅'} {dest.nombre}: {pct}% ocupado — {libre.toLocaleString('es-CO')} kg libres
                        </p>
                      )
                    })()}
                  </div>
                )}
                {/* Lote */}
                <div className="form-group" style={{ gridColumn: (form.tipo === 'entrada' ? '1 / -1' : undefined) }}>
                  <label className="form-label">Lote de café <span className="form-required">*</span></label>
                  {(form.tipo === 'salida' || form.tipo === 'traslado') && !form.idalmacen_origen ? (
                    <p className="form-hint" style={{ color: 'var(--amber)' }}>Primero selecciona un almacén origen.</p>
                  ) : loadingOrigen ? (
                    <p className="form-hint">Cargando lotes del almacén…</p>
                  ) : (
                    <select className="form-select" value={form.idlote_cafe} onChange={e => setForm(p => ({ ...p, idlote_cafe: e.target.value }))}>
                      <option value="">— Seleccionar —</option>
                      {(form.tipo === 'entrada' ? lotes : contenidoOrigen.map(c => ({ idlote_cafe: c.idlote_cafe, variedad: c.variedad, peso_kg: c.kg_en_almacen }))).map((l: any) => (
                        <option key={l.idlote_cafe} value={l.idlote_cafe}>{l.variedad} · {l.peso_kg} kg · #{l.idlote_cafe}</option>
                      ))}
                    </select>
                  )}
                  {(form.tipo !== 'entrada') && form.idalmacen_origen && contenidoOrigen.length === 0 && !loadingOrigen && (
                    <p className="form-hint" style={{ color: 'var(--red)' }}>📭 Este almacén no tiene lotes disponibles.</p>
                  )}
                </div>
                {/* Cantidad con validación visual */}
                <div className="form-group">
                  <label className="form-label">Cantidad (kg) <span className="form-required">*</span></label>
                  <input className="form-input" type="number" value={form.cantidad} onChange={e => setForm(p => ({ ...p, cantidad: e.target.value }))} step="0.01" min="0" placeholder="Ej: 500" />
                  {form.idlote_cafe && (form.tipo === 'salida' || form.tipo === 'traslado') && (() => {
                    const loteOrigen = contenidoOrigen.find(c => c.idlote_cafe === Number(form.idlote_cafe))
                    if (!loteOrigen) return null
                    const excede = Number(form.cantidad) > loteOrigen.kg_en_almacen
                    return (
                      <p className="form-hint" style={{ color: excede ? 'var(--red)' : 'var(--text-dim)' }}>
                        {excede ? '🚫' : '✅'} Disponible en almacén: {loteOrigen.kg_en_almacen.toLocaleString('es-CO')} kg
                      </p>
                    )
                  })()}
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Notas</label>
                  <textarea className="form-textarea" value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} placeholder="Observaciones, guía de transporte…" style={{ minHeight: 64 }} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Registrando…' : 'Registrar movimiento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
