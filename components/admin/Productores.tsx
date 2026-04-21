'use client'
import { useMemo } from 'react'
import { useRead } from '../../hooks/useCrud'
import CrudPage from '../../components/CrudPage'

export default function Productores() {
  const { data: productores } = useRead('productor', 'idproductor, nombre, contacto, region', 'nombre')

  // Build unique region options from loaded data
  const regionOptions = useMemo(() => {
    const regiones = Array.from(
      new Set(productores.map(p => p.region).filter(Boolean))
    ).sort() as string[]
    return regiones.map(r => ({ value: r, label: r }))
  }, [productores])

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
      filterSelects={regionOptions.length > 0 ? [
        { key: 'region', label: 'Región', options: regionOptions },
      ] : undefined}
    />
  )
}
