'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../utils/supabase/client'
import Modal from '../../../components/Modal'

interface Rol { idrol: number; nombre: string }
interface Usuario {
  idusuario: number
  nombre: string
  email: string
  telefono: string | null
  estado_aprobacion: string
  created_at: string
  rol: { nombre: string } | null
}

const estadoBadge: Record<string, string> = {
  aprobado: 'badge-green',
  pendiente: 'badge-amber',
  rechazado: 'badge-red',
}

export default function UsuariosPage() {
  const supabase = createClient()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editUser, setEditUser] = useState<Usuario | null>(null)
  const [editForm, setEditForm] = useState({ idrol: '', estado_aprobacion: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const cargar = async () => {
    setLoading(true)
    const [{ data: u }, { data: r }] = await Promise.all([
      supabase.from('usuario')
        .select('idusuario, nombre, email, telefono, estado_aprobacion, created_at, rol:idrol(nombre)')
        .order('created_at', { ascending: false }),
      supabase.from('rol').select('idrol, nombre').order('nombre'),
    ])
    setUsuarios((u ?? []) as any)
    setRoles((r ?? []) as any)
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  const filtered = search
    ? usuarios.filter(u => u.nombre.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
    : usuarios

  const openEdit = (u: Usuario) => {
    const rolId = roles.find(r => r.nombre === u.rol?.nombre)?.idrol ?? ''
    setEditForm({ idrol: String(rolId), estado_aprobacion: u.estado_aprobacion })
    setSaveError(null)
    setEditUser(u)
  }

  const handleSave = async () => {
    if (!editUser) return
    setSaving(true); setSaveError(null)
    try {
      const { error } = await supabase.from('usuario').update({
        idrol: editForm.idrol ? Number(editForm.idrol) : null,
        estado_aprobacion: editForm.estado_aprobacion,
      }).eq('idusuario', editUser.idusuario)
      if (error) throw new Error(error.message)
      setEditUser(null)
      await cargar()
    } catch (e: any) { setSaveError(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('usuario').delete().eq('idusuario', deleteId)
      if (error) throw new Error(error.message)
      setDeleteId(null)
      await cargar()
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setDeleting(false) }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-icon">👥</div>
          <div>
            <h2>Usuarios</h2>
            <p className="page-subtitle">Gestión de cuentas y roles del sistema</p>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-search">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Buscar por nombre o email…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="toolbar-count">{filtered.length} usuario{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : (
        <div className="data-table-wrap table-responsive">
          <table className="data-table">
            <thead>
              <tr><th>ID</th><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Registro</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.idusuario}>
                  <td>{u.idusuario}</td>
                  <td><strong style={{ color: 'var(--text)' }}>{u.nombre}</strong></td>
                  <td style={{ fontSize: '0.8rem' }}>{u.email}</td>
                  <td>
                    {u.rol?.nombre
                      ? <span className="badge badge-teal">{u.rol.nombre}</span>
                      : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Sin rol</span>}
                  </td>
                  <td><span className={`badge ${estadoBadge[u.estado_aprobacion] ?? 'badge-muted'}`}>{u.estado_aprobacion}</span></td>
                  <td style={{ fontSize: '0.78rem' }}>{new Date(u.created_at).toLocaleDateString('es-CO')}</td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>✏ Editar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(u.idusuario)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal editar usuario */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title={`Editar usuario — ${editUser?.nombre}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEditUser(null)} disabled={saving}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '⏳ Guardando…' : 'Guardar cambios'}
            </button>
          </>
        }>
        {saveError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {saveError}</div>}
        <div className="form-grid-2">
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Rol</label>
            <select className="form-select" value={editForm.idrol} onChange={e => setEditForm(p => ({ ...p, idrol: e.target.value }))}>
              <option value="">— Sin rol —</option>
              {roles.map(r => <option key={r.idrol} value={r.idrol}>{r.nombre}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Estado de aprobación</label>
            <select className="form-select" value={editForm.estado_aprobacion} onChange={e => setEditForm(p => ({ ...p, estado_aprobacion: e.target.value }))}>
              <option value="pendiente">Pendiente</option>
              <option value="aprobado">Aprobado</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </div>
        </div>
        <div className="alert alert-warn" style={{ marginTop: '0.85rem', fontSize: '0.78rem' }}>
          ⚠ Cambiar el rol aquí controla qué sección verá el usuario al iniciar sesión.
        </div>
      </Modal>

      {/* Modal eliminar */}
      <Modal isOpen={deleteId !== null} onClose={() => setDeleteId(null)} title="Eliminar usuario"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteId(null)} disabled={deleting}>Cancelar</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? '⏳ Eliminando…' : 'Sí, eliminar'}
            </button>
          </>
        }>
        <p style={{ color: 'var(--text-soft)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          ¿Eliminar el usuario <strong>#{deleteId}</strong>? Esta acción no se puede deshacer.
        </p>
      </Modal>
    </div>
  )
}
