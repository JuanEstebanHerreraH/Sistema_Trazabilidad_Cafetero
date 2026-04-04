'use client'
import { useState, useMemo, ReactNode } from 'react'
import { useCrud } from '../hooks/useCrud'
import Modal from './Modal'

interface Column {
  key: string
  label: string
  render?: (value: any, row: any) => ReactNode
}

interface Field {
  key: string
  label: string
  type?: string
  required?: boolean
  placeholder?: string
  description?: string   // ← texto de ayuda debajo del campo
  options?: { value: any; label: string }[]
  default?: any
  step?: string
  min?: string
  max?: string
  colSpan?: 'full' | 'half'  // ← control de columnas en formulario
  section?: string           // ← título de sección (separador visual)
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
}

export default function CrudPage({
  title, subtitle, icon,
  table, idField, selectQuery = '*', orderBy,
  columns, fields, searchKey,
}: CrudPageProps) {
  const { data, loading, error, insert, update, remove } = useCrud(table, idField, selectQuery, orderBy)

  const [search, setSearch]         = useState('')
  const [modalOpen, setModalOpen]   = useState(false)
  const [editRecord, setEditRecord] = useState<any>(null)
  const [form, setForm]             = useState<Record<string, any>>({})
  const [saving, setSaving]         = useState(false)
  const [formError, setFormError]   = useState<string | null>(null)
  const [deleteId, setDeleteId]     = useState<any>(null)
  const [deleting, setDeleting]     = useState(false)

  const filtered = useMemo(() => {
    if (!search || !searchKey) return data
    const q = search.toLowerCase()
    return data.filter(row => String(row[searchKey] ?? '').toLowerCase().includes(q))
  }, [data, search, searchKey])

  const openCreate = () => {
    const defaults: Record<string, any> = {}
    fields.forEach(f => { defaults[f.key] = f.default ?? '' })
    setForm(defaults)
    setEditRecord(null)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (record: any) => {
    const copy: Record<string, any> = {}
    fields.forEach(f => { copy[f.key] = record[f.key] ?? '' })
    setForm(copy)
    setEditRecord(record)
    setFormError(null)
    setModalOpen(true)
  }

  const handleChange = (key: string, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async () => {
    setSaving(true)
    setFormError(null)
    try {
      const payload: Record<string, any> = {}
      fields.forEach(f => {
        const val = form[f.key]
        if (val === '' && !f.required) payload[f.key] = null
        else if (f.type === 'number') payload[f.key] = val === '' ? null : Number(val)
        else payload[f.key] = val
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

  // Agrupa campos para el layout del formulario
  const renderField = (field: Field) => (
    <div className="form-group" key={field.key} style={field.colSpan === 'full' ? { gridColumn: '1 / -1' } : {}}>
      <label className="form-label">
        {field.label}
        {field.required && <span className="form-required">*</span>}
      </label>

      {field.type === 'select' ? (
        <select className="form-select" value={form[field.key] ?? ''} onChange={e => handleChange(field.key, e.target.value)}>
          <option value="">— Selecciona —</option>
          {(field.options ?? []).map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea
          className="form-textarea"
          value={form[field.key] ?? ''}
          onChange={e => handleChange(field.key, e.target.value)}
          placeholder={field.placeholder ?? ''}
          required={field.required}
        />
      ) : (
        <input
          className="form-input"
          type={field.type ?? 'text'}
          value={form[field.key] ?? ''}
          onChange={e => handleChange(field.key, e.target.value)}
          placeholder={field.placeholder ?? ''}
          required={field.required}
          step={field.type === 'number' ? (field.step ?? 'any') : undefined}
          min={field.min}
          max={field.max}
        />
      )}

      {field.description && <p className="form-hint">💡 {field.description}</p>}
    </div>
  )

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

      {/* Toolbar */}
      <div className="toolbar">
        {searchKey && (
          <div className="toolbar-search">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder={`Buscar…`} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        )}
        <span className="toolbar-count">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{icon}</div>
          <p>No hay registros{search ? ' que coincidan' : ''}.</p>
          {!search && <small>Haz clic en "+ Nuevo" para agregar el primero.</small>}
        </div>
      ) : (
        <div className="data-table-wrap">
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
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? <span style={{ color: 'var(--text-muted)' }}>—</span>)}
                    </td>
                  ))}
                  <td>
                    <div className="actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(row)}>✏ Editar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(row[idField])}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Crear/Editar */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editRecord ? `Editar ${title}` : `Nuevo registro — ${title}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Guardando…' : editRecord ? 'Guardar cambios' : 'Crear registro'}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {formError}</div>}

        <div className="form-grid-2">
          {fields.map(field => {
            if (field.section) {
              return (
                <div key={`section-${field.section}`} style={{ gridColumn: '1 / -1' }}>
                  <div className="form-section-title">{field.section}</div>
                </div>
              )
            }
            return renderField(field)
          })}
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
          ¿Estás seguro de que deseas eliminar este registro?
        </p>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.4rem' }}>
          Esta acción es irreversible y no se puede deshacer.
        </p>
      </Modal>
    </div>
  )
}
