'use client'
import { useRead } from '../../hooks/useCrud'
import CrudPage from '../../components/CrudPage'

const ESTADOS = [
  { value: 'disponible',  label: '🟢 Disponible'   },
  { value: 'en_proceso',  label: '🟡 En proceso'   },
  { value: 'vendido',     label: '🔵 Vendido'       },
  { value: 'exportado',   label: '🟣 Exportado'     },
]

const estadoBadge: Record<string,string> = {
  disponible: 'badge-green',
  en_proceso: 'badge-amber',
  vendido:    'badge-blue',
  exportado:  'badge-purple',
}

export default function LotesCafe() {
  const { data: fincas } = useRead('finca', 'idfinca, nombre', 'nombre')

  const fields = [
    {
      key: 'variedad', label: 'Variedad', type: 'text', required: true, placeholder: 'Ej: Caturra, Castillo, Geisha, Bourbon',
      description: 'Especie o variedad botánica del café cosechado en este lote.',
    },
    {
      key: 'idfinca', label: 'Finca de origen', type: 'select', required: true,
      options: fincas.map(f => ({ value: f.idfinca, label: f.nombre })),
      description: 'Finca donde se cosechó este lote. Registra fincas en la sección "Fincas".',
    },
    { section: 'Datos de cosecha' } as any,
    {
      key: 'fecha_cosecha', label: 'Fecha de cosecha', type: 'date', required: true,
      description: 'Día en que se recolectó el café en la finca.',
    },
    {
      key: 'peso_kg', label: 'Peso / Stock (kg)', type: 'number', required: true, step: '0.01', min: '0', placeholder: 'Ej: 2500.00',
      description: 'Peso en kilogramos disponible. Se descuenta automáticamente con cada compra del portal cliente.',
    },
    { section: 'Precio y estado' } as any,
    {
      key: 'precio_kg', label: 'Precio por kg (COP)', type: 'number', required: true, step: '0.01', min: '0', placeholder: 'Ej: 18500',
      description: 'Precio fijo por kilogramo en pesos colombianos. El cliente NO puede modificarlo — solo puede elegir la cantidad a comprar.',
    },
    {
      key: 'estado', label: 'Estado del lote', type: 'select', required: true, options: ESTADOS,
      description: 'Disponible: listo para venta. En proceso: siendo beneficiado. Vendido/Exportado: ya despachado.',
    },
  ]

  return (
    <CrudPage
      title="Lotes de Café" subtitle="Cosechas registradas por finca, variedad y estado" icon="☕"
      table="lote_cafe" idField="idlote_cafe"
      selectQuery="*, finca(nombre, ubicacion, productor(nombre))"
      orderBy="fecha_cosecha"
      columns={[
        { key: 'idlote_cafe',   label: '#' },
        { key: 'variedad',      label: 'Variedad' },
        { key: 'idfinca',       label: 'Finca',      render: (_, r) => r.finca?.nombre || '—' },
        { key: 'productor',     label: 'Productor',  render: (_, r) => <span style={{color:'var(--text-dim)',fontSize:'0.82rem'}}>{r.finca?.productor?.nombre || '—'}</span> },
        { key: 'fecha_cosecha', label: 'Cosecha',    render: v => v ? new Date(v).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '—' },
        { key: 'peso_kg',       label: 'Stock',      render: v => <strong>{Number(v).toLocaleString('es-CO')} kg</strong> },
        { key: 'precio_kg',     label: 'Precio/kg',  render: v => <span style={{color:'var(--primary)',fontWeight:600}}>${Number(v ?? 0).toLocaleString('es-CO')}</span> },
        { key: 'estado',        label: 'Estado',     render: v => <span className={`badge ${estadoBadge[v]??'badge-amber'}`}>{v?.replace('_',' ')}</span> },
      ]}
      fields={fields}
      searchKey="variedad"
      filterKeys={[
        {
          key: 'estado',
          label: 'Estado',
          options: [
            { value: 'disponible',  label: '✅ Disponible'  },
            { value: 'en_proceso',  label: '⚙ En proceso'  },
            { value: 'vendido',     label: '💰 Vendido'     },
            { value: 'exportado',   label: '✈ Exportado'   },
          ],
        },
      ]}
    />
  )
}
