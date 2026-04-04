'use client'
import { useRead } from '../../hooks/useCrud'
import CrudPage from '../../components/CrudPage'

export default function Fincas() {
  const { data: productores } = useRead('productor', 'idproductor, nombre', 'nombre')

  const fields = [
    {
      key: 'nombre', label: 'Nombre de la finca', type: 'text', required: true, placeholder: 'Ej: La Esperanza, El Paraíso',
      description: 'Nombre con el que se identifica la finca en el sistema.',
    },
    {
      key: 'idproductor', label: 'Productor propietario', type: 'select', required: true,
      options: productores.map(p => ({ value: p.idproductor, label: p.nombre })),
      description: 'Persona dueña o responsable de la finca. Agrégala primero en "Productores".',
    },
    { section: 'Ubicación y tamaño' } as any,
    {
      key: 'ubicacion', label: 'Ubicación', type: 'text', required: false, placeholder: 'Ej: San Agustín, Huila',
      description: 'Municipio y departamento donde está ubicada la finca.',
      colSpan: 'full',
    },
    {
      key: 'area_hectareas', label: 'Área (hectáreas)', type: 'number', required: false, step: '0.01', min: '0', placeholder: 'Ej: 12.5',
      description: 'Extensión total de la finca en hectáreas cultivadas.',
    },
  ]

  return (
    <CrudPage
      title="Fincas" subtitle="Propiedades cafeteras donde se produce el café" icon="🌿"
      table="finca" idField="idfinca"
      selectQuery="*, productor(nombre)"
      orderBy="nombre"
      columns={[
        { key: 'idfinca',        label: '#' },
        { key: 'nombre',         label: 'Finca' },
        { key: 'idproductor',    label: 'Productor',       render: (_, r) => r.productor?.nombre || '—' },
        { key: 'ubicacion',      label: 'Ubicación',       render: v => v || <span style={{color:'var(--text-muted)'}}>—</span> },
        { key: 'area_hectareas', label: 'Área',            render: v => v ? `${Number(v).toLocaleString('es-CO')} ha` : '—' },
      ]}
      fields={fields}
      searchKey="nombre"
    />
  )
}
