'use client'
import { useState, useEffect } from 'react'
import CrudPage from '../../../components/CrudPage'
import { createClient } from '../../../utils/supabase/client'

export default function FincasPage() {
  const [productores, setProductores] = useState<{ value: string; label: string }[]>([])
  useEffect(() => {
    createClient().from('productor').select('idproductor, nombre').order('nombre')
      .then(({ data }) => setProductores((data ?? []).map((p: any) => ({ value: String(p.idproductor), label: p.nombre }))))
  }, [])

  return (
    <CrudPage
      title="Fincas" subtitle="Registro de fincas cafeteras" icon="🌿"
      table="finca" idField="idfinca"
      selectQuery="idfinca, nombre, ubicacion, area_hectareas, altitud_msnm, idproductor, productor:idproductor(nombre)"
      orderBy="nombre"
      searchKeys={['nombre', 'ubicacion', 'productor.nombre']}
      searchPlaceholder="Buscar finca, ubicación o productor…"
      columns={[
        { key: 'idfinca',        label: 'ID' },
        { key: 'nombre',         label: 'Nombre',   render: v => <strong style={{ color:'var(--text)' }}>{v}</strong> },
        { key: 'ubicacion',      label: 'Ubicación' },
        { key: 'area_hectareas', label: 'Área (ha)', render: v => v ? `${v} ha` : '—' },
        { key: 'productor',      label: 'Productor', render: v => v?.nombre ?? '—' },
      ]}
      fields={[
        { key: 'nombre',         label: 'Nombre',          required: true, placeholder: 'Finca El Paraíso' },
        { key: 'ubicacion',      label: 'Ubicación',       placeholder: 'Pitalito, Huila' },
        { key: 'area_hectareas', label: 'Área (ha)',       type: 'number', placeholder: '5.5' },
        { key: 'altitud_msnm',   label: 'Altitud (msnm)', type: 'number', placeholder: '1800' },
        { key: 'idproductor',    label: 'ID Productor',    type: 'number', placeholder: 'ID del productor' },
      ]}
      filterSelects={[
        { key: 'idproductor', label: 'Productor', options: productores },
      ]}
      rangeFilters={[
        { key: 'area_hectareas', label: 'Área', unit: 'ha' },
      ]}
    />
  )
}
