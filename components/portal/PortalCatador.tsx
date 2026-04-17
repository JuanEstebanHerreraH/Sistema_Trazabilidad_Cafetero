'use client'
interface UsuarioPortal { idusuario: number; nombre: string; email: string; estado_aprobacion: string }

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '../../utils/supabase/client'

interface RegistroProceso {
  idregistro_proceso: number
  fecha_inicio: string
  fecha_fin: string
  notas: string | null
  lote_cafe: { idlote_cafe: number; variedad: string; peso_kg: number; estado: string; finca: { nombre: string } | null } | null
  proceso: { nombre: string; descripcion: string | null } | null
}

const ESTADO_CFG: Record<string, { label: string; color: string; bg: string }> = {
  disponible: { label: 'Disponible', color: 'var(--green)',  bg: 'var(--green-bg)' },
  en_proceso: { label: 'En proceso', color: 'var(--amber)',  bg: 'var(--amber-bg)' },
  vendido:    { label: 'Vendido',    color: 'var(--blue)',   bg: 'var(--blue-bg)'  },
  exportado:  { label: 'Exportado',  color: 'var(--purple)', bg: 'var(--purple-bg)' },
}

export default function PortalCatador({ usuario }: { usuario: UsuarioPortal }) {
  const supabase = createClient()
  const [registros, setRegistros]   = useState<RegistroProceso[]>([])
  const [lotes, setLotes]           = useState<any[]>([])
  const [procesos, setProcesos]     = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState<'mis_registros' | 'catalogo' | 'nuevo'>('mis_registros')

  const [form, setForm]             = useState({ idlote_cafe: '', idproceso: '', fecha_inicio: '', fecha_fin: '', notas: '' })
  const [saving, setSaving]         = useState(false)
  const [errorForm, setErrorForm]   = useState<string | null>(null)
  const [exitoMsg, setExitoMsg]     = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: r }, { data: l }, { data: p }] = await Promise.all([
      supabase
        .from('registro_proceso')
        .select(`
          idregistro_proceso, fecha_inicio, fecha_fin, notas,
          lote_cafe(idlote_cafe, variedad, peso_kg, estado, finca(nombre)),
          proceso(nombre, descripcion)
        `)
        .eq('idusuario', usuario.idusuario)
        .order('fecha_inicio', { ascending: false }),
      supabase
        .from('lote_cafe')
        .select('idlote_cafe, variedad, peso_kg, estado, finca(nombre)')
        .in('estado', ['disponible', 'en_proceso'])
        .order('fecha_cosecha', { ascending: false }),
      supabase.from('proceso').select('idproceso, nombre, descripcion').order('nombre'),
    ])
    setRegistros((r ?? []) as any)
    setLotes((l ?? []) as any)
    setProcesos(p ?? [])
    setLoading(false)
  }, [usuario.idusuario])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async () => {
    if (!form.idlote_cafe || !form.idproceso || !form.fecha_inicio || !form.fecha_fin) {
      setErrorForm('Completa todos los campos obligatorios.')
      return
    }
    if (new Date(form.fecha_fin) <= new Date(form.fecha_inicio)) {
      setErrorForm('La fecha de fin debe ser posterior a la de inicio.')
      return
    }
    setSaving(true)
    setErrorForm(null)
    setExitoMsg(null)

    // 1. Insertar registro_proceso
    const { error } = await supabase.from('registro_proceso').insert({
      idlote_cafe:  Number(form.idlote_cafe),
      idproceso:    Number(form.idproceso),
      fecha_inicio: form.fecha_inicio,
      fecha_fin:    form.fecha_fin,
      notas:        form.notas || null,
      idusuario:    usuario.idusuario,
    })
    if (error) { setErrorForm(error.message); setSaving(false); return }

    // 2. Actualizar estado del lote a 'en_proceso' si estaba disponible
    const loteActual = lotes.find(l => l.idlote_cafe === Number(form.idlote_cafe))
    if (loteActual?.estado === 'disponible') {
      await supabase
        .from('lote_cafe')
        .update({ estado: 'en_proceso' })
        .eq('idlote_cafe', Number(form.idlote_cafe))
    }

    setSaving(false)
    setExitoMsg('✅ Evaluación registrada. El estado del lote fue actualizado en la BD.')
    setForm({ idlote_cafe: '', idproceso: '', fecha_inicio: '', fecha_fin: '', notas: '' })
    setTimeout(() => { setExitoMsg(null); setTab('mis_registros') }, 2000)
    await cargar()
  }

  const variablesEsteMes = registros.filter(r => new Date(r.fecha_inicio).getMonth() === new Date().getMonth()).length
  const lotesEvaluados   = new Set(registros.map(r => r.lote_cafe?.idlote_cafe).filter(Boolean)).size

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.25rem' }}>
          🔬 Panel del Catador — {usuario.nombre}
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem' }}>
          Evalúa lotes y registra procesos. Cada evaluación actualiza el estado del lote en la base de datos.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { icon: '📋', label: 'Mis registros',  val: registros.length,  color: 'var(--primary)' },
          { icon: '🔬', label: 'Este mes',        val: variablesEsteMes,  color: 'var(--blue)'    },
          { icon: '☕', label: 'Lotes evaluados', val: lotesEvaluados,    color: 'var(--green)'   },
          { icon: '⏳', label: 'Para evaluar',    val: lotes.length,      color: 'var(--amber)'   },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-lg)', padding: '0.9rem 1rem' }}>
            <div style={{ fontSize: '1.3rem', marginBottom: '0.3rem' }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
        {([
          ['mis_registros', '📋 Mis evaluaciones'],
          ['catalogo',      '☕ Lotes a evaluar'],
          ['nuevo',         '+ Nueva evaluación'],
        ] as const).map(([t, lbl]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '0.4rem 1rem', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', background: tab === t ? 'var(--primary)' : 'var(--bg-hover)', color: tab === t ? 'var(--primary-fg)' : 'var(--text-soft)', transition: 'all var(--t)' }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : tab === 'mis_registros' ? (
        registros.length === 0 ? (
          <Empty mensaje="Aún no tienes evaluaciones registradas." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {registros.map(r => {
              const durH = Math.round((new Date(r.fecha_fin).getTime() - new Date(r.fecha_inicio).getTime()) / 36e5)
              const durLabel = durH < 24 ? `${durH}h` : `${Math.round(durH / 24)}d`
              return (
                <div key={r.idregistro_proceso} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-lg)', padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.92rem', marginBottom: '0.15rem' }}>
                        🔬 {r.proceso?.nombre ?? '—'}
                        <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}> · {r.lote_cafe?.variedad ?? '—'}</span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                        {r.lote_cafe?.finca ? `🏡 ${r.lote_cafe.finca.nombre} · ` : ''}
                        {new Date(r.fecha_inicio).toLocaleDateString('es-CO', { dateStyle: 'medium' })} → {new Date(r.fecha_fin).toLocaleDateString('es-CO', { dateStyle: 'medium' })}
                        {' · '}<span style={{ fontWeight: 600, color: 'var(--blue)' }}>{durLabel}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                      {r.lote_cafe?.peso_kg && <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1rem' }}>{r.lote_cafe.peso_kg} kg</div>}
                      {r.lote_cafe?.estado && (
                        <span style={{ padding: '0.1rem 0.5rem', borderRadius: '99px', fontSize: '0.66rem', fontWeight: 700, background: ESTADO_CFG[r.lote_cafe.estado]?.bg, color: ESTADO_CFG[r.lote_cafe.estado]?.color }}>
                          {ESTADO_CFG[r.lote_cafe.estado]?.label}
                        </span>
                      )}
                    </div>
                  </div>
                  {r.proceso?.descripcion && (
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', background: 'var(--bg)', borderRadius: 'var(--r)', padding: '0.35rem 0.6rem', marginBottom: '0.3rem' }}>
                      📌 {r.proceso.descripcion}
                    </div>
                  )}
                  {r.notas && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)', borderTop: '1px solid var(--border-soft)', paddingTop: '0.35rem', marginTop: '0.35rem' }}>
                      📝 {r.notas}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      ) : tab === 'catalogo' ? (
        lotes.length === 0 ? <Empty mensaje="No hay lotes disponibles para evaluar." /> : (
          <>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
              Haz clic en "Evaluar" para ir directo al formulario con el lote prellenado.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '0.85rem' }}>
              {lotes.map(l => {
                const cfg = ESTADO_CFG[l.estado] ?? ESTADO_CFG.disponible
                const misRegs = registros.filter(r => r.lote_cafe?.idlote_cafe === l.idlote_cafe).length
                return (
                  <div key={l.idlote_cafe} style={{ background: 'var(--bg-card)', border: `1px solid ${misRegs > 0 ? 'var(--green)' : 'var(--border-soft)'}`, borderRadius: 'var(--r-xl)', padding: '1.1rem 1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>{l.variedad}</div>
                        {l.finca && <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>🏡 {l.finca.nombre}</div>}
                      </div>
                      <span style={{ padding: '0.12rem 0.5rem', borderRadius: '99px', fontSize: '0.66rem', fontWeight: 700, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)', marginBottom: '0.6rem' }}>
                      <strong>{l.peso_kg} kg</strong> · Lote #{l.idlote_cafe}
                      {misRegs > 0 && <span style={{ marginLeft: '0.5rem', color: 'var(--green)', fontWeight: 600 }}>✓ {misRegs} eval. registrada{misRegs > 1 ? 's' : ''}</span>}
                    </div>
                    <button
                      style={{ width: '100%', padding: '0.4rem', border: 'none', borderRadius: 'var(--r-md)', background: 'var(--primary)', color: 'var(--primary-fg)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
                      onClick={() => { setForm(p => ({ ...p, idlote_cafe: String(l.idlote_cafe) })); setTab('nuevo') }}>
                      🔬 {misRegs > 0 ? 'Nueva evaluación' : 'Evaluar lote'}
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )
      ) : (
        /* Formulario */
        <div style={{ maxWidth: 500 }}>
          {exitoMsg && <div style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green)', borderRadius: 'var(--r-md)', padding: '0.75rem 1rem', marginBottom: '1rem', fontWeight: 600 }}>{exitoMsg}</div>}
          {errorForm && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {errorForm}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div>
              <label style={lblS}>Lote de café a evaluar *</label>
              <select style={selS} value={form.idlote_cafe} onChange={e => setForm(p => ({ ...p, idlote_cafe: e.target.value }))}>
                <option value="">— Selecciona un lote —</option>
                {lotes.map(l => (
                  <option key={l.idlote_cafe} value={l.idlote_cafe}>
                    {l.variedad} · {l.finca?.nombre ?? ''} · {l.peso_kg}kg · {ESTADO_CFG[l.estado]?.label} · #{l.idlote_cafe}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={lblS}>Tipo de proceso / evaluación *</label>
              <select style={selS} value={form.idproceso} onChange={e => setForm(p => ({ ...p, idproceso: e.target.value }))}>
                <option value="">— Selecciona un proceso —</option>
                {procesos.map(p => (
                  <option key={p.idproceso} value={p.idproceso}>{p.nombre}{p.descripcion ? ` — ${p.descripcion}` : ''}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={lblS}>Inicio *</label>
                <input type="datetime-local" style={inpS} value={form.fecha_inicio} onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
              </div>
              <div>
                <label style={lblS}>Fin *</label>
                <input type="datetime-local" style={inpS} value={form.fecha_fin} onChange={e => setForm(p => ({ ...p, fecha_fin: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={lblS}>Notas / Resultados de la cata</label>
              <textarea style={{ ...inpS, resize: 'vertical', minHeight: 90 } as any}
                value={form.notas}
                onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                placeholder="Puntaje de taza, notas sensoriales (acidez, dulzor, cuerpo), defectos encontrados, temperatura de proceso…" />
            </div>
            {form.idlote_cafe && lotes.find(l => l.idlote_cafe === Number(form.idlote_cafe))?.estado === 'disponible' && (
              <div style={{ background: 'var(--blue-bg)', border: '1px solid var(--blue)', borderRadius: 'var(--r-md)', padding: '0.7rem 0.9rem', fontSize: '0.78rem', color: 'var(--blue)' }}>
                💡 Al guardar, el lote pasará automáticamente a estado <strong>"En proceso"</strong>.
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.5rem' }}>
            <button style={btnSec} onClick={() => setTab('mis_registros')} disabled={saving}>Cancelar</button>
            <button style={{ ...btnPri, flex: 1 }} onClick={guardar} disabled={saving}>{saving ? '⏳ Guardando…' : '✓ Guardar evaluación'}</button>
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
  return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', background: 'var(--bg-card)', borderRadius: 'var(--r-xl)', border: '1px dashed var(--border)' }}><div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔬</div><p style={{ fontSize: '0.88rem' }}>{mensaje}</p></div>
}
