'use client'
import { useRead } from '../../hooks/useCrud'
import CrudPage from '../../components/CrudPage'

export default function Ventas() {
  const { data: clientes } = useRead('cliente', 'idcliente, nombre', 'nombre')

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
    <CrudPage
      title="Ventas" subtitle="Registro de ventas de café a clientes" icon="💰"
      table="venta" idField="idventa"
      selectQuery="*, cliente(nombre)"
      orderBy="fecha_venta"
      columns={[
        { key: 'idventa',    label: '#' },
        { key: 'fecha_venta',label: 'Fecha',     render: v => v ? new Date(v).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' }) : '—' },
        { key: 'idcliente',  label: 'Cliente',   render: (_, r) => r.cliente?.nombre || '—' },
        { key: 'total_kg',   label: 'Kg',        render: v => v ? <strong>{Number(v).toLocaleString('es-CO')} kg</strong> : '—' },
        { key: 'precio_kg',  label: 'Precio/kg', render: v => v ? `$${Number(v).toLocaleString('es-CO')}` : '—' },
        { key: 'notas',      label: 'Notas',     render: v => v ? <span style={{color:'var(--text-dim)',fontSize:'0.8rem'}}>{String(v).slice(0,40)}{String(v).length>40?'…':''}</span> : '—' },
      ]}
      fields={fields}
    />
  )
}
