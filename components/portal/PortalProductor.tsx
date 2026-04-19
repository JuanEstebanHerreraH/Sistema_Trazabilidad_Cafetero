'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '../../utils/supabase/client'

interface UsuarioPortal { idusuario: number; nombre: string; email: string }
interface Finca { idfinca: number; nombre: string; ubicacion: string | null; area_hectareas: number | null }
interface Lote { idlote_cafe: number; variedad: string; fecha_cosecha: string; peso_kg: number; estado: string; precio_kg: number; finca: { nombre: string } | null }

const estadoBadge: Record<string, string> = {
  disponible: 'badge-green', en_proceso: 'badge-amber', vendido: 'badge-muted', exportado: 'badge-blue',
}

export default function PortalProductor({ usuario }: { usuario: UsuarioPortal }) {
  const supabase = createClient()
  const [fincas, setFincas] = useState<Finca[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [idProductor, setIdProductor] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'fincas' | 'lotes'>('fincas')

  const cargar = useCallback(async () => {
    setLoading(true)
    // Buscar productor por nombre o email
    let { data: prod } = await supabase.from('productor').select('idproductor')
      .or(`nombre.ilike.${usuario.nombre},contacto.ilike.${usuario.email}`).maybeSingle()

    if (!prod) {
      const { data: nuevo } = await supabase.from('productor')
        .insert({ nombre: usuario.nombre, contacto: usuario.email }).select('idproductor').single()
      prod = nuevo as any
    }

    const pid = (prod as any)?.idproductor ?? null
    setIdProductor(pid)

    if (pid) {
      const [{ data: f }, { data: l }] = await Promise.all([
        supabase.from('finca').select('idfinca, nombre, ubicacion, area_hectareas').eq('idproductor', pid),
        supabase.from('lote_cafe').select('idlote_cafe, variedad, fecha_cosecha, peso_kg, estado, precio_kg, finca:idfinca(nombre)')
          .in('idfinca', (await supabase.from('finca').select('idfinca').eq('idproductor', pid)).data?.map(f => f.idfinca) ?? [])
          .order('created_at', { ascending: false }),
      ])
      setFincas((f ?? []) as any)
      setLotes((l ?? []) as any)
    }
    setLoading(false)
  }, [usuario.nombre, usuario.email, supabase])

  useEffect(() => { cargar() }, [cargar])

  const totalKgDisponible = lotes.filter(l => l.estado === 'disponible').reduce((s, l) => s + l.peso_kg, 0)
  const totalKgVendido    = lotes.filter(l => l.estado === 'vendido').reduce((s, l) => s + l.peso_kg, 0)

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.2rem' }}>
          Portal Productor
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.84rem' }}>Seguimiento de tus fincas y lotes de café.</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {[
          { icon: '🌿', label: 'Mis fincas',      val: fincas.length,           color: 'var(--green)' },
          { icon: '☕', label: 'Total lotes',      val: lotes.length,            color: 'var(--primary)' },
          { icon: '✅', label: 'Kg disponibles',  val: `${totalKgDisponible} kg`, color: 'var(--amber)' },
          { icon: '💰', label: 'Kg vendidos',     val: `${totalKgVendido} kg`,  color: 'var(--blue)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ '--accent': s.color } as any}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="tabs">
        <button className={`tab-btn${tab === 'fincas' ? ' active' : ''}`} onClick={() => setTab('fincas')}>🌿 Mis fincas ({fincas.length})</button>
        <button className={`tab-btn${tab === 'lotes' ? ' active' : ''}`} onClick={() => setTab('lotes')}>☕ Mis lotes ({lotes.length})</button>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : tab === 'fincas' ? (
        fincas.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">🌿</div><p>No tienes fincas registradas. Contacta al administrador.</p></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {fincas.map(f => (
              <div key={f.idfinca} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-xl)', padding: '1.2rem' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)', marginBottom: '0.5rem' }}>{f.nombre}</div>
                {f.ubicacion && <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.3rem' }}>📍 {f.ubicacion}</div>}
                {f.area_hectareas && <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)' }}>📐 {f.area_hectareas} ha</div>}
                <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {lotes.filter(l => (l.finca as any)?.nombre === f.nombre).length} lotes asociados
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        lotes.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">☕</div><p>No hay lotes asociados a tus fincas.</p></div>
        ) : (
          <div className="data-table-wrap table-responsive">
            <table className="data-table">
              <thead>
                <tr><th>Variedad</th><th>Finca</th><th>Cosecha</th><th>Peso</th><th>Precio/kg</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {lotes.map(l => (
                  <tr key={l.idlote_cafe}>
                    <td><strong style={{ color: 'var(--text)' }}>{l.variedad}</strong></td>
                    <td>{(l.finca as any)?.nombre ?? '—'}</td>
                    <td>{new Date(l.fecha_cosecha).toLocaleDateString('es-CO')}</td>
                    <td><strong style={{ color: 'var(--primary)' }}>{l.peso_kg} kg</strong></td>
                    <td>${Number(l.precio_kg).toLocaleString('es-CO')}</td>
                    <td><span className={`badge ${estadoBadge[l.estado] ?? 'badge-muted'}`}>{l.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
