'use client'
import { useState, useMemo, ReactNode } from 'react'
import { useCrud } from '../hooks/useCrud'
import Modal from './Modal'

export interface Column {
  key: string
  label: string
  render?: (value: any, row: any) => ReactNode
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

export interface FilterKey {
  key: string
  label: string
  options: { value: string; label: string }[]
  resolve?: (row: any) => string
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
  extraActions?: (row: any) => ReactNode
  filterKeys?: FilterKey[]
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function Pagination({
  total, page, pageSize, onPage, onPageSize,
}: {
  total: number; page: number; pageSize: number
  onPage: (p: number) => void; onPageSize: (n: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = Math.min(total, (page - 1) * pageSize + 1)
  const end = Math.min(total, page * pageSize)

  const pages: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
  }

  return (
    <div className="pagination-bar">
      <div className="per-page-wrap">
        <span>Mostrar</span>
        <select className="per-page-select" value={pageSize}
          onChange={e => { onPageSize(Number(e.target.value)); onPage(1) }}>
          {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span>por página</span>
      </div>
      <div className="pagination-info">
        {total === 0 ? 'Sin resultados' : `${start}–${end} de ${total}`}
      </div>
      <div className="pagination-controls">
        <button className="page-btn page-btn-wide" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Ant</button>
        {pages.map((p, i) =>
          p === '…'
            ? <span key={`e${i}`} className="page-ellipsis">…</span>
            : <button key={p} className={`page-btn${page === p ? ' active' : ''}`} onClick={() => onPage(p as number)}>{p}</button>
        )}
        <button className="page-btn page-btn-wide" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Sig →</button>
      </div>
    </div>
  )
}

export default function CrudPage({
  title, subtitle, icon, table, idField,
  selectQuery = '*', orderBy, columns, fields,
  searchKey, extraActions, filterKeys = [],
}: CrudPageProps) {
  const { data, loading, error, insert, update, remove } = useCrud(table, idField, selectQuery, orderBy)

  const [search, setSearch] = useState('')
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({})
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

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

  const activeFilterCount = useMemo(() =>
    Object.values(activeFilters).filter(v => v !== '').length, [activeFilters])

  const filtered = useMemo(() => {
    let rows = data
    if (search && searchKey) {
      const q = search.toLowerCase()
      rows = rows.filter(row => String(row[searchKey] ?? '').toLowerCase().includes(q))
    }
    for (const fk of filterKeys) {
      const val = activeFilters[fk.key]
      if (!val) continue
      rows = rows.filter(row => {
        const rowVal = fk.resolve ? fk.resolve(row) : String(row[fk.key] ?? '')
        return rowVal === val
      })
    }
    return rows
  }, [data, search, searchKey, activeFilters, filterKeys])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  const clearFilters = () => { setSearch(''); setActiveFilters({}); setPage(1) }

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
        if (val === '' || val === null || val === undefined) {
          payload[f.key!] = f.required ? val : null
        } else if (f.type === 'number') {
          payload[f.key!] = Number(val)
        } else {
          payload[f.key!] = val
        }
      })
      if (editRecord) await update(editRecord[idField], payload)
      else await insert(payload)
      setModalOpen(false)
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await remove(deleteId); setDeleteId(null)
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message)
    } finally {
      setDeleting(false)
    }
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

      <div className="toolbar-v2">
        {searchKey && (
          <div className="toolbar-search" style={{ flex: 1, minWidth: 200 }}>
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Buscar…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
        )}
        {filterKeys.length > 0 && (
          <button className="btn btn-secondary btn-sm"
            onClick={() => setShowFilters(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            ⚙ Filtros
            {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
          </button>
        )}
        {(activeFilterCount > 0 || search) && (
          <button className="filter-clear" onClick={clearFilters}>✕ Limpiar</button>
        )}
        <span className="toolbar-count">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {showFilters && filterKeys.length > 0 && (
        <div className="filter-bar">
          {filterKeys.map(fk => (
            <div className="filter-row" key={fk.key}>
              <span className="filter-label">{fk.label}</span>
              <div className="filter-chips">
                <button
                  className={`filter-chip${!activeFilters[fk.key] ? ' active' : ''}`}
                  onClick={() => { setActiveFilters(p => ({ ...p, [fk.key]: '' })); setPage(1) }}>
                  Todos
                </button>
                {fk.options.map(opt => (
                  <button key={opt.value}
                    className={`filter-chip${activeFilters[fk.key] === opt.value ? ' active' : ''}`}
                    onClick={() => { setActiveFilters(p => ({ ...p, [fk.key]: opt.value })); setPage(1) }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{icon}</div>
          <p>No hay registros{search || activeFilterCount > 0 ? ' que coincidan con los filtros' : ''}.</p>
          {!search && activeFilterCount === 0 && <small>Haz clic en &quot;+ Nuevo&quot; para agregar el primero.</small>}
          {(search || activeFilterCount > 0) && (
            <button className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem' }} onClick={clearFilters}>
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="data-table-wrap table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map(col => <th key={col.key}>{col.label}</th>)}
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(row => (
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
          <Pagination total={filtered.length} page={page} pageSize={pageSize}
            onPage={setPage} onPageSize={n => { setPageSize(n); setPage(1) }} />
        </>
      )}

      <Modal isOpen={viewModal} onClose={() => setViewModal(false)}
        title={`Detalle — ${title}`}
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

      <Modal isOpen={deleteId !== null} onClose={() => setDeleteId(null)}
        title="Confirmar eliminación"
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
