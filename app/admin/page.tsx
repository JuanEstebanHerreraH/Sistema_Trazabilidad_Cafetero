import { createClient } from '../../utils/supabase/server'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const [
    { count: totalLotes },
    { count: lotesDisponibles },
    { count: totalVentas },
    { count: totalClientes },
    { count: totalProductores },
    { count: pendientesSolicitudes },
    { data: ultimasVentas },
    { data: ultimosLotes },
  ] = await Promise.all([
    supabase.from('lote_cafe').select('*', { count: 'exact', head: true }),
    supabase.from('lote_cafe').select('*', { count: 'exact', head: true }).eq('estado', 'disponible'),
    supabase.from('venta').select('*', { count: 'exact', head: true }),
    supabase.from('cliente').select('*', { count: 'exact', head: true }),
    supabase.from('productor').select('*', { count: 'exact', head: true }),
    supabase.from('solicitud_rol').select('*', { count: 'exact', head: true }).eq('estado_revision', 'pendiente'),
    supabase.from('venta')
      .select('idventa, fecha_venta, total_kg, precio_kg, cliente(nombre)')
      .order('fecha_venta', { ascending: false }).limit(5),
    supabase.from('lote_cafe')
      .select('idlote_cafe, variedad, peso_kg, estado, fecha_cosecha, finca(nombre)')
      .order('created_at', { ascending: false }).limit(5),
  ])

  const stats = [
    { icon: '☕', label: 'Total lotes', value: totalLotes ?? 0, color: 'var(--primary)' },
    { icon: '✅', label: 'Disponibles', value: lotesDisponibles ?? 0, color: 'var(--green)' },
    { icon: '💰', label: 'Ventas', value: totalVentas ?? 0, color: 'var(--amber)' },
    { icon: '🤝', label: 'Clientes', value: totalClientes ?? 0, color: 'var(--blue)' },
    { icon: '👨‍🌾', label: 'Productores', value: totalProductores ?? 0, color: 'var(--teal)' },
    { icon: '📬', label: 'Solicitudes pend.', value: pendientesSolicitudes ?? 0, color: pendientesSolicitudes ? 'var(--red)' : 'var(--text-dim)' },
  ]

  const estadoBadge: Record<string, string> = {
    disponible: 'badge-green',
    en_proceso: 'badge-amber',
    vendido: 'badge-muted',
    exportado: 'badge-blue',
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-icon">▦</div>
          <div>
            <h2>Dashboard</h2>
            <p className="page-subtitle">Resumen general del sistema</p>
          </div>
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {new Date().toLocaleDateString('es-CO', { dateStyle: 'long' })}
        </span>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {stats.map(s => (
          <div key={s.label} className="stat-card" style={{ '--accent': s.color } as any}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* Últimas ventas */}
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title">💰 Últimas ventas</span>
            <a href="/admin/ventas" style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>Ver todas →</a>
          </div>
          {(ultimasVentas ?? []).length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Sin ventas registradas.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {(ultimasVentas ?? []).map((v: any) => (
                <div key={v.idventa} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-soft)' }}>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text)' }}>
                      #{v.idventa} — {(v as any).cliente?.nombre ?? 'Sin cliente'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      {new Date(v.fecha_venta).toLocaleDateString('es-CO')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)' }}>{v.total_kg} kg</div>
                    {v.total_kg && v.precio_kg && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        ${(v.total_kg * v.precio_kg).toLocaleString('es-CO')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Últimos lotes */}
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title">☕ Últimos lotes</span>
            <a href="/admin/lotes" style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>Ver todos →</a>
          </div>
          {(ultimosLotes ?? []).length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Sin lotes registrados.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {(ultimosLotes ?? []).map((l: any) => (
                <div key={l.idlote_cafe} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-soft)' }}>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text)' }}>{l.variedad}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      {(l as any).finca?.nombre ?? '—'} · {new Date(l.fecha_cosecha).toLocaleDateString('es-CO')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                    <span className={`badge ${estadoBadge[l.estado] ?? 'badge-muted'}`}>{l.estado}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{l.peso_kg} kg</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
