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
      description: 'Lote al que se le aplicó el proceso. Gestiona lotes en la sección "Lotes de Café".',
    },
    {
      key: 'idproceso', label: 'Proceso aplicado', type: 'select', required: true,
      options: procesos.map(p => ({ value: p.idproceso, label: p.nombre })),
      description: 'Tipo de beneficio realizado: Lavado, Natural, Honey, etc. Crea nuevos en "Procesos".',
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
      description: 'Operario o técnico a cargo de ejecutar y supervisar el proceso.',
    },
    { section: 'Observaciones' } as any,
    {
      key: 'notas', label: 'Notas del proceso', type: 'textarea', required: false, colSpan: 'full',
      placeholder: 'Temperatura de fermentación, pH, condiciones climáticas, observaciones…',
      description: 'Anotaciones técnicas relevantes: condiciones del proceso, incidencias, parámetros medidos.',
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
        { key: 'idregistro_proceso', label: '#' },
        { key: 'idlote_cafe',  label: 'Lote',     render: (_, r) => r.lote_cafe?.variedad || '—' },
        { key: 'idproceso',    label: 'Proceso',   render: (_, r) => r.proceso?.nombre    || '—' },
        { key: 'fecha_inicio', label: 'Inicio',    render: v => v ? new Date(v).toLocaleDateString('es-CO',{day:'2-digit',month:'short'}) : '—' },
        { key: 'fecha_fin',    label: 'Fin',       render: v => v ? new Date(v).toLocaleDateString('es-CO',{day:'2-digit',month:'short'}) : '—' },
        { key: 'duracion',     label: 'Duración',  render: (_, r) => <span style={{color:'var(--text-dim)',fontSize:'0.82rem'}}>{diffHours(r)}</span> },
        { key: 'idusuario',    label: 'Responsable', render: (_, r) => r.usuario?.nombre || '—' },
      ]}
      fields={fields}
    />
  )
}
