'use client'

interface UsuarioPortal { idusuario: number; nombre: string; email: string; estado_aprobacion: string }

import { useEffect, useState } from 'react'
import { createClient } from '../../utils/supabase/client'

interface Lote {
  idlote_cafe: number
  variedad: string
  fecha_cosecha: string
  peso_kg: number
  estado: string
  finca: { nombre: string; ubicacion: string | null; productor: { nombre: string } | null } | null
  registros_proceso: { proceso: { nombre: string } | null }[]
}

interface VentaDetalle {
  idventa: number
  fecha_venta: string
  total_kg: number | null
  precio_kg: number | null
  notas: string | null
  detalle_venta: {
    iddetalle_venta: number
    cantidad: number
    precio_venta: number
    lote_cafe: { variedad: string; finca: { nombre: string } | null } | null
  }[]
}

export default function PortalCliente({ usuario }: { usuario: UsuarioPortal }) {
  const supabase = createClient()
  const [lotes, setLotes]       = useState<Lote[]>([])
  const [ventas, setVentas]     = useState<VentaDetalle[]>([])
  const [idCliente, setIdCliente] = useState<number | null>(null)
  const [tab, setTab]           = useState<'catalogo' | 'compras'>('catalogo')
  const [loading, setLoading]   = useState(true)
  const [filtro, setFiltro]     = useState('')

  // Modal solicitar
  const [loteSeleccionado, setLoteSeleccionado] = useState<Lote | null>(null)

  useEffect(() => {
    ;(async () => {
      // Buscar cliente por email para enlazar con ventas reales
      const { data: clienteRow } = await supabase
        .from('cliente')
        .select('idcliente')
        .eq('email', usuario.email)
        .maybeSingle()

      const idcli = clienteRow?.idcliente ?? null
      setIdCliente(idcli)

      const [{ data: l }, ventasResult] = await Promise.all([
        supabase
          .from('lote_cafe')
          .select(`
            idlote_cafe, variedad, fecha_cosecha, peso_kg, estado,
            finca(nombre, ubicacion, productor(nombre)),
            registro_proceso(proceso(nombre))
          `)
          .eq('estado', 'disponible')
          .order('fecha_cosecha', { ascending: false }),

        idcli
          ? supabase
              .from('venta')
              .select(`
                idventa, fecha_venta, total_kg, precio_kg, notas,
                detalle_venta(iddetalle_venta, cantidad, precio_venta,
                  lote_cafe(variedad, finca(nombre)))
              `)
              .eq('idcliente', idcli)
              .order('fecha_venta', { ascending: false })
          : Promise.resolve({ data: [] }),
      ])

      setLotes((l ?? []) as any)
      setVentas((ventasResult.data ?? []) as any)
      setLoading(false)
    })()
  }, [])

  const lotesFiltrados = lotes.filter(l =>
    !filtro ||
    l.variedad.toLowerCase().includes(filtro.toLowerCase()) ||
    (l.finca?.nombre ?? '').toLowerCase().includes(filtro.toLowerCase()) ||
    (l.finca?.productor?.nombre ?? '').toLowerCase().includes(filtro.toLowerCase())
  )

  const totalComprado = ventas.reduce((acc, v) =>
    acc + (v.detalle_venta?.reduce((s, d) => s + (d.cantidad ?? 0), 0) ?? 0), 0)

  return (
    <div>
      {/* Bienvenida */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.25rem' }}>
          🤝 Bienvenido, {usuario.nombre}
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem' }}>
          Explora el catálogo de lotes disponibles o revisa tu historial de compras.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { icon: '☕', label: 'Lotes disponibles', val: lotes.length, color: 'var(--primary)' },
          { icon: '🛒', label: 'Mis compras', val: ventas.length, color: 'var(--green)' },
          { icon: '⚖️', label: 'Total comprado', val: `${totalComprado} kg`, color: 'var(--blue)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-lg)', padding: '0.9rem 1rem' }}>
            <div style={{ fontSize: '1.3rem', marginBottom: '0.3rem' }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>{s.label}</div>
          </div>
        ))}
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
            {t === 'catalogo' ? '☕ Catálogo de lotes' : `🛒 Mis compras (${ventas.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : tab === 'catalogo' ? (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <input
              style={{ width: '100%', maxWidth: 380, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0.5rem 0.9rem', color: 'var(--text)', fontSize: '0.85rem' }}
              placeholder="🔍 Buscar por variedad, finca o productor…"
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
            />
          </div>

          {lotesFiltrados.length === 0 ? (
            <Empty mensaje="No hay lotes disponibles en este momento." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1rem' }}>
              {lotesFiltrados.map(lote => (
                <LoteCard key={lote.idlote_cafe} lote={lote} onSolicitar={() => setLoteSeleccionado(lote)} />
              ))}
            </div>
          )}
        </>
      ) : (
        /* Historial de compras */
        ventas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', background: 'var(--bg-card)', borderRadius: 'var(--r-xl)', border: '1px dashed var(--border)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🛒</div>
            <p style={{ fontSize: '0.88rem', marginBottom: '0.5rem' }}>Aún no tienes compras registradas.</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {idCliente
                ? 'Una vez que el administrador procese tu pedido, aparecerá aquí.'
                : 'Tu cuenta de usuario aún no está vinculada a un perfil de cliente. Contacta al administrador.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {ventas.map(v => (
              <div key={v.idventa} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-lg)', padding: '1.15rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.92rem' }}>Compra #{v.idventa}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem', marginTop: '0.1rem' }}>
                      {new Date(v.fecha_venta).toLocaleDateString('es-CO', { dateStyle: 'long' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {v.total_kg && <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.05rem' }}>{v.total_kg} kg total</div>}
                    {v.precio_kg && <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>${v.precio_kg.toLocaleString('es-CO')}/kg</div>}
                  </div>
                </div>
                {/* Detalle por lote */}
                {v.detalle_venta?.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {v.detalle_venta.map(d => (
                      <div key={d.iddetalle_venta} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-soft)' }}>
                        <span>☕ {d.lote_cafe?.variedad ?? '—'}{d.lote_cafe?.finca ? ` · ${d.lote_cafe.finca.nombre}` : ''}</span>
                        <span style={{ fontWeight: 600 }}>{d.cantidad} kg — ${d.precio_venta?.toLocaleString('es-CO')}</span>
                      </div>
                    ))}
                  </div>
                )}
                {v.notas && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>📝 {v.notas}</div>}
              </div>
            ))}
          </div>
        )
      )}

      {/* Modal: Solicitar lote */}
      {loteSeleccionado && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }}
          onClick={() => setLoteSeleccionado(null)}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '1.75rem', width: '100%', maxWidth: 420 }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text)', marginBottom: '1rem' }}>
              ☕ Solicitar lote
            </h3>
            <div style={{ background: 'var(--bg)', borderRadius: 'var(--r-lg)', padding: '1rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <InfoRow label="Variedad"  val={loteSeleccionado.variedad} />
              <InfoRow label="Finca"     val={loteSeleccionado.finca?.nombre ?? '—'} />
              <InfoRow label="Productor" val={loteSeleccionado.finca?.productor?.nombre ?? '—'} />
              <InfoRow label="Peso"      val={`${loteSeleccionado.peso_kg} kg`} />
              <InfoRow label="Cosecha"   val={new Date(loteSeleccionado.fecha_cosecha).toLocaleDateString('es-CO', { dateStyle: 'long' })} />
              {loteSeleccionado.registros_proceso?.length > 0 && (
                <InfoRow label="Procesos" val={loteSeleccionado.registros_proceso.map(r => r.proceso?.nombre).filter(Boolean).join(', ')} />
              )}
              <InfoRow label="Lote #"    val={String(loteSeleccionado.idlote_cafe)} />
            </div>
            <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber)', borderRadius: 'var(--r-md)', padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--amber)', fontWeight: 700, marginBottom: '0.3rem' }}>📞 ¿Cómo comprar?</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)', lineHeight: 1.6 }}>
                Contacta al administrador mencionando el <strong>Lote #{loteSeleccionado.idlote_cafe} — {loteSeleccionado.variedad}</strong>.
                El equipo procesará tu pedido y lo verás reflejado en "Mis compras".
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setLoteSeleccionado(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LoteCard({ lote, onSolicitar }: { lote: Lote; onSolicitar: () => void }) {
  const finca = lote.finca
  const procesosUnicos = [...new Set(lote.registros_proceso?.map(r => r.proceso?.nombre).filter(Boolean))]
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-soft)',
      borderRadius: 'var(--r-xl)', padding: '1.25rem', display: 'flex',
      flexDirection: 'column', gap: '0.6rem', transition: 'border-color var(--t)',
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-soft)')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>{lote.variedad}</div>
          {finca && <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>🏡 {finca.nombre}{finca.ubicacion ? ` · ${finca.ubicacion}` : ''}</div>}
        </div>
        <span className="badge badge-green" style={{ flexShrink: 0 }}>Disponible</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        <Stat label="Peso"     value={`${lote.peso_kg} kg`} />
        <Stat label="Cosecha"  value={new Date(lote.fecha_cosecha).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })} />
        {finca?.productor && <Stat label="Productor" value={finca.productor.nombre} />}
        {procesosUnicos.length > 0 && <Stat label="Proceso" value={procesosUnicos.join(', ')} />}
      </div>
      <button
        className="btn btn-primary"
        style={{ marginTop: '0.25rem', width: '100%', fontSize: '0.82rem' }}
        onClick={onSolicitar}>
        🛒 Solicitar este lote
      </button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: '0.4rem 0.6rem' }}>
      <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-soft)', fontWeight: 600, marginTop: '0.1rem' }}>{value}</div>
    </div>
  )
}

function InfoRow({ label, val }: { label: string; val: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.82rem' }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 72 }}>{label}</span>
      <span style={{ color: 'var(--text-soft)', fontWeight: 600 }}>{val}</span>
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
