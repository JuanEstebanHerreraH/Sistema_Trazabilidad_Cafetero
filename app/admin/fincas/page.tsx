'use client'
import CrudPage from '../../../components/CrudPage'

export default function FincasPage() {
  return (
    <CrudPage
      title="Fincas" subtitle="Registro de fincas cafeteras" icon="🌿"
      table="finca" idField="idfinca"
      selectQuery="idfinca, nombre, ubicacion, area_hectareas, idproductor, productor:idproductor(nombre)"
      orderBy="nombre" searchKey="nombre"
      columns={[
        { key: 'idfinca', label: 'ID' },
        { key: 'nombre', label: 'Nombre', render: v => <strong style={{ color: 'var(--text)' }}>{v}</strong> },
        { key: 'ubicacion', label: 'Ubicación' },
        { key: 'area_hectareas', label: 'Área (ha)', render: v => v ? `${v} ha` : '—' },
        { key: 'productor', label: 'Productor', render: v => v?.nombre ?? '—' },
      ]}
      fields={[
        { key: 'nombre',         label: 'Nombre',          required: true, placeholder: 'Finca El Paraíso' },
        { key: 'ubicacion',      label: 'Ubicación',                       placeholder: 'Pitalito, Huila' },
        { key: 'area_hectareas', label: 'Área (ha)',        type: 'number', placeholder: '5.5' },
        { key: 'idproductor',    label: 'ID Productor',     type: 'number', placeholder: 'ID del productor' },
      ]}
    />
  )
}
