'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '../../utils/supabase/client'
import Modal from '../Modal'

const TIPOS = ['entrada', 'salida', 'traslado'] as const

const tipoBadge: Record<string,string> = {
  entrada:  'badge-green',
  salida:   'badge-red',
  traslado: 'badge-blue',
}

const tipoIcon: Record<string,string> = {
  entrada: '📥', salida: '📤', traslado: '🔄',
}

interface AlmacenConStock {
  idalmacen: number
  nombre: string
  capacidad_kg: number | null
  stock_actual: number
  espacio_disponible: number | null
}

interface ContenidoOrigen {
  idlote_cafe: number
  variedad: string
  kg_en_almacen: number
}

export default function Movimientos() {
  const supabase = createClient()

  const [data, setData]           = useState<any[]>([])
  const [lotes, setLotes]         = useState<any[]>([])
  const [almacenes, setAlmacenes] = useState<AlmacenConStock[]>([])
  const [usuarios, setUsuarios]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  // ── Filters ─────────────────────────────────────────
  const [search, setSearch]           = useState('')
  const [filtroTipo, setFiltroTipo]   = useState('')
  const [filtroAlmacen, setFiltroAlmacen] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [panelOpen, setPanelOpen]     = useState(false)
  const [sortKey, setSortKey]         = useState<string | null>('fecha_movimiento')
  const [sortDir, setSortDir]         = useState<'asc' | 'desc'>('desc')
  const [page, setPage]               = useState(1)
  const PAGE_SIZE = 20

  // Contenido del almacén origen (solo para salida/traslado)
  const [contenidoOrigen, setContenidoOrigen] = useState<ContenidoOrigen[]>([])
  const [loadingOrigen, setLoadingOrigen]     = useState(false)

  // Modal form
  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<any>(null)
  const [form, setForm] = useState<Record<string, any>>({
    tipo: 'entrada', fecha_movimiento: '', cantidad: '',
    idlote_cafe: '', idalmacen_origen: '', idalmacen_destino: '',
    idusuario_responsable: '', notas: '',
  })
  const [saving, setSaving]       = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteId, setDeleteId]   = useState<any>(null)
  const [deleting, setDeleting]   = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [movRes, lotRes, usrRes] = await Promise.all([
      supabase
        .from('movimiento_inventario')
        .select('*, lote_cafe(variedad), almacen_origen:almacen!idalmacen_origen(nombre), almacen_destino:almacen!idalmacen_destino(nombre), usuario:usuario!idusuario_responsable(nombre)')
        .order('fecha_movimiento', { ascending: false }),
      supabase.from('lote_cafe').select('idlote_cafe, variedad, peso_kg, estado').order('variedad'),
      supabase.from('usuario').select('idusuario, nombre').order('nombre'),
    ])
    if (movRes.error) setError(movRes.error.message)
    else { setData(movRes.data ?? []); setError(null) }
    setLotes(lotRes.data ?? [])
    setUsuarios(usrRes.data ?? [])

    const { data: almStock } = await supabase.from('v_almacen_stock').select('*').order('nombre')
    if (almStock) {
      setAlmacenes(almStock as AlmacenConStock[])
    } else {
      const { data: rawAlm } = await supabase.from('almacen').select('idalmacen, nombre, capacidad_kg').order('nombre')
      setAlmacenes((rawAlm ?? []).map((a: any) => ({ ...a, stock_actual: 0, espacio_disponible: a.capacidad_kg ?? null })))
    }
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if ((form.tipo === 'salida' || form.tipo === 'traslado') && form.idalmacen_origen) {
      setLoadingOrigen(true)
      supabase.rpc('fn_contenido_almacen', { p_idalmacen: Number(form.idalmacen_origen) }).then(({ data }) => {
        setContenidoOrigen((data ?? []) as ContenidoOrigen[])
        setLoadingOrigen(false)
      })
    } else { setContenidoOrigen([]) }
  }, [form.idalmacen_origen, form.tipo])

  // ── Computed filters ────────────────────────────────
  const activeFilterCount = useMemo(() => {
    let n = 0
    if (filtroTipo) n++
    if (filtroAlmacen) n++
    if (filtroDesde || filtroHasta) n++
    return n
  }, [filtroTipo, filtroAlmacen, filtroDesde, filtroHasta])

  const clearAllFilters = () => {
    setSearch(''); setFiltroTipo(''); setFiltroAlmacen('')
    setFiltroDesde(''); setFiltroHasta(''); setPage(1)
  }

  const filtered = useMemo(() => {
    let r = data
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(row =>
        row.tipo?.toLowerCase().includes(q) ||
        row.lote_cafe?.variedad?.toLowerCase().includes(q) ||
        row.almacen_origen?.nombre?.toLowerCase().includes(q) ||
        row.almacen_destino?.nombre?.toLowerCase().includes(q) ||
        row.notas?.toLowerCase().includes(q)
      )
    }
    if (filtroTipo) r = r.filter(row => row.tipo === filtroTipo)
    if (filtroAlmacen) {
      const id = Number(filtroAlmacen)
      r = r.filter(row => row.idalmacen_origen === id || row.idalmacen_destino === id)
    }
    if (filtroDesde) r = r.filter(row => row.fecha_movimiento && new Date(row.fecha_movimiento) >= new Date(filtroDesde))
    if (filtroHasta) r = r.filter(row => row.fecha_movimiento && new Date(row.fecha_movimiento) <= new Date(filtroHasta + 'T23:59:59'))
    if (sortKey) {
      r = [...r].sort((a, b) => {
        const av = a[sortKey] ?? ''
        const bv = b[sortKey] ?? ''
        const cmp = String(av).localeCompare(String(bv), 'es', { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return r
  }, [data, search, filtroTipo, filtroAlmacen, filtroDesde, filtroHasta, sortKey, sortDir])

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const resetPage = () => setPage(1)

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sortIcon = (key: string) => {
    if (sortKey !== key) return <span className="sort-icon">↕</span>
    return <span className={`sort-icon ${sortDir}`}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // ── Form handlers ───────────────────────────────────
  const openCreate = () => {
    setForm({ tipo: 'entrada', fecha_movimiento: new Date().toISOString().slice(0, 16), cantidad: '',
      idlote_cafe: '', idalmacen_origen: '', idalmacen_destino: '', idusuario_responsable: '', notas: '' })
    setEditRecord(null); setFormError(null); setModalOpen(true)
  }

  const openEdit = (record: any) => {
    setForm({
      tipo: record.tipo,
      fecha_movimiento: record.fecha_movimiento ? record.fecha_movimiento.slice(0, 16) : '',
      cantidad: record.cantidad, idlote_cafe: record.idlote_cafe ?? '',
      idalmacen_origen: record.idalmacen_origen ?? '', idalmacen_destino: record.idalmacen_destino ?? '',
      idusuario_responsable: record.idusuario_responsable ?? '', notas: record.notas ?? '',
    })
    setEditRecord(record); setFormError(null); setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.tipo || !form.cantidad || !form.idlote_cafe) { setFormError('Completa: tipo, lote y cantidad.'); return }
    if (Number(form.cantidad) <= 0) { setFormError('La cantidad debe ser mayor a 0.'); return }
    if ((form.tipo === 'salida' || form.tipo === 'traslado') && form.idalmacen_origen && form.idlote_cafe) {
      const loteEnOrigen = contenidoOrigen.find(c => c.idlote_cafe === Number(form.idlote_cafe))
      if (!loteEnOrigen) { setFormError('🚫 El lote seleccionado no está en este almacén.'); return }
      if (Number(form.cantidad) > loteEnOrigen.kg_en_almacen) {
        setFormError(`🚫 Solo hay ${loteEnOrigen.kg_en_almacen.toLocaleString('es-CO')} kg disponibles.`); return
      }
    }
    if (form.idalmacen_destino && (form.tipo === 'entrada' || form.tipo === 'traslado')) {
      const destino = almacenes.find(a => a.idalmacen === Number(form.idalmacen_destino))
      if (destino?.capacidad_kg && destino.capacidad_kg > 0) {
        const libre = destino.espacio_disponible ?? (destino.capacidad_kg - destino.stock_actual)
        if (Number(form.cantidad) > libre) {
          setFormError(`⚠️ "${destino.nombre}" solo tiene ${libre.toLocaleString('es-CO')} kg libres.`); return
        }
      }
    }
    if (form.tipo === 'traslado' && (!form.idalmacen_origen || !form.idalmacen_destino)) { setFormError('Traslado requiere origen y destino.'); return }
    if (form.tipo === 'entrada' && !form.idalmacen_destino) { setFormError('Entrada requiere almacén destino.'); return }
    if (form.tipo === 'salida' && !form.idalmacen_origen) { setFormError('Salida requiere almacén origen.'); return }

    setSaving(true); setFormError(null)
    const payload = {
      tipo: form.tipo, fecha_movimiento: form.fecha_movimiento || new Date().toISOString(),
      cantidad: Number(form.cantidad), idlote_cafe: Number(form.idlote_cafe),
      idalmacen_origen: form.idalmacen_origen ? Number(form.idalmacen_origen) : null,
      idalmacen_destino: form.idalmacen_destino ? Number(form.idalmacen_destino) : null,
      idusuario_responsable: form.idusuario_responsable ? Number(form.idusuario_responsable) : null,
      notas: form.notas || null,
    }
    let err: any
    if (editRecord) {
      const res = await supabase.from('movimiento_inventario').update(payload).eq('idmovimiento_inventario', editRecord.idmovimiento_inventario)
      err = res.error
    } else {
      const res = await supabase.from('movimiento_inventario').insert(payload)
      err = res.error
    }
    if (err) {
      const msg = err.message || ''
      setFormError(msg.includes('CAPACIDAD_EXCEDIDA')
        ? `🚫 ${msg.replace(/.*CAPACIDAD_EXCEDIDA:\s*/, '').replace(/\s*CONTEXT:.*/, '')}`
        : msg)
      setSaving(false); return
    }
    setSaving(false); setModalOpen(false); await cargar()
  }

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await supabase.from('movimiento_inventario').delete().eq('idmovimiento_inventario', deleteId)
    if (error) alert('Error al eliminar: ' + error.message)
    setDeleting(false); setDeleteId(null); await cargar()
  }

  const almacenLabel = (a: AlmacenConStock) => {
    const partes = [a.nombre, `Stock: ${a.stock_actual.toLocaleString('es-CO')} kg`]
    if (a.capacidad_kg && a.capacidad_kg > 0) partes.push(`Libre: ${(a.espacio_disponible ?? 0).toLocaleString('es-CO')} kg`)
    return partes.join(' · ')
  }

  // ── Active chips ────────────────────────────────────
  const chips: { label: string; value: string; clear: () => void }[] = []
  if (filtroTipo) chips.push({ label: 'Tipo', value: `${tipoIcon[filtroTipo]} ${filtroTipo}`, clear: () => setFiltroTipo('') })
  if (filtroAlmacen) {
    const alm = almacenes.find(a => a.idalmacen === Number(filtroAlmacen))
    chips.push({ label: 'Almacén', value: alm?.nombre ?? filtroAlmacen, clear: () => setFiltroAlmacen('') })
  }
  if (filtroDesde || filtroHasta) {
    const range = [filtroDesde && `desde ${filtroDesde}`, filtroHasta && `hasta ${filtroHasta}`].filter(Boolean).join(' ')
    chips.push({ label: 'Fecha', value: range, clear: () => { setFiltroDesde(''); setFiltroHasta('') } })
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-icon">↕️</div>
          <div>
            <h2>Movimientos de Inventario</h2>
            <p className="page-subtitle">Entradas, salidas y traslados de café entre bodegas</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Nuevo</button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {error}</div>}

      {/* ── Filter Bar ── */}
      <div className="filter-bar">
        <div className="filter-row">
          {/* Search */}
          <div className="toolbar-search">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Buscar por lote, almacén, notas…" value={search}
              onChange={e => { setSearch(e.target.value); resetPage() }} />
          </div>

          {/* Tipo segmented */}
          <div className="filter-segments">
            {(['', 'entrada', 'salida', 'traslado'] as const).map(t => (
              <button key={t || 'all'} className={`filter-seg${filtroTipo === t ? ' active' : ''}`}
                onClick={() => { setFiltroTipo(t); resetPage() }}>
                {t === '' ? 'Todos' : `${tipoIcon[t]} ${t.charAt(0).toUpperCase() + t.slice(1)}`}
              </button>
            ))}
          </div>

          {/* Advanced toggle */}
          <button className={`btn-filter${panelOpen ? ' active' : ''}`}
            onClick={() => setPanelOpen(p => !p)}>
            <span>⚡ Más filtros</span>
            {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
          </button>

          <span className="toolbar-count" style={{ marginLeft: 'auto' }}>
            {filtered.length} mov.{data.length !== filtered.length && (
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> de {data.length}</span>
            )}
          </span>
        </div>

        {/* Advanced panel */}
        {panelOpen && (
          <div className="filter-panel">
            <div className="filter-group">
              <span className="filter-label">🏭 Almacén (origen o destino)</span>
              <select value={filtroAlmacen} onChange={e => { setFiltroAlmacen(e.target.value); resetPage() }}>
                <option value="">Todos los almacenes</option>
                {almacenes.map(a => <option key={a.idalmacen} value={a.idalmacen}>{a.nombre}</option>)}
              </select>
            </div>
            <div className="filter-group" style={{ gridColumn: 'span 2' }}>
              <span className="filter-label">📅 Rango de fechas</span>
              <div className="filter-date-range">
                <input type="date" value={filtroDesde} onChange={e => { setFiltroDesde(e.target.value); resetPage() }} />
                <input type="date" value={filtroHasta} onChange={e => { setFiltroHasta(e.target.value); resetPage() }} />
              </div>
            </div>
            {(filtroAlmacen || filtroDesde || filtroHasta) && (
              <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
                <span className="filter-label">&nbsp;</span>
                <button className="btn btn-ghost btn-sm" onClick={clearAllFilters}>✕ Limpiar todo</button>
              </div>
            )}
          </div>
        )}

        {/* Chips */}
        {chips.length > 0 && (
          <div className="filter-chips">
            {chips.map(chip => (
              <span key={chip.label} className="filter-chip">
                <span style={{ color: 'var(--text-dim)', fontWeight: 500 }}>{chip.label}:</span> {chip.value}
                <button className="filter-chip-remove" onClick={chip.clear}>✕</button>
              </span>
            ))}
            <button className="filter-chips-clear" onClick={clearAllFilters}>Limpiar filtros</button>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">↕️</div>
          <p>No hay movimientos que coincidan.</p>
          <button className="btn btn-ghost btn-sm" onClick={clearAllFilters} style={{ marginTop: '0.5rem' }}>✕ Limpiar filtros</button>
        </div>
      ) : (
        <div className="data-table-wrap table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th className="th-sortable" onClick={() => toggleSort('idmovimiento_inventario')}># {sortIcon('idmovimiento_inventario')}</th>
                <th className="th-sortable" onClick={() => toggleSort('tipo')}>Tipo {sortIcon('tipo')}</th>
                <th className="th-sortable" onClick={() => toggleSort('fecha_movimiento')}>Fecha {sortIcon('fecha_movimiento')}</th>
                <th className="th-sortable" onClick={() => toggleSort('cantidad')}>Cantidad {sortIcon('cantidad')}</th>
                <th>Lote</th>
                <th>Origen</th>
                <th>Destino</th>
                <th>Responsable</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(row => (
                <tr key={row.idmovimiento_inventario}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{row.idmovimiento_inventario}</td>
                  <td><span className={`badge ${tipoBadge[row.tipo] ?? 'badge-amber'}`}>{tipoIcon[row.tipo]} {row.tipo}</span></td>
                  <td style={{ fontSize: '0.82rem' }}>
                    {row.fecha_movimiento
                      ? new Date(row.fecha_movimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                  <td><strong style={{ color: 'var(--primary)' }}>{Number(row.cantidad).toLocaleString('es-CO')} kg</strong></td>
                  <td style={{ color: 'var(--text-soft)' }}>{row.lote_cafe?.variedad || '—'}</td>
                  <td style={{ fontSize: '0.82rem' }}>
                    {row.almacen_origen?.nombre
                      ? <span style={{ color: 'var(--red)', fontWeight: 500 }}>📤 {row.almacen_origen.nombre}</span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>
                    {row.almacen_destino?.nombre
                      ? <span style={{ color: 'var(--green)', fontWeight: 500 }}>📥 {row.almacen_destino.nombre}</span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{row.usuario?.nombre || '—'}</td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(row)}>✏ Editar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(row.idmovimiento_inventario)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {!loading && pageCount > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} movimientos
          </span>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Ant</button>
            {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => Math.max(1, Math.min(pageCount - 4, page - 2)) + i).map(p => (
              <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button className="btn btn-ghost btn-sm" disabled={page === pageCount} onClick={() => setPage(p => p + 1)}>Sig ›</button>
          </div>
        </div>
      )}

      {/* ── Modal Crear/Editar ── */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editRecord ? 'Editar Movimiento' : 'Nuevo Movimiento de Inventario'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Guardando…' : editRecord ? 'Guardar cambios' : 'Registrar movimiento'}
            </button>
          </>
        }>
        {formError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {formError}</div>}
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Tipo de movimiento <span className="form-required">*</span></label>
            <select className="form-select" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
              {TIPOS.map(t => <option key={t} value={t}>{tipoIcon[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <p className="form-hint">💡 Entrada: llega a bodega. Salida: sale. Traslado: entre bodegas.</p>
          </div>
          <div className="form-group">
            <label className="form-label">Fecha y hora <span className="form-required">*</span></label>
            <input className="form-input" type="datetime-local" value={form.fecha_movimiento}
              onChange={e => setForm(p => ({ ...p, fecha_movimiento: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Lote de café <span className="form-required">*</span></label>
            {(form.tipo === 'salida' || form.tipo === 'traslado') && !form.idalmacen_origen ? (
              <p className="form-hint" style={{ color: 'var(--amber)' }}>⬆️ Primero selecciona un almacén origen.</p>
            ) : loadingOrigen ? (
              <p className="form-hint">Cargando lotes…</p>
            ) : (
              <select className="form-select" value={form.idlote_cafe}
                onChange={e => setForm(p => ({ ...p, idlote_cafe: e.target.value }))}>
                <option value="">— Selecciona —</option>
                {(form.tipo === 'entrada'
                  ? lotes
                  : contenidoOrigen.map(c => ({ idlote_cafe: c.idlote_cafe, variedad: c.variedad, peso_kg: c.kg_en_almacen, estado: 'en almacén' }))
                ).map((l: any) => (
                  <option key={l.idlote_cafe} value={l.idlote_cafe}>
                    {l.variedad} · {l.peso_kg} kg · #{l.idlote_cafe}
                  </option>
                ))}
              </select>
            )}
            {(form.tipo === 'salida' || form.tipo === 'traslado') && form.idalmacen_origen && contenidoOrigen.length === 0 && !loadingOrigen && (
              <p className="form-hint" style={{ color: 'var(--red)' }}>📭 Este almacén no tiene lotes disponibles.</p>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Cantidad (kg) <span className="form-required">*</span></label>
            <input className="form-input" type="number" value={form.cantidad}
              onChange={e => setForm(p => ({ ...p, cantidad: e.target.value }))} step="0.01" min="0" placeholder="Ej: 500" />
          </div>
          {(form.tipo === 'salida' || form.tipo === 'traslado') && (
            <div className="form-group">
              <label className="form-label">Almacén origen {form.tipo === 'traslado' && <span className="form-required">*</span>}</label>
              <select className="form-select" value={form.idalmacen_origen}
                onChange={e => setForm(p => ({ ...p, idalmacen_origen: e.target.value, idlote_cafe: '', cantidad: '' }))}>
                <option value="">— Ninguno —</option>
                {almacenes.map(a => <option key={a.idalmacen} value={a.idalmacen}>{almacenLabel(a)}</option>)}
              </select>
            </div>
          )}
          {(form.tipo === 'entrada' || form.tipo === 'traslado') && (
            <div className="form-group">
              <label className="form-label">Almacén destino {form.tipo === 'traslado' && <span className="form-required">*</span>}</label>
              <select className="form-select" value={form.idalmacen_destino}
                onChange={e => setForm(p => ({ ...p, idalmacen_destino: e.target.value }))}>
                <option value="">— Ninguno —</option>
                {almacenes.map(a => {
                  const lleno = a.capacidad_kg && a.capacidad_kg > 0 && (a.espacio_disponible ?? 0) <= 0
                  return <option key={a.idalmacen} value={a.idalmacen} disabled={!!lleno}>{lleno ? '🔴 ' : ''}{almacenLabel(a)}{lleno ? ' — LLENO' : ''}</option>
                })}
              </select>
              {form.idalmacen_destino && (() => {
                const dest = almacenes.find(a => a.idalmacen === Number(form.idalmacen_destino))
                if (!dest?.capacidad_kg || dest.capacidad_kg <= 0) return null
                const pct = Math.round((dest.stock_actual / dest.capacidad_kg) * 100)
                const color = pct >= 95 ? 'var(--red)' : pct >= 80 ? 'var(--amber)' : 'var(--green)'
                return <p className="form-hint" style={{ color }}>{pct >= 80 ? '⚠️' : '✅'} {dest.nombre}: {pct}% ocupado — {(dest.espacio_disponible ?? 0).toLocaleString('es-CO')} kg libres</p>
              })()}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Responsable</label>
            <select className="form-select" value={form.idusuario_responsable}
              onChange={e => setForm(p => ({ ...p, idusuario_responsable: e.target.value }))}>
              <option value="">— Ninguno —</option>
              {usuarios.map(u => <option key={u.idusuario} value={u.idusuario}>{u.nombre}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Notas</label>
            <textarea className="form-textarea" value={form.notas}
              onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
              placeholder="Número de guía, observaciones de calidad…" />
          </div>
        </div>
      </Modal>

      {/* ── Modal Eliminar ── */}
      <Modal isOpen={deleteId !== null} onClose={() => setDeleteId(null)} title="Confirmar eliminación"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteId(null)} disabled={deleting}>Cancelar</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
          </>
        }>
        <p style={{ color: 'var(--text-soft)', fontSize: '0.92rem', lineHeight: 1.6 }}>
          ¿Estás seguro de que deseas eliminar este movimiento? Esta acción no se puede deshacer.
        </p>
      </Modal>
    </div>
  )
}
