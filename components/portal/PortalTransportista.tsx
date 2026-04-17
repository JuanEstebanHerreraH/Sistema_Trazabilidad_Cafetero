'use client'
interface UsuarioPortal { idusuario: number; nombre: string; email: string; estado_aprobacion: string }

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '../../utils/supabase/client'

interface Movimiento {
  idmovimiento_inventario: number
  tipo: string
  fecha_movimiento: string
  cantidad: number
  notas: string | null
  lote_cafe: { idlote_cafe: number; variedad: string; peso_kg: number; estado: string } | null
  almacen_origen:  { nombre: string } | null
  almacen_destino: { nombre: string } | null
}

interface AlmacenConStock {
  idalmacen: number
  nombre: string
  ubicacion: string | null
  capacidad_kg: number | null
  stock_actual: number  // calculado de movimientos
}

const TIPO_CFG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  entrada:  { icon: '📥', label: 'Entrada',  color: 'var(--green)', bg: 'var(--green-bg)' },
  salida:   { icon: '📤', label: 'Salida',   color: 'var(--red)',   bg: 'var(--red-bg)'   },
  traslado: { icon: '🔄', label: 'Traslado', color: 'var(--blue)',  bg: 'var(--blue-bg)'  },
}

export default function PortalTransportista({ usuario }: { usuario: UsuarioPortal }) {
  const supabase = createClient()
  const [movs, setMovs]             = useState<Movimiento[]>([])
  const [almacenes, setAlmacenes]   = useState<AlmacenConStock[]>([])
  const [lotes, setLotes]           = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [tab, setTab]               = useState<'movimientos' | 'almacenes' | 'nuevo'>('movimientos')

  const [form, setForm]             = useState({ tipo: 'traslado', idlote_cafe: '', idalmacen_origen: '', idalmacen_destino: '', cantidad: '', notas: '' })
  const [saving, setSaving]         = useState(false)
  const [errorForm, setErrorForm]   = useState<string | null>(null)
  const [exitoMsg, setExitoMsg]     = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: m }, { data: l }, { data: a }, { data: allMovs }] = await Promise.all([
      supabase
        .from('movimiento_inventario')
        .select(`
          idmovimiento_inventario, tipo, fecha_movimiento, cantidad, notas,
          lote_cafe(idlote_cafe, variedad, peso_kg, estado),
          almacen_origen:almacen!idalmacen_origen(nombre),
          almacen_destino:almacen!idalmacen_destino(nombre)
        `)
        .eq('idusuario_responsable', usuario.idusuario)
        .order('fecha_movimiento', { ascending: false }),
      supabase.from('lote_cafe').select('idlote_cafe, variedad, estado, peso_kg').in('estado', ['disponible', 'en_proceso']),
      supabase.from('almacen').select('idalmacen, nombre, ubicacion, capacidad_kg'),
      // Todos los movimientos para calcular stock por almacén
      supabase.from('movimiento_inventario').select('idalmacen_origen, idalmacen_destino, cantidad, tipo'),
    ])

    // Calcular stock por almacén
    const stockMap: Record<number, number> = {}
    ;(allMovs ?? []).forEach((mv: any) => {
      if (mv.tipo === 'entrada' && mv.idalmacen_destino) {
        stockMap[mv.idalmacen_destino] = (stockMap[mv.idalmacen_destino] ?? 0) + Number(mv.cantidad)
      }
      if (mv.tipo === 'salida' && mv.idalmacen_origen) {
        stockMap[mv.idalmacen_origen] = (stockMap[mv.idalmacen_origen] ?? 0) - Number(mv.cantidad)
      }
      if (mv.tipo === 'traslado') {
        if (mv.idalmacen_origen)  stockMap[mv.idalmacen_origen]  = (stockMap[mv.idalmacen_origen]  ?? 0) - Number(mv.cantidad)
        if (mv.idalmacen_destino) stockMap[mv.idalmacen_destino] = (stockMap[mv.idalmacen_destino] ?? 0) + Number(mv.cantidad)
      }
    })

    const almacenesConStock: AlmacenConStock[] = (a ?? []).map((alm: any) => ({
      ...alm,
      stock_actual: Math.max(0, stockMap[alm.idalmacen] ?? 0),
    }))

    setMovs((m ?? []) as any)
    setLotes(l ?? [])
    setAlmacenes(almacenesConStock)
    setLoading(false)
  }, [usuario.idusuario])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async () => {
    if (!form.tipo || !form.idlote_cafe || !form.cantidad) {
      setErrorForm('Completa: tipo, lote y cantidad.')
      return
    }
    if (Number(form.cantidad) <= 0) {
      setErrorForm('La cantidad debe ser mayor a 0.')
      return
    }
    if (form.tipo === 'traslado' && (!form.idalmacen_origen || !form.idalmacen_destino)) {
      setErrorForm('Un traslado requiere almacén origen y destino.')
      return
    }
    if (form.tipo === 'entrada' && !form.idalmacen_destino) {
      setErrorForm('Una entrada requiere almacén destino.')
      return
    }
    if (form.tipo === 'salida' && !form.idalmacen_origen) {
      setErrorForm('Una salida requiere almacén origen.')
      return
    }
    setSaving(true)
    setErrorForm(null)
    setExitoMsg(null)

    const loteSeleccionado = lotes.find(l => l.idlote_cafe === Number(form.idlote_cafe))

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

    if (error) { setErrorForm(error.message); setSaving(false); return }

    // Si es entrada, marcar lote como en_proceso
    if (form.tipo === 'entrada' && loteSeleccionado?.estado === 'disponible') {
      await supabase.from('lote_cafe').update({ estado: 'en_proceso' }).eq('idlote_cafe', Number(form.idlote_cafe))
    }
    // Si es salida definitiva (sin almacén origen conocido → exportación), marcar exportado
    if (form.tipo === 'salida' && !form.idalmacen_destino) {
      await supabase.from('lote_cafe').update({ estado: 'exportado' }).eq('idlote_cafe', Number(form.idlote_cafe))
    }

    setSaving(false)
    setExitoMsg(`✅ Movimiento de ${form.cantidad} kg registrado. Los almacenes y la BD están actualizados.`)
    setForm({ tipo: 'traslado', idlote_cafe: '', idalmacen_origen: '', idalmacen_destino: '', cantidad: '', notas: '' })
    setTimeout(() => { setExitoMsg(null); setTab('movimientos') }, 2000)
    await cargar()
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
          Registra movimientos de inventario. Cada operación actualiza el stock de almacenes en tiempo real.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { icon: '📦', label: 'Total ops.',       val: movs.length,       color: 'var(--primary)' },
          { icon: '⚖️', label: 'Kg movidos',       val: `${kgTotales} kg`, color: 'var(--amber)'   },
          { icon: '🏪', label: 'Almacenes',         val: almacenes.length,  color: 'var(--blue)'    },
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
          ['almacenes',   '🏪 Stock almacenes'],
          ['nuevo',       '+ Registrar movimiento'],
        ] as const).map(([t, lbl]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '0.4rem 1rem', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', background: tab === t ? 'var(--primary)' : 'var(--bg-hover)', color: tab === t ? 'var(--primary-fg)' : 'var(--text-soft)', transition: 'all var(--t)' }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : tab === 'movimientos' ? (
        <>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {[['', 'Todos'], ...Object.entries(TIPO_CFG).map(([k, v]) => [k, v.label])].map(([val, label]) => (
              <button key={val} onClick={() => setFiltroTipo(val)} style={{ padding: '0.28rem 0.75rem', border: '1px solid', borderRadius: '99px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', borderColor: filtroTipo === val ? 'var(--primary)' : 'var(--border)', background: filtroTipo === val ? 'rgba(200,120,42,0.12)' : 'transparent', color: filtroTipo === val ? 'var(--primary)' : 'var(--text-dim)' }}>
                {label}
              </button>
            ))}
          </div>
          {movsFiltrados.length === 0 ? <Empty mensaje="No tienes movimientos registrados aún." /> : (
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
                          {m.almacen_origen  && <span>📤 {m.almacen_origen.nombre}</span>}
                          {m.almacen_origen && m.almacen_destino && <span>→</span>}
                          {m.almacen_destino && <span>📥 {m.almacen_destino.nombre}</span>}
                          <span>🗓 {new Date(m.fecha_movimiento).toLocaleDateString('es-CO', { dateStyle: 'medium' })}</span>
                        </div>
                        {m.notas && <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>📝 {m.notas}</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>{m.cantidad} kg</div>
                        {m.lote_cafe && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Lote #{m.lote_cafe.idlote_cafe}</div>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : tab === 'almacenes' ? (
        /* Vista de stock por almacén */
        almacenes.length === 0 ? <Empty mensaje="No hay almacenes registrados." /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
            {almacenes.map(a => {
              const pct = a.capacidad_kg ? Math.min(100, Math.round((a.stock_actual / a.capacidad_kg) * 100)) : null
              const barColor = pct === null ? 'var(--primary)' : pct > 80 ? 'var(--red)' : pct > 50 ? 'var(--amber)' : 'var(--green)'
              return (
                <div key={a.idalmacen} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-xl)', padding: '1.25rem' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--text)', marginBottom: '0.3rem' }}>🏪 {a.nombre}</div>
                  {a.ubicacion && <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>📍 {a.ubicacion}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-soft)' }}>Stock actual:</span>
                    <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>{a.stock_actual.toLocaleString('es-CO')} kg</span>
                  </div>
                  {a.capacidad_kg && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Capacidad:</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{a.capacidad_kg.toLocaleString('es-CO')} kg</span>
                      </div>
                      <div style={{ background: 'var(--bg)', borderRadius: '99px', height: 8, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '99px', transition: 'width 0.5s' }} />
                      </div>
                      <div style={{ fontSize: '0.7rem', color: barColor, fontWeight: 700, marginTop: '0.25rem', textAlign: 'right' }}>{pct}% ocupado</div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )
      ) : (
        /* Formulario */
        <div style={{ maxWidth: 520 }}>
          {exitoMsg && <div style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green)', borderRadius: 'var(--r-md)', padding: '0.75rem 1rem', marginBottom: '1rem', fontWeight: 600 }}>{exitoMsg}</div>}
          {errorForm && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {errorForm}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Tipo de movimiento con botones visuales */}
            <div>
              <label style={lblS}>Tipo de movimiento *</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {Object.entries(TIPO_CFG).map(([k, v]) => (
                  <button key={k} onClick={() => setForm(p => ({ ...p, tipo: k }))}
                    style={{ flex: 1, padding: '0.55rem', border: `2px solid ${form.tipo === k ? v.color : 'var(--border)'}`, borderRadius: 'var(--r-md)', background: form.tipo === k ? v.bg : 'transparent', color: form.tipo === k ? v.color : 'var(--text-dim)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', transition: 'all var(--t)' }}>
                    {v.icon}<br />{v.label}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                {form.tipo === 'entrada'  && '📥 Café que llega a un almacén (marca lote como "en proceso").'}
                {form.tipo === 'salida'   && '📤 Café que sale de un almacén (si no hay destino, se marca como "exportado").'}
                {form.tipo === 'traslado' && '🔄 Café que se mueve entre almacenes (requiere origen y destino).'}
              </p>
            </div>

            <div>
              <label style={lblS}>Lote de café *</label>
              <select style={selS} value={form.idlote_cafe} onChange={e => setForm(p => ({ ...p, idlote_cafe: e.target.value }))}>
                <option value="">— Selecciona —</option>
                {lotes.map(l => <option key={l.idlote_cafe} value={l.idlote_cafe}>{l.variedad} · {l.peso_kg}kg · Estado: {l.estado} · #{l.idlote_cafe}</option>)}
              </select>
            </div>

            <div>
              <label style={lblS}>Cantidad a mover (kg) *</label>
              <input type="number" style={inpS} value={form.cantidad} onChange={e => setForm(p => ({ ...p, cantidad: e.target.value }))} placeholder="Ej: 200" min="1" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {(form.tipo === 'salida' || form.tipo === 'traslado') && (
                <div>
                  <label style={lblS}>Almacén origen {form.tipo === 'traslado' ? '*' : ''}</label>
                  <select style={selS} value={form.idalmacen_origen} onChange={e => setForm(p => ({ ...p, idalmacen_origen: e.target.value }))}>
                    <option value="">— Ninguno —</option>
                    {almacenes.map(a => <option key={a.idalmacen} value={a.idalmacen}>{a.nombre} ({a.stock_actual} kg)</option>)}
                  </select>
                </div>
              )}
              {(form.tipo === 'entrada' || form.tipo === 'traslado') && (
                <div>
                  <label style={lblS}>Almacén destino {form.tipo === 'traslado' ? '*' : ''}</label>
                  <select style={selS} value={form.idalmacen_destino} onChange={e => setForm(p => ({ ...p, idalmacen_destino: e.target.value }))}>
                    <option value="">— Ninguno —</option>
                    {almacenes.map(a => <option key={a.idalmacen} value={a.idalmacen}>{a.nombre} ({a.stock_actual} kg)</option>)}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label style={lblS}>Notas / Observaciones</label>
              <textarea style={{ ...inpS, resize: 'vertical', minHeight: 75 } as any} value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} placeholder="Condiciones del café, incidentes, placa vehículo, temperatura, etc." />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.5rem' }}>
            <button style={{ ...btnSec }} onClick={() => setTab('movimientos')} disabled={saving}>Cancelar</button>
            <button style={{ ...btnPri, flex: 1 }} onClick={guardar} disabled={saving}>{saving ? '⏳ Registrando…' : '✓ Registrar movimiento'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

const lblS: React.CSSProperties  = { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: '0.35rem' }
const inpS: React.CSSProperties  = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0.48rem 0.75rem', color: 'var(--text)', fontSize: '0.85rem' }
const selS: React.CSSProperties  = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0.48rem 0.75rem', color: 'var(--text)', fontSize: '0.85rem' }
const btnPri: React.CSSProperties = { padding: '0.55rem 1.1rem', border: 'none', borderRadius: 'var(--r-md)', background: 'var(--primary)', color: 'var(--primary-fg)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }
const btnSec: React.CSSProperties = { padding: '0.55rem 1rem', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'transparent', color: 'var(--text-soft)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }

function Spinner() { return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>Cargando…</div> }
function Empty({ mensaje }: { mensaje: string }) {
  return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', background: 'var(--bg-card)', borderRadius: 'var(--r-xl)', border: '1px dashed var(--border)' }}><div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div><p style={{ fontSize: '0.88rem' }}>{mensaje}</p></div>
}
