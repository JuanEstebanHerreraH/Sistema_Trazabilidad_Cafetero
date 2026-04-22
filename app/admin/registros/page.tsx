'use client'
import { useState, useEffect } from 'react'
import CrudPage from '../../../components/CrudPage'
import { createClient } from '../../../utils/supabase/client'

export default function RegistrosPage() {
  const [procesos,  setProcesos]  = useState<{ value: string; label: string }[]>([])
  const [usuarios,  setUsuarios]  = useState<{ value: string; label: string }[]>([])
  useEffect(() => {
    const sb = createClient()
    sb.from('proceso').select('idproceso, nombre').order('nombre')
      .then(({ data }) => setProcesos((data??[]).map((p:any) => ({ value: String(p.idproceso), label: p.nombre }))))
    sb.from('usuario').select('idusuario, nombre').order('nombre')
      .then(({ data }) => setUsuarios((data??[]).map((u:any) => ({ value: String(u.idusuario), label: u.nombre }))))
  }, [])

  return (
    <CrudPage
      title="Registros de Proceso" subtitle="Seguimiento del beneficio por lote" icon="📋"
      table="registro_proceso" idField="idregistro_proceso"
      selectQuery="idregistro_proceso, fecha_inicio, fecha_fin, notas, calificacion, idproceso, idusuario, lote_cafe:idlote_cafe(variedad), proceso:idproceso(nombre), usuario:idusuario(nombre)"
      orderBy="fecha_inicio"
      searchKeys={['lote_cafe.variedad', 'proceso.nombre', 'usuario.nombre', 'notas']}
      searchPlaceholder="Buscar lote, proceso, responsable…"
      columns={[
        { key: 'idregistro_proceso', label: 'ID' },
        { key: 'lote_cafe',  label: 'Lote',        render: v => v?.variedad ?? '—' },
        { key: 'proceso',    label: 'Proceso',      render: v => v?.nombre ?? '—' },
        { key: 'usuario',    label: 'Responsable',  render: v => v?.nombre ?? '—' },
        { key: 'fecha_inicio', label: 'Inicio',     render: v => v ? new Date(v).toLocaleDateString('es-CO') : '—' },
        { key: 'fecha_fin',    label: 'Fin',        render: v => v ? new Date(v).toLocaleDateString('es-CO') : <span style={{ color:'var(--amber)' }}>En curso</span> },
        { key: 'calificacion', label: 'Calificación', sortable: true, render: v => v != null ? <strong style={{ color: Number(v)>=8.5?'var(--green)':Number(v)>=6?'var(--amber)':'var(--red,#f87171)' }}>{Number(v).toFixed(1)}/10</strong> : '—' },
        { key: 'notas',  label: 'Notas', render: v => v ? <span title={v} style={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any, overflow:'hidden', fontSize:'0.78rem' }}>{v}</span> : '—' },
      ]}
      fields={[
        { key: 'idlote_cafe',  label: 'ID Lote',           type: 'number', required: true, placeholder: 'ID del lote de café' },
        { key: 'idproceso',    label: 'ID Proceso',         type: 'number', required: true, placeholder: 'ID del proceso' },
        { key: 'idusuario',    label: 'ID Responsable',     type: 'number', placeholder: 'ID del usuario' },
        { key: 'calificacion', label: 'Calificación (0-10)', type: 'number', step: '0.1', min: '0', max: '10', placeholder: 'Ej: 8.5' },
        { key: 'fecha_inicio', label: 'Fecha inicio',       type: 'datetime-local', required: true },
        { key: 'fecha_fin',    label: 'Fecha fin',          type: 'datetime-local' },
        { key: 'notas', label: 'Notas', type: 'textarea', placeholder: 'Temperatura, pH, observaciones…', colSpan: 'full' },
      ]}
      filterSelects={[
        { key: 'idproceso', label: 'Proceso',     options: procesos },
        { key: 'idusuario', label: 'Responsable', options: usuarios },
      ]}
      dateFilters={[{ key: 'fecha_inicio', label: 'Fecha inicio' }]}
      rangeFilters={[{ key: 'calificacion', label: 'Calificación' }]}
    />
  )
}
