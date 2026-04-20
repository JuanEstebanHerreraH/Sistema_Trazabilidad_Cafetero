'use client'
import { useRead } from '../../hooks/useCrud'
import CrudPage from '../../components/CrudPage'

/**
 * Componente Usuarios — v2
 *
 * FIX: Se usa "rol!usuario_idrol_fkey(nombre)" en lugar de "rol(nombre)"
 * porque la migración v2 agregó una segunda FK (rol_solicitado → rol),
 * lo que causaba ambigüedad en PostgREST de Supabase:
 *   "Could not embed because more than one relationship was found for 'usuario' and 'rol'"
 *
 * La sintaxis "!idrol" le dice a PostgREST qué columna usar para el JOIN.
 */
export default function Usuarios() {
  const { data: roles } = useRead('rol', 'idrol, nombre', 'nombre')

  const fields = [
    { key: 'nombre',        label: 'Nombre completo',   type: 'text',  required: true },
    { key: 'email',         label: 'Email',             type: 'email', required: true },
    { key: 'password_hash', label: 'Password hash',     type: 'text',  required: true, placeholder: 'Hash bcrypt del password' },
    { key: 'telefono',      label: 'Teléfono',          type: 'text',  placeholder: '+57 300 000 0000' },
    {
      key: 'idrol', label: 'Rol asignado', type: 'select',
      options: roles.map(r => ({ value: r.idrol, label: r.nombre })),
    },
    {
      key: 'estado_aprobacion', label: 'Estado de aprobación', type: 'select', required: true,
      options: [
        { value: 'pendiente',  label: '⏳ Pendiente'  },
        { value: 'aprobado',   label: '✅ Aprobado'   },
        { value: 'rechazado',  label: '❌ Rechazado'  },
      ],
    },
  ]

  return (
    <CrudPage
      title="Usuarios" subtitle="Usuarios del sistema" icon="👥"
      table="usuario" idField="idusuario"
      selectQuery="*, rol!usuario_idrol_fkey(nombre)"
      orderBy="nombre"
      columns={[
        { key: 'idusuario',        label: '#' },
        { key: 'nombre',           label: 'Nombre' },
        { key: 'email',            label: 'Email' },
        {
          key: 'idrol', label: 'Rol',
          render: (_, r) => r.rol?.nombre ?? <span style={{ color: 'var(--text-muted)' }}>Sin rol</span>
        },
        {
          key: 'estado_aprobacion', label: 'Estado',
          render: (v: string) => {
            const cfg: Record<string, { cls: string; label: string }> = {
              aprobado:  { cls: 'badge-green', label: '✅ Aprobado'  },
              pendiente: { cls: 'badge-amber', label: '⏳ Pendiente' },
              rechazado: { cls: 'badge-red',   label: '❌ Rechazado' },
            }
            const c = cfg[v] ?? cfg.pendiente
            return <span className={`badge ${c.cls}`}>{c.label}</span>
          },
        },
      ]}
      fields={fields}
      searchKey="nombre"
      filterSelects={[
        { key: 'idrol', label: 'Rol', options: roles.map(r => ({ value: String(r.idrol), label: r.nombre })) },
        { key: 'estado_aprobacion', label: 'Estado', options: [
          { value: 'aprobado', label: '✅ Aprobado' },
          { value: 'pendiente', label: '⏳ Pendiente' },
          { value: 'rechazado', label: '❌ Rechazado' },
        ]},
      ]}
    />
  )
}
