'use client'

interface UsuarioPortal { idusuario: number; nombre: string; email: string; estado_aprobacion: string }

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '../../utils/supabase/client'

interface Lote {
  idlote_cafe: number
  variedad: string
  fecha_cosecha: string
  peso_kg: number
  estado: string
  precio_kg: number   // precio fijado por el admin — NO editable por el cliente
  finca: { nombre: string; ubicacion: string | null; productor: { nombre: string } | null } | null
  registro_proceso: { proceso: { nombre: string } | null }[]
}

interface LineaCompra {
  lote: Lote
  cantidad: number
}

interface VentaHistorial {
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
  const [lotes, setLotes]         = useState<Lote[]>([])
  const [ventas, setVentas]       = useState<VentaHistorial[]>([])
  const [idCliente, setIdCliente] = useState<number | null>(null)
  const [tab, setTab]             = useState<'catalogo' | 'carrito' | 'compras'>('catalogo')
  const [loading, setLoading]     = useState(true)
  const [filtro, setFiltro]       = useState('')
  const [carrito, setCarrito]     = useState<LineaCompra[]>([])
  const [comprando, setComprando] = useState(false)
  const [errorCompra, setErrorCompra] = useState<string | null>(null)
  const [exitoMsg, setExitoMsg]   = useState<string | null>(null)

  const cargar = useCallback(async () => {
    let { data: clienteRow } = await supabase
      .from('cliente').select('idcliente').eq('email', usuario.email).maybeSingle()

    if (!clienteRow) {
      const { data: nuevo } = await supabase
        .from('cliente').insert({ nombre: usuario.nombre, email: usuario.email })
        .select('idcliente').single()
      clienteRow = nuevo
    }
    setIdCliente(clienteRow?.idcliente ?? null)

    const [{ data: l }, { data: v }] = await Promise.all([
      supabase
        .from('lote_cafe')
        .select(`
          idlote_cafe, variedad, fecha_cosecha, peso_kg, estado, precio_kg,
          finca(nombre, ubicacion, productor(nombre)),
          registro_proceso(proceso(nombre))
        `)
        .eq('estado', 'disponible')
        .gt('peso_kg', 0)
        .order('fecha_cosecha', { ascending: false }),

      clienteRow?.idcliente
        ? supabase
            .from('venta')
            .select(`idventa, fecha_venta, total_kg, precio_kg, notas,
              detalle_venta(iddetalle_venta, cantidad, precio_venta,
                lote_cafe(variedad, finca(nombre)))`)
            .eq('idcliente', clienteRow.idcliente)
            .order('fecha_venta', { ascending: false })
        : Promise.resolve({ data: [] }),
    ])

    setLotes((l ?? []) as any)
    setVentas((v ?? []) as any)
    setLoading(false)
  }, [usuario.email, usuario.nombre])

  useEffect(() => { cargar() }, [cargar])

  const agregarAlCarrito = (lote: Lote, cantidad: number) => {
    setCarrito(prev => {
      const existe = prev.find(l => l.lote.idlote_cafe === lote.idlote_cafe)
      if (existe) return prev.map(l => l.lote.idlote_cafe === lote.idlote_cafe ? { ...l, cantidad } : l)
      return [...prev, { lote, cantidad }]
    })
  }

  const quitarDelCarrito = (idlote: number) =>
    setCarrito(prev => prev.filter(l => l.lote.idlote_cafe !== idlote))

  // Confirmar compra — escribe en BD, el trigger descuenta stock automáticamente
  const confirmarCompra = async () => {
    if (!idCliente || carrito.length === 0) return
    setComprando(true)
    setErrorCompra(null)
    try {
      // 0. Optimistic lock: re-verificar stock actual de cada lote
      for (const linea of carrito) {
        const { data: loteActual } = await supabase
          .from('lote_cafe')
          .select('peso_kg, estado')
          .eq('idlote_cafe', linea.lote.idlote_cafe)
          .single()

        if (!loteActual || loteActual.estado !== 'disponible') {
          throw new Error(`El lote "${linea.lote.variedad}" ya no está disponible. Otro usuario pudo haberlo comprado. Recarga la página.`)
        }
        if (loteActual.peso_kg < linea.cantidad) {
          throw new Error(`El lote "${linea.lote.variedad}" solo tiene ${loteActual.peso_kg} kg disponibles (pediste ${linea.cantidad} kg). El stock cambió desde que lo agregaste al carrito.`)
        }
      }

      const totalKg    = carrito.reduce((s, l) => s + l.cantidad, 0)
      const precioBase = carrito[0].lote.precio_kg  // precio del lote, no editable

      // 1. Crear la venta (cabecera)
      const { data: ventaData, error: ventaErr } = await supabase
        .from('venta')
        .insert({
          fecha_venta: new Date().toISOString(),
          idcliente:   idCliente,
          total_kg:    totalKg,
          precio_kg:   precioBase,
          notas: `Compra portal cliente — ${carrito.map(l => l.lote.variedad).join(', ')}`,
        })
        .select('idventa').single()
      if (ventaErr) throw new Error(ventaErr.message)

      // 2. Insertar detalle_venta por cada lote
      //    El trigger trg_descontar_stock_venta descuenta peso_kg automáticamente
      //    El trigger trg_actualizar_total_venta actualiza totales de la venta
      const { error: detErr } = await supabase.from('detalle_venta').insert(
        carrito.map(l => ({
          idventa:      ventaData.idventa,
          idlote_cafe:  l.lote.idlote_cafe,
          cantidad:     l.cantidad,
          precio_venta: l.lote.precio_kg,
        }))
      )
      if (detErr) throw new Error(detErr.message)

      // (No necesitamos actualizar lote_cafe manualmente — el trigger lo hace)

      setCarrito([])
      setExitoMsg(`✅ Compra #${ventaData.idventa} registrada (${totalKg} kg por $${(totalKg * precioBase).toLocaleString('es-CO')}). Stock actualizado automáticamente en toda la plataforma — admin, productores y transportistas ven los cambios al instante.`)
      setTimeout(() => { setExitoMsg(null); setTab('compras') }, 3500)
      await cargar()
    } catch (err: any) {
      setErrorCompra(err.message)
    } finally {
      setComprando(false)
    }
  }

  const lotesFiltrados = lotes.filter(l =>
    !filtro ||
    l.variedad.toLowerCase().includes(filtro.toLowerCase()) ||
    (l.finca?.nombre ?? '').toLowerCase().includes(filtro.toLowerCase()) ||
    (l.finca?.productor?.nombre ?? '').toLowerCase().includes(filtro.toLowerCase())
  )

  const totalCarritoKg  = carrito.reduce((s, l) => s + l.cantidad, 0)
  const totalCarritoCOP = carrito.reduce((s, l) => s + l.cantidad * l.lote.precio_kg, 0)
  const totalCompradoKg = ventas.reduce((s, v) => s + (v.total_kg ?? 0), 0)

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.25rem' }}>
          🤝 Bienvenido, {usuario.nombre}
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem' }}>
          Compra lotes de café directamente. Cada compra descuenta el stock en tiempo real.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { icon: '☕', label: 'Disponibles',     val: lotes.length,            color: 'var(--primary)' },
          { icon: '🛒', label: 'En carrito',       val: carrito.length,          color: 'var(--amber)'   },
          { icon: '📦', label: 'Mis compras',      val: ventas.length,           color: 'var(--green)'   },
          { icon: '⚖️', label: 'Total adquirido', val: `${totalCompradoKg} kg`, color: 'var(--blue)'    },
        ].map(s => (
          <div key={s.label}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-lg)', padding: '0.9rem 1rem', cursor: s.label === 'En carrito' ? 'pointer' : 'default' }}
            onClick={() => s.label === 'En carrito' && carrito.length > 0 && setTab('carrito')}>
            <div style={{ fontSize: '1.3rem', marginBottom: '0.3rem' }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
        {([
          ['catalogo', `☕ Catálogo (${lotes.length})`],
          ['carrito',  `🛒 Carrito${carrito.length > 0 ? ` (${carrito.length})` : ''}`],
          ['compras',  `📦 Mis compras (${ventas.length})`],
        ] as const).map(([t, lbl]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '0.4rem 1rem', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', background: tab === t ? 'var(--primary)' : 'var(--bg-hover)', color: tab === t ? 'var(--primary-fg)' : 'var(--text-soft)', transition: 'all var(--t)' }}>
            {lbl}
          </button>
        ))}
      </div>

      {exitoMsg && (
        <div style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green)', borderRadius: 'var(--r-md)', padding: '0.85rem 1rem', marginBottom: '1rem', fontWeight: 600 }}>
          {exitoMsg}
        </div>
      )}

      {loading ? <Spinner /> : tab === 'catalogo' ? (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <input
              style={{ width: '100%', maxWidth: 380, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0.5rem 0.9rem', color: 'var(--text)', fontSize: '0.85rem' }}
              placeholder="🔍 Buscar por variedad, finca o productor…"
              value={filtro} onChange={e => setFiltro(e.target.value)}
            />
          </div>
          {lotesFiltrados.length === 0 ? (
            <Empty mensaje="No hay lotes disponibles en este momento." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {lotesFiltrados.map(lote => (
                <LoteCard
                  key={lote.idlote_cafe}
                  lote={lote}
                  enCarrito={carrito.some(l => l.lote.idlote_cafe === lote.idlote_cafe)}
                  onAgregar={cantidad => { agregarAlCarrito(lote, cantidad); setTab('catalogo') }}
                  onQuitar={() => quitarDelCarrito(lote.idlote_cafe)}
                />
              ))}
            </div>
          )}
        </>
      ) : tab === 'carrito' ? (
        <CarritoView
          carrito={carrito} totalKg={totalCarritoKg} totalCOP={totalCarritoCOP}
          onQuitar={quitarDelCarrito} onConfirmar={confirmarCompra}
          comprando={comprando} errorCompra={errorCompra}
          onVerCatalogo={() => setTab('catalogo')}
        />
      ) : ventas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', background: 'var(--bg-card)', borderRadius: 'var(--r-xl)', border: '1px dashed var(--border)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🛒</div>
          <p style={{ fontSize: '0.88rem', marginBottom: '0.5rem' }}>Aún no tienes compras registradas.</p>
          <button className="btn btn-primary" style={{ marginTop: '0.75rem', fontSize: '0.82rem' }} onClick={() => setTab('catalogo')}>Ver catálogo</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {ventas.map(v => (
            <div key={v.idventa} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-lg)', padding: '1.15rem 1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.92rem' }}>
                    Compra #{v.idventa}
                    <span style={{ marginLeft: '0.5rem', padding: '0.1rem 0.5rem', borderRadius: '99px', fontSize: '0.68rem', background: 'var(--green-bg)', color: 'var(--green)', fontWeight: 700 }}>✓ Completada</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem', marginTop: '0.1rem' }}>
                    {new Date(v.fecha_venta).toLocaleDateString('es-CO', { dateStyle: 'long' })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {v.total_kg && <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.05rem' }}>{v.total_kg} kg</div>}
                  {v.total_kg && v.precio_kg && (
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                      ${(v.total_kg * v.precio_kg).toLocaleString('es-CO')} total
                    </div>
                  )}
                </div>
              </div>
              {v.detalle_venta?.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {v.detalle_venta.map(d => (
                    <div key={d.iddetalle_venta} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-soft)' }}>
                      <span>☕ {d.lote_cafe?.variedad ?? '—'}{d.lote_cafe?.finca ? ` · ${d.lote_cafe.finca.nombre}` : ''}</span>
                      <span style={{ fontWeight: 600 }}>{d.cantidad} kg — ${(d.cantidad * d.precio_venta).toLocaleString('es-CO')}</span>
                    </div>
                  ))}
                </div>
              )}
              {v.notas && <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>📝 {v.notas}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tarjeta de lote: precio fijo (read-only), solo se elige cantidad ──────────
function LoteCard({ lote, enCarrito, onAgregar, onQuitar }: {
  lote: Lote
  enCarrito: boolean
  onAgregar: (cantidad: number) => void
  onQuitar: () => void
}) {
  const [abierto, setAbierto]   = useState(false)
  const [cantidad, setCantidad] = useState(Math.min(50, lote.peso_kg))
  const procesosUnicos = [...new Set(lote.registro_proceso?.map(r => r.proceso?.nombre).filter(Boolean))]

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${enCarrito ? 'var(--green)' : 'var(--border-soft)'}`,
      borderRadius: 'var(--r-xl)', padding: '1.25rem',
      display: 'flex', flexDirection: 'column', gap: '0.6rem',
      transition: 'border-color var(--t)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>{lote.variedad}</div>
          {lote.finca && <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>🏡 {lote.finca.nombre}{lote.finca.ubicacion ? ` · ${lote.finca.ubicacion}` : ''}</div>}
        </div>
        <span className="badge badge-green" style={{ flexShrink: 0 }}>Disponible</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        <Stat label="Stock"     value={`${lote.peso_kg} kg`} />
        <Stat label="Cosecha"   value={new Date(lote.fecha_cosecha).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })} />
        {lote.finca?.productor && <Stat label="Productor" value={lote.finca.productor.nombre} />}
        {procesosUnicos.length > 0 && <Stat label="Proceso" value={procesosUnicos.join(', ')} />}
      </div>

      {/* Precio fijo — definido por el admin, el cliente NO puede modificarlo */}
      <div style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)', padding: '0.5rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Precio / kg</span>
        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem' }}>
          ${(lote.precio_kg ?? 0).toLocaleString('es-CO')} COP
        </span>
      </div>

      {/* Formulario: SOLO cantidad — precio es read-only */}
      {abierto && !enCarrito && (
        <div style={{ background: 'var(--bg)', borderRadius: 'var(--r-lg)', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div>
            <label style={lblS}>Cantidad (kg) *</label>
            <input type="number" style={inpS} value={cantidad} min={1} max={lote.peso_kg}
              onChange={e => setCantidad(Math.min(lote.peso_kg, Math.max(1, Number(e.target.value))))} />
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Máx disponible: {lote.peso_kg} kg · Total: <strong>${(cantidad * (lote.precio_kg ?? 0)).toLocaleString('es-CO')}</strong> COP
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button style={{ flex: 1, ...btnSec }} onClick={() => setAbierto(false)}>Cancelar</button>
            <button style={{ flex: 2, ...btnPri }} onClick={() => { onAgregar(cantidad); setAbierto(false) }}>
              🛒 Agregar al carrito
            </button>
          </div>
        </div>
      )}

      {enCarrito ? (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ flex: 1, background: 'var(--green-bg)', color: 'var(--green)', borderRadius: 'var(--r-md)', padding: '0.4rem 0.8rem', fontSize: '0.82rem', fontWeight: 700, textAlign: 'center' }}>✓ En carrito</div>
          <button style={{ ...btnSec, fontSize: '0.78rem' }} onClick={onQuitar}>Quitar</button>
        </div>
      ) : !abierto ? (
        <button style={{ ...btnPri, width: '100%', marginTop: '0.15rem' }} onClick={() => setAbierto(true)}>
          🛒 Comprar este lote
        </button>
      ) : null}
    </div>
  )
}

// ── Vista del carrito ─────────────────────────────────────────────────────────
function CarritoView({ carrito, totalKg, totalCOP, onQuitar, onConfirmar, comprando, errorCompra, onVerCatalogo }: {
  carrito: LineaCompra[]
  totalKg: number
  totalCOP: number
  onQuitar: (id: number) => void
  onConfirmar: () => void
  comprando: boolean
  errorCompra: string | null
  onVerCatalogo: () => void
}) {
  if (carrito.length === 0) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', background: 'var(--bg-card)', borderRadius: 'var(--r-xl)', border: '1px dashed var(--border)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🛒</div>
      <p style={{ marginBottom: '1rem', fontSize: '0.88rem' }}>Tu carrito está vacío.</p>
      <button className="btn btn-primary" style={{ fontSize: '0.82rem' }} onClick={onVerCatalogo}>Ver catálogo</button>
    </div>
  )
  return (
    <div style={{ maxWidth: 560 }}>
      {errorCompra && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {errorCompra}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
        {carrito.map(l => (
          <div key={l.lote.idlote_cafe} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-lg)', padding: '0.9rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>☕ {l.lote.variedad}</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                {l.lote.finca?.nombre ?? ''} · {l.cantidad} kg × ${(l.lote.precio_kg ?? 0).toLocaleString('es-CO')}/kg
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1rem', textAlign: 'right' }}>
                ${(l.cantidad * (l.lote.precio_kg ?? 0)).toLocaleString('es-CO')}
              </div>
              <button style={{ ...btnSec, fontSize: '0.74rem', padding: '0.25rem 0.5rem' }} onClick={() => onQuitar(l.lote.idlote_cafe)}>✕</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.88rem', color: 'var(--text-soft)' }}>
          <span>Total kg:</span><span style={{ fontWeight: 700 }}>{totalKg} kg</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', borderTop: '1px solid var(--border-soft)', paddingTop: '0.6rem', marginTop: '0.6rem' }}>
          <span>Total a pagar:</span>
          <span style={{ color: 'var(--primary)' }}>${totalCOP.toLocaleString('es-CO')}</span>
        </div>
      </div>
      <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber)', borderRadius: 'var(--r-md)', padding: '0.8rem 1rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: 'var(--amber)' }}>
        💡 Al confirmar, la compra se registra en la BD y el stock del lote se descuenta automáticamente para todos los usuarios.
      </div>
      <button
        style={{ width: '100%', padding: '0.7rem', borderRadius: 'var(--r-md)', background: comprando ? 'var(--border)' : 'var(--primary)', color: 'var(--primary-fg)', border: 'none', fontWeight: 700, fontSize: '0.95rem', cursor: comprando ? 'not-allowed' : 'pointer' }}
        onClick={onConfirmar} disabled={comprando}>
        {comprando ? '⏳ Procesando…' : '✓ Confirmar compra'}
      </button>
    </div>
  )
}

const lblS: React.CSSProperties = { fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: '0.25rem' }
const inpS: React.CSSProperties = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0.4rem 0.6rem', color: 'var(--text)', fontSize: '0.85rem' }
const btnPri: React.CSSProperties = { padding: '0.45rem 1rem', border: 'none', borderRadius: 'var(--r-md)', background: 'var(--primary)', color: 'var(--primary-fg)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }
const btnSec: React.CSSProperties = { padding: '0.45rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'transparent', color: 'var(--text-soft)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: '0.4rem 0.6rem' }}>
      <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-soft)', fontWeight: 600, marginTop: '0.1rem' }}>{value}</div>
    </div>
  )
}
function Spinner() { return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>Cargando…</div> }
function Empty({ mensaje }: { mensaje: string }) {
  return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', background: 'var(--bg-card)', borderRadius: 'var(--r-xl)', border: '1px dashed var(--border)' }}><div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>☕</div><p style={{ fontSize: '0.88rem' }}>{mensaje}</p></div>
}
