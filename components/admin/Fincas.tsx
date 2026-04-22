'use client'
import { useRead } from '../../hooks/useCrud'
import CrudPage from '../../components/CrudPage'

export default function Fincas() {
  const { data: productores } = useRead('productor', 'idproductor, nombre', 'nombre')

  return (
    <CrudPage
      title="Fincas" subtitle="Fincas de origen registradas" icon="🌿"
      table="finca" idField="idfinca" orderBy="nombre"
      selectQuery="*, productor(nombre)"
      searchKeys={['nombre', 'ubicacion', 'productor.nombre']}
      searchPlaceholder="Buscar por nombre, ubicación o productor…"
      columns={[
        { key: 'idfinca',      label: '#',          sortable: true },
        { key: 'nombre',       label: 'Nombre',     sortable: true },
        { key: 'ubicacion',    label: 'Ubicación',  sortable: true },
        { key: 'idproductor',  label: 'Productor',  render: (_, r) => r.productor?.nombre || '—' },
        { key: 'altitud_msnm', label: 'Altitud',    sortable: true, render: v => v ? `${v} msnm` : '—' },
        { key: 'area_hectareas', label: 'Área',     sortable: true, render: v => v ? `${v} ha` : '—' },
      ]}
      fields={[
        { key: 'nombre',       label: 'Nombre finca',       type: 'text',   required: true, placeholder: 'Ej: La Esperanza' },
        { key: 'ubicacion',    label: 'Municipio / Ubicación', type: 'text', required: false, placeholder: 'Ej: Salento, Quindío' },
        { key: 'altitud_msnm', label: 'Altitud (msnm)',     type: 'number', required: false, min: '0', placeholder: 'Ej: 1800' },
        { key: 'area_hectareas', label: 'Área (ha)',         type: 'number', required: false, min: '0', step: '0.1', placeholder: 'Ej: 5.5' },
        {
          key: 'idproductor', label: 'Productor', type: 'select', required: false,
          options: productores.map(p => ({ value: p.idproductor, label: p.nombre })),
        },
      ]}
      filterSelects={[
        ...(productores.length > 0 ? [{ key: 'idproductor', label: 'Productor', options: productores.map(p => ({ value: String(p.idproductor), label: p.nombre })) }] : []),
      ]}
      rangeFilters={[
        { key: 'area_hectareas', label: 'Área', unit: 'ha' },
      ]}
    />
  )
}
