'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../utils/supabase/client'

interface UsuarioPortal { idusuario: number; nombre: string; email: string }

const tipoBadge: Record<string, string> = { entrada: 'badge-green', salida: 'badge-red', traslado: 'badge-blue' }

export default function PortalTransportista({ usuario }: { usuario: UsuarioPortal }) {
  const supabase = createClient()
  const [movimientos, setMovimientos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('movimiento_inventario').select(`
      idmovimiento_inventario, tipo, fecha_movimiento, cantidad, notas,
      lote_cafe:idlote_cafe(variedad),
      almacen_origen:idalmacen_origen(nombre),
      almacen_destino:idalmacen_destino(nombre)
    `).order('fecha_movimiento', { ascending: false }).limit(50)
      .then(({ data }) => { setMovimientos(data ?? []); setLoading(false) })
  }, [supabase])

  const stats = [
    { label: 'Entradas', val: movimientos.filter(m => m.tipo === 'entrada').length, color: 'var(--green)' },
    { label: 'Salidas',  val: movimientos.filter(m => m.tipo === 'salida').length,  color: 'var(--red)' },
    { label: 'Traslados',val: movimientos.filter(m => m.tipo === 'traslado').length,color: 'var(--blue)' },
    { label: 'Total kg', val: `${movimientos.reduce((s, m) => s + Number(m.cantidad), 0)} kg`, color: 'var(--primary)' },
  ]

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.2rem' }}>Portal Transportista</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.84rem' }}>Movimientos de inventario registrados en el sistema.</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {stats.map(s => (
          <div key={s.label} className="stat-card" style={{ '--accent': s.color } as any}>
            <div className="stat-value">{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : movimientos.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🚛</div><p>No hay movimientos registrados.</p></div>
      ) : (
        <div className="data-table-wrap table-responsive">
          <table className="data-table">
            <thead>
              <tr><th>Tipo</th><th>Lote</th><th>Cantidad</th><th>Origen</th><th>Destino</th><th>Fecha</th><th>Notas</th></tr>
            </thead>
            <tbody>
              {movimientos.map((m: any) => (
                <tr key={m.idmovimiento_inventario}>
                  <td><span className={`badge ${tipoBadge[m.tipo] ?? 'badge-muted'}`}>{m.tipo}</span></td>
                  <td>{m.lote_cafe?.variedad ?? '—'}</td>
                  <td><strong style={{ color: 'var(--primary)' }}>{m.cantidad} kg</strong></td>
                  <td>{m.almacen_origen?.nombre ?? '—'}</td>
                  <td>{m.almacen_destino?.nombre ?? '—'}</td>
                  <td style={{ fontSize: '0.78rem' }}>{new Date(m.fecha_movimiento).toLocaleDateString('es-CO')}</td>
                  <td style={{ fontSize: '0.78rem', maxWidth: 160 }}>{m.notas ? String(m.notas).slice(0, 50) + '…' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
