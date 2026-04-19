'use client'
import CrudPage from '../../../components/CrudPage'

export default function ProductoresPage() {
  return (
    <CrudPage
      title="Productores" subtitle="Gestión de productores cafeteros" icon="👨‍🌾"
      table="productor" idField="idproductor" orderBy="nombre" searchKey="nombre"
      columns={[
        { key: 'idproductor', label: 'ID' },
        { key: 'nombre', label: 'Nombre', render: v => <strong style={{ color: 'var(--text)' }}>{v}</strong> },
        { key: 'region', label: 'Región' },
        { key: 'contacto', label: 'Contacto' },
        { key: 'created_at', label: 'Registrado', render: v => v ? new Date(v).toLocaleDateString('es-CO') : '—' },
      ]}
      fields={[
        { key: 'nombre',   label: 'Nombre',   required: true, placeholder: 'Juan Herrera' },
        { key: 'region',   label: 'Región',               placeholder: 'Huila, Nariño…' },
        { key: 'contacto', label: 'Contacto',              placeholder: 'Tel o email' },
      ]}
    />
  )
}
