'use client'
import { useState, useEffect } from 'react'
import CrudPage from '../../../components/CrudPage'
import { createClient } from '../../../utils/supabase/client'

const tipoBadge: Record<string,string> = { entrada:'badge-green', salida:'badge-red', traslado:'badge-blue' }

export default function MovimientosPage() {
  const [almacenes, setAlmacenes] = useState<{ value: string; label: string }[]>([])
  useEffect(() => {
    createClient().from('almacen').select('idalmacen, nombre').order('nombre')
      .then(({ data }) => setAlmacenes((data??[]).map((a:any) => ({ value: String(a.idalmacen), label: a.nombre }))))
  }, [])

  return (
    <CrudPage
      title="Movimientos de Inventario" subtitle="Entradas, salidas y traslados entre almacenes" icon="↕️"
      table="movimiento_inventario" idField="idmovimiento_inventario"
      selectQuery="idmovimiento_inventario, tipo, fecha_movimiento, cantidad, notas, lote_cafe:idlote_cafe(variedad), almacen_origen:idalmacen_origen(nombre), almacen_destino:idalmacen_destino(nombre)"
      orderBy="fecha_movimiento"
      searchKeys={['lote_cafe.variedad', 'almacen_origen.nombre', 'almacen_destino.nombre', 'notas']}
      searchPlaceholder="Buscar lote, almacén, notas…"
      columns={[
        { key: 'idmovimiento_inventario', label: 'ID' },
        { key: 'tipo',             label: 'Tipo',     render: v => <span className={`badge ${tipoBadge[v]??'badge-muted'}`}>{v}</span> },
        { key: 'lote_cafe',        label: 'Lote',     render: v => v?.variedad ?? '—' },
        { key: 'cantidad',         label: 'Cantidad', sortable: true, render: v => <strong style={{ color:'var(--primary)' }}>{v} kg</strong> },
        { key: 'almacen_origen',   label: 'Origen',   render: v => v?.nombre ?? '—' },
        { key: 'almacen_destino',  label: 'Destino',  render: v => v?.nombre ?? '—' },
        { key: 'fecha_movimiento', label: 'Fecha',    sortable: true, render: v => v ? new Date(v).toLocaleDateString('es-CO') : '—' },
      ]}
      fields={[
        { key: 'tipo', label: 'Tipo', type: 'select', required: true, options: [
          { value: 'entrada',  label: '📥 Entrada' },
          { value: 'salida',   label: '📤 Salida' },
          { value: 'traslado', label: '🔄 Traslado' },
        ]},
        { key: 'idlote_cafe',         label: 'ID Lote',            type: 'number', required: true },
        { key: 'cantidad',            label: 'Cantidad (kg)',       type: 'number', required: true, placeholder: '100' },
        { key: 'idalmacen_origen',    label: 'ID Almacén Origen',  type: 'number', placeholder: 'Dejar vacío si no aplica' },
        { key: 'idalmacen_destino',   label: 'ID Almacén Destino', type: 'number', placeholder: 'Dejar vacío si no aplica' },
        { key: 'fecha_movimiento',    label: 'Fecha',              type: 'datetime-local', required: true },
        { key: 'notas', label: 'Notas', type: 'textarea', placeholder: 'Observaciones…', colSpan: 'full' },
      ]}
      filterSelects={[
        { key: 'tipo', label: 'Tipo', options: [
          { value: 'entrada',  label: '📥 Entrada'  },
          { value: 'salida',   label: '📤 Salida'   },
          { value: 'traslado', label: '🔄 Traslado' },
        ]},
      ]}
      dateFilters={[{ key: 'fecha_movimiento', label: 'Fecha' }]}
      rangeFilters={[{ key: 'cantidad', label: 'Cantidad', unit: 'kg' }]}
    />
  )
}
