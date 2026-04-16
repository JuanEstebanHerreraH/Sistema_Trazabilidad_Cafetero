'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../utils/supabase/client'
import Modal from '../Modal'

// ── Tipos ────────────────────────────────────────────────────────────────────
interface Solicitud {
  idsolicitud: number
  tipo_rol: string
  datos_formulario: Record<string, any>
  estado_revision: 'pendiente' | 'aprobado' | 'rechazado'
  notas_admin: string | null
  fecha_envio: string
  fecha_revision: string | null
  idusuario: number
  usuario?: { nombre: string; email: string; telefono?: string }
}

// Iconos y colores por rol
const ROL_META: Record<string, { icon: string; color: string }> = {
  Productor:    { icon: '👨‍🌾', color: 'var(--amber)'  },
  Transportista:{ icon: '🚛', color: 'var(--blue)'    },
  Catador:      { icon: '🔬', color: 'var(--purple)'  },
  Cliente:      { icon: '🤝', color: 'var(--green)'   },
}

// Etiquetas legibles de los campos dinámicos
const CAMPO_LABELS: Record<string, string> = {
  nombre_finca:    'Nombre de la finca',
  ubicacion:       'Ubicación',
  area_hectareas:  'Área (ha)',
  certificaciones: 'Certificaciones',
  variedad_cafe:   'Variedades',
  tipo_vehiculo:   'Tipo de vehículo',
  placa:           'Placa',
  numero_licencia: 'Licencia',
  capacidad_kg:    'Capacidad (kg)',
  zona_operacion:  'Zona de operación',
  anos_experiencia:'Años de exp.',
  laboratorio:     'Laboratorio',
  especialidad:    'Especialidad',
}

const ESTADO_CONFIG = {
  pendiente:  { label: 'Pendiente',  badge: 'badge-amber', dot: '🟡' },
  aprobado:   { label: 'Aprobado',   badge: 'badge-green', dot: '🟢' },
  rechazado:  { label: 'Rechazado',  badge: 'badge-red',   dot: '🔴' },
}

// ── Componente ───────────────────────────────────────────────────────────────
export default function SolicitudesRol() {
  const supabase = createClient()

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [filtroRol,    setFiltroRol]    = useState<string>('todos')
  const [busqueda,     setBusqueda]     = useState('')

  // Modal detalle / acción
  const [detalle,        setDetalle]        = useState<Solicitud | null>(null)
  const [notasAdmin,     setNotasAdmin]     = useState('')
  const [accionLoading,  setAccionLoading]  = useState(false)
  const [accionError,    setAccionError]    = useState<string | null>(null)

  // ── Carga de datos ─────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('solicitud_rol')
      .select('*, usuario(nombre, email, telefono)')
      .order('fecha_envio', { ascending: false })

    if (err) setError(err.message)
    else setSolicitudes((data ?? []) as Solicitud[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { cargar() }, [cargar])

  // ── Acción aprobar / rechazar ──────────────────────────────────────────────
  const procesarSolicitud = async (estado: 'aprobado' | 'rechazado') => {
    if (!detalle) return
    setAccionLoading(true)
    setAccionError(null)
    try {
      // 1. Actualizar solicitud_rol
      const { error: solErr } = await supabase
        .from('solicitud_rol')
        .update({
          estado_revision:  estado,
          notas_admin:      notasAdmin.trim() || null,
          fecha_revision:   new Date().toISOString(),
        })
        .eq('idsolicitud', detalle.idsolicitud)

      if (solErr) throw new Error(solErr.message)

      // 2. Actualizar estado en la tabla usuario
      if (estado === 'aprobado') {
        // Obtener idrol del nombre del rol solicitado
        const { data: rolData } = await supabase
          .from('rol')
          .select('idrol')
          .eq('nombre', detalle.tipo_rol)
          .single()

        const { error: usrErr } = await supabase
          .from('usuario')
          .update({
            estado_aprobacion: 'aprobado',
            idrol:             rolData?.idrol ?? null,
          })
          .eq('idusuario', detalle.idusuario)

        if (usrErr) throw new Error(usrErr.message)
      } else {
        const { error: usrErr } = await supabase
          .from('usuario')
          .update({ estado_aprobacion: 'rechazado' })
          .eq('idusuario', detalle.idusuario)

        if (usrErr) throw new Error(usrErr.message)
      }

      setDetalle(null)
      setNotasAdmin('')
      await cargar()
    } catch (err: any) {
      setAccionError(err.message)
    } finally {
      setAccionLoading(false)
    }
  }

  // ── Filtrado ───────────────────────────────────────────────────────────────
  const filtradas = solicitudes.filter(s => {
    const matchEstado = filtroEstado === 'todos' || s.estado_revision === filtroEstado
    const matchRol    = filtroRol    === 'todos' || s.tipo_rol        === filtroRol
    const matchBusq   = !busqueda ||
      s.usuario?.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.usuario?.email.toLowerCase().includes(busqueda.toLowerCase())
    return matchEstado && matchRol && matchBusq
  })

  // Contadores para el resumen
  const conteo = {
    pendiente: solicitudes.filter(s => s.estado_revision === 'pendiente').length,
    aprobado:  solicitudes.filter(s => s.estado_revision === 'aprobado').length,
    rechazado: solicitudes.filter(s => s.estado_revision === 'rechazado').length,
  }

  const rolesUnicos = [...new Set(solicitudes.map(s => s.tipo_rol))]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Encabezado de página ── */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-icon">📬</div>
          <div>
            <h2>Solicitudes de Rol</h2>
            <p className="page-subtitle">Gestión y validación de solicitudes de acceso</p>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {error}</div>}

      {/* ── Tarjetas de resumen ── */}
      <div className="sol-resumen">
        {[
          { key: 'pendiente', label: 'Pendientes', icon: '⏳', color: 'var(--amber)',  bg: 'var(--amber-bg)'  },
          { key: 'aprobado',  label: 'Aprobadas',  icon: '✅', color: 'var(--green)',  bg: 'var(--green-bg)'  },
          { key: 'rechazado', label: 'Rechazadas', icon: '❌', color: 'var(--red)',    bg: 'var(--red-bg)'    },
        ].map(({ key, label, icon, color, bg }) => (
          <button
            key={key}
            className={`sol-stat ${filtroEstado === key ? 'active' : ''}`}
            style={{ '--sol-color': color, '--sol-bg': bg } as any}
            onClick={() => setFiltroEstado(filtroEstado === key ? 'todos' : key)}
          >
            <span className="sol-stat-icon">{icon}</span>
            <div>
              <div className="sol-stat-num">{conteo[key as keyof typeof conteo]}</div>
              <div className="sol-stat-label">{label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Barra de filtros ── */}
      <div className="toolbar" style={{ flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1rem' }}>
        <div className="toolbar-search" style={{ flex: '1 1 200px' }}>
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar usuario…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>

        <select
          className="form-select"
          style={{ flex: '0 0 auto', minWidth: '140px' }}
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
        >
          <option value="todos">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="aprobado">Aprobado</option>
          <option value="rechazado">Rechazado</option>
        </select>

        <select
          className="form-select"
          style={{ flex: '0 0 auto', minWidth: '140px' }}
          value={filtroRol}
          onChange={e => setFiltroRol(e.target.value)}
        >
          <option value="todos">Todos los roles</option>
          {rolesUnicos.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <span className="toolbar-count">{filtradas.length} solicitud{filtradas.length !== 1 ? 'es' : ''}</span>
      </div>

      {/* ── Tabla / Lista ── */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando solicitudes…</span></div>
      ) : filtradas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📬</div>
          <p>No hay solicitudes{busqueda || filtroEstado !== 'todos' || filtroRol !== 'todos' ? ' que coincidan' : ' registradas'}.</p>
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Usuario</th>
                <th>Rol solicitado</th>
                <th>Fecha envío</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(sol => {
                const meta   = ROL_META[sol.tipo_rol] ?? { icon: '👤', color: 'var(--text-soft)' }
                const estado = ESTADO_CONFIG[sol.estado_revision]
                const fecha  = new Date(sol.fecha_envio).toLocaleDateString('es-CO', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })
                return (
                  <tr key={sol.idsolicitud}>
                    <td style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>#{sol.idsolicitud}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{sol.usuario?.nombre ?? '—'}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>{sol.usuario?.email}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>{meta.icon}</span>
                        <span style={{ color: meta.color, fontWeight: 600 }}>{sol.tipo_rol}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-soft)' }}>{fecha}</td>
                    <td>
                      <span className={`badge ${estado.badge}`}>
                        {estado.label}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setDetalle(sol); setNotasAdmin(sol.notas_admin ?? ''); setAccionError(null) }}
                        >
                          👁 Ver
                        </button>
                        {sol.estado_revision === 'pendiente' && (
                          <>
                            <button
                              className="btn btn-sm"
                              style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green)' }}
                              onClick={() => { setDetalle(sol); setNotasAdmin(''); setAccionError(null) }}
                            >
                              ✓ Aprobar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal de detalle y acción ── */}
      <Modal
        isOpen={!!detalle}
        onClose={() => { setDetalle(null); setNotasAdmin(''); setAccionError(null) }}
        title={`Solicitud de rol — ${detalle?.tipo_rol ?? ''}`}
        footer={
          detalle?.estado_revision === 'pendiente' ? (
            <>
              <button
                className="btn btn-danger"
                onClick={() => procesarSolicitud('rechazado')}
                disabled={accionLoading}
              >
                {accionLoading ? '…' : '✗ Rechazar'}
              </button>
              <button
                className="btn"
                style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green)' }}
                onClick={() => procesarSolicitud('aprobado')}
                disabled={accionLoading}
              >
                {accionLoading ? '…' : '✓ Aprobar solicitud'}
              </button>
            </>
          ) : (
            <button className="btn btn-secondary" onClick={() => setDetalle(null)}>Cerrar</button>
          )
        }
      >
        {detalle && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {accionError && <div className="alert alert-error">⚠ {accionError}</div>}

            {/* Info del usuario */}
            <div className="sol-detalle-seccion">
              <div className="sol-detalle-titulo">👤 Datos del usuario</div>
              <div className="sol-detalle-grid">
                <div className="sol-detalle-item">
                  <span className="sol-detalle-key">Nombre</span>
                  <span className="sol-detalle-val">{detalle.usuario?.nombre}</span>
                </div>
                <div className="sol-detalle-item">
                  <span className="sol-detalle-key">Email</span>
                  <span className="sol-detalle-val">{detalle.usuario?.email}</span>
                </div>
                {detalle.usuario?.telefono && (
                  <div className="sol-detalle-item">
                    <span className="sol-detalle-key">Teléfono</span>
                    <span className="sol-detalle-val">{detalle.usuario.telefono}</span>
                  </div>
                )}
                <div className="sol-detalle-item">
                  <span className="sol-detalle-key">Estado actual</span>
                  <span className={`badge ${ESTADO_CONFIG[detalle.estado_revision].badge}`}>
                    {ESTADO_CONFIG[detalle.estado_revision].label}
                  </span>
                </div>
              </div>
            </div>

            {/* Datos del formulario de rol */}
            {Object.keys(detalle.datos_formulario).length > 0 && (
              <div className="sol-detalle-seccion">
                <div className="sol-detalle-titulo">
                  {ROL_META[detalle.tipo_rol]?.icon} Datos de {detalle.tipo_rol}
                </div>
                <div className="sol-detalle-grid">
                  {Object.entries(detalle.datos_formulario).map(([key, val]) => (
                    <div key={key} className="sol-detalle-item">
                      <span className="sol-detalle-key">{CAMPO_LABELS[key] ?? key}</span>
                      <span className="sol-detalle-val">{val || <em style={{ color: 'var(--text-muted)' }}>—</em>}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fechas */}
            <div className="sol-detalle-seccion">
              <div className="sol-detalle-titulo">📅 Fechas</div>
              <div className="sol-detalle-grid">
                <div className="sol-detalle-item">
                  <span className="sol-detalle-key">Enviada</span>
                  <span className="sol-detalle-val">
                    {new Date(detalle.fecha_envio).toLocaleString('es-CO')}
                  </span>
                </div>
                {detalle.fecha_revision && (
                  <div className="sol-detalle-item">
                    <span className="sol-detalle-key">Revisada</span>
                    <span className="sol-detalle-val">
                      {new Date(detalle.fecha_revision).toLocaleString('es-CO')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Notas del admin (siempre visible para editar si está pendiente) */}
            {detalle.estado_revision === 'pendiente' && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  Notas de revisión{' '}
                  <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(opcional)</span>
                </label>
                <textarea
                  className="form-textarea"
                  value={notasAdmin}
                  onChange={e => setNotasAdmin(e.target.value)}
                  placeholder="Ej: Documentación verificada, aprobado para operar en la región Andina…"
                  style={{ minHeight: '80px' }}
                />
              </div>
            )}

            {/* Notas existentes si ya fue revisada */}
            {detalle.estado_revision !== 'pendiente' && detalle.notas_admin && (
              <div className="sol-detalle-seccion">
                <div className="sol-detalle-titulo">📝 Notas del administrador</div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-soft)', lineHeight: 1.6 }}>
                  {detalle.notas_admin}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
