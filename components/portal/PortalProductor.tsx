'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '../../utils/supabase/client'

interface UsuarioPortal { idusuario: number; nombre: string; email: string }
interface Finca { idfinca: number; nombre: string; ubicacion: string | null; area_hectareas: number | null }
interface Lote { idlote_cafe: number; variedad: string; fecha_cosecha: string; peso_kg: number; estado: string; precio_kg: number; idfinca: number; finca: { nombre: string } | null }

const estadoBadge: Record<string, string> = {
  disponible: 'badge-green', en_proceso: 'badge-amber', vendido: 'badge-blue', exportado: 'badge-purple',
}
const estadoLabel: Record<string, string> = {
  disponible: 'Disponible', en_proceso: 'En proceso', vendido: 'Vendido', exportado: 'Exportado',
}

export default function PortalProductor({ usuario }: { usuario: UsuarioPortal }) {
  const supabase = createClient()
  const [fincas, setFincas] = useState<Finca[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [idProductor, setIdProductor] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'fincas' | 'lotes'>('fincas')

  const [modalFinca, setModalFinca] = useState(false)
  const [editFinca, setEditFinca] = useState<Finca | null>(null)
  const [formFinca, setFormFinca] = useState({ nombre: '', ubicacion: '', area_hectareas: '' })
  const [savingFinca, setSavingFinca] = useState(false)
  const [errFinca, setErrFinca] = useState<string | null>(null)

  const [modalLote, setModalLote] = useState(false)
  const [editLote, setEditLote] = useState<Lote | null>(null)
  const [formLote, setFormLote] = useState({ idfinca: '', variedad: '', fecha_cosecha: '', peso_kg: '', precio_kg: '', estado: 'disponible' })
  const [savingLote, setSavingLote] = useState(false)
  const [errLote, setErrLote] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    let { data: prod } = await supabase.from('productor').select('idproductor')
      .or(`nombre.ilike.${usuario.nombre},contacto.ilike.${usuario.email}`).maybeSingle()

    if (!prod) {
      const { data: nuevo } = await supabase.from('productor')
        .insert({ nombre: usuario.nombre, contacto: usuario.email }).select('idproductor').single()
      prod = nuevo as any
    }

    const pid = (prod as any)?.idproductor ?? null
    setIdProductor(pid)

    if (pid) {
      const { data: fincaRows } = await supabase.from('finca').select('idfinca').eq('idproductor', pid)
      const fincaIds = fincaRows?.map(f => f.idfinca) ?? []
      const [{ data: f }, lotesResult] = await Promise.all([
        supabase.from('finca').select('idfinca, nombre, ubicacion, area_hectareas').eq('idproductor', pid).order('nombre'),
        fincaIds.length > 0
          ? supabase.from('lote_cafe').select('idlote_cafe, variedad, fecha_cosecha, peso_kg, estado, precio_kg, idfinca, finca:idfinca(nombre)')
              .in('idfinca', fincaIds).order('fecha_cosecha', { ascending: false })
          : Promise.resolve({ data: [] }),
      ])
      setFincas((f ?? []) as any)
      setLotes(((lotesResult as any).data ?? []) as any)
    }
    setLoading(false)
  }, [usuario.nombre, usuario.email, supabase])

  useEffect(() => { cargar() }, [cargar])

  const openNewFinca = () => {
    setFormFinca({ nombre: '', ubicacion: '', area_hectareas: '' })
    setEditFinca(null); setErrFinca(null); setModalFinca(true)
  }
  const openEditFinca = (f: Finca) => {
    setFormFinca({ nombre: f.nombre, ubicacion: f.ubicacion ?? '', area_hectareas: f.area_hectareas?.toString() ?? '' })
    setEditFinca(f); setErrFinca(null); setModalFinca(true)
  }
  const saveFinca = async () => {
    if (!formFinca.nombre.trim()) { setErrFinca('El nombre es obligatorio.'); return }
    if (!idProductor) { setErrFinca('No se encontró tu perfil de productor.'); return }
    setSavingFinca(true); setErrFinca(null)
    const payload: any = {
      nombre: formFinca.nombre.trim(),
      ubicacion: formFinca.ubicacion.trim() || null,
      area_hectareas: formFinca.area_hectareas ? Number(formFinca.area_hectareas) : null,
      idproductor: idProductor,
    }
    if (editFinca) {
      const { error } = await supabase.from('finca').update(payload).eq('idfinca', editFinca.idfinca)
      if (error) { setErrFinca(error.message); setSavingFinca(false); return }
    } else {
      const { error } = await supabase.from('finca').insert(payload)
      if (error) { setErrFinca(error.message); setSavingFinca(false); return }
    }
    setSavingFinca(false); setModalFinca(false); await cargar()
  }

  const openNewLote = (idfinca?: number) => {
    setFormLote({ idfinca: idfinca?.toString() ?? '', variedad: '', fecha_cosecha: new Date().toISOString().slice(0,10), peso_kg: '', precio_kg: '', estado: 'disponible' })
    setEditLote(null); setErrLote(null); setModalLote(true)
  }
  const openEditLote = (l: Lote) => {
    setFormLote({ idfinca: l.idfinca.toString(), variedad: l.variedad, fecha_cosecha: l.fecha_cosecha?.slice(0, 10) ?? '', peso_kg: l.peso_kg.toString(), precio_kg: l.precio_kg.toString(), estado: l.estado })
    setEditLote(l); setErrLote(null); setModalLote(true)
  }
  const saveLote = async () => {
    if (!formLote.variedad.trim() || !formLote.idfinca || !formLote.fecha_cosecha || !formLote.peso_kg || !formLote.precio_kg) {
      setErrLote('Completa todos los campos obligatorios.'); return
    }
    setSavingLote(true); setErrLote(null)
    const payload = {
      variedad: formLote.variedad.trim(), idfinca: Number(formLote.idfinca),
      fecha_cosecha: formLote.fecha_cosecha, peso_kg: Number(formLote.peso_kg),
      precio_kg: Number(formLote.precio_kg), estado: formLote.estado,
    }
    if (editLote) {
      const { error } = await supabase.from('lote_cafe').update(payload).eq('idlote_cafe', editLote.idlote_cafe)
      if (error) { setErrLote(error.message); setSavingLote(false); return }
    } else {
      const { error } = await supabase.from('lote_cafe').insert(payload)
      if (error) { setErrLote(error.message); setSavingLote(false); return }
    }
    setSavingLote(false); setModalLote(false); await cargar()
  }

  const totalKgDisponible = lotes.filter(l => l.estado === 'disponible').reduce((s, l) => s + l.peso_kg, 0)
  const totalKgVendido    = lotes.filter(l => l.estado === 'vendido').reduce((s, l) => s + l.peso_kg, 0)

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.2rem' }}>Portal Productor</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.84rem' }}>Seguimiento de tus fincas y lotes de café.</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {[
          { icon: '🌿', label: 'Mis fincas',     val: fincas.length,             color: 'var(--green)'   },
          { icon: '☕', label: 'Total lotes',     val: lotes.length,              color: 'var(--primary)' },
          { icon: '✅', label: 'Kg disponibles', val: `${totalKgDisponible} kg`, color: 'var(--amber)'   },
          { icon: '💰', label: 'Kg vendidos',    val: `${totalKgVendido} kg`,    color: 'var(--blue)'    },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ '--accent': s.color } as any}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div className="tabs" style={{ margin: 0, flex: 1 }}>
          <button className={`tab-btn${tab === 'fincas' ? ' active' : ''}`} onClick={() => setTab('fincas')}>🌿 Mis fincas ({fincas.length})</button>
          <button className={`tab-btn${tab === 'lotes' ? ' active' : ''}`} onClick={() => setTab('lotes')}>☕ Mis lotes ({lotes.length})</button>
        </div>
        {tab === 'fincas' && <button className="btn btn-primary btn-sm" onClick={openNewFinca}>+ Nueva finca</button>}
        {tab === 'lotes' && <button className="btn btn-primary btn-sm" onClick={() => openNewLote()}>+ Nuevo lote</button>}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : tab === 'fincas' ? (
        fincas.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🌿</div>
            <p>No tienes fincas registradas.</p>
            <button className="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={openNewFinca}>+ Registrar primera finca</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {fincas.map(f => {
              const lotesF = lotes.filter(l => l.idfinca === f.idfinca)
              const kgTotal = lotesF.reduce((s, l) => s + l.peso_kg, 0)
              return (
                <div key={f.idfinca} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-xl)', padding: '1.2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>🌿 {f.nombre}</div>
                      {f.ubicacion && <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>📍 {f.ubicacion}</div>}
                      {f.area_hectareas && <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)', marginTop: '0.1rem' }}>📐 {f.area_hectareas} ha</div>}
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEditFinca(f)} title="Editar finca">✏</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.75rem' }}>
                    <div style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: '0.4rem 0.6rem' }}>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Lotes</div>
                      <div style={{ fontWeight: 700, color: 'var(--blue)', fontSize: '1rem' }}>{lotesF.length}</div>
                    </div>
                    <div style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: '0.4rem 0.6rem' }}>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total kg</div>
                      <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1rem' }}>{kgTotal.toLocaleString('es-CO')}</div>
                    </div>
                  </div>
                  <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => openNewLote(f.idfinca)}>
                    + Nuevo lote en esta finca
                  </button>
                </div>
              )
            })}
          </div>
        )
      ) : (
        lotes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">☕</div>
            <p>No hay lotes registrados.</p>
            {fincas.length === 0
              ? <small style={{ color: 'var(--text-dim)', marginTop: '0.5rem', display: 'block' }}>Primero registra una finca.</small>
              : <button className="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={() => openNewLote()}>+ Registrar primer lote</button>
            }
          </div>
        ) : (
          <div className="data-table-wrap table-responsive">
            <table className="data-table">
              <thead>
                <tr><th>Variedad</th><th>Finca</th><th>Cosecha</th><th>Peso</th><th>Precio/kg</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {lotes.map(l => (
                  <tr key={l.idlote_cafe}>
                    <td><strong style={{ color: 'var(--text)' }}>{l.variedad}</strong></td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-soft)' }}>{(l.finca as any)?.nombre ?? '—'}</td>
                    <td style={{ fontSize: '0.82rem' }}>{new Date(l.fecha_cosecha).toLocaleDateString('es-CO')}</td>
                    <td><strong style={{ color: 'var(--primary)' }}>{l.peso_kg} kg</strong></td>
                    <td style={{ color: 'var(--amber)', fontSize: '0.82rem' }}>${Number(l.precio_kg).toLocaleString('es-CO')}</td>
                    <td><span className={`badge ${estadoBadge[l.estado] ?? 'badge-muted'}`}>{estadoLabel[l.estado] ?? l.estado}</span></td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => openEditLote(l)}>✏</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Modal Finca */}
      {modalFinca && (
        <div className="modal-overlay" onClick={() => setModalFinca(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3 className="modal-title">{editFinca ? 'Editar finca' : 'Nueva finca'}</h3>
              <button className="modal-close" onClick={() => setModalFinca(false)}>✕</button>
            </div>
            <div className="modal-body">
              {errFinca && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {errFinca}</div>}
              <div className="form-grid-2">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Nombre <span className="form-required">*</span></label>
                  <input className="form-input" value={formFinca.nombre} onChange={e => setFormFinca(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: La Esperanza" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Ubicación</label>
                  <input className="form-input" value={formFinca.ubicacion} onChange={e => setFormFinca(p => ({ ...p, ubicacion: e.target.value }))} placeholder="Ej: Huila, Pitalito" />
                </div>
                <div className="form-group">
                  <label className="form-label">Área (ha)</label>
                  <input className="form-input" type="number" value={formFinca.area_hectareas} onChange={e => setFormFinca(p => ({ ...p, area_hectareas: e.target.value }))} placeholder="Ej: 5.5" step="0.1" min="0" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalFinca(false)} disabled={savingFinca}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveFinca} disabled={savingFinca}>
                {savingFinca ? 'Guardando…' : editFinca ? 'Guardar cambios' : 'Crear finca'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lote */}
      {modalLote && (
        <div className="modal-overlay" onClick={() => setModalLote(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title">{editLote ? 'Editar lote' : 'Nuevo lote de café'}</h3>
              <button className="modal-close" onClick={() => setModalLote(false)}>✕</button>
            </div>
            <div className="modal-body">
              {errLote && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {errLote}</div>}
              {fincas.length === 0 ? (
                <div className="alert alert-warn">Primero debes registrar al menos una finca.</div>
              ) : (
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Finca <span className="form-required">*</span></label>
                    <select className="form-select" value={formLote.idfinca} onChange={e => setFormLote(p => ({ ...p, idfinca: e.target.value }))}>
                      <option value="">— Seleccionar —</option>
                      {fincas.map(f => <option key={f.idfinca} value={f.idfinca}>{f.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Variedad <span className="form-required">*</span></label>
                    <input className="form-input" value={formLote.variedad} onChange={e => setFormLote(p => ({ ...p, variedad: e.target.value }))} placeholder="Ej: Caturra, Geisha, Bourbon" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fecha cosecha <span className="form-required">*</span></label>
                    <input className="form-input" type="date" value={formLote.fecha_cosecha} onChange={e => setFormLote(p => ({ ...p, fecha_cosecha: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Peso (kg) <span className="form-required">*</span></label>
                    <input className="form-input" type="number" value={formLote.peso_kg} onChange={e => setFormLote(p => ({ ...p, peso_kg: e.target.value }))} placeholder="Ej: 500" step="0.01" min="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Precio / kg (COP) <span className="form-required">*</span></label>
                    <input className="form-input" type="number" value={formLote.precio_kg} onChange={e => setFormLote(p => ({ ...p, precio_kg: e.target.value }))} placeholder="Ej: 18500" step="100" min="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select className="form-select" value={formLote.estado} onChange={e => setFormLote(p => ({ ...p, estado: e.target.value }))}>
                      <option value="disponible">🟢 Disponible</option>
                      <option value="en_proceso">🟡 En proceso</option>
                      <option value="vendido">🔵 Vendido</option>
                      <option value="exportado">🟣 Exportado</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalLote(false)} disabled={savingLote}>Cancelar</button>
              {fincas.length > 0 && (
                <button className="btn btn-primary" onClick={saveLote} disabled={savingLote}>
                  {savingLote ? 'Guardando…' : editLote ? 'Guardar cambios' : 'Registrar lote'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
