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
      description: 'Finca donde se cosechó este lote.',
    },
    { section: 'Datos de cosecha' } as any,
    { key: 'fecha_cosecha', label: 'Fecha de cosecha', type: 'date', required: true },
    { key: 'peso_kg',       label: 'Peso / Stock (kg)', type: 'number', required: true, step: '0.01', min: '0', placeholder: 'Ej: 2500.00' },
    { section: 'Precio y estado' } as any,
    { key: 'precio_kg',     label: 'Precio por kg (COP)', type: 'number', required: true, step: '0.01', min: '0', placeholder: 'Ej: 18500' },
    { key: 'estado',        label: 'Estado del lote', type: 'select', required: true, options: ESTADOS },
  ]

  return (
    <CrudPage
      title="Lotes de Café" subtitle="Cosechas registradas por finca, variedad y estado" icon="☕"
      table="lote_cafe" idField="idlote_cafe"
      selectQuery="*, finca(nombre, ubicacion, productor(nombre))"
      orderBy="fecha_cosecha"
      searchKeys={['variedad', 'finca.nombre', 'finca.productor.nombre']}
      searchPlaceholder="Buscar variedad, finca o productor…"
      columns={[
        { key: 'idlote_cafe',   label: '#',         sortable: true },
        { key: 'variedad',      label: 'Variedad',  sortable: true },
        { key: 'idfinca',       label: 'Finca',     sortable: true, render: (_, r) => r.finca?.nombre || '—' },
        { key: 'productor',     label: 'Productor', render: (_, r) => <span style={{color:'var(--text-dim)',fontSize:'0.82rem'}}>{r.finca?.productor?.nombre || '—'}</span> },
        { key: 'fecha_cosecha', label: 'Cosecha',   sortable: true, render: v => v ? new Date(v).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '—' },
        { key: 'peso_kg',       label: 'Stock',     sortable: true, render: v => <strong>{Number(v).toLocaleString('es-CO')} kg</strong> },
        { key: 'precio_kg',     label: 'Precio/kg', sortable: true, render: v => <span style={{color:'var(--primary)',fontWeight:600}}>${Number(v ?? 0).toLocaleString('es-CO')}</span> },
        { key: 'estado',        label: 'Estado',    render: v => <span className={`badge ${estadoBadge[v]??'badge-amber'}`}>{v?.replace('_',' ')}</span> },
      ]}
      fields={fields}
      filterSelects={[
        { key: 'estado', label: 'Estado', options: ESTADOS },
        ...(fincas.length > 0 ? [{ key: 'idfinca', label: 'Finca', options: fincas.map(f => ({ value: String(f.idfinca), label: f.nombre })) }] : []),
      ]}
      dateFilters={[
        { key: 'fecha_cosecha', label: 'Fecha cosecha' },
      ]}
    />
  )
}
