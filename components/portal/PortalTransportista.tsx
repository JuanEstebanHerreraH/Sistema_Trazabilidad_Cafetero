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
  stock_actual: number
  porcentaje_ocupacion: number | null
  espacio_disponible: number | null
}

interface ContenidoAlmacen {
  idlote_cafe: number
  variedad: string
  kg_en_almacen: number
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

  // Contenido expandido de almacén
  const [contenidoAlmacen, setContenidoAlmacen] = useState<{ id: number; data: ContenidoAlmacen[] } | null>(null)
  const [loadingContenido, setLoadingContenido] = useState(false)

  // Contenido del almacén ORIGEN seleccionado (para filtrar lotes en salida/traslado)
  const [contenidoOrigen, setContenidoOrigen] = useState<ContenidoAlmacen[]>([])
  const [loadingOrigen, setLoadingOrigen] = useState(false)

  const [form, setForm]             = useState({ tipo: 'traslado', idlote_cafe: '', idalmacen_origen: '', idalmacen_destino: '', cantidad: '', notas: '' })
  const [saving, setSaving]         = useState(false)
  const [errorForm, setErrorForm]   = useState<string | null>(null)
  const [exitoMsg, setExitoMsg]     = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: m }, { data: l }] = await Promise.all([
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
    ])

    // Cargar almacenes con stock desde la vista
    const { data: almStock } = await supabase.from('v_almacen_stock').select('*').order('nombre')
    if (almStock) {
      setAlmacenes(almStock as AlmacenConStock[])
    } else {
      // Fallback sin vista
      const { data: rawAlm } = await supabase.from('almacen').select('idalmacen, nombre, ubicacion, capacidad_kg')
      setAlmacenes((rawAlm ?? []).map((a: any) => ({ ...a, stock_actual: 0, porcentaje_ocupacion: null, espacio_disponible: a.capacidad_kg ?? null })))
    }

    setMovs((m ?? []) as any)
    setLotes(l ?? [])
    setLoading(false)
  }, [usuario.idusuario])

  useEffect(() => { cargar() }, [cargar])

  // Cuando cambia el almacén origen, cargar sus lotes
  useEffect(() => {
    if ((form.tipo === 'salida' || form.tipo === 'traslado') && form.idalmacen_origen) {
      setLoadingOrigen(true)
      supabase.rpc('fn_contenido_almacen', { p_idalmacen: Number(form.idalmacen_origen) }).then(({ data }) => {
        setContenidoOrigen((data ?? []) as ContenidoAlmacen[])
        setLoadingOrigen(false)
      })
    } else {
      setContenidoOrigen([])
    }
  }, [form.idalmacen_origen, form.tipo])

  const verContenidoAlmacen = async (idalmacen: number) => {
    if (contenidoAlmacen?.id === idalmacen) {
      setContenidoAlmacen(null)
      return
    }
    setLoadingContenido(true)
    const { data } = await supabase.rpc('fn_contenido_almacen', { p_idalmacen: idalmacen })
    setContenidoAlmacen({ id: idalmacen, data: (data ?? []) as ContenidoAlmacen[] })
    setLoadingContenido(false)
  }

  const guardar = async () => {
    if (!form.tipo || !form.idlote_cafe || !form.cantidad) {
      setErrorForm('Completa: tipo, lote y cantidad.')
      return
    }
    if (Number(form.cantidad) <= 0) {
      setErrorForm('La cantidad debe ser mayor a 0.')
      return
    }

    // Validar que el lote esté en el almacén origen
    if ((form.tipo === 'salida' || form.tipo === 'traslado') && form.idalmacen_origen && form.idlote_cafe) {
      const loteEnOrigen = contenidoOrigen.find(c => c.idlote_cafe === Number(form.idlote_cafe))
      if (!loteEnOrigen) {
        setErrorForm('🚫 Ese lote no está en el almacén origen. Solo puedes mover lotes que estén dentro.')
        return
      }
      if (Number(form.cantidad) > loteEnOrigen.kg_en_almacen) {
        setErrorForm(`🚫 Solo hay ${loteEnOrigen.kg_en_almacen.toLocaleString('es-CO')} kg de "${loteEnOrigen.variedad}" en este almacén. No puedes mover ${Number(form.cantidad).toLocaleString('es-CO')} kg.`)
        return
      }
    }

    // Validar capacidad frontend
    if (form.idalmacen_destino && (form.tipo === 'entrada' || form.tipo === 'traslado')) {
      const destino = almacenes.find(a => a.idalmacen === Number(form.idalmacen_destino))
      if (destino && destino.capacidad_kg && destino.capacidad_kg > 0) {
        const espacioLibre = destino.espacio_disponible ?? (destino.capacidad_kg - destino.stock_actual)
        if (Number(form.cantidad) > espacioLibre) {
          setErrorForm(
            `🚫 El almacén "${destino.nombre}" solo tiene ${espacioLibre.toLocaleString('es-CO')} kg disponibles. ` +
            `Capacidad: ${destino.capacidad_kg.toLocaleString('es-CO')} kg, Stock actual: ${destino.stock_actual.toLocaleString('es-CO')} kg. ` +
            `No se pueden agregar ${Number(form.cantidad).toLocaleString('es-CO')} kg.`
          )
          return
        }
      }
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

    if (error) {
      const msg = error.message || ''
      if (msg.includes('CAPACIDAD_EXCEDIDA')) {
        setErrorForm(`🚫 ${msg.replace(/.*CAPACIDAD_EXCEDIDA:\s*/, '').replace(/\s*CONTEXT:.*/, '')}`)
      } else {
        setErrorForm(msg)
      }
      setSaving(false)
      return
    }

    // Si es entrada, marcar lote como en_proceso
    const loteSeleccionado = lotes.find(l => l.idlote_cafe === Number(form.idlote_cafe))
    if (form.tipo === 'entrada' && loteSeleccionado?.estado === 'disponible') {
      await supabase.from('lote_cafe').update({ estado: 'en_proceso' }).eq('idlote_cafe', Number(form.idlote_cafe))
    }
    if (form.tipo === 'salida' && !form.idalmacen_destino) {
      await supabase.from('lote_cafe').update({ estado: 'exportado' }).eq('idlote_cafe', Number(form.idlote_cafe))
    }

    setSaving(false)
    setExitoMsg(`✅ Movimiento de ${form.cantidad} kg registrado. Los almacenes y el stock están actualizados en toda la plataforma.`)
    setForm({ tipo: 'traslado', idlote_cafe: '', idalmacen_origen: '', idalmacen_destino: '', cantidad: '', notas: '' })
    setTimeout(() => { setExitoMsg(null); setTab('movimientos') }, 2000)
    await cargar()
  }

  const movsFiltrados = movs.filter(m => !filtroTipo || m.tipo === filtroTipo)
  const kgTotales     = movs.reduce((acc, m) => acc + (m.cantidad ?? 0), 0)

  const getBarColor = (pct: number) => {
    if (pct >= 95) return 'var(--red)'
    if (pct >= 80) return 'var(--amber)'
    if (pct >= 50) return 'var(--blue)'
    return 'var(--green)'
  }

  const almacenLabel = (a: AlmacenConStock) => {
    let label = `${a.nombre} (${a.stock_actual.toLocaleString('es-CO')} kg`
    if (a.capacidad_kg && a.capacidad_kg > 0) {
      label += ` / ${a.capacidad_kg.toLocaleString('es-CO')} kg`
    }
    label += ')'
    return label
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.25rem' }}>
          🚛 Panel del Transportista — {usuario.nombre}
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem' }}>
          Registra movimientos de inventario. Los cambios se reflejan en tiempo real en almacenes, admin y otros roles.
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
        /* Vista de stock por almacén con contenido expandible */
        almacenes.length === 0 ? <Empty mensaje="No hay almacenes registrados." /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {almacenes.map(a => {
              const pct = a.porcentaje_ocupacion ?? (a.capacidad_kg && a.capacidad_kg > 0 ? Math.round((a.stock_actual / a.capacidad_kg) * 100) : null)
              const barColor = pct === null ? 'var(--primary)' : getBarColor(pct)
              const isExpanded = contenidoAlmacen?.id === a.idalmacen
              return (
                <div key={a.idalmacen} style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${(pct ?? 0) >= 100 ? 'var(--red)' : (pct ?? 0) >= 80 ? 'var(--amber)' : 'var(--border-soft)'}`,
                  borderRadius: 'var(--r-xl)',
                  padding: '1.25rem',
                  transition: 'border-color 0.3s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>🏪 {a.nombre}</div>
                    {pct !== null && pct >= 100 && <span style={{ padding: '0.1rem 0.4rem', borderRadius: '99px', fontSize: '0.65rem', background: 'var(--red-bg)', color: 'var(--red)', fontWeight: 700 }}>🔴 LLENO</span>}
                    {pct !== null && pct >= 80 && pct < 100 && <span style={{ padding: '0.1rem 0.4rem', borderRadius: '99px', fontSize: '0.65rem', background: 'var(--amber-bg)', color: 'var(--amber)', fontWeight: 700 }}>🟡 Casi lleno</span>}
                  </div>
                  {a.ubicacion && <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>📍 {a.ubicacion}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-soft)' }}>Stock actual:</span>
                    <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>{a.stock_actual.toLocaleString('es-CO')} kg</span>
                  </div>
                  {a.capacidad_kg && a.capacidad_kg > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Capacidad:</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{a.capacidad_kg.toLocaleString('es-CO')} kg</span>
                      </div>
                      <div style={{ background: 'var(--bg)', borderRadius: '99px', height: 8, overflow: 'hidden', marginBottom: '0.3rem' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, pct ?? 0)}%`, background: barColor, borderRadius: '99px', transition: 'width 0.5s' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '0.6rem' }}>
                        <span style={{ color: barColor, fontWeight: 700 }}>{pct}% ocupado</span>
                        <span style={{ color: 'var(--text-dim)' }}>{(a.espacio_disponible ?? 0).toLocaleString('es-CO')} kg libres</span>
                      </div>
                    </>
                  )}

                  {/* Botón ver contenido */}
                  <button onClick={() => verContenidoAlmacen(a.idalmacen)} style={{
                    width: '100%', padding: '0.4rem', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                    background: isExpanded ? 'var(--bg)' : 'transparent', color: 'var(--text-soft)', fontWeight: 600,
                    fontSize: '0.78rem', cursor: 'pointer', transition: 'all var(--t)',
                  }}>
                    {isExpanded ? '▲ Ocultar contenido' : '📦 Ver lotes dentro'}
                  </button>

                  {/* Contenido expandido */}
                  {isExpanded && (
                    <div style={{ marginTop: '0.6rem', borderTop: '1px solid var(--border-soft)', paddingTop: '0.6rem' }}>
                      {loadingContenido ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center', padding: '0.5rem' }}>Cargando…</div>
                      ) : contenidoAlmacen.data.length === 0 ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center', padding: '0.5rem' }}>📭 Vacío</div>
                      ) : (
                        contenidoAlmacen.data.map(c => (
                          <div key={c.idlote_cafe} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.3rem 0', borderBottom: '1px solid var(--border-soft)' }}>
                            <span style={{ color: 'var(--text-soft)' }}>☕ {c.variedad} <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>#{c.idlote_cafe}</span></span>
                            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{c.kg_en_almacen.toLocaleString('es-CO')} kg</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      ) : (
        /* Formulario con validación de capacidad */
        <div style={{ maxWidth: 520 }}>
          {exitoMsg && <div style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green)', borderRadius: 'var(--r-md)', padding: '0.75rem 1rem', marginBottom: '1rem', fontWeight: 600 }}>{exitoMsg}</div>}
          {errorForm && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {errorForm}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Tipo de movimiento */}
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
              {(form.tipo === 'salida' || form.tipo === 'traslado') && !form.idalmacen_origen ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--amber)', background: 'var(--amber-bg)', padding: '0.5rem 0.75rem', borderRadius: 'var(--r-md)' }}>⬆️ Primero selecciona un almacén origen para ver los lotes disponibles.</p>
              ) : loadingOrigen && (form.tipo === 'salida' || form.tipo === 'traslado') ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Cargando lotes del almacén…</p>
              ) : (
                <select style={selS} value={form.idlote_cafe} onChange={e => setForm(p => ({ ...p, idlote_cafe: e.target.value }))}>
                  <option value="">— Selecciona —</option>
                  {(form.tipo === 'entrada'
                    ? lotes
                    : contenidoOrigen.map(c => ({ idlote_cafe: c.idlote_cafe, variedad: c.variedad, peso_kg: c.kg_en_almacen, estado: 'en almacén' }))
                  ).map((l: any) => (
                    <option key={l.idlote_cafe} value={l.idlote_cafe}>
                      {l.variedad} · {l.peso_kg} kg {form.tipo !== 'entrada' ? 'en almacén' : `· ${l.estado}`} · #{l.idlote_cafe}
                    </option>
                  ))}
                </select>
              )}
              {(form.tipo === 'salida' || form.tipo === 'traslado') && form.idalmacen_origen && contenidoOrigen.length === 0 && !loadingOrigen && (
                <p style={{ fontSize: '0.74rem', color: 'var(--red)', marginTop: '0.3rem' }}>📭 Este almacén está vacío. No hay lotes para mover.</p>
              )}
            </div>

            <div>
              <label style={lblS}>Cantidad a mover (kg) *</label>
              <input type="number" style={inpS} value={form.cantidad} onChange={e => setForm(p => ({ ...p, cantidad: e.target.value }))} placeholder="Ej: 200" min="1" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {(form.tipo === 'salida' || form.tipo === 'traslado') && (
                <div>
                  <label style={lblS}>Almacén origen {form.tipo === 'traslado' ? '*' : ''}</label>
                  <select style={selS} value={form.idalmacen_origen} onChange={e => setForm(p => ({ ...p, idalmacen_origen: e.target.value, idlote_cafe: '', cantidad: '' }))}>
                    <option value="">— Ninguno —</option>
                    {almacenes.map(a => <option key={a.idalmacen} value={a.idalmacen}>{almacenLabel(a)}</option>)}
                  </select>
                </div>
              )}
              {(form.tipo === 'entrada' || form.tipo === 'traslado') && (
                <div>
                  <label style={lblS}>Almacén destino {form.tipo === 'traslado' ? '*' : ''}</label>
                  <select style={selS} value={form.idalmacen_destino} onChange={e => setForm(p => ({ ...p, idalmacen_destino: e.target.value }))}>
                    <option value="">— Ninguno —</option>
                    {almacenes.map(a => {
                      const lleno = a.capacidad_kg && a.capacidad_kg > 0 && (a.espacio_disponible ?? 0) <= 0
                      return (
                        <option key={a.idalmacen} value={a.idalmacen} disabled={!!lleno}>
                          {lleno ? '🔴 ' : ''}{almacenLabel(a)}{lleno ? ' — LLENO' : ''}
                        </option>
                      )
                    })}
                  </select>
                  {/* Warning */}
                  {form.idalmacen_destino && (() => {
                    const dest = almacenes.find(a => a.idalmacen === Number(form.idalmacen_destino))
                    if (!dest || !dest.capacidad_kg || dest.capacidad_kg <= 0) return null
                    const pct = Math.round((dest.stock_actual / dest.capacidad_kg) * 100)
                    if (pct >= 80) {
                      return <p style={{ fontSize: '0.74rem', color: pct >= 95 ? 'var(--red)' : 'var(--amber)', marginTop: '0.3rem', fontWeight: 600 }}>
                        ⚠️ {pct}% ocupado — {(dest.espacio_disponible ?? 0).toLocaleString('es-CO')} kg libres
                      </p>
                    }
                    return <p style={{ fontSize: '0.74rem', color: 'var(--green)', marginTop: '0.3rem' }}>
                      ✅ {(dest.espacio_disponible ?? 0).toLocaleString('es-CO')} kg disponibles
                    </p>
                  })()}
                </div>
              )}
            </div>

            <div>
              <label style={lblS}>Notas / Observaciones</label>
              <textarea style={{ ...inpS, resize: 'vertical', minHeight: 75 } as any} value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} placeholder="Condiciones del café, placa vehículo, temperatura, etc." />
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
