'use client'
import { useRead } from '../../hooks/useCrud'
import CrudPage from '../../components/CrudPage'

export default function Usuarios() {
  const { data: roles } = useRead('rol', 'idrol, nombre', 'nombre')

  const fields = [
    { key: 'nombre',        label: 'Nombre completo', type: 'text',   required: true },
    { key: 'email',         label: 'Email',           type: 'email',  required: true },
    { key: 'password_hash', label: 'Password hash',   type: 'text',   required: true, placeholder: 'Hash bcrypt del password' },
    {
      key: 'idrol', label: 'Rol', type: 'select', required: true,
      options: roles.map(r => ({ value: r.idrol, label: r.nombre })),
    },
  ]

  return (
    <CrudPage
      title="Usuarios" subtitle="Usuarios del sistema" icon="👥"
      table="usuario" idField="idusuario"
      selectQuery="*, rol(nombre)"
      orderBy="nombre"
      columns={[
        { key: 'idusuario', label: '#' },
        { key: 'nombre',    label: 'Nombre' },
        { key: 'email',     label: 'Email' },
        { key: 'idrol',     label: 'Rol', render: (_, r) => r.rol?.nombre || r.idrol },
      ]}
      fields={fields}
      searchKey="nombre"
    />
  )
}
