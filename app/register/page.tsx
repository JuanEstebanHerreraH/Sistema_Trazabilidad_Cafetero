'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../utils/supabase/client'

type Step = 'datos' | 'rol' | 'formulario' | 'exito'

const ROLES = [
  { id: 'Cliente',      label: 'Cliente',      icon: '🤝', desc: 'Compra lotes de café directamente',     auto: true,  color: 'var(--green)' },
  { id: 'Productor',    label: 'Productor',     icon: '👨‍🌾', desc: 'Dueño o administrador de finca',        auto: false, color: 'var(--amber)' },
  { id: 'Operador',     label: 'Operador',      icon: '⚙️', desc: 'Gestión operativa y trazabilidad',      auto: false, color: 'var(--blue)'  },
  { id: 'Vendedor',     label: 'Vendedor',      icon: '💼', desc: 'Gestión de ventas y clientes',          auto: false, color: 'var(--purple)'},
  { id: 'Catador',      label: 'Catador',       icon: '🔬', desc: 'Evaluación de calidad del café',        auto: false, color: 'var(--teal)'  },
  { id: 'Transportista',label: 'Transportista', icon: '🚛', desc: 'Responsable de transporte de carga',    auto: false, color: 'var(--primary)'},
]

const CAMPOS: Record<string, { key: string; label: string; type?: string; placeholder?: string; required?: boolean }[]> = {
  Productor:     [
    { key: 'nombre_finca',   label: 'Nombre de la finca',   required: true, placeholder: 'Finca El Paraíso' },
    { key: 'ubicacion',      label: 'Ubicación / Municipio',required: true, placeholder: 'Huila, Colombia' },
    { key: 'area_hectareas', label: 'Área (ha)',             type: 'number', placeholder: '5.5' },
    { key: 'variedad_cafe',  label: 'Variedades',                            placeholder: 'Caturra, Geisha' },
  ],
  Operador: [
    { key: 'cargo', label: 'Cargo', required: true, placeholder: 'Supervisor de operaciones' },
    { key: 'area',  label: 'Área de responsabilidad', placeholder: 'Planta de beneficio' },
  ],
  Vendedor: [
    { key: 'zona_ventas', label: 'Zona de ventas', required: true, placeholder: 'Región Andina' },
    { key: 'experiencia', label: 'Años de experiencia', type: 'number', placeholder: '3' },
  ],
  Catador:  [
    { key: 'certificaciones', label: 'Certificaciones', required: true, placeholder: 'Q Grader, SCA' },
    { key: 'laboratorio',     label: 'Laboratorio',                      placeholder: 'CafeLab Colombia' },
  ],
  Transportista: [
    { key: 'placa',         label: 'Placa del vehículo', required: true, placeholder: 'ABC-123' },
    { key: 'tipo_vehiculo', label: 'Tipo de vehículo',   required: true, placeholder: 'Camión, Furgón' },
  ],
}

export default function RegisterPage() {
  const supabase = createClient()
  const [step, setStep] = useState<Step>('datos')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [base, setBase] = useState({ nombre: '', email: '', password: '', confirmar: '', telefono: '' })
  const [rolId, setRolId] = useState<string | null>(null)
  const [camposRol, setCamposRol] = useState<Record<string, string>>({})

  const rolInfo = ROLES.find(r => r.id === rolId)

  const validar = () => {
    if (!base.nombre.trim()) { setError('Nombre obligatorio.'); return false }
    if (!base.email.trim())  { setError('Correo obligatorio.'); return false }
    if (base.password.length < 6) { setError('Contraseña mínimo 6 caracteres.'); return false }
    if (base.password !== base.confirmar) { setError('Las contraseñas no coinciden.'); return false }
    return true
  }

  const registrar = async () => {
    setLoading(true); setError(null)
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: base.email.trim(), password: base.password,
        options: { data: { nombre: base.nombre.trim() } },
      })
      if (authErr) throw new Error(
        authErr.message.includes('already registered') ? 'Este correo ya está registrado.' : authErr.message
      )
      const { data: rolData } = await supabase.from('rol').select('idrol').eq('nombre', rolId).single()
      const idrol = rolData?.idrol ?? null
      const estado = rolInfo?.auto ? 'aprobado' : 'pendiente'
      const { data: usuarioData, error: uErr } = await supabase.from('usuario').insert({
        nombre: base.nombre.trim(), email: base.email.trim(), password_hash: '—',
        telefono: base.telefono.trim() || null,
        idrol: rolInfo?.auto ? idrol : null,
        rol_solicitado: idrol,
        estado_aprobacion: estado,
        auth_uid: authData.user?.id ?? null,
      }).select('idusuario').single()
      if (uErr) throw new Error(uErr.message)
      if (!rolInfo?.auto && rolId && CAMPOS[rolId]) {
        await supabase.from('solicitud_rol').insert({
          idusuario: usuarioData.idusuario, tipo_rol: rolId,
          datos_formulario: camposRol, estado_revision: 'pendiente',
        })
      }
      setStep('exito')
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  const irSiguiente = () => {
    setError(null)
    if (step === 'datos') { if (validar()) setStep('rol') }
    else if (step === 'rol') {
      if (!rolId) { setError('Selecciona un rol.'); return }
      if (rolInfo?.auto || !CAMPOS[rolId!]) registrar()
      else { setCamposRol({}); setStep('formulario') }
    }
    else if (step === 'formulario') registrar()
  }

  const steps = ['datos', 'rol', 'formulario'] as const
  const stepLabels = ['Datos', 'Rol', 'Detalles']

  return (
    <div className="auth-page">
      <div className="auth-card register-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">☕</div>
          <h1>Crear cuenta</h1>
          <p>Únete al sistema de trazabilidad</p>
        </div>

        <div className="auth-tabs">
          <Link href="/login" className="auth-tab">Iniciar sesión</Link>
          <span className="auth-tab active">Registrarse</span>
        </div>

        {step !== 'exito' && (
          <div className="steps-indicator" style={{ marginBottom: '1.25rem' }}>
            {steps.map((s, i) => {
              const idx = steps.indexOf(step as any)
              return (
                <div key={s} className={`step-item${step === s ? ' active' : ''}${idx > i ? ' done' : ''}`}>
                  <div className="step-circle">{idx > i ? '✓' : i + 1}</div>
                  <span className="step-label" style={{ marginRight: '0.3rem' }}>{stepLabels[i]}</span>
                  {i < 2 && <div className={`step-line${idx > i ? ' done' : ''}`} />}
                </div>
              )
            })}
          </div>
        )}

        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {error}</div>}

        {step === 'datos' && (
          <div>
            <div className="form-grid-2" style={{ marginBottom: '1rem' }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Nombre completo <span className="form-required">*</span></label>
                <input className="form-input" type="text" value={base.nombre}
                  onChange={e => setBase(p => ({ ...p, nombre: e.target.value }))} placeholder="Juan Esteban Herrera" />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Correo <span className="form-required">*</span></label>
                <input className="form-input" type="email" value={base.email}
                  onChange={e => setBase(p => ({ ...p, email: e.target.value }))} placeholder="tu@email.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña <span className="form-required">*</span></label>
                <input className="form-input" type="password" value={base.password}
                  onChange={e => setBase(p => ({ ...p, password: e.target.value }))} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar contraseña <span className="form-required">*</span></label>
                <input className="form-input" type="password" value={base.confirmar}
                  onChange={e => setBase(p => ({ ...p, confirmar: e.target.value }))} placeholder="Repite la contraseña" />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Teléfono <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
                <input className="form-input" type="tel" value={base.telefono}
                  onChange={e => setBase(p => ({ ...p, telefono: e.target.value }))} placeholder="+57 300 000 0000" />
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', padding: '0.6rem' }} onClick={irSiguiente}>Continuar →</button>
          </div>
        )}

        {step === 'rol' && (
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.8rem' }}>
              Selecciona tu rol en el sistema. Los roles especiales requieren aprobación del administrador.
            </p>
            <div className="roles-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginBottom: '1rem' }}>
              {ROLES.map(r => (
                <button key={r.id} className={`rol-card${rolId === r.id ? ' selected' : ''}`}
                  style={{ '--rol-color': r.color } as any} onClick={() => setRolId(r.id)}>
                  <div className="rol-card-icon">{r.icon}</div>
                  <div className="rol-card-nombre">{r.label}</div>
                  <div className="rol-card-desc">{r.desc}</div>
                  {r.auto
                    ? <span className="rol-badge-auto">✓ Acceso inmediato</span>
                    : <span className="rol-badge-revision">⏳ Requiere aprobación</span>}
                </button>
              ))}
            </div>
            <div className="register-nav">
              <button className="btn btn-secondary" onClick={() => { setError(null); setStep('datos') }}>← Atrás</button>
              <button className="btn btn-primary" onClick={irSiguiente} disabled={!rolId || loading}>
                {loading ? '⏳ Registrando…' : rolInfo?.auto ? 'Registrarme' : 'Continuar →'}
              </button>
            </div>
          </div>
        )}

        {step === 'formulario' && rolId && CAMPOS[rolId] && (
          <div>
            <div className="rol-info-banner" style={{ '--rol-color': rolInfo?.color } as any}>
              <span className="rol-info-icon">{rolInfo?.icon}</span>
              <div>
                <div className="rol-info-nombre">{rolInfo?.label}</div>
                <div className="rol-info-sub">Completa los datos para tu solicitud</div>
              </div>
            </div>
            <div className="form-grid-2" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
              {CAMPOS[rolId].map(c => (
                <div key={c.key} className="form-group" style={{ gridColumn: c.type === 'number' ? undefined : '1/-1' }}>
                  <label className="form-label">{c.label}{c.required && <span className="form-required">*</span>}</label>
                  <input className="form-input" type={c.type ?? 'text'} value={camposRol[c.key] ?? ''}
                    onChange={e => setCamposRol(p => ({ ...p, [c.key]: e.target.value }))} placeholder={c.placeholder ?? ''} />
                </div>
              ))}
            </div>
            <div className="register-nav">
              <button className="btn btn-secondary" onClick={() => { setError(null); setStep('rol') }}>← Atrás</button>
              <button className="btn btn-primary" onClick={irSiguiente} disabled={loading}>
                {loading ? '⏳ Enviando…' : 'Enviar solicitud'}
              </button>
            </div>
          </div>
        )}

        {step === 'exito' && (
          <div className="register-exito">
            <div className="exito-icon">{rolInfo?.auto ? '✅' : '⏳'}</div>
            <h2>{rolInfo?.auto ? '¡Bienvenido!' : 'Solicitud enviada'}</h2>
            <p>
              {rolInfo?.auto
                ? 'Tu cuenta está lista. Si necesitas confirmar tu correo, revisa tu bandeja de entrada.'
                : `Tu solicitud como ${rolId} fue enviada. El administrador la revisará pronto.`}
            </p>
            <div className="exito-tip">💡 Si no puedes ingresar, revisa tu bandeja de entrada para confirmar el correo.</div>
            <Link href="/login" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>Ir al inicio de sesión</Link>
          </div>
        )}
      </div>
    </div>
  )
}
