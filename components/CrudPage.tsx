'use client'
import { useState, useMemo, ReactNode, useCallback } from 'react'
import { useCrud } from '../hooks/useCrud'
import Modal from './Modal'

export interface Column {
  key: string
  label: string
  render?: (value: any, row: any) => ReactNode
  sortable?: boolean
}

export interface Field {
  key?: string
  section?: string
  label?: string
  type?: string
  required?: boolean
  placeholder?: string
  description?: string
  options?: { value: any; label: string }[]
  default?: any
  step?: string
  min?: string
  max?: string
  colSpan?: 'full' | 'half'
}

export interface FilterSelect {
  key: string
  label: string
  options: { value: string; label: string }[]
}

export interface DateRangeFilter {
  key: string
  label: string
}

export interface RangeFilter {
  key: string
  label: string
  unit?: string
  getValue?: (row: any) => number
}

interface CrudPageProps {
  title: string
  subtitle?: string
  icon: string
  table: string
  idField: string
  selectQuery?: string
  orderBy?: string
  columns: Column[]
  fields: Field[]
  searchKey?: string
  searchKeys?: string[]          // ← NEW: multi-field search with dot notation
  searchPlaceholder?: string     // ← NEW: custom placeholder
  extraActions?: (row: any) => ReactNode
  filterSelects?: FilterSelect[]
  dateFilters?: DateRangeFilter[]
  rangeFilters?: RangeFilter[]
}

type SortDir = 'asc' | 'desc' | null

export default function CrudPage({
  title, subtitle, icon, table, idField,
  selectQuery = '*', orderBy, columns, fields,
  searchKey, searchKeys, searchPlaceholder,
  extraActions, filterSelects, dateFilters, rangeFilters,
}: CrudPageProps) {
  const { data, loading, error, insert, update, remove } = useCrud(table, idField, selectQuery, orderBy)

  const [search, setSearch] = useState('')
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [dateFrom, setDateFrom] = useState<Record<string, string>>({})
  const [dateTo, setDateTo] = useState<Record<string, string>>({})
  const [rangeMin, setRangeMin] = useState<Record<string, string>>({})
  const [rangeMax, setRangeMax] = useState<Record<string, string>>({})
  const [panelOpen, setPanelOpen] = useState(false)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)

  const [page, setPage] = useState(1)
  const PAGE_SIZE = 15

  const [modalOpen, setModalOpen] = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [viewRecord, setViewRecord] = useState<any>(null)
  const [editRecord, setEditRecord] = useState<any>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  const dataFields = useMemo(() => fields.filter(f => !!f.key), [fields])

  const hasFilters = useMemo(() => {
    const hasSelects = filterSelects?.some(fs => filterValues[fs.key]) ?? false
    const hasDates = dateFilters?.some(df => dateFrom[df.key] || dateTo[df.key]) ?? false
    const hasRanges = rangeFilters?.some(rf => rangeMin[rf.key] || rangeMax[rf.key]) ?? false
    return hasSelects || hasDates || hasRanges
  }, [filterValues, dateFrom, dateTo, rangeMin, rangeMax, filterSelects, dateFilters, rangeFilters])

  const activeFilterCount = useMemo(() => {
    let count = 0
    filterSelects?.forEach(fs => { if (filterValues[fs.key]) count++ })
    dateFilters?.forEach(df => { if (dateFrom[df.key] || dateTo[df.key]) count++ })
    rangeFilters?.forEach(rf => { if (rangeMin[rf.key] || rangeMax[rf.key]) count++ })
    return count
  }, [filterValues, dateFrom, dateTo, rangeMin, rangeMax, filterSelects, dateFilters, rangeFilters])

  const clearFilter = useCallback((key: string, type: 'select' | 'date' | 'range') => {
    if (type === 'select') setFilterValues(p => { const n = { ...p }; delete n[key]; return n })
    else if (type === 'range') {
      setRangeMin(p => { const n = { ...p }; delete n[key]; return n })
      setRangeMax(p => { const n = { ...p }; delete n[key]; return n })
    } else {
      setDateFrom(p => { const n = { ...p }; delete n[key]; return n })
      setDateTo(p => { const n = { ...p }; delete n[key]; return n })
    }
  }, [])

  const clearAll = useCallback(() => {
    setFilterValues({})
    setDateFrom({})
    setDateTo({})
    setRangeMin({})
    setRangeMax({})
    setSearch('')
    setPage(1)
  }, [])

  // helper: resolve dot-notation paths like "cliente.nombre" in a row
  const getVal = (row: any, path: string): string => {
    const v = path.split('.').reduce((acc, k) => acc?.[k], row)
    return String(v ?? '').toLowerCase()
  }

  const allSearchKeys: string[] = searchKeys ?? (searchKey ? [searchKey] : [])

  const filtered = useMemo(() => {
    let result = data
    if (search && allSearchKeys.length > 0) {
      const q = search.toLowerCase()
      result = result.filter(row => allSearchKeys.some(k => getVal(row, k).includes(q)))
    }
    filterSelects?.forEach(fs => {
      const val = filterValues[fs.key]
      if (val) result = result.filter(row => String(row[fs.key] ?? '') === val)
    })
    dateFilters?.forEach(df => {
      const from = dateFrom[df.key]
      const to = dateTo[df.key]
      if (from) result = result.filter(row => row[df.key] && new Date(row[df.key]) >= new Date(from))
      if (to) result = result.filter(row => row[df.key] && new Date(row[df.key]) <= new Date(to + 'T23:59:59'))
    })
    rangeFilters?.forEach(rf => {
      const min = rangeMin[rf.key]
      const max = rangeMax[rf.key]
      const getValue = rf.getValue ?? ((row: any) => Number(row[rf.key] ?? 0))
      if (min) result = result.filter(row => getValue(row) >= Number(min))
      if (max) result = result.filter(row => getValue(row) <= Number(max))
    })
    if (sortKey && sortDir) {
      result = [...result].sort((a, b) => {
        const cmp = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), 'es', { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, search, filterValues, filterSelects, dateFilters, rangeFilters, dateFrom, dateTo, rangeMin, rangeMax, sortKey, sortDir])

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const resetPage = () => setPage(1)

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortKey(null); setSortDir(null) }
    } else { setSortKey(key); setSortDir('asc') }
  }

  const openCreate = () => {
    const defaults: Record<string, any> = {}
    dataFields.forEach(f => { defaults[f.key!] = f.default ?? '' })
    setForm(defaults); setEditRecord(null); setFormError(null); setModalOpen(true)
  }

  const openEdit = (record: any) => {
    const copy: Record<string, any> = {}
    dataFields.forEach(f => { copy[f.key!] = record[f.key!] ?? '' })
    setForm(copy); setEditRecord(record); setFormError(null); setModalOpen(true)
  }

  const openView = (record: any) => { setViewRecord(record); setViewModal(true) }

  const handleSubmit = async () => {
    setSaving(true); setFormError(null)
    try {
      const payload: Record<string, any> = {}
      dataFields.forEach(f => {
        const val = form[f.key!]
        if (val === '' || val === null || val === undefined) payload[f.key!] = f.required ? val : null
        else if (f.type === 'number') payload[f.key!] = Number(val)
        else payload[f.key!] = val
      })
      if (editRecord) await update(editRecord[idField], payload)
      else await insert(payload)
      setModalOpen(false)
    } catch (err: any) { setFormError(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try { await remove(deleteId); setDeleteId(null) }
    catch (err: any) { alert('Error al eliminar: ' + err.message) }
    finally { setDeleting(false) }
  }

  const renderField = (field: Field) => (
    <div className="form-group" key={field.key}
      style={field.colSpan === 'full' || field.type === 'textarea' ? { gridColumn: '1 / -1' } : {}}>
      <label className="form-label">
        {field.label}
        {field.required && <span className="form-required">*</span>}
      </label>
      {field.type === 'select' ? (
        <select className="form-select" value={form[field.key!] ?? ''}
          onChange={e => setForm(p => ({ ...p, [field.key!]: e.target.value }))}>
          <option value="">— Selecciona —</option>
          {(field.options ?? []).map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea className="form-textarea" value={form[field.key!] ?? ''}
          onChange={e => setForm(p => ({ ...p, [field.key!]: e.target.value }))}
          placeholder={field.placeholder ?? ''} />
      ) : (
        <input className="form-input" type={field.type ?? 'text'}
          value={form[field.key!] ?? ''}
          onChange={e => setForm(p => ({ ...p, [field.key!]: e.target.value }))}
          placeholder={field.placeholder ?? ''} required={field.required}
          step={field.type === 'number' ? (field.step ?? 'any') : undefined}
          min={field.min} max={field.max} />
      )}
      {field.description && <p className="form-hint">💡 {field.description}</p>}
    </div>
  )

  const getDisplayValue = (row: any, key: string) => {
    const col = columns.find(c => c.key === key)
    const raw = row[key]
    if (col?.render) { try { return col.render(raw, row) } catch { return String(raw ?? '—') } }
    if (raw === null || raw === undefined) return '—'
    if (typeof raw === 'object') return JSON.stringify(raw)
    return String(raw)
  }

  const hasAnySearch = !!(searchKey || (searchKeys && searchKeys.length > 0))
  const hasSelects = filterSelects && filterSelects.length > 0
  const hasDates = dateFilters && dateFilters.length > 0
  const hasRanges = rangeFilters && rangeFilters.length > 0
  const hasAnyFilter = hasAnySearch || hasSelects || hasDates || hasRanges

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-icon">{icon}</div>
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
          </div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Nuevo</button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {error}</div>}

      {/* ── FILTER BAR ── */}
      {hasAnyFilter && (
        <div className="filter-bar">
          {/* Top row: search + toggle button */}
          <div className="filter-row">
            {hasAnySearch && (
              <div className="toolbar-search">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder={searchPlaceholder ?? 'Buscar…'}
                  value={search}
                  onChange={e => { setSearch(e.target.value); resetPage() }}
                />
              </div>
            )}

            {(hasSelects || hasDates || hasRanges) && (
              <button
                className={`btn-filter${panelOpen ? ' active' : ''}`}
                onClick={() => setPanelOpen(v => !v)}
              >
                ⚙ Filtros
                {activeFilterCount > 0 && (
                  <span className="filter-badge">{activeFilterCount}</span>
                )}
              </button>
            )}

            {(hasFilters || search) && (
              <button
                onClick={() => { clearAll(); resetPage() }}
                style={{ height: '34px', padding: '0 0.7rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', color: 'var(--text-muted)', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                ✕ Limpiar
              </button>
            )}

            <span className="toolbar-count">
              {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
              {data.length !== filtered.length && <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}> / {data.length}</span>}
            </span>
          </div>

          {/* Expandable filter panel */}
          {panelOpen && (
            <div className="filter-panel">
              {/* Select filters */}
              {filterSelects && filterSelects.map(fs => (
                <div key={fs.key} className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>{fs.label}</label>
                  <select
                    className="form-select"
                    style={{
                      height: '36px', fontSize: '0.82rem',
                      background: filterValues[fs.key] ? 'var(--primary-subtle)' : undefined,
                      border: filterValues[fs.key] ? '1px solid var(--primary)' : undefined,
                    }}
                    value={filterValues[fs.key] ?? ''}
                    onChange={e => { setFilterValues(p => ({ ...p, [fs.key]: e.target.value })); resetPage() }}
                  >
                    <option value="">Todos</option>
                    {fs.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              ))}

              {/* Date filters */}
              {dateFilters && dateFilters.map(df => (
                <div key={df.key} className="form-group" style={{ margin: 0, minWidth: 200 }}>
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>📅 {df.label}</label>
                  <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                    <input type="date" className="form-input"
                      style={{ height: '36px', fontSize: '0.82rem', flex: 1 }}
                      value={dateFrom[df.key] ?? ''}
                      onChange={e => { setDateFrom(p => ({ ...p, [df.key]: e.target.value })); resetPage() }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>–</span>
                    <input type="date" className="form-input"
                      style={{ height: '36px', fontSize: '0.82rem', flex: 1 }}
                      value={dateTo[df.key] ?? ''}
                      onChange={e => { setDateTo(p => ({ ...p, [df.key]: e.target.value })); resetPage() }}
                    />
                  </div>
                </div>
              ))}

              {/* Range filters */}
              {rangeFilters && rangeFilters.map(rf => {
                const active = !!(rangeMin[rf.key] || rangeMax[rf.key])
                return (
                  <div key={rf.key} className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>{rf.label}{rf.unit ? ` (${rf.unit})` : ''}</label>
                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <input type="number" className="form-input" placeholder="Mín"
                        style={{ height: '36px', fontSize: '0.82rem', flex: 1, background: active ? 'var(--primary-subtle)' : undefined, border: active ? '1px solid var(--primary)' : undefined }}
                        value={rangeMin[rf.key] ?? ''}
                        onChange={e => { setRangeMin(p => ({ ...p, [rf.key]: e.target.value })); resetPage() }}
                      />
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>–</span>
                      <input type="number" className="form-input" placeholder="Máx"
                        style={{ height: '36px', fontSize: '0.82rem', flex: 1, background: active ? 'var(--primary-subtle)' : undefined, border: active ? '1px solid var(--primary)' : undefined }}
                        value={rangeMax[rf.key] ?? ''}
                        onChange={e => { setRangeMax(p => ({ ...p, [rf.key]: e.target.value })); resetPage() }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{icon}</div>
          <p>No hay registros{search || hasFilters ? ' que coincidan' : ''}.</p>
          {!search && !hasFilters && <small>Haz clic en &quot;+ Nuevo&quot; para agregar el primero.</small>}
          {(search || hasFilters) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { clearAll(); setSearch(''); resetPage() }} style={{ marginTop: '0.5rem' }}>
              {search && !hasFilters ? '✕ Limpiar búsqueda' : '✕ Limpiar filtros'}
            </button>
          )}
        </div>
      ) : (
        <div className="data-table-wrap table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key}
                    className={col.sortable ? 'th-sortable' : ''}
                    onClick={col.sortable ? () => toggleSort(col.key) : undefined}>
                    {col.label}
                    {col.sortable && (
                      <span className={`sort-icon${sortKey === col.key ? (sortDir === 'asc' ? ' asc' : ' desc') : ''}`}>
                        {sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                      </span>
                    )}
                  </th>
                ))}
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(row => (
                <tr key={row[idField]}>
                  {columns.map(col => (
                    <td key={col.key}>
                      {col.render ? col.render(row[col.key], row)
                        : (row[col.key] ?? <span style={{ color: 'var(--text-muted)' }}>—</span>)}
                    </td>
                  ))}
                  <td>
                    <div className="actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => openView(row)} title="Ver detalle">👁</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(row)}>✏ Editar</button>
                      {extraActions?.(row)}
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(row[idField])}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && pageCount > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
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

      <Modal isOpen={viewModal} onClose={() => setViewModal(false)} title={`Detalle — ${title}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setViewModal(false)}>Cerrar</button>
            <button className="btn btn-primary" onClick={() => { setViewModal(false); openEdit(viewRecord) }}>✏ Editar</button>
          </>
        }>
        {viewRecord && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {columns.map(col => (
              <div key={col.key} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border-soft)',
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                  {col.label}
                </span>
                <span style={{ fontSize: '0.84rem', color: 'var(--text-soft)', textAlign: 'right' }}>
                  {getDisplayValue(viewRecord, col.key)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editRecord ? `Editar — ${title}` : `Nuevo — ${title}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? '⏳ Guardando…' : editRecord ? 'Guardar cambios' : 'Crear registro'}
            </button>
          </>
        }>
        {formError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {formError}</div>}
        <div className="form-grid-2">
          {fields.map((field, idx) => {
            if (field.section) return (
              <div key={`s-${idx}`} style={{ gridColumn: '1 / -1' }}>
                <div className="form-section-title">{field.section}</div>
              </div>
            )
            return renderField(field)
          })}
        </div>
      </Modal>

      <Modal isOpen={deleteId !== null} onClose={() => setDeleteId(null)} title="Confirmar eliminación"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteId(null)} disabled={deleting}>Cancelar</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? '⏳ Eliminando…' : 'Sí, eliminar'}
            </button>
          </>
        }>
        <p style={{ color: 'var(--text-soft)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          ¿Estás seguro de que deseas eliminar este registro? Esta acción <strong>no se puede deshacer</strong>.
        </p>
      </Modal>
    </div>
  )
}
