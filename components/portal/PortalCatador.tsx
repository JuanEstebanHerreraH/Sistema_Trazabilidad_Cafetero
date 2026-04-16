'use client'

interface UsuarioPortal { idusuario: number; nombre: string; email: string; estado_aprobacion: string }

import { useEffect, useState } from 'react'
import { createClient } from '../../utils/supabase/client'

interface RegistroProceso {
  idregistro_proceso: number
  fecha_inicio: string
  fecha_fin: string
  notas: string | null
  lote_cafe: { variedad: string; peso_kg: number; estado: string } | null
  proceso: { nombre: string; descripcion: string | null } | null
}

export default function PortalCatador({ usuario }: { usuario: UsuarioPortal }) {
  const supabase = createClient()
  const [registros, setRegistros] = useState<RegistroProceso[]>([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [lotes, setLotes]         = useState<any[]>([])
  const [procesos, setProcesos]   = useState<any[]>([])
  const [form, setForm]           = useState({ idlote_cafe: '', idproceso: '', fecha_inicio: '', fecha_fin: '', notas: '' })
  const [saving, setSaving]       = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    const [{ data: r }, { data: l }, { data: p }] = await Promise.all([
      supabase
        .from('registro_proceso')
        .select('idregistro_proceso, fecha_inicio, fecha_fin, notas, lote_cafe(variedad, peso_kg, estado), proceso(nombre, descripcion)')
        .eq('idusuario', usuario.idusuario)
        .order('fecha_inicio', { ascending: false }),
      supabase.from('lote_cafe').select('idlote_cafe, variedad, estado').eq('estado', 'en_proceso'),
      supabase.from('proceso').select('idproceso, nombre, descripcion'),
    ])
    setRegistros((r ?? []) as any)
    setLotes(l ?? [])
    setProcesos(p ?? [])
    setLoading(false)
  }

  const guardar = async () => {
    if (!form.idlote_cafe || !form.idproceso || !form.fecha_inicio || !form.fecha_fin) {
      setErrorForm('Completa todos los campos obligatorios.')
      return
    }
    setSaving(true)
    setErrorForm(null)
    const { error } = await supabase.from('registro_proceso').insert({
      idlote_cafe:  Number(form.idlote_cafe),
      idproceso:    Number(form.idproceso),
      fecha_inicio: form.fecha_inicio,
      fecha_fin:    form.fecha_fin,
      notas:        form.notas || null,
      idusuario:    usuario.idusuario,
    })
    setSaving(false)
    if (error) { setErrorForm(error.message); return }
    setModal(false)
    setForm({ idlote_cafe: '', idproceso: '', fecha_inicio: '', fecha_fin: '', notas: '' })
    cargar()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.25rem' }}>🔬 Mis Evaluaciones</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem' }}>Registros de procesos y evaluaciones que has realizado.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setModal(true); setErrorForm(null) }}>+ Nuevo registro</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { icon: '📋', label: 'Total registros', val: registros.length, color: 'var(--primary)' },
          { icon: '🔬', label: 'Este mes', val: registros.filter(r => new Date(r.fecha_inicio).getMonth() === new Date().getMonth()).length, color: 'var(--blue)' },
          { icon: '☕', label: 'Lotes evaluados', val: new Set(registros.map(r => (r.lote_cafe as any)?.variedad)).size, color: 'var(--green)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-lg)', padding: '0.9rem 1rem' }}>
            <div style={{ fontSize: '1.3rem', marginBottom: '0.3rem' }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? <Spinner /> : registros.length === 0 ? (
        <Empty mensaje="Aún no tienes evaluaciones registradas." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {registros.map(r => (
            <div key={r.idregistro_proceso} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-lg)', padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.92rem', marginBottom: '0.2rem' }}>
                    {r.proceso?.nombre ?? '—'} · {r.lote_cafe?.variedad ?? '—'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    {new Date(r.fecha_inicio).toLocaleDateString('es-CO', { dateStyle: 'medium' })} →{' '}
                    {new Date(r.fecha_fin).toLocaleDateString('es-CO', { dateStyle: 'medium' })}
                  </div>
                </div>
                {r.lote_cafe?.peso_kg && (
                  <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1rem' }}>{r.lote_cafe.peso_kg} kg</div>
                )}
              </div>
              {r.proceso?.descripcion && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', background: 'var(--bg)', borderRadius: 'var(--r)', padding: '0.4rem 0.65rem', marginBottom: '0.35rem' }}>
                  📌 {r.proceso.descripcion}
                </div>
              )}
              {r.notas && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)', borderTop: '1px solid var(--border-soft)', paddingTop: '0.4rem', marginTop: '0.35rem' }}>
                  📝 {r.notas}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }} onClick={() => setModal(false)}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '1.75rem', width: '100%', maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text)', marginBottom: '1.25rem' }}>Nuevo registro de evaluación</h3>
            {errorForm && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {errorForm}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <SelectField label="Lote de café (en proceso) *" value={form.idlote_cafe} onChange={(v: string) => setForm(p => ({ ...p, idlote_cafe: v }))} options={lotes.map(l => ({ value: l.idlote_cafe, label: `${l.variedad} (${l.estado})` }))} />
              <SelectField label="Tipo de proceso *" value={form.idproceso} onChange={(v: string) => setForm(p => ({ ...p, idproceso: v }))} options={procesos.map(p => ({ value: p.idproceso, label: p.nombre }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <InputField label="Fecha inicio *" type="datetime-local" value={form.fecha_inicio} onChange={(v: string) => setForm(p => ({ ...p, fecha_inicio: v }))} />
                <InputField label="Fecha fin *" type="datetime-local" value={form.fecha_fin} onChange={(v: string) => setForm(p => ({ ...p, fecha_fin: v }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: '0.35rem' }}>Notas / Observaciones</label>
                <textarea style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0.48rem 0.75rem', color: 'var(--text)', fontSize: '0.85rem', resize: 'vertical', minHeight: 80 }} value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} placeholder="Descripción del proceso, resultados, etc." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setModal(false)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Guardar evaluación'}</button>
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
  return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', background: 'var(--bg-card)', borderRadius: 'var(--r-xl)', border: '1px dashed var(--border)' }}><div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔬</div><p style={{ fontSize: '0.88rem' }}>{mensaje}</p></div>
}
