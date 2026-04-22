'use client'
import CrudPage from '../../../components/CrudPage'

export default function AlmacenesPage() {
  return (
    <CrudPage
      title="Almacenes" subtitle="Gestión de bodegas y almacenes" icon="🏭"
      table="almacen" idField="idalmacen" orderBy="nombre"
      searchKeys={['nombre', 'ubicacion']}
      searchPlaceholder="Buscar almacén o ubicación…"
      columns={[
        { key: 'idalmacen',    label: 'ID' },
        { key: 'nombre',       label: 'Nombre',    render: v => <strong style={{ color:'var(--text)' }}>{v}</strong> },
        { key: 'ubicacion',    label: 'Ubicación' },
        { key: 'capacidad_kg', label: 'Capacidad', sortable: true, render: v => v ? `${Number(v).toLocaleString('es-CO')} kg` : '—' },
      ]}
      fields={[
        { key: 'nombre',       label: 'Nombre',         required: true, placeholder: 'Bodega Central' },
        { key: 'ubicacion',    label: 'Ubicación',      placeholder: 'Neiva, Huila' },
        { key: 'capacidad_kg', label: 'Capacidad (kg)', type: 'number', placeholder: '10000' },
      ]}
      rangeFilters={[
        { key: 'capacidad_kg', label: 'Capacidad', unit: 'kg' },
      ]}
    />
  )
}
