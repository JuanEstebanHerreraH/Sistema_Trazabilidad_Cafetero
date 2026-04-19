'use client'
import CrudPage from '../../../components/CrudPage'

export default function RegistrosPage() {
  return (
    <CrudPage
      title="Registros de Proceso" subtitle="Seguimiento del beneficio por lote" icon="📋"
      table="registro_proceso" idField="idregistro_proceso"
      selectQuery="idregistro_proceso, fecha_inicio, fecha_fin, notas, lote_cafe:idlote_cafe(variedad), proceso:idproceso(nombre)"
      orderBy="fecha_inicio"
      columns={[
        { key: 'idregistro_proceso', label: 'ID' },
        { key: 'lote_cafe', label: 'Lote', render: v => v?.variedad ?? '—' },
        { key: 'proceso', label: 'Proceso', render: v => v?.nombre ?? '—' },
        { key: 'fecha_inicio', label: 'Inicio', render: v => v ? new Date(v).toLocaleDateString('es-CO') : '—' },
        { key: 'fecha_fin',    label: 'Fin',    render: v => v ? new Date(v).toLocaleDateString('es-CO') : '—' },
        { key: 'notas', label: 'Notas', render: v => v ? <span style={{ fontSize: '0.78rem' }}>{String(v).slice(0, 40)}{String(v).length > 40 ? '…' : ''}</span> : '—' },
      ]}
      fields={[
        { key: 'idlote_cafe', label: 'ID Lote',    type: 'number', required: true, placeholder: 'ID del lote de café' },
        { key: 'idproceso',   label: 'ID Proceso', type: 'number', required: true, placeholder: 'ID del proceso' },
        { key: 'fecha_inicio', label: 'Fecha inicio', type: 'datetime-local', required: true },
        { key: 'fecha_fin',    label: 'Fecha fin',    type: 'datetime-local', required: true },
        { key: 'notas', label: 'Notas', type: 'textarea', placeholder: 'Observaciones del proceso…', colSpan: 'full' },
      ]}
    />
  )
}
