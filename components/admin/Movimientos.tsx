'use client'
import { useState, useEffect, useCallback } from 'react'
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

  const [data, setData]       = useState<any[]>([])
  const [lotes, setLotes]     = useState<any[]>([])
  const [almacenes, setAlmacenes] = useState<AlmacenConStock[]>([])
  const [usuarios, setUsuarios]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [search, setSearch]       = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [movPage, setMovPage] = useState(1)
  const MOV_PAGE_SIZE = 20

  // Contenido del almacén origen (solo para salida/traslado)
  const [contenidoOrigen, setContenidoOrigen] = useState<ContenidoOrigen[]>([])
  const [loadingOrigen, setLoadingOrigen] = useState(false)

  // Modal form
  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<any>(null)
  const [form, setForm] = useState<Record<string, any>>({
    tipo: 'entrada',
    fecha_movimiento: '',
    cantidad: '',
    idlote_cafe: '',
    idalmacen_origen: '',
    idalmacen_destino: '',
    idusuario_responsable: '',
    notas: '',
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Delete
  const [deleteId, setDeleteId] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

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

    // Cargar almacenes con stock
    const { data: almStock } = await supabase.from('v_almacen_stock').select('*').order('nombre')
    if (almStock) {
      setAlmacenes(almStock as AlmacenConStock[])
    } else {
      // Fallback
      const { data: rawAlm } = await supabase.from('almacen').select('idalmacen, nombre, capacidad_kg').order('nombre')
      setAlmacenes((rawAlm ?? []).map((a: any) => ({ ...a, stock_actual: 0, espacio_disponible: a.capacidad_kg ?? null })))
    }

    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Cuando cambia el almacén origen en salida/traslado, cargar su contenido
  useEffect(() => {
    if ((form.tipo === 'salida' || form.tipo === 'traslado') && form.idalmacen_origen) {
      setLoadingOrigen(true)
      supabase.rpc('fn_contenido_almacen', { p_idalmacen: Number(form.idalmacen_origen) }).then(({ data }) => {
        setContenidoOrigen((data ?? []) as ContenidoOrigen[])
        setLoadingOrigen(false)
      })
    } else {
      setContenidoOrigen([])
    }
  }, [form.idalmacen_origen, form.tipo])

  const openCreate = () => {
    setForm({
      tipo: 'entrada',
      fecha_movimiento: new Date().toISOString().slice(0, 16),
      cantidad: '',
      idlote_cafe: '',
      idalmacen_origen: '',
      idalmacen_destino: '',
      idusuario_responsable: '',
      notas: '',
    })
    setEditRecord(null)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (record: any) => {
    setForm({
      tipo: record.tipo,
      fecha_movimiento: record.fecha_movimiento ? record.fecha_movimiento.slice(0, 16) : '',
      cantidad: record.cantidad,
      idlote_cafe: record.idlote_cafe ?? '',
      idalmacen_origen: record.idalmacen_origen ?? '',
      idalmacen_destino: record.idalmacen_destino ?? '',
      idusuario_responsable: record.idusuario_responsable ?? '',
      notas: record.notas ?? '',
    })
    setEditRecord(record)
    setFormError(null)
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.tipo || !form.cantidad || !form.idlote_cafe) {
      setFormError('Completa: tipo, lote y cantidad.')
      return
    }
    if (Number(form.cantidad) <= 0) {
      setFormError('La cantidad debe ser mayor a 0.')
      return
    }

    // Validar que el lote esté en el almacén origen (salida/traslado)
    if ((form.tipo === 'salida' || form.tipo === 'traslado') && form.idalmacen_origen && form.idlote_cafe) {
      const loteEnOrigen = contenidoOrigen.find(c => c.idlote_cafe === Number(form.idlote_cafe))
      if (!loteEnOrigen) {
        setFormError(`🚫 El lote seleccionado no está en este almacén. Solo puedes mover lotes que estén dentro del almacén origen.`)
        return
      }
      if (Number(form.cantidad) > loteEnOrigen.kg_en_almacen) {
        setFormError(`🚫 Solo hay ${loteEnOrigen.kg_en_almacen.toLocaleString('es-CO')} kg de "${loteEnOrigen.variedad}" en este almacén. No puedes mover ${Number(form.cantidad).toLocaleString('es-CO')} kg.`)
        return
      }
    }

    // Validar capacidad en frontend antes de enviar
    if (form.idalmacen_destino && (form.tipo === 'entrada' || form.tipo === 'traslado')) {
      const destino = almacenes.find(a => a.idalmacen === Number(form.idalmacen_destino))
      if (destino && destino.capacidad_kg && destino.capacidad_kg > 0) {
        const espacioLibre = destino.espacio_disponible ?? (destino.capacidad_kg - destino.stock_actual)
        if (Number(form.cantidad) > espacioLibre) {
          setFormError(
            `⚠️ El almacén "${destino.nombre}" solo tiene ${espacioLibre.toLocaleString('es-CO')} kg disponibles de ${destino.capacidad_kg.toLocaleString('es-CO')} kg de capacidad. ` +
            `No se pueden agregar ${Number(form.cantidad).toLocaleString('es-CO')} kg.`
          )
          return
        }
      }
    }

    if (form.tipo === 'traslado' && (!form.idalmacen_origen || !form.idalmacen_destino)) {
      setFormError('Un traslado requiere almacén origen y destino.')
      return
    }
    if (form.tipo === 'entrada' && !form.idalmacen_destino) {
      setFormError('Una entrada requiere almacén destino.')
      return
    }
    if (form.tipo === 'salida' && !form.idalmacen_origen) {
      setFormError('Una salida requiere almacén origen.')
      return
    }

    setSaving(true)
    setFormError(null)

    const payload: Record<string, any> = {
      tipo: form.tipo,
      fecha_movimiento: form.fecha_movimiento || new Date().toISOString(),
      cantidad: Number(form.cantidad),
      idlote_cafe: Number(form.idlote_cafe),
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
      // Parse trigger error
      const msg = err.message || ''
      if (msg.includes('CAPACIDAD_EXCEDIDA')) {
        const cleanMsg = msg.replace(/.*CAPACIDAD_EXCEDIDA:\s*/, '').replace(/\s*CONTEXT:.*/, '')
        setFormError(`🚫 ${cleanMsg}`)
      } else {
        setFormError(msg)
      }
      setSaving(false)
      return
    }

    setSaving(false)
    setModalOpen(false)
    await cargar()
  }

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await supabase.from('movimiento_inventario').delete().eq('idmovimiento_inventario', deleteId)
    if (error) alert('Error al eliminar: ' + error.message)
    setDeleting(false)
    setDeleteId(null)
    await cargar()
  }

  const filtered = data.filter(row => {
    const q = search.toLowerCase()
    const matchSearch = !search || (
      row.tipo?.toLowerCase().includes(q) ||
      row.lote_cafe?.variedad?.toLowerCase().includes(q) ||
      row.almacen_origen?.nombre?.toLowerCase().includes(q) ||
      row.almacen_destino?.nombre?.toLowerCase().includes(q)
    )
    const matchTipo = !filtroTipo || row.tipo === filtroTipo
    return matchSearch && matchTipo
  })

  const movTotalPages = Math.max(1, Math.ceil(filtered.length / MOV_PAGE_SIZE))
  const filteredPage  = filtered.slice((movPage - 1) * MOV_PAGE_SIZE, movPage * MOV_PAGE_SIZE)

  // Format almacen option with stock info
  const almacenLabel = (a: AlmacenConStock) => {
    const partes = [a.nombre]
    partes.push(`Stock: ${a.stock_actual.toLocaleString('es-CO')} kg`)
    if (a.capacidad_kg && a.capacidad_kg > 0) {
      partes.push(`Libre: ${(a.espacio_disponible ?? 0).toLocaleString('es-CO')} kg`)
    }
    return partes.join(' · ')
  }

  return (
    <div>
      {/* Header */}
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

      {/* Toolbar */}
      <div className="toolbar-v2">
        <div className="toolbar-search" style={{ flex: 1 }}>
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Buscar por tipo, lote, almacén…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-secondary btn-sm"
          onClick={() => setShowFilters(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          ⚙ Filtros
          {filtroTipo && <span className="filter-badge">1</span>}
        </button>
        {(search || filtroTipo) && (
          <button className="filter-clear" onClick={() => { setSearch(''); setFiltroTipo('') }}>✕ Limpiar</button>
        )}
        <span className="toolbar-count">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</span>
      </div>
      {showFilters && (
        <div className="filter-bar">
          <div className="filter-row">
            <span className="filter-label">Tipo</span>
            <div className="filter-chips">
              {[
                { v: '', l: 'Todos' },
                { v: 'entrada',  l: '📥 Entrada' },
                { v: 'salida',   l: '📤 Salida' },
                { v: 'traslado', l: '🔄 Traslado' },
              ].map(opt => (
                <button key={opt.v}
                  className={`filter-chip${filtroTipo === opt.v ? ' active' : ''}`}
                  onClick={() => setFiltroTipo(opt.v)}>
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">↕️</div>
          <p>No hay movimientos{search ? ' que coincidan' : ''}.</p>
        </div>
      ) : (
        <>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Cantidad</th>
                  <th>Lote</th>
                  <th>Origen</th>
                  <th>Destino</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredPage.map(row => (
                  <tr key={row.idmovimiento_inventario}>
                    <td>{row.idmovimiento_inventario}</td>
                    <td><span className={`badge ${tipoBadge[row.tipo]??'badge-amber'}`}>{tipoIcon[row.tipo]} {row.tipo}</span></td>
                    <td>{row.fecha_movimiento ? new Date(row.fecha_movimiento).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '—'}</td>
                    <td><strong>{Number(row.cantidad).toLocaleString('es-CO')} kg</strong></td>
                    <td>{row.lote_cafe?.variedad || '—'}</td>
                    <td>{row.almacen_origen?.nombre || <span style={{color:'var(--text-muted)'}}>—</span>}</td>
                    <td>{row.almacen_destino?.nombre || <span style={{color:'var(--text-muted)'}}>—</span>}</td>
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
          {movTotalPages > 1 && (
            <div className="pagination-bar">
              <div className="pagination-info">
                {(movPage - 1) * MOV_PAGE_SIZE + 1}–{Math.min(filtered.length, movPage * MOV_PAGE_SIZE)} de {filtered.length}
              </div>
              <div className="pagination-controls">
                <button className="page-btn page-btn-wide" disabled={movPage <= 1} onClick={() => setMovPage(p => p - 1)}>← Ant</button>
                {Array.from({ length: movTotalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === movTotalPages || Math.abs(p - movPage) <= 1)
                  .reduce<(number | '…')[]>((acc, p, i, arr) => {
                    if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('…')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, i) =>
                    p === '…'
                      ? <span key={`e${i}`} className="page-ellipsis">…</span>
                      : <button key={p} className={`page-btn${movPage === p ? ' active' : ''}`}
                          onClick={() => setMovPage(p as number)}>{p}</button>
                  )}
                <button className="page-btn page-btn-wide" disabled={movPage >= movTotalPages} onClick={() => setMovPage(p => p + 1)}>Sig →</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal Crear/Editar */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editRecord ? 'Editar Movimiento' : 'Nuevo Movimiento de Inventario'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Guardando…' : editRecord ? 'Guardar cambios' : 'Registrar movimiento'}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {formError}</div>}

        <div className="form-grid-2">
          {/* Tipo */}
          <div className="form-group">
            <label className="form-label">Tipo de movimiento <span className="form-required">*</span></label>
            <select className="form-select" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
              {TIPOS.map(t => <option key={t} value={t}>{tipoIcon[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <p className="form-hint">💡 Entrada: llega a bodega. Salida: sale. Traslado: entre bodegas.</p>
          </div>

          {/* Fecha */}
          <div className="form-group">
            <label className="form-label">Fecha y hora <span className="form-required">*</span></label>
            <input className="form-input" type="datetime-local" value={form.fecha_movimiento} onChange={e => setForm(p => ({ ...p, fecha_movimiento: e.target.value }))} />
          </div>

          {/* Lote — filtrado por contenido del almacén origen en salida/traslado */}
          <div className="form-group">
            <label className="form-label">Lote de café <span className="form-required">*</span></label>
            {(form.tipo === 'salida' || form.tipo === 'traslado') && !form.idalmacen_origen ? (
              <p className="form-hint" style={{ color: 'var(--amber)' }}>⬆️ Primero selecciona un almacén origen para ver los lotes disponibles.</p>
            ) : loadingOrigen && (form.tipo === 'salida' || form.tipo === 'traslado') ? (
              <p className="form-hint">Cargando lotes del almacén…</p>
            ) : (
              <select className="form-select" value={form.idlote_cafe} onChange={e => setForm(p => ({ ...p, idlote_cafe: e.target.value }))}>
                <option value="">— Selecciona —</option>
                {(form.tipo === 'entrada'
                  ? lotes
                  : contenidoOrigen.map(c => ({ idlote_cafe: c.idlote_cafe, variedad: c.variedad, peso_kg: c.kg_en_almacen, estado: 'en almacén' }))
                ).map((l: any) => (
                  <option key={l.idlote_cafe} value={l.idlote_cafe}>
                    {l.variedad} · {l.peso_kg} kg {form.tipo !== 'entrada' ? 'en almacén' : `· ${l.estado}`} · #{l.idlote_cafe}
                  </option>
                ))}
              </select>
            )}
            {(form.tipo === 'salida' || form.tipo === 'traslado') && form.idalmacen_origen && contenidoOrigen.length === 0 && !loadingOrigen && (
              <p className="form-hint" style={{ color: 'var(--red)' }}>📭 Este almacén no tiene lotes. No se puede hacer {form.tipo}.</p>
            )}
          </div>

          {/* Cantidad */}
          <div className="form-group">
            <label className="form-label">Cantidad (kg) <span className="form-required">*</span></label>
            <input className="form-input" type="number" value={form.cantidad} onChange={e => setForm(p => ({ ...p, cantidad: e.target.value }))} step="0.01" min="0" placeholder="Ej: 500" />
          </div>

          {/* Origen — al cambiar, resetea el lote seleccionado */}
          {(form.tipo === 'salida' || form.tipo === 'traslado') && (
            <div className="form-group">
              <label className="form-label">Almacén origen {form.tipo === 'traslado' ? <span className="form-required">*</span> : ''}</label>
              <select className="form-select" value={form.idalmacen_origen} onChange={e => setForm(p => ({ ...p, idalmacen_origen: e.target.value, idlote_cafe: '', cantidad: '' }))}>
                <option value="">— Ninguno —</option>
                {almacenes.map(a => <option key={a.idalmacen} value={a.idalmacen}>{almacenLabel(a)}</option>)}
              </select>
            </div>
          )}

          {/* Destino */}
          {(form.tipo === 'entrada' || form.tipo === 'traslado') && (
            <div className="form-group">
              <label className="form-label">Almacén destino {form.tipo === 'traslado' ? <span className="form-required">*</span> : ''}</label>
              <select className="form-select" value={form.idalmacen_destino} onChange={e => setForm(p => ({ ...p, idalmacen_destino: e.target.value }))}>
                <option value="">— Ninguno —</option>
                {almacenes.map(a => {
                  const lleno = a.capacidad_kg && a.capacidad_kg > 0 && (a.espacio_disponible ?? 0) <= 0
                  return (
                    <option key={a.idalmacen} value={a.idalmacen} disabled={!!lleno}>
                      {lleno ? '🔴 ' : ''}{almacenLabel(a)}{lleno ? ' — LLENO' : ''}
                    </option>
                  )
                })}
              </select>
              {/* Warning if selected destino is almost full */}
              {form.idalmacen_destino && (() => {
                const dest = almacenes.find(a => a.idalmacen === Number(form.idalmacen_destino))
                if (!dest || !dest.capacidad_kg || dest.capacidad_kg <= 0) return null
                const pct = Math.round((dest.stock_actual / dest.capacidad_kg) * 100)
                if (pct >= 80) {
                  return (
                    <p className="form-hint" style={{ color: pct >= 95 ? 'var(--red)' : 'var(--amber)' }}>
                      ⚠️ {dest.nombre}: {pct}% ocupado — {(dest.espacio_disponible ?? 0).toLocaleString('es-CO')} kg libres de {dest.capacidad_kg.toLocaleString('es-CO')} kg
                    </p>
                  )
                }
                return (
                  <p className="form-hint">
                    ✅ {dest.nombre}: {(dest.espacio_disponible ?? 0).toLocaleString('es-CO')} kg disponibles
                  </p>
                )
              })()}
            </div>
          )}

          {/* Responsable */}
          <div className="form-group">
            <label className="form-label">Responsable</label>
            <select className="form-select" value={form.idusuario_responsable} onChange={e => setForm(p => ({ ...p, idusuario_responsable: e.target.value }))}>
              <option value="">— Ninguno —</option>
              {usuarios.map(u => <option key={u.idusuario} value={u.idusuario}>{u.nombre}</option>)}
            </select>
          </div>

          {/* Notas */}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Notas</label>
            <textarea className="form-textarea" value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} placeholder="Número de guía, observaciones de calidad…" />
          </div>
        </div>
      </Modal>

      {/* Modal Eliminar */}
      <Modal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Confirmar eliminación"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteId(null)} disabled={deleting}>Cancelar</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
          </>
        }
      >
        <p style={{ color: 'var(--text-soft)', fontSize: '0.92rem', lineHeight: 1.6 }}>
          ¿Estás seguro de que deseas eliminar este movimiento? Esta acción no se puede deshacer.
        </p>
      </Modal>
    </div>
  )
}
