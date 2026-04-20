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
}

export default function CrudPage({
  title, subtitle, icon, table, idField,
  selectQuery = '*', orderBy, columns, fields,
  searchKey, extraActions,
}: CrudPageProps) {
  const { data, loading, error, insert, update, remove } = useCrud(table, idField, selectQuery, orderBy)

  const [search, setSearch] = useState('')
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

  const filtered = useMemo(() => {
    if (!search || !searchKey) return data
    const q = search.toLowerCase()
    return data.filter(row => String(row[searchKey] ?? '').toLowerCase().includes(q))
  }, [data, search, searchKey])

  const openCreate = () => {
    const defaults: Record<string, any> = {}
    dataFields.forEach(f => { defaults[f.key!] = f.default ?? '' })
    setForm(defaults)
    setEditRecord(null)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (record: any) => {
    const copy: Record<string, any> = {}
    dataFields.forEach(f => { copy[f.key!] = record[f.key!] ?? '' })
    setForm(copy)
    setEditRecord(record)
    setFormError(null)
    setModalOpen(true)
  }

  const openView = (record: any) => {
    setViewRecord(record)
    setViewModal(true)
  }

  const handleSubmit = async () => {
    setSaving(true)
    setFormError(null)
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
      await remove(deleteId)
      setDeleteId(null)
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

  // Helper to get a readable value from a nested object
  const getDisplayValue = (row: any, key: string) => {
    const col = columns.find(c => c.key === key)
    const raw = row[key]
    if (col?.render) {
      try { return col.render(raw, row) } catch { return String(raw ?? '—') }
    }
    if (raw === null || raw === undefined) return '—'
    if (typeof raw === 'object') return JSON.stringify(raw)
    return String(raw)
  }

  return (
    <div>
      {/* Header */}
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

      <div className="toolbar">
        {searchKey && (
          <div className="toolbar-search">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Buscar…" value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
        )}
        <span className="toolbar-count">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{icon}</div>
          <p>No hay registros{search ? ' que coincidan' : ''}.</p>
          {!search && <small>Haz clic en &quot;+ Nuevo&quot; para agregar el primero.</small>}
        </div>
      ) : (
        <div className="data-table-wrap table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map(col => <th key={col.key}>{col.label}</th>)}
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
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

      {/* ── Modal VER detalle ── */}
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
                gap: '1rem', padding: '0.5rem 0',
                borderBottom: '1px solid var(--border-soft)',
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

      {/* ── Modal CREAR / EDITAR ── */}
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

      {/* ── Modal ELIMINAR ── */}
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
