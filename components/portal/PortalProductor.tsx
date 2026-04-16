'use client'

interface UsuarioPortal { idusuario: number; nombre: string; email: string; estado_aprobacion: string }

import { useEffect, useState } from 'react'
import { createClient } from '../../utils/supabase/client'

interface Finca {
  idfinca: number
  nombre: string
  ubicacion: string | null
  area_hectareas: number | null
  productor: { nombre: string } | null
}

interface Lote {
  idlote_cafe: number
  variedad: string
  fecha_cosecha: string
  peso_kg: number
  estado: string
  idfinca: number
}

const ESTADO_CFG: Record<string, { label: string; color: string; bg: string }> = {
  disponible: { label: 'Disponible',  color: 'var(--green)',  bg: 'var(--green-bg)' },
  en_proceso: { label: 'En proceso',  color: 'var(--amber)',  bg: 'var(--amber-bg)' },
  vendido:    { label: 'Vendido',     color: 'var(--blue)',   bg: 'var(--blue-bg)'  },
  exportado:  { label: 'Exportado',   color: 'var(--purple)', bg: 'var(--purple-bg)' },
}

export default function PortalProductor({ usuario }: { usuario: UsuarioPortal }) {
  const supabase = createClient()
  const [fincas, setFincas]   = useState<Finca[]>([])
  const [lotes, setLotes]     = useState<Lote[]>([])
  const [tab, setTab]         = useState<'fincas' | 'lotes'>('fincas')
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<string>('')

  // Modal nuevo lote
  const [modalLote, setModalLote] = useState(false)
  const [formLote, setFormLote] = useState({ variedad: '', fecha_cosecha: '', peso_kg: '', idfinca: '' })
  const [saving, setSaving]   = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    setLoading(true)
    const [{ data: f }, { data: l }] = await Promise.all([
      supabase.from('finca').select('idfinca, nombre, ubicacion, area_hectareas, productor(nombre)').order('nombre'),
      supabase.from('lote_cafe').select('idlote_cafe, variedad, fecha_cosecha, peso_kg, estado, idfinca').order('fecha_cosecha', { ascending: false }),
    ])
    setFincas((f ?? []) as any)
    setLotes((l ?? []) as any)
    setLoading(false)
  }

  const lotesFiltrados = lotes.filter(l => !filtroEstado || l.estado === filtroEstado)

  const guardarLote = async () => {
    if (!formLote.variedad || !formLote.fecha_cosecha || !formLote.peso_kg || !formLote.idfinca) {
      setErrorForm('Completa todos los campos obligatorios.')
      return
    }
    setSaving(true)
    setErrorForm(null)
    const { error } = await supabase.from('lote_cafe').insert({
      variedad:      formLote.variedad,
      fecha_cosecha: formLote.fecha_cosecha,
      peso_kg:       Number(formLote.peso_kg),
      estado:        'disponible',
      idfinca:       Number(formLote.idfinca),
    })
    setSaving(false)
    if (error) { setErrorForm(error.message); return }
    setModalLote(false)
    setFormLote({ variedad: '', fecha_cosecha: '', peso_kg: '', idfinca: '' })
    cargar()
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.25rem' }}>
            👨‍🌾 Mi Panel, {usuario.nombre}
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem' }}>Administra tus fincas y lotes de café.</p>
        </div>
        {tab === 'lotes' && (
          <button className="btn btn-primary" onClick={() => { setModalLote(true); setErrorForm(null) }}>+ Nuevo lote</button>
        )}
      </div>

      {/* Stats rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { icon: '🏡', label: 'Mis fincas',      val: fincas.length,                              color: 'var(--amber)' },
          { icon: '☕', label: 'Total lotes',      val: lotes.length,                               color: 'var(--primary)' },
          { icon: '✅', label: 'Disponibles',     val: lotes.filter(l=>l.estado==='disponible').length,  color: 'var(--green)' },
          { icon: '⚙️', label: 'En proceso',      val: lotes.filter(l=>l.estado==='en_proceso').length,  color: 'var(--blue)' },
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
        {(['fincas','lotes'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '0.4rem 1rem', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', background: tab === t ? 'var(--primary)' : 'var(--bg-hover)', color: tab === t ? 'var(--primary-fg)' : 'var(--text-soft)', transition: 'all var(--t)' }}>
            {t === 'fincas' ? '🏡 Mis fincas' : '☕ Mis lotes'}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : tab === 'fincas' ? (
        fincas.length === 0 ? <Empty mensaje="No hay fincas registradas." /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {fincas.map(f => (
              <div key={f.idfinca} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-xl)', padding: '1.25rem' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)', marginBottom: '0.5rem' }}>🏡 {f.nombre}</div>
                {f.ubicacion     && <InfoRow label="Ubicación"   val={f.ubicacion} />}
                {f.area_hectareas && <InfoRow label="Área"       val={`${f.area_hectareas} ha`} />}
                {f.productor     && <InfoRow label="Productor"   val={f.productor.nombre} />}
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-soft)', paddingTop: '0.6rem', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                  {lotes.filter(l => l.idfinca === f.idfinca).length} lotes registrados
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          {/* Filtro por estado */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {[['', 'Todos'], ...Object.entries(ESTADO_CFG).map(([k, v]) => [k, v.label])].map(([val, label]) => (
              <button key={val} onClick={() => setFiltroEstado(val)} style={{ padding: '0.28rem 0.75rem', border: '1px solid', borderRadius: '99px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', transition: 'all var(--t)', borderColor: filtroEstado === val ? 'var(--primary)' : 'var(--border)', background: filtroEstado === val ? 'rgba(200,120,42,0.12)' : 'transparent', color: filtroEstado === val ? 'var(--primary)' : 'var(--text-dim)' }}>
                {label}
              </button>
            ))}
          </div>

          {lotesFiltrados.length === 0 ? <Empty mensaje="No hay lotes con ese estado." /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {lotesFiltrados.map(lote => {
                const cfg = ESTADO_CFG[lote.estado] ?? ESTADO_CFG.disponible
                const finca = fincas.find(f => f.idfinca === lote.idfinca)
                return (
                  <div key={lote.idlote_cafe} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-lg)', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.92rem' }}>{lote.variedad}</span>
                        <span style={{ padding: '0.15rem 0.55rem', borderRadius: '99px', fontSize: '0.68rem', fontWeight: 700, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        {finca ? `🏡 ${finca.nombre}` : ''} · Cosecha: {new Date(lote.fecha_cosecha).toLocaleDateString('es-CO', { dateStyle: 'medium' })}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.05rem' }}>{lote.peso_kg} kg</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Lote #{lote.idlote_cafe}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Modal nuevo lote */}
      {modalLote && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }} onClick={() => setModalLote(false)}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '1.75rem', width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text)', marginBottom: '1.25rem' }}>Registrar nuevo lote</h3>
            {errorForm && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {errorForm}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <Field label="Variedad *" value={formLote.variedad} onChange={v => setFormLote(p => ({ ...p, variedad: v }))} placeholder="Ej: Caturra, Colombia" />
              <Field label="Fecha de cosecha *" type="date" value={formLote.fecha_cosecha} onChange={v => setFormLote(p => ({ ...p, fecha_cosecha: v }))} />
              <Field label="Peso (kg) *" type="number" value={formLote.peso_kg} onChange={v => setFormLote(p => ({ ...p, peso_kg: v }))} placeholder="Ej: 500" />
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: '0.35rem' }}>Finca *</label>
                <select style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0.48rem 0.75rem', color: 'var(--text)', fontSize: '0.85rem' }}
                  value={formLote.idfinca} onChange={e => setFormLote(p => ({ ...p, idfinca: e.target.value }))}>
                  <option value="">— Selecciona —</option>
                  {fincas.map(f => <option key={f.idfinca} value={f.idfinca}>{f.nombre}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setModalLote(false)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarLote} disabled={saving}>{saving ? 'Guardando…' : 'Registrar lote'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder = '', type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: '0.35rem' }}>{label}</label>
      <input type={type} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0.48rem 0.75rem', color: 'var(--text)', fontSize: '0.85rem' }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

function InfoRow({ label, val }: { label: string; val: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem', marginBottom: '0.25rem' }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 72 }}>{label}</span>
      <span style={{ color: 'var(--text-soft)' }}>{val}</span>
    </div>
  )
}

function Spinner() {
  return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>Cargando…</div>
}

function Empty({ mensaje }: { mensaje: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', background: 'var(--bg-card)', borderRadius: 'var(--r-xl)', border: '1px dashed var(--border)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
      <p style={{ fontSize: '0.88rem' }}>{mensaje}</p>
    </div>
  )
}
