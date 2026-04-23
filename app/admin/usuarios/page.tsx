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
  const [filtroRol, setFiltroRol] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [regDesde, setRegDesde] = useState('')
  const [regHasta, setRegHasta] = useState('')
  const [filtroOpen, setFiltroOpen] = useState(false)
  const [editUser, setEditUser] = useState<Usuario | null>(null)
  const [editForm, setEditForm] = useState({ idrol: '', estado_aprobacion: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtroCount = [filtroRol, filtroEstado, regDesde||regHasta].filter(Boolean).length

  const filtered = usuarios.filter(u => {
    if (search && !u.nombre.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false
    if (filtroRol && u.rol?.nombre !== filtroRol) return false
    if (filtroEstado && u.estado_aprobacion !== filtroEstado) return false
    if (regDesde && (!u.created_at || new Date(u.created_at) < new Date(regDesde))) return false
    if (regHasta && (!u.created_at || new Date(u.created_at) > new Date(regHasta + 'T23:59:59'))) return false
    return true
  })

  const clearFiltros = () => { setSearch(''); setFiltroRol(''); setFiltroEstado(''); setRegDesde(''); setRegHasta('') }

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
        <button onClick={() => setFiltroOpen(v => !v)}
          style={{ display:'inline-flex', alignItems:'center', gap:'0.4rem', height:38, padding:'0 1rem', borderRadius:'var(--r-md)', border: filtroOpen||filtroCount>0 ? '1px solid var(--primary)' : '1px solid var(--border)', background: filtroOpen||filtroCount>0 ? 'rgba(196,122,44,0.12)' : 'var(--bg-input)', color: filtroOpen||filtroCount>0 ? 'var(--primary)' : 'var(--text-soft)', fontSize:'0.84rem', fontFamily:'var(--font-body)', cursor:'pointer', fontWeight:600 }}>
          🎯 Filtros
          {filtroCount>0 && <span style={{ minWidth:20, height:20, borderRadius:99, background:'var(--primary)', color:'#fff', fontSize:'0.65rem', fontWeight:700, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>{filtroCount}</span>}
          <span style={{ opacity:0.5, fontSize:'0.7rem' }}>{filtroOpen?'▲':'▼'}</span>
        </button>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap', marginBottom:'0.75rem' }}>
        <div style={{ position:'relative', flex:1, minWidth:180, maxWidth:360 }}>
          <span style={{ position:'absolute', left:'0.7rem', top:'50%', transform:'translateY(-50%)', opacity:0.4, pointerEvents:'none' }}>🔍</span>
          <input type="text" placeholder="Buscar por nombre o email…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width:'100%', height:36, background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', padding:'0 0.9rem 0 2.1rem', color:'var(--text)', fontSize:'0.84rem', fontFamily:'var(--font-body)', outline:'none' }} />
        </div>
        {(search||filtroCount>0) && <button onClick={clearFiltros} style={{ height:36, padding:'0 0.8rem', background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--r-md)', color:'var(--text-muted)', fontSize:'0.8rem', fontFamily:'var(--font-body)', cursor:'pointer' }}>✕ Limpiar</button>}
        <span style={{ fontSize:'0.78rem', color:'var(--text-dim)', fontWeight:500, marginLeft:'auto' }}>{filtered.length} usuario{filtered.length!==1?'s':''}</span>
      </div>

      {filtroOpen && (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'1rem 1.25rem', marginBottom:'1rem' }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'1rem', alignItems:'flex-end' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem', minWidth:160 }}>
              <label style={{ fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)' }}>Rol</label>
              <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)}
                style={{ height:38, minWidth:160, background:filtroRol?'rgba(196,122,44,0.08)':'var(--bg-input)', border:filtroRol?'1px solid var(--primary)':'1px solid var(--border)', borderRadius:'var(--r-md)', color:'var(--text)', fontSize:'0.84rem', fontFamily:'var(--font-body)', padding:'0 0.6rem', outline:'none', cursor:'pointer' }}>
                <option value="">— Todos —</option>
                {roles.map(r => <option key={r.idrol} value={r.nombre}>{r.nombre}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem', minWidth:160 }}>
              <label style={{ fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)' }}>Estado</label>
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
                style={{ height:38, minWidth:160, background:filtroEstado?'rgba(196,122,44,0.08)':'var(--bg-input)', border:filtroEstado?'1px solid var(--primary)':'1px solid var(--border)', borderRadius:'var(--r-md)', color:'var(--text)', fontSize:'0.84rem', fontFamily:'var(--font-body)', padding:'0 0.6rem', outline:'none', cursor:'pointer' }}>
                <option value="">— Todos —</option>
                <option value="aprobado">✅ Aprobado</option>
                <option value="pendiente">⏳ Pendiente</option>
                <option value="rechazado">❌ Rechazado</option>
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
              <label style={{ fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)' }}>📅 Fecha registro</label>
              <div style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
                <input type="date" value={regDesde} onChange={e => setRegDesde(e.target.value)} style={{ height:38, width:140, background:(regDesde||regHasta)?'rgba(196,122,44,0.08)':'var(--bg-input)', border:(regDesde||regHasta)?'1px solid var(--primary)':'1px solid var(--border)', borderRadius:'var(--r-md)', color:'var(--text)', fontSize:'0.84rem', fontFamily:'var(--font-body)', padding:'0 0.5rem', outline:'none' }} />
                <span style={{ color:'var(--text-muted)' }}>–</span>
                <input type="date" value={regHasta} onChange={e => setRegHasta(e.target.value)} style={{ height:38, width:140, background:(regDesde||regHasta)?'rgba(196,122,44,0.08)':'var(--bg-input)', border:(regDesde||regHasta)?'1px solid var(--primary)':'1px solid var(--border)', borderRadius:'var(--r-md)', color:'var(--text)', fontSize:'0.84rem', fontFamily:'var(--font-body)', padding:'0 0.5rem', outline:'none' }} />
              </div>
            </div>
          </div>
        </div>
      )}

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
