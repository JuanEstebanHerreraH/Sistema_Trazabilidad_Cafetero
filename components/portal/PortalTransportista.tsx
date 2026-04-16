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
  lote_cafe: { variedad: string; peso_kg: number; estado: string } | null
  almacen_origen:  { nombre: string } | null
  almacen_destino: { nombre: string } | null
}

const TIPO_CFG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  entrada:  { icon: '📥', label: 'Entrada',  color: 'var(--green)', bg: 'var(--green-bg)' },
  salida:   { icon: '📤', label: 'Salida',   color: 'var(--red)',   bg: 'var(--red-bg)'   },
  traslado: { icon: '🔄', label: 'Traslado', color: 'var(--blue)',  bg: 'var(--blue-bg)'  },
}

export default function PortalTransportista({ usuario }: { usuario: UsuarioPortal }) {
  const supabase = createClient()
  const [movs, setMovs]         = useState<Movimiento[]>([])
  const [lotes, setLotes]       = useState<any[]>([])
  const [almacenes, setAlmacenes] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [tab, setTab]           = useState<'movimientos' | 'nuevo'>('movimientos')

  const [form, setForm]         = useState({ tipo: 'traslado', idlote_cafe: '', idalmacen_origen: '', idalmacen_destino: '', cantidad: '', notas: '' })
  const [saving, setSaving]     = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [exitoMsg, setExitoMsg] = useState<string | null>(null)

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    const [{ data: m }, { data: l }, { data: a }] = await Promise.all([
      supabase
        .from('movimiento_inventario')
        .select(`
          idmovimiento_inventario, tipo, fecha_movimiento, cantidad, notas,
          lote_cafe(variedad, peso_kg, estado),
          almacen_origen:almacen!idalmacen_origen(nombre),
          almacen_destino:almacen!idalmacen_destino(nombre)
        `)
        .eq('idusuario_responsable', usuario.idusuario)
        .order('fecha_movimiento', { ascending: false }),
      supabase.from('lote_cafe').select('idlote_cafe, variedad, estado, peso_kg').in('estado', ['disponible', 'en_proceso']),
      supabase.from('almacen').select('idalmacen, nombre, ubicacion'),
    ])
    setMovs((m ?? []) as any)
    setLotes(l ?? [])
    setAlmacenes(a ?? [])
    setLoading(false)
  }

  const guardar = async () => {
    if (!form.tipo || !form.idlote_cafe || !form.cantidad) {
      setErrorForm('Completa los campos obligatorios: tipo, lote y cantidad.')
      return
    }
    if (Number(form.cantidad) <= 0) {
      setErrorForm('La cantidad debe ser mayor a 0.')
      return
    }
    setSaving(true)
    setErrorForm(null)
    setExitoMsg(null)
    const { error } = await supabase.from('movimiento_inventario').insert({
      tipo:                  form.tipo,
      cantidad:              Number(form.cantidad),
      idlote_cafe:           Number(form.idlote_cafe),
      idalmacen_origen:      form.idalmacen_origen  ? Number(form.idalmacen_origen)  : null,
      idalmacen_destino:     form.idalmacen_destino ? Number(form.idalmacen_destino) : null,
      notas:                 form.notas || null,
      idusuario_responsable: usuario.idusuario,
      fecha_movimiento:      new Date().toISOString(),
    })
    setSaving(false)
    if (error) { setErrorForm(error.message); return }
    setExitoMsg('✅ Movimiento registrado correctamente.')
    setForm({ tipo: 'traslado', idlote_cafe: '', idalmacen_origen: '', idalmacen_destino: '', cantidad: '', notas: '' })
    setTimeout(() => { setExitoMsg(null); setTab('movimientos') }, 1500)
    cargar()
  }

  const movsFiltrados = movs.filter(m => !filtroTipo || m.tipo === filtroTipo)
  const kgTotales     = movs.reduce((acc, m) => acc + (m.cantidad ?? 0), 0)

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.25rem' }}>
          🚛 Panel del Transportista — {usuario.nombre}
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem' }}>
          Registra y consulta los movimientos de carga que has realizado.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { icon: '📦', label: 'Total movimientos', val: movs.length,           color: 'var(--primary)' },
          { icon: '⚖️', label: 'Kg transportados',  val: `${kgTotales}`,        color: 'var(--amber)'   },
          ...Object.entries(TIPO_CFG).map(([tipo, cfg]) => ({
            icon: cfg.icon, label: cfg.label + 's', color: cfg.color,
            val: movs.filter(m => m.tipo === tipo).length,
          })),
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-lg)', padding: '0.9rem 1rem' }}>
            <div style={{ fontSize: '1.3rem', marginBottom: '0.3rem' }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
        {([
          ['movimientos', '📋 Mis movimientos'],
          ['nuevo',       '+ Registrar movimiento'],
        ] as const).map(([t, lbl]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '0.4rem 1rem', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', background: tab === t ? 'var(--primary)' : 'var(--bg-hover)', color: tab === t ? 'var(--primary-fg)' : 'var(--text-soft)', transition: 'all var(--t)' }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : tab === 'movimientos' ? (
        <>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {[['', 'Todos'], ...Object.entries(TIPO_CFG).map(([k, v]) => [k, v.label])].map(([val, label]) => (
              <button key={val} onClick={() => setFiltroTipo(val)} style={{ padding: '0.28rem 0.75rem', border: '1px solid', borderRadius: '99px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', transition: 'all var(--t)', borderColor: filtroTipo === val ? 'var(--primary)' : 'var(--border)', background: filtroTipo === val ? 'rgba(200,120,42,0.12)' : 'transparent', color: filtroTipo === val ? 'var(--primary)' : 'var(--text-dim)' }}>
                {label}
              </button>
            ))}
          </div>

          {movsFiltrados.length === 0 ? (
            <Empty mensaje="No tienes movimientos registrados aún." />
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
                          {m.almacen_origen  && <span>📤 Desde: <strong>{m.almacen_origen.nombre}</strong></span>}
                          {m.almacen_destino && <span>📥 Hacia: <strong>{m.almacen_destino.nombre}</strong></span>}
                          <span>🗓 {new Date(m.fecha_movimiento).toLocaleDateString('es-CO', { dateStyle: 'medium' })}</span>
                        </div>
                        {m.notas && <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>📝 {m.notas}</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.05rem' }}>{m.cantidad} kg</div>
                        {m.lote_cafe?.peso_kg && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Lote: {m.lote_cafe.peso_kg} kg total</div>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        /* Formulario nuevo movimiento */
        <div style={{ maxWidth: 500 }}>
          {exitoMsg && <div style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green)', borderRadius: 'var(--r-md)', padding: '0.75rem 1rem', marginBottom: '1rem' }}>{exitoMsg}</div>}
          {errorForm && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {errorForm}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div>
              <label style={labelStyle}>Tipo de movimiento *</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {Object.entries(TIPO_CFG).map(([k, v]) => (
                  <button key={k} onClick={() => setForm(p => ({ ...p, tipo: k }))}
                    style={{ flex: 1, padding: '0.5rem', border: `2px solid ${form.tipo === k ? v.color : 'var(--border)'}`, borderRadius: 'var(--r-md)', background: form.tipo === k ? v.bg : 'transparent', color: form.tipo === k ? v.color : 'var(--text-dim)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all var(--t)' }}>
                    {v.icon} {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Lote de café *</label>
              <select style={selectStyle} value={form.idlote_cafe} onChange={e => setForm(p => ({ ...p, idlote_cafe: e.target.value }))}>
                <option value="">— Selecciona un lote —</option>
                {lotes.map(l => <option key={l.idlote_cafe} value={l.idlote_cafe}>{l.variedad} · {l.peso_kg}kg · #{l.idlote_cafe}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Cantidad a mover (kg) *</label>
              <input type="number" style={inputStyle} value={form.cantidad} onChange={e => setForm(p => ({ ...p, cantidad: e.target.value }))} placeholder="Ej: 200" min="1" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>Almacén origen</label>
                <select style={selectStyle} value={form.idalmacen_origen} onChange={e => setForm(p => ({ ...p, idalmacen_origen: e.target.value }))}>
                  <option value="">— Ninguno —</option>
                  {almacenes.map(a => <option key={a.idalmacen} value={a.idalmacen}>{a.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Almacén destino</label>
                <select style={selectStyle} value={form.idalmacen_destino} onChange={e => setForm(p => ({ ...p, idalmacen_destino: e.target.value }))}>
                  <option value="">— Ninguno —</option>
                  {almacenes.map(a => <option key={a.idalmacen} value={a.idalmacen}>{a.nombre}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Notas / Observaciones</label>
              <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 75 } as any} value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} placeholder="Condición del lote, incidentes en ruta, temperatura, etc." />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.5rem' }}>
            <button className="btn btn-secondary" onClick={() => setTab('movimientos')} disabled={saving}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : '✓ Registrar movimiento'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties  = { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: '0.35rem' }
const inputStyle: React.CSSProperties  = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0.48rem 0.75rem', color: 'var(--text)', fontSize: '0.85rem' }
const selectStyle: React.CSSProperties = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0.48rem 0.75rem', color: 'var(--text)', fontSize: '0.85rem' }

function Spinner() { return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>Cargando…</div> }
function Empty({ mensaje }: { mensaje: string }) {
  return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', background: 'var(--bg-card)', borderRadius: 'var(--r-xl)', border: '1px dashed var(--border)' }}><div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div><p style={{ fontSize: '0.88rem' }}>{mensaje}</p></div>
}
