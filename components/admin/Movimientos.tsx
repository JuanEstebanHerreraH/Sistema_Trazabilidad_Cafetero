'use client'
import { useRead } from '../../hooks/useCrud'
import CrudPage from '../../components/CrudPage'

const TIPOS = ['entrada', 'salida', 'traslado']

const tipoBadge: Record<string,string> = {
  entrada:  'badge-green',
  salida:   'badge-red',
  traslado: 'badge-blue',
}

export default function Movimientos() {
  const { data: lotes }     = useRead('lote_cafe', 'idlote_cafe, variedad', 'variedad')
  const { data: almacenes } = useRead('almacen',   'idalmacen, nombre',     'nombre')
  const { data: usuarios }  = useRead('usuario',   'idusuario, nombre',     'nombre')

  const fields = [
    {
      key: 'tipo', label: 'Tipo de movimiento', type: 'select', required: true,
      options: TIPOS.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })),
      description: 'Entrada: café que llega a bodega. Salida: café que sale. Traslado: movimiento entre bodegas.',
    },
    {
      key: 'fecha_movimiento', label: 'Fecha y hora', type: 'datetime-local', required: true,
      description: 'Fecha y hora en que ocurrió físicamente el movimiento.',
    },
    {
      key: 'cantidad', label: 'Cantidad (kg)', type: 'number', required: true, step: '0.01', min: '0', placeholder: 'Ej: 500.00',
      description: 'Peso en kilogramos del café que se mueve.',
    },
    {
      key: 'idlote_cafe', label: 'Lote de café', type: 'select', required: true,
      options: lotes.map(l => ({ value: l.idlote_cafe, label: l.variedad })),
      description: 'Lote específico de café involucrado en este movimiento.',
    },
    { section: 'Origen y destino' } as any,
    {
      key: 'idalmacen_origen', label: 'Almacén origen', type: 'select', required: false,
      options: almacenes.map(a => ({ value: a.idalmacen, label: a.nombre })),
      description: 'Bodega desde donde sale el café. Vacío si es una entrada nueva.',
    },
    {
      key: 'idalmacen_destino', label: 'Almacén destino', type: 'select', required: false,
      options: almacenes.map(a => ({ value: a.idalmacen, label: a.nombre })),
      description: 'Bodega hacia donde llega el café. Vacío si es una salida definitiva.',
    },
    {
      key: 'idusuario_responsable', label: 'Responsable', type: 'select', required: false,
      options: usuarios.map(u => ({ value: u.idusuario, label: u.nombre })),
      description: 'Persona que autorizó o ejecutó el movimiento.',
    },
    { section: 'Observaciones' } as any,
    {
      key: 'notas', label: 'Notas', type: 'textarea', required: false, colSpan: 'full',
      placeholder: 'Número de guía, transportista, observaciones de calidad…',
      description: 'Información adicional: número de remisión, estado del café al recibirlo, etc.',
    },
  ]

  return (
    <CrudPage
      title="Movimientos de Inventario" subtitle="Entradas, salidas y traslados de café entre bodegas" icon="↕️"
      table="movimiento_inventario" idField="idmovimiento_inventario"
      selectQuery="*, lote_cafe(variedad), almacen_origen:almacen!idalmacen_origen(nombre), almacen_destino:almacen!idalmacen_destino(nombre), usuario:usuario!idusuario_responsable(nombre)"
      orderBy="fecha_movimiento"
      columns={[
        { key: 'idmovimiento_inventario', label: '#' },
        { key: 'tipo',              label: 'Tipo',     render: v => <span className={`badge ${tipoBadge[v]??'badge-amber'}`}>{v}</span> },
        { key: 'fecha_movimiento',  label: 'Fecha',    render: v => v ? new Date(v).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '—' },
        { key: 'cantidad',          label: 'Cantidad', render: v => <strong>{Number(v).toLocaleString('es-CO')} kg</strong> },
        { key: 'idlote_cafe',       label: 'Lote',     render: (_, r) => r.lote_cafe?.variedad || '—' },
        { key: 'idalmacen_origen',  label: 'Origen',   render: (_, r) => r.almacen_origen?.nombre  || <span style={{color:'var(--text-muted)'}}>—</span> },
        { key: 'idalmacen_destino', label: 'Destino',  render: (_, r) => r.almacen_destino?.nombre || <span style={{color:'var(--text-muted)'}}>—</span> },
      ]}
      fields={fields}
    />
  )
}
