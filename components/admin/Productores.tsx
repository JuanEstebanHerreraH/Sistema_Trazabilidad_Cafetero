'use client'
import CrudPage from '../../components/CrudPage'

export default function Productores() {
  return (
    <CrudPage
      title="Productores" subtitle="Productores de café registrados" icon="👨‍🌾"
      table="productor" idField="idproductor" orderBy="nombre"
      searchKeys={['nombre', 'contacto', 'region']}
      searchPlaceholder="Buscar por nombre, contacto o región…"
      columns={[
        { key: 'idproductor', label: '#',         sortable: true },
        { key: 'nombre',      label: 'Nombre',    sortable: true },
        { key: 'contacto',    label: 'Contacto' },
        { key: 'region',      label: 'Región',    sortable: true },
      ]}
      fields={[
        { key: 'nombre',   label: 'Nombre completo',  type: 'text', required: true,  placeholder: 'Ej: Juan Pérez' },
        { key: 'contacto', label: 'Teléfono / Email', type: 'text', required: false, placeholder: 'Ej: 310 000 0000' },
        { key: 'region',   label: 'Región',           type: 'text', required: false, placeholder: 'Ej: Huila, Nariño…' },
      ]}
    />
  )
}
