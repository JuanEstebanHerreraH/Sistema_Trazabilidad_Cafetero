'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../utils/supabase/client'

interface Lote {
  idlote_cafe: number
  variedad: string
  fecha_cosecha: string
  peso_kg: number
  estado: string
  finca: { nombre: string; ubicacion: string | null; productor: { nombre: string } | null } | null
}

interface Venta {
  idventa: number
  fecha_venta: string
  total_kg: number
  precio_kg: number
  notas: string | null
}

export default function PortalCliente({ usuario }: { usuario: any }) {
  const supabase = createClient()
  const [lotes, setLotes]     = useState<Lote[]>([])
  const [ventas, setVentas]   = useState<Venta[]>([])
  const [tab, setTab]         = useState<'catalogo' | 'compras'>('catalogo')
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro]   = useState('')

  useEffect(() => {
    ;(async () => {
      const [{ data: l }, { data: v }] = await Promise.all([
        supabase
          .from('lote_cafe')
          .select('idlote_cafe, variedad, fecha_cosecha, peso_kg, estado, finca(nombre, ubicacion, productor(nombre))')
          .eq('estado', 'disponible')
          .order('fecha_cosecha', { ascending: false }),
        supabase
          .from('venta')
          .select('idventa, fecha_venta, total_kg, precio_kg, notas')
          .eq('idcliente',
            // buscar cliente por nombre (en un sistema real usarías una FK directa)
            usuario.idusuario
          )
          .order('fecha_venta', { ascending: false }),
      ])
      setLotes((l ?? []) as any)
      setVentas((v ?? []) as any)
      setLoading(false)
    })()
  }, [])

  const lotesFiltrados = lotes.filter(l =>
    !filtro || l.variedad.toLowerCase().includes(filtro.toLowerCase()) ||
    (l.finca?.nombre ?? '').toLowerCase().includes(filtro.toLowerCase())
  )

  return (
    <div>
      {/* Bienvenida */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.25rem' }}>
          🤝 Bienvenido, {usuario.nombre}
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem' }}>
          Explora los lotes de café disponibles o revisa tu historial de compras.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
        {(['catalogo', 'compras'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '0.4rem 1rem', border: 'none', borderRadius: 'var(--r-md)',
              fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
              background: tab === t ? 'var(--primary)' : 'var(--bg-hover)',
              color: tab === t ? 'var(--primary-fg)' : 'var(--text-soft)',
              transition: 'all var(--t)',
            }}>
            {t === 'catalogo' ? '☕ Catálogo' : '📋 Mis compras'}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : tab === 'catalogo' ? (
        <>
          {/* Filtro */}
          <div style={{ marginBottom: '1rem' }}>
            <input
              style={{ width: '100%', maxWidth: 360, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0.5rem 0.9rem', color: 'var(--text)', fontSize: '0.85rem' }}
              placeholder="🔍 Buscar por variedad o finca…"
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
            />
          </div>

          {lotesFiltrados.length === 0 ? (
            <Empty mensaje="No hay lotes disponibles en este momento." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {lotesFiltrados.map(lote => (
                <LoteCard key={lote.idlote_cafe} lote={lote} />
              ))}
            </div>
          )}
        </>
      ) : (
        /* Historial de compras */
        ventas.length === 0 ? (
          <Empty mensaje="Aún no tienes compras registradas." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {ventas.map(v => (
              <div key={v.idventa} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-lg)', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>Compra #{v.idventa}</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem', marginTop: '0.15rem' }}>{new Date(v.fecha_venta).toLocaleDateString('es-CO', { dateStyle: 'medium' })}</div>
                  {v.notas && <div style={{ color: 'var(--text-soft)', fontSize: '0.78rem', marginTop: '0.25rem' }}>{v.notas}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.05rem' }}>{v.total_kg} kg</div>
                  {v.precio_kg && <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>${v.precio_kg.toLocaleString('es-CO')}/kg</div>}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

function LoteCard({ lote }: { lote: Lote }) {
  const finca = lote.finca
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-xl)', padding: '1.25rem', display: 'flex',
      flexDirection: 'column', gap: '0.5rem',
      transition: 'border-color var(--t)',
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-soft)')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>{lote.variedad}</div>
          {finca && <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>🏡 {finca.nombre}{finca.ubicacion ? ` · ${finca.ubicacion}` : ''}</div>}
        </div>
        <span className="badge badge-green" style={{ flexShrink: 0 }}>Disponible</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
        <Stat label="Peso" value={`${lote.peso_kg} kg`} />
        <Stat label="Cosecha" value={new Date(lote.fecha_cosecha).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })} />
        {finca?.productor && <Stat label="Productor" value={finca.productor.nombre} />}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: '0.45rem 0.65rem' }}>
      <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-soft)', fontWeight: 600, marginTop: '0.1rem' }}>{value}</div>
    </div>
  )
}

function Spinner() {
  return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>Cargando…</div>
}

function Empty({ mensaje }: { mensaje: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', background: 'var(--bg-card)', borderRadius: 'var(--r-xl)', border: '1px dashed var(--border)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>☕</div>
      <p style={{ fontSize: '0.88rem' }}>{mensaje}</p>
    </div>
  )
}
