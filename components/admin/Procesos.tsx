'use client'
import CrudPage from '../../components/CrudPage'

export default function Procesos() {
  return (
    <CrudPage
      title="Procesos" subtitle="Tipos de proceso aplicados al café" icon="⚙️"
      table="proceso" idField="idproceso" orderBy="nombre"
      columns={[
        { key: 'idproceso',   label: '#' },
        { key: 'nombre',      label: 'Nombre' },
        { key: 'descripcion', label: 'Descripción' },
      ]}
      fields={[
        { key: 'nombre',      label: 'Nombre',      type: 'text',     required: true,  placeholder: 'Ej: Lavado, Natural, Honey' },
        { key: 'descripcion', label: 'Descripción', type: 'textarea', required: true,  placeholder: 'Descripción del proceso…' },
      ]}
      searchKey="nombre"
    />
  )
}
