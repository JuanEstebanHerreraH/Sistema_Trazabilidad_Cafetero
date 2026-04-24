'use client'
import { useState, useEffect } from 'react'
import CrudPage from '../../../components/CrudPage'
import Modal from '../../../components/Modal'
import { createClient } from '../../../utils/supabase/client'

const ESTADOS = [
  { value: 'disponible', label: '🟢 Disponible' },
  { value: 'en_proceso', label: '🟡 En proceso' },
  { value: 'vendido',    label: '🔵 Vendido'    },
  { value: 'exportado',  label: '🟣 Exportado'  },
]
const estadoBadge: Record<string, string> = {
  disponible: 'badge-green', en_proceso: 'badge-amber',
  vendido: 'badge-muted', exportado: 'badge-blue',
}

const calColor = (v: number) =>
  v >= 8.5 ? 'var(--green)' : v >= 6 ? 'var(--amber)' : 'var(--red,#f87171)'

const tipoBadge = (tipo: string) =>
  tipo === 'catador'
    ? { bg: 'rgba(196,122,44,0.12)', color: 'var(--primary)', label: '🎯 Catador' }
    : { bg: 'rgba(59,130,246,0.12)', color: 'var(--blue)',    label: '🛒 Cliente' }

export default function LotesPage() {
  const supabase = createClient()
  const [fincas,     setFincas]     = useState<{ value: string; label: string }[]>([])
  const [variedades, setVariedades] = useState<{ value: string; label: string }[]>([])

  // Trace modal
  const [traceModal,   setTraceModal]   = useState(false)
  const [traceData,    setTraceData]    = useState<any>(null)
  const [traceLoading, setTraceLoading] = useState(false)

  // Reviews modal
  const [resModal,    setResModal]    = useState(false)
  const [resLote,     setResLote]     = useState<any>(null)
  const [resenas,     setResenas]     = useState<any[]>([])
  const [resLoading,  setResLoading]  = useState(false)
  const [resFiltro,   setResFiltro]   = useState<'todos' | 'catador' | 'cliente'>('todos')
  const [resExpanded, setResExpanded] = useState<number | null>(null)
  // New review form
  const [newReseña,   setNewReseña]   = useState({ texto: '', calificacion: '' })
  const [saving,      setSaving]      = useState(false)
  const [saveErr,     setSaveErr]     = useState<string | null>(null)

  useEffect(() => {
    supabase.from('finca').select('idfinca, nombre').order('nombre')
      .then(({ data }) => setFincas((data ?? []).map((f: any) => ({ value: String(f.idfinca), label: f.nombre }))))
    supabase.from('lote_cafe').select('variedad').order('variedad')
      .then(({ data }) => {
        const unique = Array.from(new Set((data ?? []).map((l: any) => l.variedad).filter(Boolean)))
        setVariedades(unique.map(v => ({ value: String(v), label: String(v) })))
      })
  }, [])

  const verTrazabilidad = async (row: any) => {
    setTraceLoading(true); setTraceModal(true); setTraceData(null)
    const { data } = await supabase.from('lote_cafe').select(`
      idlote_cafe, variedad, fecha_cosecha, peso_kg, estado, precio_kg,
      finca(nombre, ubicacion, productor(nombre, region)),
      registro_proceso(proceso(nombre), fecha_inicio, fecha_fin, notas),
      movimiento_inventario(tipo, fecha_movimiento, cantidad, almacen_origen:idalmacen_origen(nombre), almacen_destino:idalmacen_destino(nombre), notas)
    `).eq('idlote_cafe', row.idlote_cafe).single()
    setTraceData(data); setTraceLoading(false)
  }

  const verResenas = async (row: any) => {
    setResLote(row); setResLoading(true); setResModal(true)
    setResenas([]); setResFiltro('todos'); setResExpanded(null)
    setNewReseña({ texto: '', calificacion: '' }); setSaveErr(null)
    const { data } = await supabase
      .from('v_resenas_lote')
      .select('*')
      .eq('idlote_cafe', row.idlote_cafe)
      .order('created_at', { ascending: false })
    setResenas(data ?? [])
    setResLoading(false)
  }

  const submitReseña = async () => {
    if (!newReseña.texto.trim() && !newReseña.calificacion) {
      setSaveErr('Escribe una reseña o calificación.'); return
    }
    setSaving(true); setSaveErr(null)
    const { error } = await supabase.from('resena_lote').insert({
      idlote_cafe:  resLote.idlote_cafe,
      calificacion: newReseña.calificacion ? Number(newReseña.calificacion) : null,
      texto:        newReseña.texto.trim() || null,
    })
    if (error) { setSaveErr(error.message); setSaving(false); return }
    setNewReseña({ texto: '', calificacion: '' })
    // Reload reviews
    const { data } = await supabase.from('v_resenas_lote').select('*').eq('idlote_cafe', resLote.idlote_cafe).order('created_at', { ascending: false })
    setResenas(data ?? [])
    setSaving(false)
  }

  const deleteReseña = async (tipo: string, id: number) => {
    if (!confirm('¿Eliminar esta reseña?')) return
    if (tipo === 'cliente') await supabase.from('resena_lote').delete().eq('idresena', id)
    else await supabase.from('registro_proceso').update({ notas: null, calificacion: null }).eq('idregistro_proceso', id)
    const { data } = await supabase.from('v_resenas_lote').select('*').eq('idlote_cafe', resLote.idlote_cafe).order('created_at', { ascending: false })
    setResenas(data ?? [])
  }

  const visibleRes = resenas.filter(r => resFiltro === 'todos' || r.tipo === resFiltro)
  const avgCal = (list: any[]) => {
    const vals = list.filter(r => r.calificacion != null).map(r => Number(r.calificacion))
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }
  const globalAvg = avgCal(resenas)
  const catAvg    = avgCal(resenas.filter(r => r.tipo === 'catador'))
  const cliAvg    = avgCal(resenas.filter(r => r.tipo === 'cliente'))

  return (
    <>
      <CrudPage
        title="Lotes de Café" subtitle="Gestión y trazabilidad completa de lotes" icon="☕"
        table="lote_cafe" idField="idlote_cafe"
        selectQuery="idlote_cafe, variedad, fecha_cosecha, peso_kg, estado, precio_kg, idfinca, finca:idfinca(nombre)"
        orderBy="fecha_cosecha"
        searchKeys={['variedad', 'finca.nombre']}
        searchPlaceholder="Buscar variedad o finca…"
        columns={[
          { key: 'idlote_cafe',   label: 'ID' },
          { key: 'variedad',      label: 'Variedad', render: v => <strong style={{ color: 'var(--text)' }}>{v}</strong> },
          { key: 'finca',         label: 'Finca',    render: v => v?.nombre ?? '—' },
          { key: 'fecha_cosecha', label: 'Cosecha',  render: v => v ? new Date(v).toLocaleDateString('es-CO') : '—' },
          { key: 'peso_kg',       label: 'Peso (kg)', render: v => <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{v} kg</span> },
          { key: 'precio_kg',     label: 'Precio/kg', render: v => `$${Number(v ?? 0).toLocaleString('es-CO')}` },
          { key: 'estado',        label: 'Estado',   render: v => <span className={`badge ${estadoBadge[v] ?? 'badge-muted'}`}>{v}</span> },
        ]}
        fields={[
          { key: 'variedad',      label: 'Variedad',    required: true, placeholder: 'Caturra, Geisha, Colombia…' },
          { key: 'fecha_cosecha', label: 'Fecha cosecha', type: 'date', required: true },
          { key: 'peso_kg',       label: 'Peso (kg)',   type: 'number', required: true, placeholder: '500' },
          { key: 'precio_kg',     label: 'Precio/kg',   type: 'number', required: true, placeholder: '18500', description: 'Precio en COP' },
          { key: 'estado',        label: 'Estado',      type: 'select', required: true, default: 'disponible', options: ESTADOS },
          { key: 'idfinca',       label: 'ID Finca',    type: 'number', placeholder: 'ID de la finca' },
        ]}
        filterSelects={[
          { key: 'estado',   label: 'Estado',   options: ESTADOS },
          { key: 'idfinca',  label: 'Finca',    options: fincas },
          { key: 'variedad', label: 'Variedad', options: variedades },
        ]}
        dateFilters={[{ key: 'fecha_cosecha', label: 'Fecha cosecha' }]}
        rangeFilters={[
          { key: 'peso_kg',   label: 'Stock',     unit: 'kg' },
          { key: 'precio_kg', label: 'Precio/kg', unit: 'COP' },
        ]}
        extraActions={row => (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => verResenas(row)} title="Ver reseñas">📝 Reseñas</button>
            <button className="btn btn-ghost btn-sm" onClick={() => verTrazabilidad(row)} title="Trazabilidad">🔍 Traza</button>
          </>
        )}
      />

      {/* ── RESEÑAS MODAL ── */}
      <Modal isOpen={resModal} onClose={() => setResModal(false)}
        title={`📝 Reseñas — ${resLote?.variedad ?? ''}`}
        size="lg"
        footer={<button className="btn btn-secondary" onClick={() => setResModal(false)}>Cerrar</button>}>
        {resLoading ? (
          <div className="loading-center"><div className="spinner" /><span>Cargando reseñas…</span></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Stats row */}
            {resenas.length > 0 && (
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {[
                  { label: 'Promedio global',  val: globalAvg, count: resenas.length,                           icon: '⭐' },
                  { label: 'Catadores',         val: catAvg,    count: resenas.filter(r => r.tipo === 'catador').length, icon: '🎯' },
                  { label: 'Clientes',          val: cliAvg,    count: resenas.filter(r => r.tipo === 'cliente').length, icon: '🛒' },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, minWidth: 110, background: 'var(--bg)', borderRadius: 'var(--r-lg)', padding: '0.7rem 0.9rem', textAlign: 'center', border: '1px solid var(--border-soft)' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>{s.icon} {s.label}</div>
                    <div style={{ fontWeight: 800, fontSize: '1.4rem', color: s.val != null ? calColor(s.val) : 'var(--text-dim)', lineHeight: 1.1, marginTop: '0.2rem' }}>
                      {s.val != null ? s.val.toFixed(1) : '—'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{s.count} reseña{s.count !== 1 ? 's' : ''}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Filter tabs */}
            {resenas.length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {(['todos', 'catador', 'cliente'] as const).map(t => (
                  <button key={t} onClick={() => setResFiltro(t)}
                    style={{ height: 32, padding: '0 0.85rem', borderRadius: 'var(--r-md)', border: resFiltro === t ? '1px solid var(--primary)' : '1px solid var(--border)', background: resFiltro === t ? 'rgba(196,122,44,0.12)' : 'var(--bg-input)', color: resFiltro === t ? 'var(--primary)' : 'var(--text-soft)', fontSize: '0.8rem', fontFamily: 'var(--font-body)', cursor: 'pointer', fontWeight: resFiltro === t ? 600 : 400 }}>
                    {t === 'todos' ? 'Todos' : t === 'catador' ? '🎯 Catadores' : '🛒 Clientes'}
                    <span style={{ marginLeft: '0.35rem', fontSize: '0.7rem', opacity: 0.7 }}>
                      ({t === 'todos' ? resenas.length : resenas.filter(r => r.tipo === t).length})
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Reviews list */}
            {visibleRes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', background: 'var(--bg)', borderRadius: 'var(--r-lg)', fontSize: '0.84rem' }}>
                {resenas.length === 0 ? 'Este lote aún no tiene reseñas.' : 'No hay reseñas de este tipo.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: 340, overflowY: 'auto' }}>
                {visibleRes.map((r: any) => {
                  const tb = tipoBadge(r.tipo)
                  const isExp = resExpanded === r.id
                  const largo = (r.texto ?? '').length > 130
                  return (
                    <div key={`${r.tipo}-${r.id}`} style={{ background: 'var(--bg)', borderRadius: 'var(--r-lg)', padding: '0.8rem 1rem', border: '1px solid var(--border-soft)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: 99, background: tb.bg, color: tb.color }}>{tb.label}</span>
                          {r.autor && <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)', fontWeight: 600 }}>{r.autor}</span>}
                          {r.proceso_nombre && <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>· {r.proceso_nombre}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {r.calificacion != null && (
                            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: calColor(Number(r.calificacion)) }}>
                              {Number(r.calificacion).toFixed(1)}<span style={{ fontSize: '0.6rem', opacity: 0.6 }}>/10</span>
                            </span>
                          )}
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                            {new Date(r.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          <button onClick={() => deleteReseña(r.tipo, r.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0 0.2rem', lineHeight: 1 }} title="Eliminar reseña">
                            ✕
                          </button>
                        </div>
                      </div>
                      {r.texto && (
                        <>
                          <p style={{ fontSize: '0.84rem', color: 'var(--text-soft)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', ...(isExp ? {} : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }) }}>
                            {r.texto}
                          </p>
                          {largo && (
                            <button onClick={() => setResExpanded(isExp ? null : r.id)}
                              style={{ marginTop: '0.25rem', fontSize: '0.72rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)' }}>
                              {isExp ? '▲ Menos' : '▼ Ver completo'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add review form */}
            <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.65rem' }}>➕ Agregar reseña de cliente</div>
              {saveErr && <div className="alert alert-error" style={{ marginBottom: '0.75rem', fontSize: '0.82rem' }}>⚠ {saveErr}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.65rem', alignItems: 'end' }}>
                <textarea
                  placeholder="Escribe tu reseña o comentario sobre este lote…"
                  value={newReseña.texto}
                  onChange={e => setNewReseña(p => ({ ...p, texto: e.target.value }))}
                  className="form-textarea"
                  rows={3}
                  style={{ resize: 'vertical', minHeight: 72, fontSize: '0.84rem' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input type="number" min="0" max="10" step="0.5" placeholder="Cal. /10"
                    value={newReseña.calificacion}
                    onChange={e => setNewReseña(p => ({ ...p, calificacion: e.target.value }))}
                    style={{ width: 80, height: 38, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text)', fontSize: '0.84rem', fontFamily: 'var(--font-body)', padding: '0 0.5rem', outline: 'none', textAlign: 'center' }} />
                  <button className="btn btn-primary" onClick={submitReseña} disabled={saving}
                    style={{ height: 38, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    {saving ? '…' : '+ Enviar'}
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}
      </Modal>

      {/* ── TRAZABILIDAD MODAL ── */}
      <Modal isOpen={traceModal} onClose={() => setTraceModal(false)} title="🔍 Trazabilidad del Lote" size="lg"
        footer={<button className="btn btn-secondary" onClick={() => setTraceModal(false)}>Cerrar</button>}>
        {traceLoading ? (
          <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
        ) : traceData ? (
          <div>
            <div style={{ background: 'var(--bg-1)', borderRadius: 'var(--r-lg)', padding: '1rem', marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div><div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Variedad</div><div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{traceData.variedad}</div></div>
              <div><div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Stock</div><div style={{ fontWeight: 700, color: 'var(--primary)' }}>{traceData.peso_kg} kg</div></div>
              <div><div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Estado</div><span className={`badge ${estadoBadge[traceData.estado] ?? 'badge-muted'}`}>{traceData.estado}</span></div>
            </div>
            {traceData.finca && <p style={{ fontSize: '0.84rem', color: 'var(--text-soft)', marginBottom: '0.75rem' }}>🏡 {traceData.finca.nombre}{traceData.finca.ubicacion ? ` · ${traceData.finca.ubicacion}` : ''}{traceData.finca.productor ? ` · 👨‍🌾 ${traceData.finca.productor.nombre}` : ''}</p>}
            {(traceData.registro_proceso ?? []).map((r: any, i: number) => (
              <div key={i} style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)', padding: '0.6rem 0.8rem', marginBottom: '0.4rem', fontSize: '0.82rem' }}>
                ⚙️ <strong>{r.proceso?.nombre}</strong> · {new Date(r.fecha_inicio).toLocaleDateString('es-CO')} → {r.fecha_fin ? new Date(r.fecha_fin).toLocaleDateString('es-CO') : 'En curso'}
                {r.notas && <div style={{ color: 'var(--text-dim)', marginTop: '0.2rem' }}>📝 {r.notas}</div>}
              </div>
            ))}
            {(traceData.movimiento_inventario ?? []).map((m: any, i: number) => (
              <div key={i} style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)', padding: '0.6rem 0.8rem', marginBottom: '0.4rem', fontSize: '0.82rem' }}>
                🏭 <strong>{m.tipo}</strong> · {m.cantidad} kg · {new Date(m.fecha_movimiento).toLocaleDateString('es-CO')}
                {m.almacen_origen && <> · De: {m.almacen_origen.nombre}</>}
                {m.almacen_destino && <> · A: {m.almacen_destino.nombre}</>}
              </div>
            ))}
          </div>
        ) : null}
      </Modal>
    </>
  )
}
