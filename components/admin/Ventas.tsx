'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../utils/supabase/client'
import { useRead } from '../../hooks/useCrud'
import CrudPage from '../../components/CrudPage'
import Modal from '../Modal'

interface DetalleVenta {
  iddetalle_venta: number
  cantidad: number
  precio_venta: number
  lote_cafe: { idlote_cafe: number; variedad: string; finca: { nombre: string } | null } | null
}

interface VentaDetalle {
  idventa: number
  fecha_venta: string
  total_kg: number | null
  precio_kg: number | null
  notas: string | null
  cliente: { nombre: string } | null
  detalle_venta: DetalleVenta[]
}

export default function Ventas() {
  const supabase = createClient()
  const { data: clientes } = useRead('cliente', 'idcliente, nombre', 'nombre')

  // Modal detalle
  const [detalleVenta, setDetalleVenta] = useState<VentaDetalle | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)

  const verDetalle = async (idventa: number) => {
    setLoadingDetalle(true)
    setDetalleVenta(null)
    const { data } = await supabase
      .from('venta')
      .select(`
        idventa, fecha_venta, total_kg, precio_kg, notas,
        cliente(nombre),
        detalle_venta(iddetalle_venta, cantidad, precio_venta,
          lote_cafe(idlote_cafe, variedad, finca(nombre)))
      `)
      .eq('idventa', idventa)
      .single()
    setDetalleVenta(data as any)
    setLoadingDetalle(false)
  }

  const fields = [
    {
      key: 'fecha_venta', label: 'Fecha de venta', type: 'datetime-local', required: true,
      description: 'Fecha y hora exacta en que se realizó o acordó la venta.',
    },
    {
      key: 'idcliente', label: 'Cliente comprador', type: 'select', required: true,
      options: clientes.map(c => ({ value: c.idcliente, label: c.nombre })),
      description: 'Empresa o persona que compra el café. Gestiona clientes en la sección Clientes.',
    },
    { section: 'Detalles económicos' } as any,
    {
      key: 'total_kg', label: 'Total vendido (kg)', type: 'number', required: false,
      step: '0.01', min: '0', placeholder: 'Ej: 500.00',
      description: 'Kilogramos totales de café incluidos en esta venta.',
    },
    {
      key: 'precio_kg', label: 'Precio por kg (COP)', type: 'number', required: false,
      step: '1', min: '0', placeholder: 'Ej: 18500',
      description: 'Precio pactado por kilogramo en pesos colombianos.',
    },
    { section: 'Información adicional' } as any,
    {
      key: 'notas', label: 'Notas', type: 'textarea', required: false, colSpan: 'full',
      placeholder: 'Condiciones de pago, instrucciones de entrega, observaciones…',
      description: 'Campo libre para observaciones, términos acordados o referencias.',
    },
  ]

  return (
    <>
      <CrudPage
        title="Ventas" subtitle="Registro de ventas de café a clientes" icon="💰"
        table="venta" idField="idventa"
        selectQuery="*, cliente(nombre)"
        orderBy="fecha_venta"
        columns={[
          { key: 'idventa',    label: '#' },
          { key: 'fecha_venta',label: 'Fecha', render: v => v ? new Date(v).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' }) : '—' },
          { key: 'idcliente',  label: 'Cliente', render: (_, r) => r.cliente?.nombre || '—' },
          { key: 'total_kg',   label: 'Kg', render: v => v ? <strong>{Number(v).toLocaleString('es-CO')} kg</strong> : '—' },
          { key: 'precio_kg',  label: 'Precio/kg', render: v => v ? `$${Number(v).toLocaleString('es-CO')}` : '—' },
          {
            key: 'total_cop', label: 'Total $',
            render: (_, r) => {
              const total = (r.total_kg ?? 0) * (r.precio_kg ?? 0)
              return total > 0
                ? <strong style={{ color: 'var(--green)' }}>${total.toLocaleString('es-CO')}</strong>
                : '—'
            }
          },
          {
            key: 'detalle', label: 'Detalle',
            render: (_, r) => (
              <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); verDetalle(r.idventa) }}>
                👁 Ver
              </button>
            ),
          },
          { key: 'notas', label: 'Notas', render: v => v ? <span style={{color:'var(--text-dim)',fontSize:'0.8rem'}}>{String(v).slice(0,30)}{String(v).length>30?'…':''}</span> : '—' },
        ]}
        fields={fields}
      />

      {/* Modal de Detalle de Venta */}
      <Modal
        isOpen={!!detalleVenta || loadingDetalle}
        onClose={() => { setDetalleVenta(null); setLoadingDetalle(false) }}
        title={`Detalle — Venta #${detalleVenta?.idventa ?? ''}`}
        footer={<button className="btn btn-secondary" onClick={() => setDetalleVenta(null)}>Cerrar</button>}
      >
        {loadingDetalle ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>Cargando detalles…</div>
        ) : detalleVenta ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Info de la venta */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <InfoBlock label="Cliente" value={detalleVenta.cliente?.nombre ?? '—'} />
              <InfoBlock label="Fecha" value={new Date(detalleVenta.fecha_venta).toLocaleDateString('es-CO', { dateStyle: 'long' })} />
              <InfoBlock label="Total kg" value={`${detalleVenta.total_kg ?? 0} kg`} />
              <InfoBlock label="Precio/kg" value={`$${(detalleVenta.precio_kg ?? 0).toLocaleString('es-CO')}`} />
            </div>

            {/* Total */}
            <div style={{ background: 'var(--green-bg)', borderRadius: 'var(--r-md)', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: 'var(--green)', fontSize: '0.88rem' }}>Total de la venta:</span>
              <span style={{ fontWeight: 700, color: 'var(--green)', fontSize: '1.2rem' }}>
                ${((detalleVenta.total_kg ?? 0) * (detalleVenta.precio_kg ?? 0)).toLocaleString('es-CO')} COP
              </span>
            </div>

            {/* Items */}
            {detalleVenta.detalle_venta && detalleVenta.detalle_venta.length > 0 ? (
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-soft)', marginBottom: '0.5rem' }}>
                  📦 Lotes vendidos ({detalleVenta.detalle_venta.length} ítem{detalleVenta.detalle_venta.length > 1 ? 's' : ''}):
                </div>
                {detalleVenta.detalle_venta.map(d => (
                  <div key={d.iddetalle_venta} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--bg)', borderRadius: 'var(--r-md)', padding: '0.6rem 0.8rem', marginBottom: '0.4rem',
                  }}>
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>☕ {d.lote_cafe?.variedad ?? '—'}</span>
                      {d.lote_cafe?.finca && <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>· {d.lote_cafe.finca.nombre}</span>}
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>Lote #{d.lote_cafe?.idlote_cafe}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{d.cantidad} kg</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        ${(d.cantidad * d.precio_venta).toLocaleString('es-CO')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-dim)', background: 'var(--bg)', borderRadius: 'var(--r-md)' }}>
                📝 Venta creada manualmente (sin ítems de detalle).
                <br /><span style={{ fontSize: '0.76rem' }}>Las compras del portal generan detalles automáticamente.</span>
              </div>
            )}

            {/* Notas */}
            {detalleVenta.notas && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-soft)', borderTop: '1px solid var(--border-soft)', paddingTop: '0.6rem' }}>
                📝 {detalleVenta.notas}
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 'var(--r)', padding: '0.45rem 0.65rem' }}>
      <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '0.88rem', color: 'var(--text-soft)', fontWeight: 600, marginTop: '0.1rem' }}>{value}</div>
    </div>
  )
}
