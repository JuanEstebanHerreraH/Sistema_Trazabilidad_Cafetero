'use client'
import { useState, useEffect } from 'react'
import CrudPage from '../../../components/CrudPage'
import { createClient } from '../../../utils/supabase/client'

export default function ProductoresPage() {
  const [regiones, setRegiones] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    createClient().from('productor').select('region').order('region')
      .then(({ data }) => {
        const unique = Array.from(new Set((data ?? []).map((p: any) => p.region).filter(Boolean)))
        setRegiones(unique.map(r => ({ value: String(r), label: String(r) })))
      })
  }, [])

  return (
    <CrudPage
      title="Productores" subtitle="Gestión de productores cafeteros" icon="👨‍🌾"
      table="productor" idField="idproductor" orderBy="nombre"
      searchKeys={['nombre', 'region', 'contacto']}
      searchPlaceholder="Buscar productor, región o contacto…"
      columns={[
        { key: 'idproductor', label: 'ID' },
        { key: 'nombre',   label: 'Nombre',     render: v => <strong style={{ color: 'var(--text)' }}>{v}</strong> },
        { key: 'region',   label: 'Región' },
        { key: 'contacto', label: 'Contacto' },
        { key: 'created_at', label: 'Registrado', render: v => v ? new Date(v).toLocaleDateString('es-CO') : '—' },
      ]}
      fields={[
        { key: 'nombre',   label: 'Nombre',   required: true, placeholder: 'Juan Herrera' },
        { key: 'region',   label: 'Región',               placeholder: 'Huila, Nariño…' },
        { key: 'contacto', label: 'Contacto',              placeholder: 'Tel o email' },
      ]}
      filterSelects={[
        { key: 'region', label: 'Región', options: regiones },
      ]}
      dateFilters={[{ key: 'created_at', label: 'Fecha registro' }]}
    />
  )
}
