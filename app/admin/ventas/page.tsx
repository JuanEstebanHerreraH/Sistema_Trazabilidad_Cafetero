'use client'
import { useState } from 'react'
import { useCrud } from '../../../hooks/useCrud'
import Modal from '../../../components/Modal'
import { createClient } from '../../../utils/supabase/client'

interface DetalleVenta {
  iddetalle_venta: number
  cantidad: number
  precio_venta: number
  lote_cafe: { variedad: string; finca: { nombre: string } | null } | null
}

interface Venta {
  idventa: number
  fecha_venta: string
  total_kg: number | null
  precio_kg: number | null
  notas: string | null
  cliente: { nombre: string; email: string | null } | null
  detalle_venta: DetalleVenta[]
}

export default function VentasPage() {
  const { data, loading, error, refetch } = useCrud(
    'venta', 'idventa',
    'idventa, fecha_venta, total_kg, precio_kg, notas, cliente:idcliente(nombre, email), detalle_venta(iddetalle_venta, cantidad, precio_venta, lote_cafe:idlote_cafe(variedad, finca:idfinca(nombre)))',
    'fecha_venta'
  )

  const [viewVenta, setViewVenta] = useState<Venta | null>(null)
  const [newModal, setNewModal] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ idcliente: '', notas: '', items: [{ idlote_cafe: '', cantidad: '', precio_venta: '' }] })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  const filtered = search
    ? data.filter((v: Venta) => v.cliente?.nombre?.toLowerCase().includes(search.toLowerCase()) || String(v.idventa).includes(search))
    : data

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { idlote_cafe: '', cantidad: '', precio_venta: '' }] }))
  const removeItem = (i: number) => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }))
  const updateItem = (i: number, key: string, val: string) =>
    setForm(p => ({ ...p, items: p.items.map((it, idx) => idx === i ? { ...it, [key]: val } : it) }))

  const handleCreate = async () => {
    setSaving(true); setFormError(null)
    try {
      if (!form.idcliente) throw new Error('Selecciona un cliente.')
      const validItems = form.items.filter(i => i.idlote_cafe && i.cantidad && i.precio_venta)
      if (validItems.length === 0) throw new Error('Agrega al menos un lote con cantidad y precio.')

      const totalKg = validItems.reduce((s, i) => s + Number(i.cantidad), 0)
      const { data: venta, error: vErr } = await supabase.from('venta').insert({
        idcliente: Number(form.idcliente),
        total_kg: totalKg,
        precio_kg: Number(validItems[0].precio_venta),
        notas: form.notas || null,
        fecha_venta: new Date().toISOString(),
      }).select('idventa').single()
      if (vErr) throw new Error(vErr.message)

      const { error: dErr } = await supabase.from('detalle_venta').insert(
        validItems.map(i => ({
          idventa: venta.idventa,
          idlote_cafe: Number(i.idlote_cafe),
          cantidad: Number(i.cantidad),
          precio_venta: Number(i.precio_venta),
        }))
      )
      if (dErr) throw new Error(dErr.message)

      setNewModal(false)
      setForm({ idcliente: '', notas: '', items: [{ idlote_cafe: '', cantidad: '', precio_venta: '' }] })
      await refetch()
    } catch (e: any) { setFormError(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await supabase.from('detalle_venta').delete().eq('idventa', deleteId)
      await supabase.from('venta').delete().eq('idventa', deleteId)
      setDeleteId(null)
      await refetch()
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setDeleting(false) }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-icon">💰</div>
          <div>
            <h2>Ventas</h2>
            <p className="page-subtitle">Historial completo de transacciones comerciales</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { setFormError(null); setNewModal(true) }}>+ Nueva venta</button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {error}</div>}

      <div className="toolbar">
        <div className="toolbar-search">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Buscar por cliente o ID…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="toolbar-count">{filtered.length} venta{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💰</div>
          <p>No hay ventas registradas.</p>
          <small>Haz clic en &quot;+ Nueva venta&quot; para agregar la primera.</small>
        </div>
      ) : (
        <div className="data-table-wrap table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th><th>Fecha</th><th>Cliente</th><th>Total kg</th><th>Precio/kg</th><th>Total COP</th><th>Items</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v: Venta) => (
                <tr key={v.idventa}>
                  <td><strong style={{ color: 'var(--text)' }}>#{v.idventa}</strong></td>
                  <td>{new Date(v.fecha_venta).toLocaleDateString('es-CO')}</td>
                  <td>{v.cliente?.nombre ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td><strong style={{ color: 'var(--primary)' }}>{v.total_kg ?? '—'} kg</strong></td>
                  <td>{v.precio_kg ? `$${Number(v.precio_kg).toLocaleString('es-CO')}` : '—'}</td>
                  <td>
                    {v.total_kg && v.precio_kg
                      ? <strong style={{ color: 'var(--green)' }}>${(v.total_kg * v.precio_kg).toLocaleString('es-CO')}</strong>
                      : '—'}
                  </td>
                  <td><span className="badge badge-blue">{v.detalle_venta?.length ?? 0} lotes</span></td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setViewVenta(v)} title="Ver detalle">👁 Ver</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(v.idventa)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal Ver detalle venta ── */}
      <Modal isOpen={!!viewVenta} onClose={() => setViewVenta(null)} title={`Venta #${viewVenta?.idventa}`} size="lg"
        footer={<button className="btn btn-secondary" onClick={() => setViewVenta(null)}>Cerrar</button>}>
        {viewVenta && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {[
                { label: 'Cliente', value: viewVenta.cliente?.nombre ?? '—' },
                { label: 'Fecha', value: new Date(viewVenta.fecha_venta).toLocaleDateString('es-CO', { dateStyle: 'long' }) },
                { label: 'Total kg', value: `${viewVenta.total_kg ?? 0} kg` },
                { label: 'Precio/kg', value: viewVenta.precio_kg ? `$${Number(viewVenta.precio_kg).toLocaleString('es-CO')}` : '—' },
                { label: 'Total COP', value: viewVenta.total_kg && viewVenta.precio_kg ? `$${(viewVenta.total_kg * viewVenta.precio_kg).toLocaleString('es-CO')}` : '—' },
                { label: 'Email cliente', value: viewVenta.cliente?.email ?? '—' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg-1)', borderRadius: 'var(--r-md)', padding: '0.6rem 0.8rem' }}>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.15rem' }}>{s.label}</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' }}>{s.value}</div>
                </div>
              ))}
            </div>

            {viewVenta.notas && (
              <div className="alert alert-info" style={{ marginBottom: '1rem', fontSize: '0.82rem' }}>📝 {viewVenta.notas}</div>
            )}

            <div style={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
              Detalle de lotes
            </div>
            {(viewVenta.detalle_venta ?? []).length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Sin detalles registrados.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {viewVenta.detalle_venta.map(d => (
                  <div key={d.iddetalle_venta} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-1)', borderRadius: 'var(--r-md)', padding: '0.65rem 0.9rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text)' }}>☕ {d.lote_cafe?.variedad ?? '—'}</div>
                      {d.lote_cafe?.finca && <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>🏡 {d.lote_cafe.finca.nombre}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{d.cantidad} kg</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>× ${Number(d.precio_venta).toLocaleString('es-CO')}</div>
                      <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: '0.84rem' }}>${(d.cantidad * d.precio_venta).toLocaleString('es-CO')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Modal Nueva venta ── */}
      <Modal isOpen={newModal} onClose={() => setNewModal(false)} title="Nueva Venta" size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setNewModal(false)} disabled={saving}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
              {saving ? '⏳ Guardando…' : 'Registrar venta'}
            </button>
          </>
        }>
        {formError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {formError}</div>}
        <div className="form-grid-2" style={{ marginBottom: '1rem' }}>
          <div className="form-group">
            <label className="form-label">ID Cliente <span className="form-required">*</span></label>
            <input className="form-input" type="number" value={form.idcliente}
              onChange={e => setForm(p => ({ ...p, idcliente: e.target.value }))} placeholder="ID del cliente" />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Notas</label>
            <textarea className="form-textarea" value={form.notas}
              onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} placeholder="Observaciones de la venta…" />
          </div>
        </div>

        <div style={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Lotes incluidos
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.75rem' }}>
          {form.items.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
              <div className="form-group">
                {i === 0 && <label className="form-label">ID Lote <span className="form-required">*</span></label>}
                <input className="form-input" type="number" value={item.idlote_cafe}
                  onChange={e => updateItem(i, 'idlote_cafe', e.target.value)} placeholder="ID del lote" />
              </div>
              <div className="form-group">
                {i === 0 && <label className="form-label">Cantidad (kg) <span className="form-required">*</span></label>}
                <input className="form-input" type="number" value={item.cantidad}
                  onChange={e => updateItem(i, 'cantidad', e.target.value)} placeholder="Kg" />
              </div>
              <div className="form-group">
                {i === 0 && <label className="form-label">Precio/kg <span className="form-required">*</span></label>}
                <input className="form-input" type="number" value={item.precio_venta}
                  onChange={e => updateItem(i, 'precio_venta', e.target.value)} placeholder="COP" />
              </div>
              <button className="btn btn-danger btn-sm" style={{ marginBottom: i === 0 ? '0' : undefined }}
                onClick={() => removeItem(i)} disabled={form.items.length === 1}>✕</button>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={addItem}>+ Agregar lote</button>
      </Modal>

      {/* ── Modal Eliminar ── */}
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
          Se eliminará la venta <strong>#{deleteId}</strong> y todos sus detalles. Esta acción no se puede deshacer.
        </p>
      </Modal>
    </div>
  )
}
