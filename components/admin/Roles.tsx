'use client'
import CrudPage from '../../components/CrudPage'

export default function Roles() {
  return (
    <CrudPage
      title="Roles" subtitle="Roles del sistema para usuarios" icon="🔐"
      table="rol" idField="idrol" orderBy="nombre"
      columns={[
        { key: 'idrol',       label: '#' },
        { key: 'nombre',      label: 'Nombre' },
        { key: 'descripcion', label: 'Descripción' },
      ]}
      fields={[
        { key: 'nombre',      label: 'Nombre',      type: 'text',     required: true },
        { key: 'descripcion', label: 'Descripción', type: 'textarea', required: true },
      ]}
      searchKey="nombre"
    />
  )
}
