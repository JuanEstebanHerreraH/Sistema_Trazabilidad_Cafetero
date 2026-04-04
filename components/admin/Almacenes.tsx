'use client'
import CrudPage from '../../components/CrudPage'

export default function Almacenes() {
  return (
    <CrudPage
      title="Almacenes" subtitle="Bodegas y puntos de almacenamiento de café" icon="🏭"
      table="almacen" idField="idalmacen" orderBy="nombre"
      columns={[
        { key: 'idalmacen',   label: '#' },
        { key: 'nombre',      label: 'Nombre' },
        { key: 'ubicacion',   label: 'Ubicación' },
        { key: 'capacidad_kg',label: 'Capacidad (kg)', render: v => v ? Number(v).toLocaleString('es-CO') : '—' },
      ]}
      fields={[
        { key: 'nombre',       label: 'Nombre',          type: 'text',   required: true,  placeholder: 'Ej: Bodega Central' },
        { key: 'ubicacion',    label: 'Ubicación',       type: 'text',   required: true,  placeholder: 'Ej: Km 5 vía Bogotá' },
        { key: 'capacidad_kg', label: 'Capacidad (kg)',  type: 'number', required: false, step: '0.01', min: '0' },
      ]}
      searchKey="nombre"
    />
  )
}
