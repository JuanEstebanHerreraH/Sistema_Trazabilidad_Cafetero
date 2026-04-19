'use client'
import { useState } from 'react'
import CrudPage from '../../../components/CrudPage'
import Modal from '../../../components/Modal'
import { createClient } from '../../../utils/supabase/client'

interface Proceso { nombre: string }
interface RegProceso { proceso: Proceso | null; fecha_inicio: string; fecha_fin: string; notas: string | null }
interface Movimiento { tipo: string; fecha_movimiento: string; cantidad: number; almacen_origen: {nombre:string}|null; almacen_destino: {nombre:string}|null; notas: string|null }
interface Venta { idventa: number; fecha_venta: string; cliente: {nombre:string}|null; detalle_venta: {cantidad:number;precio_venta:number}[] }
interface LoteTrace {
  idlote_cafe: number; variedad: string; fecha_cosecha: string; peso_kg: number; estado: string; precio_kg: number
  finca: { nombre: string; ubicacion: string|null; productor: { nombre: string; region: string|null } | null } | null
  registro_proceso: RegProceso[]
  movimiento_inventario: Movimiento[]
}

function estadoBadge(e: string) {
  const m: Record<string, string> = { disponible: 'badge-green', en_proceso: 'badge-amber', vendido: 'badge-muted', exportado: 'badge-blue' }
  return m[e] ?? 'badge-muted'
}

export default function LotesPage() {
  const [traceModal, setTraceModal] = useState(false)
  const [traceData, setTraceData] = useState<LoteTrace | null>(null)
  const [traceVentas, setTraceVentas] = useState<Venta[]>([])
  const [traceLoading, setTraceLoading] = useState(false)

  const supabase = createClient()

  const verTrazabilidad = async (row: any) => {
    setTraceLoading(true)
    setTraceModal(true)
    setTraceData(null)

    const [{ data: lote }, { data: ventas }] = await Promise.all([
      supabase.from('lote_cafe').select(`
        idlote_cafe, variedad, fecha_cosecha, peso_kg, estado, precio_kg,
        finca(nombre, ubicacion, productor(nombre, region)),
        registro_proceso(proceso(nombre), fecha_inicio, fecha_fin, notas),
        movimiento_inventario(tipo, fecha_movimiento, cantidad, almacen_origen:idalmacen_origen(nombre), almacen_destino:idalmacen_destino(nombre), notas)
      `).eq('idlote_cafe', row.idlote_cafe).single(),
      supabase.from('venta').select(`
        idventa, fecha_venta, cliente(nombre, email, telefono),
        detalle_venta!inner(cantidad, precio_venta)
      `).eq('detalle_venta.idlote_cafe', row.idlote_cafe),
    ])

    setTraceData(lote as any)
    setTraceVentas((ventas ?? []) as any)
    setTraceLoading(false)
  }

  return (
    <>
      <CrudPage
        title="Lotes de Café" subtitle="Gestión y trazabilidad completa de lotes" icon="☕"
        table="lote_cafe" idField="idlote_cafe"
        selectQuery="idlote_cafe, variedad, fecha_cosecha, peso_kg, estado, precio_kg, finca:idfinca(nombre)"
        orderBy="created_at"
        searchKey="variedad"
        columns={[
          { key: 'idlote_cafe', label: 'ID' },
          { key: 'variedad', label: 'Variedad', render: (v) => <strong style={{ color: 'var(--text)' }}>{v}</strong> },
          { key: 'finca', label: 'Finca', render: (v) => v?.nombre ?? '—' },
          { key: 'fecha_cosecha', label: 'Cosecha', render: (v) => v ? new Date(v).toLocaleDateString('es-CO') : '—' },
          { key: 'peso_kg', label: 'Peso (kg)', render: (v) => <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{v} kg</span> },
          { key: 'precio_kg', label: 'Precio/kg', render: (v) => `$${Number(v ?? 0).toLocaleString('es-CO')}` },
          { key: 'estado', label: 'Estado', render: (v) => <span className={`badge ${estadoBadge(v)}`}>{v}</span> },
        ]}
        fields={[
          { key: 'variedad',     label: 'Variedad',      required: true, placeholder: 'Caturra, Geisha, Colombia…' },
          { key: 'fecha_cosecha',label: 'Fecha cosecha', type: 'date',   required: true },
          { key: 'peso_kg',      label: 'Peso (kg)',     type: 'number', required: true, placeholder: '500' },
          { key: 'precio_kg',    label: 'Precio / kg',   type: 'number', required: true, placeholder: '18500',
            description: 'Precio en COP que verán los clientes en el portal' },
          { key: 'estado',       label: 'Estado',        type: 'select', required: true, default: 'disponible',
            options: [
              { value: 'disponible', label: 'Disponible' },
              { value: 'en_proceso', label: 'En proceso' },
              { value: 'vendido',    label: 'Vendido' },
              { value: 'exportado',  label: 'Exportado' },
            ]},
          { key: 'idfinca', label: 'ID Finca', type: 'number', placeholder: 'ID de la finca' },
        ]}
        extraActions={(row) => (
          <button className="btn btn-ghost btn-sm" onClick={() => verTrazabilidad(row)} title="Trazabilidad">
            🔍 Traza
          </button>
        )}
      />

      {/* Modal de Trazabilidad */}
      <Modal isOpen={traceModal} onClose={() => setTraceModal(false)}
        title="🔍 Trazabilidad del Lote" size="lg"
        footer={<button className="btn btn-secondary" onClick={() => setTraceModal(false)}>Cerrar</button>}>
        {traceLoading ? (
          <div className="loading-center"><div className="spinner" /><span>Cargando trazabilidad…</span></div>
        ) : traceData ? (
          <div>
            {/* Cabecera del lote */}
            <div style={{ background: 'var(--bg-1)', borderRadius: 'var(--r-lg)', padding: '1rem 1.1rem', marginBottom: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.2rem' }}>Variedad</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text)', fontWeight: 700 }}>{traceData.variedad}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.2rem' }}>Stock actual</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>{traceData.peso_kg} kg</div>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.2rem' }}>Estado</div>
                <span className={`badge ${estadoBadge(traceData.estado)}`}>{traceData.estado}</span>
              </div>
            </div>

            {/* Timeline */}
            <div className="trace-timeline">
              {/* Origen: finca */}
              <div className="trace-event">
                <div className="trace-dot-col">
                  <div className="trace-dot" style={{ background: 'var(--green-bg)', border: '2px solid var(--green)' }}>🌿</div>
                  <div className="trace-line" />
                </div>
                <div className="trace-content">
                  <div className="trace-title">Cosecha en finca</div>
                  <div className="trace-date">{new Date(traceData.fecha_cosecha).toLocaleDateString('es-CO', { dateStyle: 'long' })}</div>
                  {traceData.finca && (
                    <div className="trace-detail">
                      🏡 {traceData.finca.nombre}{traceData.finca.ubicacion ? ` · ${traceData.finca.ubicacion}` : ''}
                      {traceData.finca.productor && <><br />👨‍🌾 {traceData.finca.productor.nombre}{traceData.finca.productor.region ? ` · ${traceData.finca.productor.region}` : ''}</>}
                    </div>
                  )}
                </div>
              </div>

              {/* Registros de proceso */}
              {(traceData.registro_proceso ?? []).map((rp, i) => (
                <div key={i} className="trace-event">
                  <div className="trace-dot-col">
                    <div className="trace-dot" style={{ background: 'var(--amber-bg)', border: '2px solid var(--amber)' }}>⚙️</div>
                    {i < (traceData.registro_proceso?.length ?? 0) - 1 || (traceData.movimiento_inventario?.length ?? 0) > 0 || traceVentas.length > 0 ? <div className="trace-line" /> : null}
                  </div>
                  <div className="trace-content">
                    <div className="trace-title">Proceso: {rp.proceso?.nombre ?? '—'}</div>
                    <div className="trace-date">
                      {new Date(rp.fecha_inicio).toLocaleDateString('es-CO')} → {new Date(rp.fecha_fin).toLocaleDateString('es-CO')}
                    </div>
                    {rp.notas && <div className="trace-detail">📝 {rp.notas}</div>}
                  </div>
                </div>
              ))}

              {/* Movimientos de inventario */}
              {(traceData.movimiento_inventario ?? []).map((mv, i) => (
                <div key={i} className="trace-event">
                  <div className="trace-dot-col">
                    <div className="trace-dot" style={{ background: 'var(--blue-bg)', border: '2px solid var(--blue)' }}>🏭</div>
                    {i < (traceData.movimiento_inventario?.length ?? 0) - 1 || traceVentas.length > 0 ? <div className="trace-line" /> : null}
                  </div>
                  <div className="trace-content">
                    <div className="trace-title">Movimiento de inventario — {mv.tipo}</div>
                    <div className="trace-date">{new Date(mv.fecha_movimiento).toLocaleDateString('es-CO', { dateStyle: 'long' })}</div>
                    <div className="trace-detail">
                      {mv.cantidad} kg
                      {mv.almacen_origen && <> · Origen: {(mv.almacen_origen as any)?.nombre}</>}
                      {mv.almacen_destino && <> · Destino: {(mv.almacen_destino as any)?.nombre}</>}
                      {mv.notas && <><br />📝 {mv.notas}</>}
                    </div>
                  </div>
                </div>
              ))}

              {/* Ventas */}
              {traceVentas.map((v, i) => (
                <div key={i} className="trace-event">
                  <div className="trace-dot-col">
                    <div className="trace-dot" style={{ background: 'var(--primary-subtle)', border: '2px solid var(--primary)' }}>💰</div>
                  </div>
                  <div className="trace-content">
                    <div className="trace-title">Venta #{v.idventa}</div>
                    <div className="trace-date">{new Date(v.fecha_venta).toLocaleDateString('es-CO', { dateStyle: 'long' })}</div>
                    <div className="trace-detail">
                      🧾 <strong>Comprador:</strong> {(v as any).cliente?.nombre ?? 'Cliente desconocido'}
                      {(v as any).cliente?.email && <><br />📧 {(v as any).cliente.email}</>}
                      {(v as any).cliente?.telefono && <><br />📞 {(v as any).cliente.telefono}</>}
                      {(v.detalle_venta ?? []).map((d: any, di: number) => (
                        <span key={di}><br />· {d.cantidad} kg × ${Number(d.precio_venta).toLocaleString('es-CO')}/kg = <strong>${(d.cantidad * d.precio_venta).toLocaleString('es-CO')}</strong></span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {/* Vacío */}
              {(traceData.registro_proceso ?? []).length === 0 &&
               (traceData.movimiento_inventario ?? []).length === 0 &&
               traceVentas.length === 0 && (
                <div className="trace-event">
                  <div className="trace-dot-col">
                    <div className="trace-dot" style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-med)' }}>⏳</div>
                  </div>
                  <div className="trace-content">
                    <div className="trace-title" style={{ color: 'var(--text-dim)' }}>Sin movimientos adicionales registrados</div>
                    <div className="trace-date">El lote está en su estado inicial desde la cosecha</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
