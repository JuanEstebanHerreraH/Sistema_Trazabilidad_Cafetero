'use client'
import { useRead } from '../../hooks/useCrud'
import CrudPage from '../../components/CrudPage'

export default function Registros() {
  const { data: lotes }    = useRead('lote_cafe', 'idlote_cafe, variedad', 'variedad')
  const { data: procesos } = useRead('proceso',   'idproceso, nombre',     'nombre')
  const { data: usuarios } = useRead('usuario',   'idusuario, nombre',     'nombre')

  const fields = [
    {
      key: 'idlote_cafe', label: 'Lote de café', type: 'select', required: true,
      options: lotes.map(l => ({ value: l.idlote_cafe, label: l.variedad })),
      description: 'Lote al que se le aplicó el proceso.',
    },
    {
      key: 'idproceso', label: 'Proceso aplicado', type: 'select', required: true,
      options: procesos.map(p => ({ value: p.idproceso, label: p.nombre })),
      description: 'Tipo de beneficio: Lavado, Natural, Honey, etc.',
    },
    { section: 'Periodo de ejecución' } as any,
    {
      key: 'fecha_inicio', label: 'Fecha de inicio', type: 'datetime-local', required: true,
      description: 'Momento en que comenzó el proceso de beneficio.',
    },
    {
      key: 'fecha_fin', label: 'Fecha de finalización', type: 'datetime-local', required: true,
      description: 'Momento en que se completó el proceso.',
    },
    {
      key: 'idusuario', label: 'Responsable del proceso', type: 'select', required: false,
      options: usuarios.map(u => ({ value: u.idusuario, label: u.nombre })),
    },
    { section: 'Observaciones' } as any,
    {
      key: 'notas', label: 'Notas del proceso', type: 'textarea', required: false, colSpan: 'full',
      placeholder: 'Temperatura, pH, condiciones climáticas, incidencias…',
    },
  ]

  const diffHours = (r: any) => {
    if (!r.fecha_inicio || !r.fecha_fin) return '—'
    const h = Math.round((new Date(r.fecha_fin).getTime() - new Date(r.fecha_inicio).getTime()) / 36e5)
    return h < 24 ? `${h}h` : `${Math.round(h/24)}d`
  }

  return (
    <CrudPage
      title="Registros de Proceso" subtitle="Historial de beneficios aplicados a cada lote de café" icon="📋"
      table="registro_proceso" idField="idregistro_proceso"
      selectQuery="*, lote_cafe(variedad), proceso(nombre), usuario(nombre)"
      orderBy="fecha_inicio"
      columns={[
        { key: 'idregistro_proceso', label: '#', sortable: true },
        { key: 'idlote_cafe',  label: 'Lote',       render: (_, r) => r.lote_cafe?.variedad || '—' },
        { key: 'idproceso',    label: 'Proceso',     render: (_, r) => <span className="badge badge-amber">{r.proceso?.nombre || '—'}</span> },
        { key: 'fecha_inicio', label: 'Inicio', sortable: true, render: v => v ? new Date(v).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' }) : '—' },
        { key: 'fecha_fin',    label: 'Fin',    sortable: true, render: v => v ? new Date(v).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' }) : <span style={{ color: 'var(--amber)', fontSize: '0.8rem' }}>En curso</span> },
        { key: 'duracion',     label: 'Duración',   render: (_, r) => <span style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>{diffHours(r)}</span> },
        { key: 'idusuario',    label: 'Responsable', render: (_, r) => r.usuario?.nombre || '—' },
      ]}
      fields={fields}
      searchKey="notas"
      filterSelects={procesos.length > 0 ? [
        { key: 'idproceso', label: 'Proceso', options: procesos.map(p => ({ value: String(p.idproceso), label: p.nombre })) },
      ] : undefined}
      dateFilters={[
        { key: 'fecha_inicio', label: 'Fecha de inicio' },
      ]}
    />
  )
}
