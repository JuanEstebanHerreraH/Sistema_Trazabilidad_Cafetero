'use client'
import CrudPage from '../../../components/CrudPage'

export default function RolesPage() {
  return (
    <CrudPage
      title="Roles" subtitle="Roles del sistema y sus permisos" icon="🔐"
      table="rol" idField="idrol" orderBy="nombre" searchKey="nombre"
      columns={[
        { key: 'idrol', label: 'ID' },
        { key: 'nombre', label: 'Nombre', render: v => <strong style={{ color: 'var(--text)' }}>{v}</strong> },
        { key: 'descripcion', label: 'Descripción' },
      ]}
      fields={[
        { key: 'nombre',      label: 'Nombre',      required: true, placeholder: 'Cliente, Operador…' },
        { key: 'descripcion', label: 'Descripción', type: 'textarea', placeholder: 'Describe los permisos de este rol…' },
      ]}
    />
  )
}
