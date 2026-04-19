'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../utils/supabase/client'

interface UsuarioPortal { idusuario: number; nombre: string; email: string }

export default function PortalCatador({ usuario }: { usuario: UsuarioPortal }) {
  const supabase = createClient()
  const [registros, setRegistros] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('registro_proceso').select(`
      idregistro_proceso, fecha_inicio, fecha_fin, notas,
      lote_cafe:idlote_cafe(variedad, peso_kg, finca:idfinca(nombre)),
      proceso:idproceso(nombre)
    `).order('fecha_inicio', { ascending: false }).limit(50)
      .then(({ data }) => { setRegistros(data ?? []); setLoading(false) })
  }, [supabase])

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.2rem' }}>Portal Catador</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.84rem' }}>Registros de procesos de beneficio para evaluación.</p>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : registros.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🔬</div><p>No hay registros de proceso disponibles.</p></div>
      ) : (
        <div className="data-table-wrap table-responsive">
          <table className="data-table">
            <thead>
              <tr><th>Proceso</th><th>Lote</th><th>Finca</th><th>Inicio</th><th>Fin</th><th>Notas</th></tr>
            </thead>
            <tbody>
              {registros.map((r: any) => (
                <tr key={r.idregistro_proceso}>
                  <td><span className="badge badge-amber">{r.proceso?.nombre ?? '—'}</span></td>
                  <td><strong style={{ color: 'var(--text)' }}>{r.lote_cafe?.variedad ?? '—'}</strong></td>
                  <td>{r.lote_cafe?.finca?.nombre ?? '—'}</td>
                  <td style={{ fontSize: '0.78rem' }}>{new Date(r.fecha_inicio).toLocaleDateString('es-CO')}</td>
                  <td style={{ fontSize: '0.78rem' }}>{new Date(r.fecha_fin).toLocaleDateString('es-CO')}</td>
                  <td style={{ fontSize: '0.78rem', maxWidth: 200 }}>{r.notas ? String(r.notas).slice(0, 60) + (r.notas.length > 60 ? '…' : '') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
