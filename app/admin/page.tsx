import { createClient } from '../../utils/supabase/server'
import Link from 'next/link'

export default async function Dashboard() {
  const supabase = await createClient()

  const [
    { count: lotes },        { count: ventas },
    { count: movimientos },  { count: clientes },
    { count: productores },  { count: almacenes },
    { count: procesos },     { count: usuarios },
    { data: lotesRecientes },
    { data: ventasRecientes },
    { data: movRecientes },
  ] = await Promise.all([
    supabase.from('lote_cafe').select('*',             { count: 'exact', head: true }),
    supabase.from('venta').select('*',                 { count: 'exact', head: true }),
    supabase.from('movimiento_inventario').select('*', { count: 'exact', head: true }),
    supabase.from('cliente').select('*',               { count: 'exact', head: true }),
    supabase.from('productor').select('*',             { count: 'exact', head: true }),
    supabase.from('almacen').select('*',               { count: 'exact', head: true }),
    supabase.from('proceso').select('*',               { count: 'exact', head: true }),
    supabase.from('usuario').select('*',               { count: 'exact', head: true }),
    supabase.from('lote_cafe').select('variedad, peso_kg, estado, finca(nombre)').order('created_at', { ascending: false }).limit(5),
    supabase.from('venta').select('fecha_venta, total_kg, precio_kg, cliente(nombre)').order('fecha_venta', { ascending: false }).limit(5),
    supabase.from('movimiento_inventario').select('tipo, fecha_movimiento, cantidad, lote_cafe(variedad)').order('fecha_movimiento', { ascending: false }).limit(5),
  ])

  const stats = [
    { label: 'Lotes',       value: lotes ?? 0,      icon: '☕', href: '/admin/lotes',       color: '#c8782a', bg: 'rgba(200,120,42,0.12)'  },
    { label: 'Ventas',      value: ventas ?? 0,     icon: '💰', href: '/admin/ventas',      color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
    { label: 'Movimientos', value: movimientos ?? 0,icon: '↕️', href: '/admin/movimientos', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
    { label: 'Clientes',    value: clientes ?? 0,   icon: '🤝', href: '/admin/clientes',    color: '#a855f7', bg: 'rgba(168,85,247,0.12)'  },
    { label: 'Productores', value: productores ?? 0,icon: '👨‍🌾', href: '/admin/productores', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
    { label: 'Almacenes',   value: almacenes ?? 0,  icon: '🏭', href: '/admin/almacenes',   color: '#14b8a6', bg: 'rgba(20,184,166,0.12)'  },
    { label: 'Procesos',    value: procesos ?? 0,   icon: '⚙️', href: '/admin/procesos',    color: '#ec4899', bg: 'rgba(236,72,153,0.12)'  },
    { label: 'Usuarios',    value: usuarios ?? 0,   icon: '👥', href: '/admin/usuarios',    color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)'  },
  ]

  const estadoBadge: Record<string,string> = { disponible:'badge-green', en_proceso:'badge-amber', vendido:'badge-blue', exportado:'badge-purple' }
  const tipoBadge:   Record<string,string> = { entrada:'badge-green', salida:'badge-red', traslado:'badge-blue' }

  const fmt = (v: string) => new Date(v).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })

  return (
    <div>
      {/* Hero */}
      <div className="dash-hero">
        <div className="dash-hero-icon">☕</div>
        <div>
          <h1>Café Almacén</h1>
          <p>Panel de control · inventario, procesos y ventas de café especial</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {stats.map(s => (
          <Link key={s.label} href={s.href} className="stat-card" style={{ ['--card-color' as any]: s.color }}>
            <div className="stat-icon-wrap" style={{ background: s.bg }}>
              <span>{s.icon}</span>
            </div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <div className="dash-grid">

        {/* Lotes recientes */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <span className="dash-panel-title">☕ Últimos lotes</span>
            <Link href="/admin/lotes" className="dash-panel-link">Ver todos →</Link>
          </div>
          <table className="data-table">
            <thead><tr><th>Variedad</th><th>Finca</th><th>Peso</th><th>Estado</th></tr></thead>
            <tbody>
              {(lotesRecientes ?? []).map((l: any) => (
                <tr key={l.idlote_cafe}>
                  <td><strong>{l.variedad}</strong></td>
                  <td style={{color:'var(--text-dim)',fontSize:'0.82rem'}}>{l.finca?.nombre || '—'}</td>
                  <td style={{fontSize:'0.82rem'}}>{Number(l.peso_kg).toLocaleString('es-CO')} kg</td>
                  <td><span className={`badge ${estadoBadge[l.estado]??'badge-amber'}`}>{l.estado?.replace('_',' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Ventas recientes */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <span className="dash-panel-title">💰 Últimas ventas</span>
            <Link href="/admin/ventas" className="dash-panel-link">Ver todas →</Link>
          </div>
          <table className="data-table">
            <thead><tr><th>Cliente</th><th>Fecha</th><th>Kg</th><th>$/kg</th></tr></thead>
            <tbody>
              {(ventasRecientes ?? []).map((v: any) => (
                <tr key={v.idventa}>
                  <td><strong>{v.cliente?.nombre || '—'}</strong></td>
                  <td style={{color:'var(--text-dim)',fontSize:'0.82rem'}}>{fmt(v.fecha_venta)}</td>
                  <td style={{fontSize:'0.82rem'}}>{v.total_kg ? `${Number(v.total_kg).toLocaleString('es-CO')} kg` : '—'}</td>
                  <td style={{fontSize:'0.82rem'}}>{v.precio_kg ? `$${Number(v.precio_kg).toLocaleString('es-CO')}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Movimientos recientes */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <span className="dash-panel-title">↕️ Últimos movimientos</span>
            <Link href="/admin/movimientos" className="dash-panel-link">Ver todos →</Link>
          </div>
          <table className="data-table">
            <thead><tr><th>Tipo</th><th>Lote</th><th>Cantidad</th><th>Fecha</th></tr></thead>
            <tbody>
              {(movRecientes ?? []).map((m: any, i: number) => (
                <tr key={i}>
                  <td><span className={`badge ${tipoBadge[m.tipo]??'badge-amber'}`}>{m.tipo}</span></td>
                  <td style={{color:'var(--text-dim)',fontSize:'0.82rem'}}>{m.lote_cafe?.variedad || '—'}</td>
                  <td style={{fontSize:'0.82rem'}}>{Number(m.cantidad).toLocaleString('es-CO')} kg</td>
                  <td style={{color:'var(--text-dim)',fontSize:'0.82rem'}}>{fmt(m.fecha_movimiento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
