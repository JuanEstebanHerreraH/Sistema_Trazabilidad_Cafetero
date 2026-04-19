'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '../../utils/supabase/client'

// ── Singleton: evita re-crear el client en cada render (causa loop infinito) ──
const supabase = createClient()

interface UsuarioPortal { idusuario: number; nombre: string; email: string }

interface Lote {
  idlote_cafe: number; variedad: string; fecha_cosecha: string
  peso_kg: number; estado: string; precio_kg: number
  finca: { nombre: string; ubicacion: string | null; productor: { nombre: string } | null } | null
  registro_proceso: { proceso: { nombre: string } | null }[]
}

interface LineaCarrito { lote: Lote; cantidad: number }

interface VentaHistorial {
  idventa: number; fecha_venta: string; total_kg: number | null; precio_kg: number | null; notas: string | null
  detalle_venta: { iddetalle_venta: number; cantidad: number; precio_venta: number; lote_cafe: { variedad: string; finca: { nombre: string } | null } | null }[]
}

export default function PortalCliente({ usuario }: { usuario: UsuarioPortal }) {
  const [lotes, setLotes] = useState<Lote[]>([])
  const [ventas, setVentas] = useState<VentaHistorial[]>([])
  const [idCliente, setIdCliente] = useState<number | null>(null)
  const [tab, setTab] = useState<'catalogo' | 'carrito' | 'compras'>('catalogo')
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [carrito, setCarrito] = useState<LineaCarrito[]>([])
  const [comprando, setComprando] = useState(false)
  const [errorCompra, setErrorCompra] = useState<string | null>(null)
  const [exitoMsg, setExitoMsg] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    // ── 1. Obtener-o-crear cliente de forma atómica (upsert por email UNIQUE) ──
    const { data: clienteRow, error: clienteErr } = await supabase
      .from('cliente')
      .upsert(
        { nombre: usuario.nombre, email: usuario.email },
        { onConflict: 'email' }
      )
      .select('idcliente')
      .single()

    if (clienteErr || !clienteRow) {
      console.warn('[PortalCliente] Error resolviendo cliente:', clienteErr?.message)
      setLoading(false)
      return
    }

    const clienteId = clienteRow.idcliente
    setIdCliente(clienteId)

    // ── 2. Cargar lotes disponibles + historial de compras en paralelo ──
    const [lotesRes, ventasRes] = await Promise.all([
      supabase.from('lote_cafe').select(`
        idlote_cafe, variedad, fecha_cosecha, peso_kg, estado, precio_kg,
        finca(nombre, ubicacion, productor(nombre)),
        registro_proceso(proceso(nombre))
      `).eq('estado', 'disponible').gt('peso_kg', 0).order('fecha_cosecha', { ascending: false }),

      supabase.from('venta').select(`
        idventa, fecha_venta, total_kg, precio_kg, notas,
        detalle_venta(iddetalle_venta, cantidad, precio_venta,
          lote_cafe:idlote_cafe(variedad, finca:idfinca(nombre)))
      `).eq('idcliente', clienteId).order('fecha_venta', { ascending: false }),
    ])

    if (lotesRes.error) console.warn('[PortalCliente] Error cargando lotes:', lotesRes.error.message)
    if (ventasRes.error) console.warn('[PortalCliente] Error cargando ventas:', ventasRes.error.message)

    setLotes((lotesRes.data ?? []) as any)
    setVentas((ventasRes.data ?? []) as any)
    setLoading(false)
  }, [usuario.email, usuario.nombre])

  useEffect(() => { cargar() }, [cargar])

  const agregarCarrito = (lote: Lote, cantidad: number) => {
    setCarrito(prev => {
      const ex = prev.find(l => l.lote.idlote_cafe === lote.idlote_cafe)
      if (ex) return prev.map(l => l.lote.idlote_cafe === lote.idlote_cafe ? { ...l, cantidad } : l)
      return [...prev, { lote, cantidad }]
    })
  }

  const quitarCarrito = (id: number) => setCarrito(prev => prev.filter(l => l.lote.idlote_cafe !== id))

  const confirmarCompra = async () => {
    if (!idCliente || carrito.length === 0) return
    setComprando(true); setErrorCompra(null)
    try {
      // Verificar stock actualizado antes de insertar
      for (const linea of carrito) {
        const { data: actual } = await supabase.from('lote_cafe')
          .select('peso_kg, estado').eq('idlote_cafe', linea.lote.idlote_cafe).single()
        if (!actual || actual.estado !== 'disponible')
          throw new Error(`Lote "${linea.lote.variedad}" ya no está disponible.`)
        if (actual.peso_kg < linea.cantidad)
          throw new Error(`Lote "${linea.lote.variedad}" solo tiene ${actual.peso_kg} kg disponibles (pediste ${linea.cantidad} kg).`)
      }

      const totalKg = carrito.reduce((s, l) => s + l.cantidad, 0)

      // 1. Crear venta cabecera
      const { data: ventaData, error: vErr } = await supabase.from('venta').insert({
        fecha_venta: new Date().toISOString(),
        idcliente: idCliente,
        total_kg: totalKg,
        precio_kg: carrito[0].lote.precio_kg,
        notas: `Compra portal cliente — ${carrito.map(l => l.lote.variedad).join(', ')}`,
      }).select('idventa').single()
      if (vErr) throw new Error(vErr.message)

      // 2. Insertar detalles — el trigger descuenta el stock automáticamente
      const { error: dErr } = await supabase.from('detalle_venta').insert(
        carrito.map(l => ({
          idventa: ventaData.idventa,
          idlote_cafe: l.lote.idlote_cafe,
          cantidad: l.cantidad,
          precio_venta: l.lote.precio_kg,
        }))
      )
      if (dErr) throw new Error(dErr.message)

      const totalCOP = carrito.reduce((s, l) => s + l.cantidad * l.lote.precio_kg, 0)
      const msgExito = `✅ Compra #${ventaData.idventa} registrada — ${totalKg} kg por $${totalCOP.toLocaleString('es-CO')} COP`
      setCarrito([])
      // Recargar datos primero, luego mostrar mensaje y cambiar tab
      await cargar()
      setExitoMsg(msgExito)
      setTab('compras')
      setTimeout(() => { setExitoMsg(null) }, 5000)
    } catch (e: any) { setErrorCompra(e.message) }
    finally { setComprando(false) }
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
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.2rem' }}>
          Bienvenido, {usuario.nombre}
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.84rem' }}>
          Compra lotes de café directamente desde el portal. Stock actualizado en tiempo real.
        </p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {[
          { icon: '☕', label: 'Lotes disponibles', val: lotes.length,            color: 'var(--primary)', onClick: () => setTab('catalogo') },
          { icon: '🛒', label: 'En carrito',        val: carrito.length,          color: 'var(--amber)',   onClick: () => carrito.length > 0 && setTab('carrito') },
          { icon: '📦', label: 'Mis compras',       val: ventas.length,           color: 'var(--green)',   onClick: () => setTab('compras') },
          { icon: '⚖️', label: 'Total adquirido',  val: `${totalCompradoKg} kg`, color: 'var(--blue)',    onClick: undefined },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ '--accent': s.color, cursor: s.onClick ? 'pointer' : 'default' } as any}
            onClick={s.onClick}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {([
          ['catalogo', `☕ Catálogo (${lotes.length})`],
          ['carrito',  `🛒 Carrito${carrito.length > 0 ? ` (${carrito.length})` : ''}`],
          ['compras',  `📦 Mis compras (${ventas.length})`],
        ] as const).map(([t, lbl]) => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{lbl}</button>
        ))}
      </div>

      {exitoMsg && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{exitoMsg}</div>}

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : tab === 'catalogo' ? (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <input className="form-input" style={{ maxWidth: 360 }}
              placeholder="🔍 Buscar por variedad, finca o productor…"
              value={filtro} onChange={e => setFiltro(e.target.value)} />
          </div>
          {lotesFiltrados.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">☕</div><p>No hay lotes disponibles.</p></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1rem' }}>
              {lotesFiltrados.map(lote => (
                <LoteCard key={lote.idlote_cafe} lote={lote}
                  enCarrito={carrito.some(l => l.lote.idlote_cafe === lote.idlote_cafe)}
                  onAgregar={cant => { agregarCarrito(lote, cant) }}
                  onQuitar={() => quitarCarrito(lote.idlote_cafe)} />
              ))}
            </div>
          )}
        </>
      ) : tab === 'carrito' ? (
        <CarritoView carrito={carrito} totalKg={totalCarritoKg} totalCOP={totalCarritoCOP}
          onQuitar={quitarCarrito} onConfirmar={confirmarCompra}
          comprando={comprando} errorCompra={errorCompra}
          onVerCatalogo={() => setTab('catalogo')} />
      ) : (
        <HistorialCompras ventas={ventas} onVerCatalogo={() => setTab('catalogo')} />
      )}
    </div>
  )
}

// ── Tarjeta de lote ───────────────────────────────────────────────────────────
function LoteCard({ lote, enCarrito, onAgregar, onQuitar }: {
  lote: Lote; enCarrito: boolean
  onAgregar: (cantidad: number) => void; onQuitar: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [cantidad, setCantidad] = useState(Math.min(50, lote.peso_kg))
  const procesos = Array.from(new Set(lote.registro_proceso?.map(r => r.proceso?.nombre).filter(Boolean)))

  return (
    <div className={`lote-card${enCarrito ? ' in-cart' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="lote-card-title">{lote.variedad}</div>
          {lote.finca && <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>🏡 {lote.finca.nombre}{lote.finca.ubicacion ? ` · ${lote.finca.ubicacion}` : ''}</div>}
        </div>
        <span className="badge badge-green">Disponible</span>
      </div>

      <div className="lote-stats">
        <div className="lote-stat">
          <div className="lote-stat-label">Stock</div>
          <div className="lote-stat-value">{lote.peso_kg} kg</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--amber)', fontWeight: 700, marginTop: '0.1rem' }}>📦 {(lote.peso_kg / 70).toFixed(2)} bultos</div>
        </div>
        <div className="lote-stat">
          <div className="lote-stat-label">Cosecha</div>
          <div className="lote-stat-value">{new Date(lote.fecha_cosecha).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}</div>
        </div>
        {lote.finca?.productor && (
          <div className="lote-stat">
            <div className="lote-stat-label">Productor</div>
            <div className="lote-stat-value">{lote.finca.productor.nombre}</div>
          </div>
        )}
        {procesos.length > 0 && (
          <div className="lote-stat">
            <div className="lote-stat-label">Proceso</div>
            <div className="lote-stat-value">{procesos.join(', ')}</div>
          </div>
        )}
      </div>

      <div className="price-box">
        <span className="price-label">Precio / kg</span>
        <span className="price-value">${(lote.precio_kg ?? 0).toLocaleString('es-CO')} COP</span>
      </div>

      {abierto && !enCarrito && (
        <div style={{ background: 'var(--bg-1)', borderRadius: 'var(--r-lg)', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div>
            <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-soft)', display: 'block', marginBottom: '0.25rem' }}>
              Cantidad (kg) — máx {lote.peso_kg} kg
            </label>
            <input type="number" className="form-input"
              value={cantidad} min={1} max={lote.peso_kg}
              onChange={e => setCantidad(Math.min(lote.peso_kg, Math.max(1, Number(e.target.value))))} />
            <div style={{ background: 'var(--primary-subtle)', borderRadius: 'var(--r-md)', padding: '0.6rem 0.75rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.18rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-soft)' }}>
                <span>Precio/kg:</span>
                <span style={{ fontWeight: 600 }}>${(lote.precio_kg ?? 0).toLocaleString('es-CO')} COP</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-soft)' }}>📦 Bultos:</span>
                <span style={{ fontWeight: 800, color: 'var(--amber)', fontSize: '0.95rem' }}>{(cantidad / 70).toFixed(2)} <span style={{ fontWeight: 500, fontSize: '0.72rem', color: 'var(--text-muted)' }}>(1 bulto = 70 kg)</span></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid var(--primary)', paddingTop: '0.5rem', marginTop: '0.3rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>💰 Total:</span>
                <span style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.01em' }}>${(cantidad * (lote.precio_kg ?? 0)).toLocaleString('es-CO')} COP</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setAbierto(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" style={{ flex: 2 }} onClick={() => { onAgregar(cantidad); setAbierto(false) }}>
              🛒 Agregar al carrito
            </button>
          </div>
        </div>
      )}

      {enCarrito ? (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ flex: 1, background: 'var(--green-bg)', color: 'var(--green)', borderRadius: 'var(--r-md)', padding: '0.4rem 0.8rem', fontSize: '0.82rem', fontWeight: 700, textAlign: 'center' }}>✓ En carrito</div>
          <button className="btn btn-secondary btn-sm" onClick={onQuitar}>Quitar</button>
        </div>
      ) : !abierto ? (
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setAbierto(true)}>
          🛒 Comprar este lote
        </button>
      ) : null}
    </div>
  )
}

// ── Vista carrito ─────────────────────────────────────────────────────────────
function CarritoView({ carrito, totalKg, totalCOP, onQuitar, onConfirmar, comprando, errorCompra, onVerCatalogo }: {
  carrito: LineaCarrito[]; totalKg: number; totalCOP: number
  onQuitar: (id: number) => void; onConfirmar: () => void
  comprando: boolean; errorCompra: string | null; onVerCatalogo: () => void
}) {
  if (carrito.length === 0) return (
    <div className="empty-state">
      <div className="empty-icon">🛒</div>
      <p>Tu carrito está vacío.</p>
      <button className="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={onVerCatalogo}>Ver catálogo</button>
    </div>
  )
  return (
    <div style={{ maxWidth: 560 }}>
      {errorCompra && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {errorCompra}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
        {carrito.map(l => (
          <div key={l.lote.idlote_cafe} className="venta-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>☕ {l.lote.variedad}</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                {l.lote.finca?.nombre ?? ''} · {l.cantidad} kg × ${(l.lote.precio_kg ?? 0).toLocaleString('es-CO')}/kg
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>
                ${(l.cantidad * (l.lote.precio_kg ?? 0)).toLocaleString('es-CO')}
              </strong>
              <button className="btn btn-danger btn-sm" onClick={() => onQuitar(l.lote.idlote_cafe)}>✕</button>
            </div>
          </div>
        ))}
      </div>

      <div className="venta-card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.88rem', color: 'var(--text-soft)' }}>
          <span>Total kg:</span><span style={{ fontWeight: 700 }}>{totalKg} kg</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', borderTop: '1px solid var(--border-soft)', paddingTop: '0.6rem', marginTop: '0.6rem' }}>
          <span>Total a pagar:</span>
          <span style={{ color: 'var(--primary)' }}>${totalCOP.toLocaleString('es-CO')}</span>
        </div>
      </div>

      <div className="alert alert-warn" style={{ marginBottom: '1.25rem', fontSize: '0.78rem' }}>
        💡 Al confirmar, el stock se descuenta automáticamente en toda la plataforma.
      </div>

      <button className="btn btn-primary" style={{ width: '100%', padding: '0.7rem', fontSize: '0.95rem' }}
        onClick={onConfirmar} disabled={comprando}>
        {comprando ? '⏳ Procesando…' : '✓ Confirmar compra'}
      </button>
    </div>
  )
}

// ── Historial de compras ──────────────────────────────────────────────────────
function HistorialCompras({ ventas, onVerCatalogo }: { ventas: VentaHistorial[]; onVerCatalogo: () => void }) {
  if (ventas.length === 0) return (
    <div className="empty-state">
      <div className="empty-icon">📦</div>
      <p>Aún no tienes compras registradas.</p>
      <button className="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={onVerCatalogo}>Ver catálogo</button>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {ventas.map(v => (
        <div key={v.idventa} className="venta-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Compra #{v.idventa}
                <span className="badge badge-green">✓ Completada</span>
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.76rem', marginTop: '0.1rem' }}>
                {new Date(v.fecha_venta).toLocaleDateString('es-CO', { dateStyle: 'long' })}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {v.total_kg && <>
                <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1rem' }}>{v.total_kg} kg</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--amber)', fontWeight: 700 }}>📦 {(v.total_kg / 70).toFixed(2)} bultos</div>
                {v.precio_kg && <div style={{ color: 'var(--text-dim)', fontSize: '0.76rem' }}>${(v.total_kg * v.precio_kg).toLocaleString('es-CO')} COP</div>}
              </>}
            </div>
          </div>
          {(v.detalle_venta ?? []).length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.28rem' }}>
              {v.detalle_venta.map(d => (
                <div key={d.iddetalle_venta} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.79rem', color: 'var(--text-soft)' }}>
                  <span>☕ {d.lote_cafe?.variedad ?? '—'}{d.lote_cafe?.finca ? ` · ${d.lote_cafe.finca.nombre}` : ''}</span>
                  <span style={{ fontWeight: 600 }}>{d.cantidad} kg — ${(d.cantidad * d.precio_venta).toLocaleString('es-CO')}</span>
                </div>
              ))}
            </div>
          )}
          {v.notas && <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>📝 {v.notas}</div>}
        </div>
      ))}
    </div>
  )
}
