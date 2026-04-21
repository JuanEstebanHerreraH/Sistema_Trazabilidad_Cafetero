'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '../../utils/supabase/client'
import FilterBar from '../FilterBar'

interface UsuarioPortal { idusuario: number; nombre: string; email: string }
interface Finca { idfinca: number; nombre: string; ubicacion: string | null; area_hectareas: number | null }
interface Lote { idlote_cafe: number; variedad: string; fecha_cosecha: string; peso_kg: number; estado: string; precio_kg: number; idfinca: number; finca: { nombre: string } | null }

interface LineaGanancia {
  iddetalle_venta: number
  idlote_cafe: number
  cantidad: number
  precio_venta: number
  ganancia: number
  variedad: string
  finca_nombre: string
  idfinca: number
  fecha_venta: string
}

const estadoBadge: Record<string, string> = {
  disponible: 'badge-green', en_proceso: 'badge-amber', vendido: 'badge-blue', exportado: 'badge-purple',
}
const estadoLabel: Record<string, string> = {
  disponible: 'Disponible', en_proceso: 'En proceso', vendido: 'Vendido', exportado: 'Exportado',
}

const PAGE_SIZE = 10

export default function PortalProductor({ usuario }: { usuario: UsuarioPortal }) {
  const supabase = createClient()
  const [fincas, setFincas] = useState<Finca[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [ganancias, setGanancias] = useState<LineaGanancia[]>([])
  const [idProductor, setIdProductor] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingGanancias, setLoadingGanancias] = useState(false)
  const [tab, setTab] = useState<'fincas' | 'lotes' | 'ganancias'>('fincas')

  const [modalFinca, setModalFinca] = useState(false)
  const [editFinca, setEditFinca] = useState<Finca | null>(null)
  const [formFinca, setFormFinca] = useState({ nombre: '', ubicacion: '', area_hectareas: '' })
  const [savingFinca, setSavingFinca] = useState(false)
  const [errFinca, setErrFinca] = useState<string | null>(null)

  const [modalLote, setModalLote] = useState(false)
  const [editLote, setEditLote] = useState<Lote | null>(null)
  const [formLote, setFormLote] = useState({ idfinca: '', variedad: '', fecha_cosecha: '', peso_kg: '', precio_kg: '', estado: 'disponible' })
  const [savingLote, setSavingLote] = useState(false)
  const [errLote, setErrLote] = useState<string | null>(null)

  const [loteSearch, setLoteSearch] = useState('')
  const [loteFincaFilter, setLoteFincaFilter] = useState('')
  const [loteEstadoFilter, setLoteEstadoFilter] = useState('')
  const [loteSortDir, setLoteSortDir] = useState<'asc' | 'desc'>('desc')
  const [lotePage, setLotePage] = useState(1)

  const [ganFincaFilter, setGanFincaFilter] = useState('')
  const [ganLoteFilter, setGanLoteFilter] = useState('')
  const [ganDateFrom, setGanDateFrom] = useState('')
  const [ganDateTo, setGanDateTo] = useState('')
  const [ganPage, setGanPage] = useState(1)

  const cargarGananciasData = useCallback(async (loteIds: number[]) => {
    if (loteIds.length === 0) { setGanancias([]); return }
    setLoadingGanancias(true)
    const { data, error } = await supabase
      .from('detalle_venta')
      .select('iddetalle_venta, idlote_cafe, cantidad, precio_venta, lote_cafe(idlote_cafe, variedad, idfinca, finca:idfinca(nombre)), venta(idventa, fecha_venta)')
      .in('idlote_cafe', loteIds)
      .order('iddetalle_venta', { ascending: false })
    if (!error && data) {
      setGanancias(data.map((d: any) => ({
        iddetalle_venta: d.iddetalle_venta,
        idlote_cafe: d.idlote_cafe,
        cantidad: d.cantidad ?? 0,
        precio_venta: d.precio_venta ?? 0,
        ganancia: (d.cantidad ?? 0) * (d.precio_venta ?? 0),
        variedad: d.lote_cafe?.variedad ?? '—',
        finca_nombre: d.lote_cafe?.finca?.nombre ?? '—',
        idfinca: d.lote_cafe?.idfinca ?? 0,
        fecha_venta: d.venta?.fecha_venta ?? '',
      })))
    }
    setLoadingGanancias(false)
  }, [supabase])

  const cargar = useCallback(async () => {
    setLoading(true)
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
      const { data: fincaRows } = await supabase.from('finca').select('idfinca').eq('idproductor', pid)
      const fincaIds = fincaRows?.map(f => f.idfinca) ?? []
      const [{ data: f }, lotesResult] = await Promise.all([
        supabase.from('finca').select('idfinca, nombre, ubicacion, area_hectareas').eq('idproductor', pid).order('nombre'),
        fincaIds.length > 0
          ? supabase.from('lote_cafe').select('idlote_cafe, variedad, fecha_cosecha, peso_kg, estado, precio_kg, idfinca, finca:idfinca(nombre)')
              .in('idfinca', fincaIds).order('fecha_cosecha', { ascending: false })
          : Promise.resolve({ data: [] }),
      ])
      setFincas((f ?? []) as any)
      const lotesData = ((lotesResult as any).data ?? []) as Lote[]
      setLotes(lotesData)
      await cargarGananciasData(lotesData.map(l => l.idlote_cafe))
    }
    setLoading(false)
  }, [usuario.nombre, usuario.email, supabase, cargarGananciasData])

  useEffect(() => { cargar() }, [cargar])

  const openNewFinca = () => { setFormFinca({ nombre: '', ubicacion: '', area_hectareas: '' }); setEditFinca(null); setErrFinca(null); setModalFinca(true) }
  const openEditFinca = (f: Finca) => { setFormFinca({ nombre: f.nombre, ubicacion: f.ubicacion ?? '', area_hectareas: f.area_hectareas?.toString() ?? '' }); setEditFinca(f); setErrFinca(null); setModalFinca(true) }
  const saveFinca = async () => {
    if (!formFinca.nombre.trim()) { setErrFinca('El nombre es obligatorio.'); return }
    if (!idProductor) { setErrFinca('No se encontró tu perfil de productor.'); return }
    setSavingFinca(true); setErrFinca(null)
    const payload: any = { nombre: formFinca.nombre.trim(), ubicacion: formFinca.ubicacion.trim() || null, area_hectareas: formFinca.area_hectareas ? Number(formFinca.area_hectareas) : null, idproductor: idProductor }
    if (editFinca) { const { error } = await supabase.from('finca').update(payload).eq('idfinca', editFinca.idfinca); if (error) { setErrFinca(error.message); setSavingFinca(false); return } }
    else { const { error } = await supabase.from('finca').insert(payload); if (error) { setErrFinca(error.message); setSavingFinca(false); return } }
    setSavingFinca(false); setModalFinca(false); await cargar()
  }

  const openNewLote = (idfinca?: number) => { setFormLote({ idfinca: idfinca?.toString() ?? '', variedad: '', fecha_cosecha: new Date().toISOString().slice(0,10), peso_kg: '', precio_kg: '', estado: 'disponible' }); setEditLote(null); setErrLote(null); setModalLote(true) }
  const openEditLote = (l: Lote) => { setFormLote({ idfinca: l.idfinca.toString(), variedad: l.variedad, fecha_cosecha: l.fecha_cosecha?.slice(0, 10) ?? '', peso_kg: l.peso_kg.toString(), precio_kg: l.precio_kg.toString(), estado: l.estado }); setEditLote(l); setErrLote(null); setModalLote(true) }
  const saveLote = async () => {
    if (!formLote.variedad.trim() || !formLote.idfinca || !formLote.fecha_cosecha || !formLote.peso_kg || !formLote.precio_kg) { setErrLote('Completa todos los campos obligatorios.'); return }
    setSavingLote(true); setErrLote(null)
    const payload = { variedad: formLote.variedad.trim(), idfinca: Number(formLote.idfinca), fecha_cosecha: formLote.fecha_cosecha, peso_kg: Number(formLote.peso_kg), precio_kg: Number(formLote.precio_kg), estado: formLote.estado }
    if (editLote) { const { error } = await supabase.from('lote_cafe').update(payload).eq('idlote_cafe', editLote.idlote_cafe); if (error) { setErrLote(error.message); setSavingLote(false); return } }
    else { const { error } = await supabase.from('lote_cafe').insert(payload); if (error) { setErrLote(error.message); setSavingLote(false); return } }
    setSavingLote(false); setModalLote(false); await cargar()
  }

  const totalKgDisponible = lotes.filter(l => l.estado === 'disponible').reduce((s, l) => s + l.peso_kg, 0)
  const totalKgVendido    = lotes.filter(l => l.estado === 'vendido').reduce((s, l) => s + l.peso_kg, 0)
  const totalGanancias    = ganancias.reduce((s, g) => s + g.ganancia, 0)

  const lotesFiltrados = useMemo(() => {
    let r = lotes
    if (loteSearch) r = r.filter(l => l.variedad.toLowerCase().includes(loteSearch.toLowerCase()) || ((l.finca as any)?.nombre ?? '').toLowerCase().includes(loteSearch.toLowerCase()))
    if (loteFincaFilter) r = r.filter(l => l.idfinca === Number(loteFincaFilter))
    if (loteEstadoFilter) r = r.filter(l => l.estado === loteEstadoFilter)
    r = [...r].sort((a, b) => { const d = new Date(a.fecha_cosecha).getTime() - new Date(b.fecha_cosecha).getTime(); return loteSortDir === 'asc' ? d : -d })
    return r
  }, [lotes, loteSearch, loteFincaFilter, loteEstadoFilter, loteSortDir])

  const lotePageCount = Math.ceil(lotesFiltrados.length / PAGE_SIZE)
  const lotesPaged = lotesFiltrados.slice((lotePage - 1) * PAGE_SIZE, lotePage * PAGE_SIZE)
  const loteActiveFilters = [loteFincaFilter, loteEstadoFilter].filter(Boolean).length

  const gananciasFiltradas = useMemo(() => {
    let r = ganancias
    if (ganFincaFilter) r = r.filter(g => g.idfinca === Number(ganFincaFilter))
    if (ganLoteFilter) r = r.filter(g => g.idlote_cafe === Number(ganLoteFilter))
    if (ganDateFrom) r = r.filter(g => g.fecha_venta >= ganDateFrom)
    if (ganDateTo) r = r.filter(g => g.fecha_venta <= ganDateTo + 'T23:59:59')
    return r
  }, [ganancias, ganFincaFilter, ganLoteFilter, ganDateFrom, ganDateTo])

  const ganPageCount = Math.ceil(gananciasFiltradas.length / PAGE_SIZE)
  const ganPaged = gananciasFiltradas.slice((ganPage - 1) * PAGE_SIZE, ganPage * PAGE_SIZE)
  const ganTotalFiltrado = gananciasFiltradas.reduce((s, g) => s + g.ganancia, 0)
  const ganActiveFilters = [ganFincaFilter, ganLoteFilter, ganDateFrom, ganDateTo].filter(Boolean).length
  const lotesUnicos = useMemo(() => Array.from(new Map(lotes.map(l => [l.idlote_cafe, l])).values()), [lotes])

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.2rem' }}>Portal Productor</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.84rem' }}>Seguimiento de tus fincas, lotes y ganancias.</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {[
          { icon: '🌿', label: 'Mis fincas',     val: fincas.length,             color: 'var(--green)',   onClick: () => setTab('fincas') },
          { icon: '☕', label: 'Total lotes',     val: lotes.length,              color: 'var(--primary)', onClick: () => setTab('lotes') },
          { icon: '✅', label: 'Kg disponibles', val: `${totalKgDisponible} kg`, color: 'var(--amber)',   onClick: () => setTab('lotes') },
          { icon: '💵', label: 'Ganancias',      val: `$${totalGanancias.toLocaleString('es-CO')}`, color: 'var(--green)', onClick: () => setTab('ganancias') },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ '--accent': s.color, cursor: 'pointer' } as any} onClick={s.onClick}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div className="tabs" style={{ margin: 0, flex: 1 }}>
          <button className={`tab-btn${tab === 'fincas' ? ' active' : ''}`} onClick={() => setTab('fincas')}>🌿 Fincas ({fincas.length})</button>
          <button className={`tab-btn${tab === 'lotes' ? ' active' : ''}`} onClick={() => setTab('lotes')}>☕ Lotes ({lotes.length})</button>
          <button className={`tab-btn${tab === 'ganancias' ? ' active' : ''}`} onClick={() => setTab('ganancias')}>💵 Ganancias</button>
        </div>
        {tab === 'fincas' && <button className="btn btn-primary btn-sm" onClick={openNewFinca}>+ Nueva finca</button>}
        {tab === 'lotes' && <button className="btn btn-primary btn-sm" onClick={() => openNewLote()}>+ Nuevo lote</button>}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : tab === 'fincas' ? (
        fincas.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🌿</div>
            <p>No tienes fincas registradas.</p>
            <button className="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={openNewFinca}>+ Registrar primera finca</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {fincas.map(f => {
              const lotesF = lotes.filter(l => l.idfinca === f.idfinca)
              const kgTotal = lotesF.reduce((s, l) => s + l.peso_kg, 0)
              const gananciaF = ganancias.filter(g => g.idfinca === f.idfinca).reduce((s, g) => s + g.ganancia, 0)
              return (
                <div key={f.idfinca} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-xl)', padding: '1.2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>🌿 {f.nombre}</div>
                      {f.ubicacion && <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>📍 {f.ubicacion}</div>}
                      {f.area_hectareas && <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)', marginTop: '0.1rem' }}>📐 {f.area_hectareas} ha</div>}
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEditFinca(f)} title="Editar finca">✏</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', marginBottom: '0.75rem' }}>
                    {[
                      { label: 'Lotes', val: lotesF.length, color: 'var(--blue)' },
                      { label: 'Kg stock', val: kgTotal.toLocaleString('es-CO'), color: 'var(--primary)' },
                      { label: 'Ganancia', val: `$${gananciaF.toLocaleString('es-CO')}`, color: 'var(--green)' },
                    ].map(item => (
                      <div key={item.label} style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: '0.4rem 0.5rem' }}>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{item.label}</div>
                        <div style={{ fontWeight: 700, color: item.color, fontSize: '0.85rem' }}>{item.val}</div>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => openNewLote(f.idfinca)}>+ Nuevo lote</button>
                </div>
              )
            })}
          </div>
        )
      ) : tab === 'lotes' ? (
        <div>
          <FilterBar
            search={loteSearch} onSearchChange={v => { setLoteSearch(v); setLotePage(1) }} searchPlaceholder="Buscar variedad o finca…"
            selects={[
              { label: 'Finca', value: loteFincaFilter, onChange: v => { setLoteFincaFilter(v); setLotePage(1) }, options: fincas.map(f => ({ value: String(f.idfinca), label: f.nombre })) },
              { label: 'Estado', value: loteEstadoFilter, onChange: v => { setLoteEstadoFilter(v); setLotePage(1) }, options: [{ value: 'disponible', label: '🟢 Disponible' }, { value: 'en_proceso', label: '🟡 En proceso' }, { value: 'vendido', label: '🔵 Vendido' }, { value: 'exportado', label: '🟣 Exportado' }] },
            ]}
            sortDir={loteSortDir} onSortDirChange={setLoteSortDir} sortLabel="Cosecha"
            activeCount={loteActiveFilters} onClear={() => { setLoteFincaFilter(''); setLoteEstadoFilter('') }}
          />
          {lotes.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">☕</div><p>No hay lotes registrados.</p>{fincas.length === 0 ? <small style={{ color: 'var(--text-dim)', marginTop: '0.5rem', display: 'block' }}>Primero registra una finca.</small> : <button className="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={() => openNewLote()}>+ Registrar primer lote</button>}</div>
          ) : lotesFiltrados.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🔍</div><p>Sin resultados con esos filtros.</p></div>
          ) : (
            <>
              <div className="data-table-wrap table-responsive">
                <table className="data-table">
                  <thead><tr><th>Variedad</th><th>Finca</th><th>Cosecha</th><th>Peso</th><th>Precio/kg</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    {lotesPaged.map(l => (
                      <tr key={l.idlote_cafe}>
                        <td><strong style={{ color: 'var(--text)' }}>{l.variedad}</strong></td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-soft)' }}>{(l.finca as any)?.nombre ?? '—'}</td>
                        <td style={{ fontSize: '0.82rem' }}>{new Date(l.fecha_cosecha).toLocaleDateString('es-CO')}</td>
                        <td><strong style={{ color: 'var(--primary)' }}>{l.peso_kg} kg</strong></td>
                        <td style={{ color: 'var(--amber)', fontSize: '0.82rem' }}>${Number(l.precio_kg).toLocaleString('es-CO')}</td>
                        <td><span className={`badge ${estadoBadge[l.estado] ?? 'badge-muted'}`}>{estadoLabel[l.estado] ?? l.estado}</span></td>
                        <td><button className="btn btn-ghost btn-sm" onClick={() => openEditLote(l)}>✏</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {lotePageCount > 1 && <Pagination page={lotePage} total={lotePageCount} onChange={setLotePage} count={lotesFiltrados.length} pageSize={PAGE_SIZE} />}
            </>
          )}
        </div>
      ) : (
        /* ── Tab Ganancias ─────────────────────────────────────────────────── */
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { icon: '💵', label: 'Ganancias totales', val: `$${totalGanancias.toLocaleString('es-CO')} COP`, color: 'var(--green)' },
              { icon: '📦', label: 'Ventas registradas', val: ganancias.length, color: 'var(--blue)' },
              { icon: '⚖️', label: 'Kg vendidos', val: `${totalKgVendido.toLocaleString('es-CO')} kg`, color: 'var(--primary)' },
              { icon: '🌿', label: 'Fincas activas', val: fincas.length, color: 'var(--amber)' },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ '--accent': s.color } as any}>
                <div className="stat-icon">{s.icon}</div>
                <div className="stat-value" style={{ fontSize: '1rem' }}>{s.val}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          <FilterBar
            selects={[
              { label: 'Finca', value: ganFincaFilter, onChange: v => { setGanFincaFilter(v); setGanLoteFilter(''); setGanPage(1) }, options: fincas.map(f => ({ value: String(f.idfinca), label: f.nombre })) },
              { label: 'Lote', value: ganLoteFilter, onChange: v => { setGanLoteFilter(v); setGanPage(1) }, options: (ganFincaFilter ? lotesUnicos.filter(l => l.idfinca === Number(ganFincaFilter)) : lotesUnicos).map(l => ({ value: String(l.idlote_cafe), label: `${l.variedad} (${(l.finca as any)?.nombre ?? ''})` })) },
            ]}
            dateFrom={ganDateFrom} dateTo={ganDateTo}
            onDateFromChange={v => { setGanDateFrom(v); setGanPage(1) }}
            onDateToChange={v => { setGanDateTo(v); setGanPage(1) }}
            activeCount={ganActiveFilters}
            onClear={() => { setGanFincaFilter(''); setGanLoteFilter(''); setGanDateFrom(''); setGanDateTo(''); setGanPage(1) }}
          />

          {ganActiveFilters > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-xl)', padding: '0.75rem 1rem', marginBottom: '0.75rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div><span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Ganancia filtrada</span><div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--green)', fontSize: '1.15rem' }}>${ganTotalFiltrado.toLocaleString('es-CO')} COP</div></div>
              <div><span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Registros</span><div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--text)', fontSize: '1.15rem' }}>{gananciasFiltradas.length}</div></div>
            </div>
          )}

          {loadingGanancias ? (
            <div className="loading-center"><div className="spinner" /><span>Cargando ganancias…</span></div>
          ) : ganancias.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💵</div>
              <p>Aún no hay ventas registradas para tus lotes.</p>
              <small style={{ color: 'var(--text-dim)', marginTop: '0.5rem', display: 'block' }}>Las ganancias aparecerán aquí cuando se registren ventas.</small>
            </div>
          ) : gananciasFiltradas.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🔍</div><p>Sin resultados con esos filtros.</p></div>
          ) : (
            <>
              <div className="data-table-wrap table-responsive">
                <table className="data-table">
                  <thead>
                    <tr><th>Finca</th><th>Lote (variedad)</th><th>Fecha venta</th><th>Kg vendidos</th><th>Precio / kg</th><th>Ganancia</th></tr>
                  </thead>
                  <tbody>
                    {ganPaged.map(g => (
                      <tr key={g.iddetalle_venta}>
                        <td><span style={{ fontWeight: 600, color: 'var(--text)' }}>🌿 {g.finca_nombre}</span></td>
                        <td><span className="badge badge-muted">{g.variedad}</span></td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>{g.fecha_venta ? new Date(g.fecha_venta).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                        <td><strong style={{ color: 'var(--primary)' }}>{g.cantidad.toLocaleString('es-CO')} kg</strong></td>
                        <td style={{ color: 'var(--amber)', fontSize: '0.82rem' }}>${g.precio_venta.toLocaleString('es-CO')}</td>
                        <td><strong style={{ color: 'var(--green)', fontSize: '0.95rem' }}>${g.ganancia.toLocaleString('es-CO')}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border-soft)' }}>
                      <td colSpan={3} style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.5rem 0.75rem' }}>Total {ganActiveFilters > 0 ? '(filtrado)' : ''}:</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{gananciasFiltradas.reduce((s, g) => s + g.cantidad, 0).toLocaleString('es-CO')} kg</td>
                      <td />
                      <td><strong style={{ color: 'var(--green)', fontSize: '1rem' }}>${ganTotalFiltrado.toLocaleString('es-CO')}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {ganPageCount > 1 && <Pagination page={ganPage} total={ganPageCount} onChange={setGanPage} count={gananciasFiltradas.length} pageSize={PAGE_SIZE} />}
            </>
          )}

          {ganancias.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--text)', marginBottom: '0.75rem' }}>📊 Desglose por finca</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
                {fincas.map(f => {
                  const lineas = ganancias.filter(g => g.idfinca === f.idfinca)
                  const gananciaF = lineas.reduce((s, g) => s + g.ganancia, 0)
                  const kgF = lineas.reduce((s, g) => s + g.cantidad, 0)
                  if (gananciaF === 0) return null
                  return (
                    <div key={f.idfinca} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-xl)', padding: '1rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem' }}>🌿 {f.nombre}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}><span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Kg vendidos</span><span style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '0.82rem' }}>{kgF.toLocaleString('es-CO')} kg</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Ganancia</span><span style={{ fontWeight: 800, color: 'var(--green)', fontSize: '1rem' }}>${gananciaF.toLocaleString('es-CO')}</span></div>
                    </div>
                  )
                }).filter(Boolean)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Finca */}
      {modalFinca && (
        <div className="modal-overlay" onClick={() => setModalFinca(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header"><h3 className="modal-title">{editFinca ? 'Editar finca' : 'Nueva finca'}</h3><button className="modal-close" onClick={() => setModalFinca(false)}>✕</button></div>
            <div className="modal-body">
              {errFinca && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {errFinca}</div>}
              <div className="form-grid-2">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Nombre <span className="form-required">*</span></label><input className="form-input" value={formFinca.nombre} onChange={e => setFormFinca(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: La Esperanza" /></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Ubicación</label><input className="form-input" value={formFinca.ubicacion} onChange={e => setFormFinca(p => ({ ...p, ubicacion: e.target.value }))} placeholder="Ej: Huila, Pitalito" /></div>
                <div className="form-group"><label className="form-label">Área (ha)</label><input className="form-input" type="number" value={formFinca.area_hectareas} onChange={e => setFormFinca(p => ({ ...p, area_hectareas: e.target.value }))} placeholder="Ej: 5.5" step="0.1" min="0" /></div>
              </div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setModalFinca(false)} disabled={savingFinca}>Cancelar</button><button className="btn btn-primary" onClick={saveFinca} disabled={savingFinca}>{savingFinca ? 'Guardando…' : editFinca ? 'Guardar cambios' : 'Crear finca'}</button></div>
          </div>
        </div>
      )}

      {/* Modal Lote */}
      {modalLote && (
        <div className="modal-overlay" onClick={() => setModalLote(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header"><h3 className="modal-title">{editLote ? 'Editar lote' : 'Nuevo lote de café'}</h3><button className="modal-close" onClick={() => setModalLote(false)}>✕</button></div>
            <div className="modal-body">
              {errLote && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {errLote}</div>}
              {fincas.length === 0 ? (<div className="alert alert-warn">Primero debes registrar al menos una finca.</div>) : (
                <div className="form-grid-2">
                  <div className="form-group"><label className="form-label">Finca <span className="form-required">*</span></label><select className="form-select" value={formLote.idfinca} onChange={e => setFormLote(p => ({ ...p, idfinca: e.target.value }))}><option value="">— Seleccionar —</option>{fincas.map(f => <option key={f.idfinca} value={f.idfinca}>{f.nombre}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Variedad <span className="form-required">*</span></label><input className="form-input" value={formLote.variedad} onChange={e => setFormLote(p => ({ ...p, variedad: e.target.value }))} placeholder="Ej: Caturra, Geisha" /></div>
                  <div className="form-group"><label className="form-label">Fecha cosecha <span className="form-required">*</span></label><input className="form-input" type="date" value={formLote.fecha_cosecha} onChange={e => setFormLote(p => ({ ...p, fecha_cosecha: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">Peso (kg) <span className="form-required">*</span></label><input className="form-input" type="number" value={formLote.peso_kg} onChange={e => setFormLote(p => ({ ...p, peso_kg: e.target.value }))} placeholder="Ej: 500" step="0.01" min="0" /></div>
                  <div className="form-group"><label className="form-label">Precio / kg (COP) <span className="form-required">*</span></label><input className="form-input" type="number" value={formLote.precio_kg} onChange={e => setFormLote(p => ({ ...p, precio_kg: e.target.value }))} placeholder="Ej: 18500" step="100" min="0" /></div>
                  <div className="form-group"><label className="form-label">Estado</label><select className="form-select" value={formLote.estado} onChange={e => setFormLote(p => ({ ...p, estado: e.target.value }))}><option value="disponible">🟢 Disponible</option><option value="en_proceso">🟡 En proceso</option><option value="vendido">🔵 Vendido</option><option value="exportado">🟣 Exportado</option></select></div>
                </div>
              )}
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setModalLote(false)} disabled={savingLote}>Cancelar</button>{fincas.length > 0 && <button className="btn btn-primary" onClick={saveLote} disabled={savingLote}>{savingLote ? 'Guardando…' : editLote ? 'Guardar cambios' : 'Registrar lote'}</button>}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function Pagination({ page, total, onChange, count, pageSize }: { page: number; total: number; onChange: (p: number) => void; count: number; pageSize: number }) {
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, count)
  const pages = Array.from({ length: Math.min(total, 5) }, (_, i) => Math.max(1, Math.min(total - 4, page - 2)) + i)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{from}–{to} de {count}</span>
      <div style={{ display: 'flex', gap: '0.35rem' }}>
        <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => onChange(page - 1)}>‹ Ant</button>
        {pages.map(p => <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}`} onClick={() => onChange(p)}>{p}</button>)}
        <button className="btn btn-ghost btn-sm" disabled={page === total} onClick={() => onChange(page + 1)}>Sig ›</button>
      </div>
    </div>
  )
}
