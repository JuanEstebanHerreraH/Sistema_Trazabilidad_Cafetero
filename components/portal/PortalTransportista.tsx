'use client'

interface UsuarioPortal { idusuario: number; nombre: string; email: string; estado_aprobacion: string }

import { useEffect, useState } from 'react'
import { createClient } from '../../utils/supabase/client'

interface Movimiento {
  idmovimiento_inventario: number
  tipo: string
  fecha_movimiento: string
  cantidad: number
  notas: string | null
  lote_cafe: { variedad: string; peso_kg: number } | null
  almacen_origen: { nombre: string } | null
  almacen_destino: { nombre: string } | null
}

const TIPO_CFG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  entrada:  { icon: '📥', label: 'Entrada',  color: 'var(--green)', bg: 'var(--green-bg)' },
  salida:   { icon: '📤', label: 'Salida',   color: 'var(--red)',   bg: 'var(--red-bg)'   },
  traslado: { icon: '🔄', label: 'Traslado', color: 'var(--blue)',  bg: 'var(--blue-bg)'  },
}

export default function PortalTransportista({ usuario }: { usuario: UsuarioPortal }) {
  const supabase = createClient()
  const [movs, setMovs]       = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('')

  // Modal nuevo movimiento
  const [modal, setModal]   = useState(false)
  const [lotes, setLotes]   = useState<any[]>([])
  const [almacenes, setAlmacenes] = useState<any[]>([])
  const [form, setForm]     = useState({ tipo: 'traslado', idlote_cafe: '', idalmacen_origen: '', idalmacen_destino: '', cantidad: '', notas: '' })
  const [saving, setSaving] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    const [{ data: m }, { data: l }, { data: a }] = await Promise.all([
      supabase
        .from('movimiento_inventario')
        .select('idmovimiento_inventario, tipo, fecha_movimiento, cantidad, notas, lote_cafe(variedad, peso_kg), almacen_origen:almacen!idalmacen_origen(nombre), almacen_destino:almacen!idalmacen_destino(nombre)')
        .eq('idusuario_responsable', usuario.idusuario)
        .order('fecha_movimiento', { ascending: false }),
      supabase.from('lote_cafe').select('idlote_cafe, variedad').eq('estado', 'disponible'),
      supabase.from('almacen').select('idalmacen, nombre'),
    ])
    setMovs((m ?? []) as any)
    setLotes(l ?? [])
    setAlmacenes(a ?? [])
    setLoading(false)
  }

  const guardar = async () => {
    if (!form.tipo || !form.idlote_cafe || !form.cantidad) {
      setErrorForm('Completa los campos obligatorios.')
      return
    }
    setSaving(true)
    setErrorForm(null)
    const { error } = await supabase.from('movimiento_inventario').insert({
      tipo:                   form.tipo,
      cantidad:               Number(form.cantidad),
      idlote_cafe:            Number(form.idlote_cafe),
      idalmacen_origen:       form.idalmacen_origen ? Number(form.idalmacen_origen) : null,
      idalmacen_destino:      form.idalmacen_destino ? Number(form.idalmacen_destino) : null,
      notas:                  form.notas || null,
      idusuario_responsable:  usuario.idusuario,
      fecha_movimiento:       new Date().toISOString(),
    })
    setSaving(false)
    if (error) { setErrorForm(error.message); return }
    setModal(false)
    cargar()
  }

  const movsFiltrados = movs.filter(m => !filtroTipo || m.tipo === filtroTipo)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.25rem' }}>🚛 Mis Movimientos</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem' }}>Historial de entradas, salidas y traslados que has registrado.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setModal(true); setErrorForm(null) }}>+ Registrar movimiento</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {Object.entries(TIPO_CFG).map(([tipo, cfg]) => (
          <div key={tipo} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-lg)', padding: '0.9rem 1rem' }}>
            <div style={{ fontSize: '1.3rem', marginBottom: '0.3rem' }}>{cfg.icon}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: cfg.color }}>{movs.filter(m => m.tipo === tipo).length}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>{cfg.label}s</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[['', 'Todos'], ...Object.entries(TIPO_CFG).map(([k, v]) => [k, v.label])].map(([val, label]) => (
          <button key={val} onClick={() => setFiltroTipo(val)} style={{ padding: '0.28rem 0.75rem', border: '1px solid', borderRadius: '99px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', transition: 'all var(--t)', borderColor: filtroTipo === val ? 'var(--primary)' : 'var(--border)', background: filtroTipo === val ? 'rgba(200,120,42,0.12)' : 'transparent', color: filtroTipo === val ? 'var(--primary)' : 'var(--text-dim)' }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : movsFiltrados.length === 0 ? (
        <Empty mensaje="No tienes movimientos registrados." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {movsFiltrados.map(m => {
            const cfg = TIPO_CFG[m.tipo]
            return (
              <div key={m.idmovimiento_inventario} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-lg)', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                      <span style={{ padding: '0.15rem 0.6rem', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 700, background: cfg.bg, color: cfg.color }}>{cfg.icon} {cfg.label}</span>
                      <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>{m.lote_cafe?.variedad ?? '—'}</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {m.almacen_origen  && <span>Desde: {m.almacen_origen.nombre}</span>}
                      {m.almacen_destino && <span>Hacia: {m.almacen_destino.nombre}</span>}
                      <span>{new Date(m.fecha_movimiento).toLocaleDateString('es-CO', { dateStyle: 'medium' })}</span>
                    </div>
                    {m.notas && <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>📝 {m.notas}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.05rem' }}>{m.cantidad} kg</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }} onClick={() => setModal(false)}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '1.75rem', width: '100%', maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text)', marginBottom: '1.25rem' }}>Registrar movimiento</h3>
            {errorForm && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {errorForm}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <SelectField label="Tipo *" value={form.tipo} onChange={v => setForm(p => ({ ...p, tipo: v }))} options={Object.entries(TIPO_CFG).map(([k, v]) => ({ value: k, label: v.label }))} />
              <SelectField label="Lote de café *" value={form.idlote_cafe} onChange={v => setForm(p => ({ ...p, idlote_cafe: v }))} options={lotes.map(l => ({ value: l.idlote_cafe, label: l.variedad }))} />
              <InputField label="Cantidad (kg) *" type="number" value={form.cantidad} onChange={v => setForm(p => ({ ...p, cantidad: v }))} placeholder="Kg a mover" />
              <SelectField label="Almacén origen" value={form.idalmacen_origen} onChange={v => setForm(p => ({ ...p, idalmacen_origen: v }))} options={almacenes.map(a => ({ value: a.idalmacen, label: a.nombre }))} />
              <SelectField label="Almacén destino" value={form.idalmacen_destino} onChange={v => setForm(p => ({ ...p, idalmacen_destino: v }))} options={almacenes.map(a => ({ value: a.idalmacen, label: a.nombre }))} />
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: '0.35rem' }}>Notas</label>
                <textarea style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0.48rem 0.75rem', color: 'var(--text)', fontSize: '0.85rem', resize: 'vertical', minHeight: 70 }} value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} placeholder="Observaciones opcionales" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setModal(false)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Registrar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InputField({ label, value, onChange, placeholder = '', type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: '0.35rem' }}>{label}</label>
      <input type={type} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0.48rem 0.75rem', color: 'var(--text)', fontSize: '0.85rem' }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string | number; label: string }[] }) {
  return (
    <div>
      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: '0.35rem' }}>{label}</label>
      <select style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0.48rem 0.75rem', color: 'var(--text)', fontSize: '0.85rem' }} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">— Selecciona —</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function Spinner() { return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>Cargando…</div> }
function Empty({ mensaje }: { mensaje: string }) {
  return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', background: 'var(--bg-card)', borderRadius: 'var(--r-xl)', border: '1px dashed var(--border)' }}><div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div><p style={{ fontSize: '0.88rem' }}>{mensaje}</p></div>
}
