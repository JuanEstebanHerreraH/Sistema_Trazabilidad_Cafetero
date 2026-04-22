'use client'
import { useState, useEffect } from 'react'
import CrudPage from '../../../components/CrudPage'
import Modal from '../../../components/Modal'
import { createClient } from '../../../utils/supabase/client'

const ESTADOS = [
  { value: 'disponible', label: '🟢 Disponible' },
  { value: 'en_proceso', label: '🟡 En proceso' },
  { value: 'vendido',    label: '🔵 Vendido'    },
  { value: 'exportado',  label: '🟣 Exportado'  },
]
const estadoBadge: Record<string,string> = { disponible:'badge-green', en_proceso:'badge-amber', vendido:'badge-muted', exportado:'badge-blue' }

export default function LotesPage() {
  const [fincas,    setFincas]    = useState<{ value: string; label: string }[]>([])
  const [variedades,setVariedades] = useState<{ value: string; label: string }[]>([])
  const [traceModal, setTraceModal] = useState(false)
  const [traceData,  setTraceData]  = useState<any>(null)
  const [traceLoading, setTraceLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('finca').select('idfinca, nombre').order('nombre')
      .then(({ data }) => setFincas((data??[]).map((f:any) => ({ value: String(f.idfinca), label: f.nombre }))))
    supabase.from('lote_cafe').select('variedad').order('variedad')
      .then(({ data }) => {
        const unique = Array.from(new Set((data??[]).map((l:any)=>l.variedad).filter(Boolean)))
        setVariedades(unique.map(v => ({ value: String(v), label: String(v) })))
      })
  }, [])

  const verTrazabilidad = async (row: any) => {
    setTraceLoading(true); setTraceModal(true); setTraceData(null)
    const { data } = await supabase.from('lote_cafe').select(`
      idlote_cafe, variedad, fecha_cosecha, peso_kg, estado, precio_kg,
      finca(nombre, ubicacion, productor(nombre, region)),
      registro_proceso(proceso(nombre), fecha_inicio, fecha_fin, notas),
      movimiento_inventario(tipo, fecha_movimiento, cantidad, almacen_origen:idalmacen_origen(nombre), almacen_destino:idalmacen_destino(nombre), notas)
    `).eq('idlote_cafe', row.idlote_cafe).single()
    setTraceData(data); setTraceLoading(false)
  }

  return (
    <>
      <CrudPage
        title="Lotes de Café" subtitle="Gestión y trazabilidad completa de lotes" icon="☕"
        table="lote_cafe" idField="idlote_cafe"
        selectQuery="idlote_cafe, variedad, fecha_cosecha, peso_kg, estado, precio_kg, idfinca, finca:idfinca(nombre)"
        orderBy="fecha_cosecha"
        searchKeys={['variedad', 'finca.nombre']}
        searchPlaceholder="Buscar variedad o finca…"
        columns={[
          { key: 'idlote_cafe',   label: 'ID' },
          { key: 'variedad',      label: 'Variedad', render: v => <strong style={{ color:'var(--text)' }}>{v}</strong> },
          { key: 'finca',         label: 'Finca',    render: v => v?.nombre ?? '—' },
          { key: 'fecha_cosecha', label: 'Cosecha',  render: v => v ? new Date(v).toLocaleDateString('es-CO') : '—' },
          { key: 'peso_kg',       label: 'Peso (kg)', render: v => <span style={{ fontWeight:700, color:'var(--primary)' }}>{v} kg</span> },
          { key: 'precio_kg',     label: 'Precio/kg', render: v => `$${Number(v??0).toLocaleString('es-CO')}` },
          { key: 'estado',        label: 'Estado',   render: v => <span className={`badge ${estadoBadge[v]??'badge-muted'}`}>{v}</span> },
        ]}
        fields={[
          { key: 'variedad',      label: 'Variedad',      required: true, placeholder: 'Caturra, Geisha, Colombia…' },
          { key: 'fecha_cosecha', label: 'Fecha cosecha', type: 'date',   required: true },
          { key: 'peso_kg',       label: 'Peso (kg)',     type: 'number', required: true, placeholder: '500' },
          { key: 'precio_kg',     label: 'Precio/kg',     type: 'number', required: true, placeholder: '18500', description: 'Precio en COP' },
          { key: 'estado',        label: 'Estado',        type: 'select', required: true, default: 'disponible', options: ESTADOS },
          { key: 'idfinca',       label: 'ID Finca',      type: 'number', placeholder: 'ID de la finca' },
        ]}
        filterSelects={[
          { key: 'estado',    label: 'Estado',   options: ESTADOS },
          { key: 'idfinca',   label: 'Finca',    options: fincas },
          { key: 'variedad',  label: 'Variedad', options: variedades },
        ]}
        dateFilters={[{ key: 'fecha_cosecha', label: 'Fecha cosecha' }]}
        rangeFilters={[
          { key: 'peso_kg',   label: 'Stock',     unit: 'kg' },
          { key: 'precio_kg', label: 'Precio/kg', unit: 'COP' },
        ]}
        extraActions={row => (
          <button className="btn btn-ghost btn-sm" onClick={() => verTrazabilidad(row)}>🔍 Traza</button>
        )}
      />

      <Modal isOpen={traceModal} onClose={() => setTraceModal(false)} title="🔍 Trazabilidad del Lote" size="lg"
        footer={<button className="btn btn-secondary" onClick={() => setTraceModal(false)}>Cerrar</button>}>
        {traceLoading ? (
          <div className="loading-center"><div className="spinner"/><span>Cargando…</span></div>
        ) : traceData ? (
          <div>
            <div style={{ background:'var(--bg-1)', borderRadius:'var(--r-lg)', padding:'1rem', marginBottom:'1rem', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.75rem' }}>
              <div><div style={{ fontSize:'0.65rem', textTransform:'uppercase', color:'var(--text-muted)', fontWeight:700 }}>Variedad</div><div style={{ fontWeight:700, fontSize:'1.1rem' }}>{traceData.variedad}</div></div>
              <div><div style={{ fontSize:'0.65rem', textTransform:'uppercase', color:'var(--text-muted)', fontWeight:700 }}>Stock</div><div style={{ fontWeight:700, color:'var(--primary)' }}>{traceData.peso_kg} kg</div></div>
              <div><div style={{ fontSize:'0.65rem', textTransform:'uppercase', color:'var(--text-muted)', fontWeight:700 }}>Estado</div><span className={`badge ${estadoBadge[traceData.estado]??'badge-muted'}`}>{traceData.estado}</span></div>
            </div>
            {traceData.finca && <p style={{ fontSize:'0.84rem', color:'var(--text-soft)', marginBottom:'0.75rem' }}>🏡 {traceData.finca.nombre}{traceData.finca.ubicacion ? ` · ${traceData.finca.ubicacion}` : ''}{traceData.finca.productor ? ` · 👨‍🌾 ${traceData.finca.productor.nombre}` : ''}</p>}
            {(traceData.registro_proceso ?? []).map((r: any, i: number) => (
              <div key={i} style={{ background:'var(--bg)', borderRadius:'var(--r-md)', padding:'0.6rem 0.8rem', marginBottom:'0.4rem', fontSize:'0.82rem' }}>
                ⚙️ <strong>{r.proceso?.nombre}</strong> · {new Date(r.fecha_inicio).toLocaleDateString('es-CO')} → {r.fecha_fin ? new Date(r.fecha_fin).toLocaleDateString('es-CO') : 'En curso'}
                {r.notas && <div style={{ color:'var(--text-dim)', marginTop:'0.2rem' }}>📝 {r.notas}</div>}
              </div>
            ))}
            {(traceData.movimiento_inventario ?? []).map((m: any, i: number) => (
              <div key={i} style={{ background:'var(--bg)', borderRadius:'var(--r-md)', padding:'0.6rem 0.8rem', marginBottom:'0.4rem', fontSize:'0.82rem' }}>
                🏭 <strong>{m.tipo}</strong> · {m.cantidad} kg · {new Date(m.fecha_movimiento).toLocaleDateString('es-CO')}
                {m.almacen_origen && <> · De: {m.almacen_origen.nombre}</>}
                {m.almacen_destino && <> · A: {m.almacen_destino.nombre}</>}
              </div>
            ))}
          </div>
        ) : null}
      </Modal>
    </>
  )
}
