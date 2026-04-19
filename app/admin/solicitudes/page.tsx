'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../../utils/supabase/client'
import Modal from '../../../components/Modal'

interface Solicitud {
  idsolicitud: number
  tipo_rol: string
  estado_revision: string
  fecha_envio: string
  notas_admin: string | null
  datos_formulario: Record<string, string>
  usuario: { nombre: string; email: string } | null
}

const estadoBadge: Record<string, string> = {
  pendiente: 'badge-amber',
  aprobado:  'badge-green',
  rechazado: 'badge-red',
}

export default function SolicitudesPage() {
  const supabase = createClient()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'pendiente' | 'aprobado' | 'rechazado'>('pendiente')
  const [viewSol, setViewSol] = useState<Solicitud | null>(null)
  const [notasAdmin, setNotasAdmin] = useState('')
  const [procesando, setProcesando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('solicitud_rol')
      .select('idsolicitud, tipo_rol, estado_revision, fecha_envio, notas_admin, datos_formulario, usuario:idusuario(nombre, email)')
      .order('fecha_envio', { ascending: false })
    if (filtro !== 'todos') q = q.eq('estado_revision', filtro)
    const { data } = await q
    setSolicitudes((data ?? []) as any)
    setLoading(false)
  }, [filtro, supabase])

  useEffect(() => { cargar() }, [cargar])

  const procesar = async (sol: Solicitud, decision: 'aprobado' | 'rechazado') => {
    setProcesando(true)
    try {
      // 1. Actualizar solicitud
      await supabase.from('solicitud_rol').update({
        estado_revision: decision,
        notas_admin: notasAdmin || null,
        fecha_revision: new Date().toISOString(),
      }).eq('idsolicitud', sol.idsolicitud)

      // 2. Si aprobado: asignar rol y cambiar estado del usuario
      if (decision === 'aprobado') {
        const { data: rolData } = await supabase.from('rol').select('idrol').eq('nombre', sol.tipo_rol).single()
        if (rolData) {
          const { data: usuarioRow } = await supabase
            .from('usuario')
            .select('idusuario')
            .eq('email', (sol.usuario as any)?.email)
            .maybeSingle()
          if (usuarioRow) {
            await supabase.from('usuario').update({
              idrol: rolData.idrol,
              estado_aprobacion: 'aprobado',
            }).eq('idusuario', usuarioRow.idusuario)
          }
        }
      } else {
        // Rechazado: marcar usuario también
        const { data: usuarioRow } = await supabase
          .from('usuario')
          .select('idusuario')
          .eq('email', (sol.usuario as any)?.email)
          .maybeSingle()
        if (usuarioRow) {
          await supabase.from('usuario').update({ estado_aprobacion: 'rechazado' })
            .eq('idusuario', usuarioRow.idusuario)
        }
      }

      setViewSol(null)
      setNotasAdmin('')
      await cargar()
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setProcesando(false) }
  }

  const tabs = [
    { key: 'pendiente', label: 'Pendientes', color: 'var(--amber)' },
    { key: 'aprobado',  label: 'Aprobadas',  color: 'var(--green)' },
    { key: 'rechazado', label: 'Rechazadas', color: 'var(--red)' },
    { key: 'todos',     label: 'Todas',      color: 'var(--text-dim)' },
  ] as const

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-icon">📬</div>
          <div>
            <h2>Solicitudes de Rol</h2>
            <p className="page-subtitle">Aprueba o rechaza solicitudes de acceso al sistema</p>
          </div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: '1.25rem' }}>
        {tabs.map(t => (
          <button key={t.key} className={`tab-btn${filtro === t.key ? ' active' : ''}`}
            onClick={() => setFiltro(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : solicitudes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📬</div>
          <p>No hay solicitudes {filtro !== 'todos' ? filtro + 's' : ''}.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {solicitudes.map(s => (
            <div key={s.idsolicitud} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-soft)',
              borderRadius: 'var(--r-xl)', padding: '1rem 1.2rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                  <strong style={{ color: 'var(--text)', fontSize: '0.92rem' }}>{s.usuario?.nombre ?? '—'}</strong>
                  <span className={`badge ${estadoBadge[s.estado_revision] ?? 'badge-muted'}`}>{s.estado_revision}</span>
                  <span className="badge badge-teal">{s.tipo_rol}</span>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                  {s.usuario?.email} · Enviado el {new Date(s.fecha_envio).toLocaleDateString('es-CO')}
                </div>
                {s.notas_admin && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>📝 Admin: {s.notas_admin}</div>
                )}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => { setViewSol(s); setNotasAdmin(s.notas_admin ?? '') }}>
                Ver detalle
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal detalle y decisión */}
      <Modal isOpen={!!viewSol} onClose={() => setViewSol(null)} title={`Solicitud #${viewSol?.idsolicitud} — ${viewSol?.tipo_rol}`} size="lg"
        footer={
          viewSol?.estado_revision === 'pendiente' ? (
            <>
              <button className="btn btn-secondary" onClick={() => setViewSol(null)} disabled={procesando}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => viewSol && procesar(viewSol, 'rechazado')} disabled={procesando}>
                {procesando ? '⏳…' : '✕ Rechazar'}
              </button>
              <button className="btn btn-primary" onClick={() => viewSol && procesar(viewSol, 'aprobado')} disabled={procesando}
                style={{ background: 'var(--green)' }}>
                {procesando ? '⏳…' : '✓ Aprobar'}
              </button>
            </>
          ) : (
            <button className="btn btn-secondary" onClick={() => setViewSol(null)}>Cerrar</button>
          )
        }>
        {viewSol && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              {[
                { label: 'Solicitante', value: viewSol.usuario?.nombre ?? '—' },
                { label: 'Email', value: viewSol.usuario?.email ?? '—' },
                { label: 'Rol solicitado', value: viewSol.tipo_rol },
                { label: 'Fecha envío', value: new Date(viewSol.fecha_envio).toLocaleDateString('es-CO', { dateStyle: 'long' }) },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg-1)', borderRadius: 'var(--r-md)', padding: '0.6rem 0.8rem' }}>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.15rem' }}>{s.label}</div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text)' }}>{s.value}</div>
                </div>
              ))}
            </div>

            {Object.keys(viewSol.datos_formulario ?? {}).length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.5rem' }}>
                  Datos del formulario
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {Object.entries(viewSol.datos_formulario).map(([k, v]) => (
                    <div key={k} style={{ background: 'var(--bg-1)', borderRadius: 'var(--r)', padding: '0.5rem 0.7rem' }}>
                      <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-soft)', marginTop: '0.1rem' }}>{v || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewSol.estado_revision === 'pendiente' && (
              <div className="form-group">
                <label className="form-label">Notas del administrador (opcional)</label>
                <textarea className="form-textarea" value={notasAdmin}
                  onChange={e => setNotasAdmin(e.target.value)}
                  placeholder="Explica la razón de aprobación o rechazo…" />
              </div>
            )}

            {viewSol.estado_revision !== 'pendiente' && viewSol.notas_admin && (
              <div className="alert alert-info" style={{ fontSize: '0.82rem' }}>
                📝 Nota del administrador: {viewSol.notas_admin}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
