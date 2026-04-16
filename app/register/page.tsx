'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../utils/supabase/client'

// ── Tipos ────────────────────────────────────────────────────────────────────
type Step = 'datos' | 'rol' | 'formulario' | 'exito'

interface BaseForm {
  nombre: string
  email: string
  password: string
  confirmar: string
  telefono: string
}

// Roles disponibles con configuración
const ROLES = [
  {
    id: 'Cliente',
    label: 'Cliente',
    icon: '🤝',
    desc: 'Comprador o consumidor de café',
    autoAprobado: true,
    color: 'var(--green)',
  },
  {
    id: 'Productor',
    label: 'Productor',
    icon: '👨‍🌾',
    desc: 'Dueño o administrador de finca cafetera',
    autoAprobado: false,
    color: 'var(--amber)',
  },
  {
    id: 'Transportista',
    label: 'Transportista',
    icon: '🚛',
    desc: 'Responsable del transporte de carga',
    autoAprobado: false,
    color: 'var(--blue)',
  },
  {
    id: 'Catador',
    label: 'Catador',
    icon: '🔬',
    desc: 'Evaluador de calidad del café',
    autoAprobado: false,
    color: 'var(--purple)',
  },
]

// Campos por rol
const CAMPOS_ROL: Record<string, { key: string; label: string; type?: string; placeholder?: string; required?: boolean }[]> = {
  Productor: [
    { key: 'nombre_finca',    label: 'Nombre de la finca',    required: true,  placeholder: 'Ej: Finca El Paraíso' },
    { key: 'ubicacion',       label: 'Ubicación / Municipio', required: true,  placeholder: 'Ej: Huila, Colombia' },
    { key: 'area_hectareas',  label: 'Área (hectáreas)',      type: 'number',  placeholder: 'Ej: 5.5' },
    { key: 'certificaciones', label: 'Certificaciones',       placeholder: 'Ej: RainForest, UTZ, Orgánico' },
    { key: 'variedad_cafe',   label: 'Variedades de café',    placeholder: 'Ej: Caturra, Colombia, Geisha' },
  ],
  Transportista: [
    { key: 'tipo_vehiculo',   label: 'Tipo de vehículo',      required: true,  placeholder: 'Ej: Camión, Furgón' },
    { key: 'placa',           label: 'Placa',                 required: true,  placeholder: 'Ej: ABC-123' },
    { key: 'numero_licencia', label: 'Número de licencia',    required: true,  placeholder: 'Licencia de conducción' },
    { key: 'capacidad_kg',    label: 'Capacidad (kg)',        type: 'number',  placeholder: 'Ej: 5000' },
    { key: 'zona_operacion',  label: 'Zona de operación',     placeholder: 'Ej: Eje Cafetero, Huila' },
  ],
  Catador: [
    { key: 'anos_experiencia', label: 'Años de experiencia',  type: 'number',  placeholder: 'Ej: 5' },
    { key: 'certificaciones',  label: 'Certificaciones',      required: true,  placeholder: 'Ej: Q Grader, SCA' },
    { key: 'laboratorio',      label: 'Laboratorio / Empresa', placeholder: 'Nombre del laboratorio o empresa' },
    { key: 'especialidad',     label: 'Especialidad',          placeholder: 'Ej: Cafés especiales, exportación' },
  ],
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function RegisterPage() {
  const supabase = createClient()

  const [step, setStep]           = useState<Step>('datos')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // Paso 1: Datos base
  const [base, setBase] = useState<BaseForm>({
    nombre: '', email: '', password: '', confirmar: '', telefono: '',
  })

  // Paso 2: Rol seleccionado
  const [rolSeleccionado, setRolSeleccionado] = useState<string | null>(null)

  // Paso 3: Campos dinámicos del rol
  const [camposRol, setCamposRol] = useState<Record<string, string>>({})

  // ── Validaciones ──────────────────────────────────────────────────────────

  const validarDatos = (): boolean => {
    if (!base.nombre.trim()) { setError('El nombre es obligatorio.'); return false }
    if (!base.email.trim())  { setError('El correo es obligatorio.'); return false }
    if (!base.password)      { setError('La contraseña es obligatoria.'); return false }
    if (base.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return false }
    if (base.password !== base.confirmar) { setError('Las contraseñas no coinciden.'); return false }
    return true
  }

  const validarRol = (): boolean => {
    if (!rolSeleccionado) { setError('Selecciona un rol para continuar.'); return false }
    return true
  }

  // ── Navegación entre pasos ────────────────────────────────────────────────

  const irAlRol = () => {
    setError(null)
    if (validarDatos()) setStep('rol')
  }

  const irAlFormulario = () => {
    setError(null)
    if (!validarRol()) return
    const rolInfo = ROLES.find(r => r.id === rolSeleccionado)
    // Cliente no necesita formulario adicional
    if (rolInfo?.autoAprobado || !CAMPOS_ROL[rolSeleccionado!]) {
      registrar()
    } else {
      setCamposRol({})
      setStep('formulario')
    }
  }

  // ── Registro final ────────────────────────────────────────────────────────

  const registrar = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: base.email.trim(),
        password: base.password,
        options: { data: { nombre: base.nombre.trim() } },
      })
      if (authErr) throw new Error(authErr.message)

      const authUid = authData.user?.id

      // 2. Obtener id del rol desde la tabla pública
      const { data: rolData } = await supabase
        .from('rol')
        .select('idrol')
        .eq('nombre', rolSeleccionado)
        .single()

      const idrol = rolData?.idrol ?? null
      const rolInfo = ROLES.find(r => r.id === rolSeleccionado)
      const estadoAprobacion = rolInfo?.autoAprobado ? 'aprobado' : 'pendiente'

      // 3. Insertar en tabla usuario pública
      const { data: usuarioData, error: userErr } = await supabase
        .from('usuario')
        .insert({
          nombre:            base.nombre.trim(),
          email:             base.email.trim(),
          password_hash:     '—', // la auth la maneja Supabase Auth
          telefono:          base.telefono.trim() || null,
          idrol:             rolInfo?.autoAprobado ? idrol : null, // asignar solo si aprobado
          rol_solicitado:    idrol,
          estado_aprobacion: estadoAprobacion,
          auth_uid:          authUid ?? null,
        })
        .select('idusuario')
        .single()

      if (userErr) throw new Error(userErr.message)

      // 4. Insertar solicitud de rol si es rol especial
      if (!rolInfo?.autoAprobado && rolSeleccionado) {
        const { error: solErr } = await supabase
          .from('solicitud_rol')
          .insert({
            idusuario:        usuarioData.idusuario,
            tipo_rol:         rolSeleccionado,
            datos_formulario: camposRol,
            estado_revision:  'pendiente',
          })
        if (solErr) console.warn('Error al crear solicitud:', solErr.message)
      }

      setStep('exito')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCampoRol = (key: string, value: string) =>
    setCamposRol(prev => ({ ...prev, [key]: value }))

  // ── Render ────────────────────────────────────────────────────────────────

  const rolActual = ROLES.find(r => r.id === rolSeleccionado)

  return (
    <div className="login-page">
      <div className="login-card register-card">

        {/* ── Header ── */}
        <div className="login-header">
          <div className="login-icon">☕</div>
          <h1>Crear cuenta</h1>
          <p>Únete al sistema de trazabilidad</p>
        </div>

        {/* ── Tabs ── */}
        <div className="auth-tabs">
          <Link href="/login" className="auth-tab">Iniciar sesión</Link>
          <span className="auth-tab active">Registrarse</span>
        </div>

        {/* ── Indicador de pasos ── */}
        <div className="steps-indicator">
          {(['datos', 'rol', 'formulario'] as Step[]).map((s, i) => {
            const labels = ['Datos', 'Rol', 'Detalles']
            const done = step === 'exito' ||
              (step === 'formulario' && i < 2) ||
              (step === 'rol' && i < 1)
            const active = step === s
            return (
              <div key={s} className={`step-item ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
                <div className="step-circle">{done ? '✓' : i + 1}</div>
                <span className="step-label">{labels[i]}</span>
                {i < 2 && <div className={`step-line ${done ? 'done' : ''}`} />}
              </div>
            )
          })}
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {error}</div>
        )}

        {/* ════════════════════════════════════════════════════════
            PASO 1 — Datos personales
        ════════════════════════════════════════════════════════ */}
        {step === 'datos' && (
          <div className="register-step">
            <div className="form-grid-2">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Nombre completo <span className="form-required">*</span></label>
                <input
                  className="form-input"
                  type="text"
                  value={base.nombre}
                  onChange={e => setBase(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Juan Esteban Herrera"
                />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Correo electrónico <span className="form-required">*</span></label>
                <input
                  className="form-input"
                  type="email"
                  value={base.email}
                  onChange={e => setBase(p => ({ ...p, email: e.target.value }))}
                  placeholder="tu@email.com"
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Contraseña <span className="form-required">*</span></label>
                <input
                  className="form-input"
                  type="password"
                  value={base.password}
                  onChange={e => setBase(p => ({ ...p, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirmar contraseña <span className="form-required">*</span></label>
                <input
                  className="form-input"
                  type="password"
                  value={base.confirmar}
                  onChange={e => setBase(p => ({ ...p, confirmar: e.target.value }))}
                  placeholder="Repite tu contraseña"
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Teléfono <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(opcional)</span></label>
                <input
                  className="form-input"
                  type="tel"
                  value={base.telefono}
                  onChange={e => setBase(p => ({ ...p, telefono: e.target.value }))}
                  placeholder="+57 300 000 0000"
                />
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
              onClick={irAlRol}
            >
              Continuar →
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            PASO 2 — Selección de rol
        ════════════════════════════════════════════════════════ */}
        {step === 'rol' && (
          <div className="register-step">
            <p className="register-step-desc">
              Selecciona el rol con el que participarás en el sistema.
              Los roles especiales requieren validación del administrador.
            </p>

            <div className="roles-grid">
              {ROLES.map(rol => (
                <button
                  key={rol.id}
                  className={`rol-card ${rolSeleccionado === rol.id ? 'selected' : ''}`}
                  onClick={() => setRolSeleccionado(rol.id)}
                  style={{ '--rol-color': rol.color } as any}
                >
                  <div className="rol-card-icon">{rol.icon}</div>
                  <div className="rol-card-nombre">{rol.label}</div>
                  <div className="rol-card-desc">{rol.desc}</div>
                  {rol.autoAprobado
                    ? <span className="rol-badge-auto">✓ Aprobación automática</span>
                    : <span className="rol-badge-revision">⏳ Requiere revisión</span>
                  }
                </button>
              ))}
            </div>

            <div className="register-nav">
              <button className="btn btn-secondary" onClick={() => { setError(null); setStep('datos') }}>
                ← Atrás
              </button>
              <button
                className="btn btn-primary"
                onClick={irAlFormulario}
                disabled={!rolSeleccionado || loading}
              >
                {loading ? 'Registrando…' : (rolActual?.autoAprobado ? 'Registrarme' : 'Continuar →')}
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            PASO 3 — Formulario específico del rol
        ════════════════════════════════════════════════════════ */}
        {step === 'formulario' && rolSeleccionado && CAMPOS_ROL[rolSeleccionado] && (
          <div className="register-step">
            <div className="rol-info-banner" style={{ '--rol-color': rolActual?.color } as any}>
              <span className="rol-info-icon">{rolActual?.icon}</span>
              <div>
                <div className="rol-info-nombre">{rolActual?.label}</div>
                <div className="rol-info-sub">Completa los datos adicionales para tu solicitud</div>
              </div>
            </div>

            <div className="form-grid-2" style={{ marginTop: '1rem' }}>
              {CAMPOS_ROL[rolSeleccionado].map(campo => (
                <div
                  key={campo.key}
                  className="form-group"
                  style={{ gridColumn: campo.type === 'number' ? undefined : '1 / -1' }}
                >
                  <label className="form-label">
                    {campo.label}
                    {campo.required && <span className="form-required">*</span>}
                  </label>
                  <input
                    className="form-input"
                    type={campo.type ?? 'text'}
                    value={camposRol[campo.key] ?? ''}
                    onChange={e => handleCampoRol(campo.key, e.target.value)}
                    placeholder={campo.placeholder ?? ''}
                  />
                </div>
              ))}
            </div>

            <div className="register-nav">
              <button className="btn btn-secondary" onClick={() => { setError(null); setStep('rol') }}>
                ← Atrás
              </button>
              <button
                className="btn btn-primary"
                onClick={registrar}
                disabled={loading}
              >
                {loading ? 'Enviando solicitud…' : 'Enviar solicitud'}
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            ÉXITO
        ════════════════════════════════════════════════════════ */}
        {step === 'exito' && (
          <div className="register-exito">
            <div className="exito-icon">
              {rolActual?.autoAprobado ? '✅' : '⏳'}
            </div>
            <h2>
              {rolActual?.autoAprobado ? '¡Bienvenido!' : 'Solicitud enviada'}
            </h2>
            <p>
              {rolActual?.autoAprobado
                ? 'Tu cuenta fue creada exitosamente. Ya puedes iniciar sesión.'
                : `Tu solicitud como ${rolSeleccionado} fue enviada. Un administrador la revisará pronto. Recibirás acceso una vez aprobada.`
              }
            </p>
            <Link href="/login" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
              Ir al inicio de sesión
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
