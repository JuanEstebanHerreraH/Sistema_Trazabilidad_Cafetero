'use client'
import CrudPage from '../../../components/CrudPage'

export default function ClientesPage() {
  return (
    <CrudPage
      title="Clientes" subtitle="Base de clientes compradores" icon="🤝"
      table="cliente" idField="idcliente" orderBy="nombre" searchKey="nombre"
      columns={[
        { key: 'idcliente', label: 'ID' },
        { key: 'nombre', label: 'Nombre', render: v => <strong style={{ color: 'var(--text)' }}>{v}</strong> },
        { key: 'email', label: 'Email' },
        { key: 'telefono', label: 'Teléfono' },
        { key: 'created_at', label: 'Registro', render: v => v ? new Date(v).toLocaleDateString('es-CO') : '—' },
      ]}
      fields={[
        { key: 'nombre',   label: 'Nombre',   required: true, placeholder: 'María García' },
        { key: 'email',    label: 'Email',     type: 'email',  placeholder: 'cliente@email.com' },
        { key: 'telefono', label: 'Teléfono', type: 'tel',    placeholder: '+57 300 000 0000' },
      ]}
    />
  )
}
