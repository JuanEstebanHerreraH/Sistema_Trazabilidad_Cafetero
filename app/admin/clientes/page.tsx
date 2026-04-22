'use client'
import CrudPage from '../../../components/CrudPage'

export default function ClientesPage() {
  return (
    <CrudPage
      title="Clientes" subtitle="Base de clientes compradores" icon="🧡"
      table="cliente" idField="idcliente" orderBy="nombre"
      searchKeys={['nombre', 'email', 'telefono']}
      searchPlaceholder="Buscar cliente, email o teléfono…"
      columns={[
        { key: 'idcliente', label: 'ID' },
        { key: 'nombre',    label: 'Nombre',   render: v => <strong style={{ color:'var(--text)' }}>{v}</strong> },
        { key: 'email',     label: 'Email' },
        { key: 'telefono',  label: 'Teléfono' },
        { key: 'created_at',label: 'Registro', render: v => v ? new Date(v).toLocaleDateString('es-CO') : '—' },
      ]}
      fields={[
        { key: 'nombre',   label: 'Nombre',   required: true, placeholder: 'Distribuidora XYZ' },
        { key: 'email',    label: 'Email',    type: 'email',  placeholder: 'correo@empresa.com' },
        { key: 'telefono', label: 'Teléfono', placeholder: '+57 300 000 0000' },
      ]}
      dateFilters={[{ key: 'created_at', label: 'Fecha registro' }]}
    />
  )
}
