'use client'
import CrudPage from '../../components/CrudPage'

export default function Clientes() {
  return (
    <CrudPage
      title="Clientes" subtitle="Clientes compradores de café" icon="🤝"
      table="cliente" idField="idcliente" orderBy="nombre"
      searchKeys={['nombre', 'email', 'telefono']}
      searchPlaceholder="Buscar por nombre, email o teléfono…"
      columns={[
        { key: 'idcliente', label: '#',        sortable: true },
        { key: 'nombre',    label: 'Nombre',   sortable: true },
        { key: 'email',     label: 'Email' },
        { key: 'telefono',  label: 'Teléfono' },
      ]}
      fields={[
        { key: 'nombre',   label: 'Nombre',   type: 'text',  required: true,  placeholder: 'Ej: Tostadores del Sur' },
        { key: 'email',    label: 'Email',    type: 'email', required: false, placeholder: 'cliente@email.com' },
        { key: 'telefono', label: 'Teléfono', type: 'text',  required: false, placeholder: 'Ej: +57 300 000 0000' },
      ]}
    />
  )
}
