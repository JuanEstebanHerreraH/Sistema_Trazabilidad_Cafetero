'use client'
import CrudPage from '../../../components/CrudPage'

export default function ProcesosPage() {
  return (
    <CrudPage
      title="Procesos" subtitle="Tipos de beneficio y proceso del café" icon="⚙️"
      table="proceso" idField="idproceso" orderBy="nombre" searchKey="nombre"
      columns={[
        { key: 'idproceso', label: 'ID' },
        { key: 'nombre', label: 'Nombre', render: v => <strong style={{ color: 'var(--text)' }}>{v}</strong> },
        { key: 'descripcion', label: 'Descripción' },
      ]}
      fields={[
        { key: 'nombre',      label: 'Nombre',      required: true, placeholder: 'Lavado, Natural, Honey…' },
        { key: 'descripcion', label: 'Descripción', type: 'textarea', placeholder: 'Describe el proceso de beneficio…' },
      ]}
    />
  )
}
