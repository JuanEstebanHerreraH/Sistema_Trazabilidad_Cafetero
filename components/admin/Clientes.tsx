'use client'
import CrudPage from '../../components/CrudPage'

export default function Clientes() {
  return (
    <CrudPage
      title="Clientes" subtitle="Clientes compradores de café" icon="🤝"
      table="cliente" idField="idcliente" orderBy="nombre"
      columns={[
        { key: 'idcliente', label: '#' },
        { key: 'nombre',    label: 'Nombre' },
        { key: 'email',     label: 'Email' },
        { key: 'telefono',  label: 'Teléfono' },
      ]}
      fields={[
        { key: 'nombre',   label: 'Nombre',    type: 'text',  required: true,  placeholder: 'Ej: Tostadores del Sur' },
        { key: 'email',    label: 'Email',     type: 'email', required: false, placeholder: 'cliente@email.com' },
        { key: 'telefono', label: 'Teléfono',  type: 'text',  required: false, placeholder: 'Ej: +57 300 000 0000' },
      ]}
      searchKey="nombre"
    />
  )
}
