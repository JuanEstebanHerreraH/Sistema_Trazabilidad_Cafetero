'use client'
import { useState, useMemo, ReactNode, useCallback } from 'react'
import { useCrud } from '../hooks/useCrud'
import Modal from './Modal'

export interface Column {
  key: string; label: string
  render?: (value: any, row: any) => ReactNode
  sortable?: boolean
}
export interface Field {
  key?: string; section?: string; label?: string; type?: string
  required?: boolean; placeholder?: string; description?: string
  options?: { value: any; label: string }[]
  default?: any; step?: string; min?: string; max?: string
  colSpan?: 'full' | 'half'
}
export interface FilterSelect {
  key: string; label: string
  options: { value: string; label: string }[]
}
export interface DateRangeFilter { key: string; label: string }
export interface RangeFilter {
  key: string; label: string; unit?: string
  getValue?: (row: any) => number
}

interface Props {
  title: string; subtitle?: string; icon: string
  table: string; idField: string; selectQuery?: string; orderBy?: string
  columns: Column[]; fields: Field[]
  searchKey?: string; searchKeys?: string[]; searchPlaceholder?: string
  extraActions?: (row: any) => ReactNode
  filterSelects?: FilterSelect[]
  dateFilters?: DateRangeFilter[]
  rangeFilters?: RangeFilter[]
}

type SortDir = 'asc' | 'desc' | null

const IBG = 'var(--bg-input)'
const BRD = '1px solid var(--border)'
const ACT_BRD = '1px solid var(--primary)'
const ACT_BG  = 'rgba(196,122,44,0.08)'
const RMD = 'var(--r-md)'
const FONT = 'var(--font-body)'
const TXT = 'var(--text)'

function inp(active: boolean): React.CSSProperties {
  return { flex: 1, height: 36, background: active ? ACT_BG : IBG, border: active ? ACT_BRD : BRD, borderRadius: RMD, color: TXT, fontSize: '0.82rem', fontFamily: FONT, padding: '0 0.5rem', outline: 'none' }
}

export default function CrudPage({
  title, subtitle, icon, table, idField,
  selectQuery = '*', orderBy, columns, fields,
  searchKey, searchKeys, searchPlaceholder,
  extraActions, filterSelects, dateFilters, rangeFilters,
}: Props) {
  const { data, loading, error, insert, update, remove } = useCrud(table, idField, selectQuery, orderBy)

  const [search, setSearch]     = useState('')
  const [fv, setFv]             = useState<Record<string,string>>({})
  const [df, setDf]             = useState<Record<string,string>>({})
  const [dt, setDt]             = useState<Record<string,string>>({})
  const [rmin, setRmin]         = useState<Record<string,string>>({})
  const [rmax, setRmax]         = useState<Record<string,string>>({})
  const [open, setOpen]         = useState(false)
  const [sortKey, setSortKey]   = useState<string|null>(null)
  const [sortDir, setSortDir]   = useState<SortDir>(null)
  const [page, setPage]         = useState(1)
  const PAGE = 15

  const [modal, setModal]       = useState(false)
  const [viewM, setViewM]       = useState(false)
  const [viewR, setViewR]       = useState<any>(null)
  const [editR, setEditR]       = useState<any>(null)
  const [form, setForm]         = useState<Record<string,any>>({})
  const [saving, setSaving]     = useState(false)
  const [fErr, setFErr]         = useState<string|null>(null)
  const [delId, setDelId]       = useState<any>(null)
  const [deling, setDeling]     = useState(false)

  const dfields = useMemo(() => fields.filter(f => !!f.key), [fields])
  const skeys: string[] = searchKeys ?? (searchKey ? [searchKey] : [])

  const nActive = useMemo(() => {
    let n = 0
    filterSelects?.forEach(fs => { if (fv[fs.key]) n++ })
    dateFilters?.forEach(d => { if (df[d.key] || dt[d.key]) n++ })
    rangeFilters?.forEach(r => { if (rmin[r.key] || rmax[r.key]) n++ })
    return n
  }, [fv, df, dt, rmin, rmax, filterSelects, dateFilters, rangeFilters])

  const hasAny = !!(search || nActive)

  const clearAll = useCallback(() => {
    setSearch(''); setFv({}); setDf({}); setDt({}); setRmin({}); setRmax({}); setPage(1)
  }, [])

  const gv = (row: any, path: string) =>
    String(path.split('.').reduce((a: any, k: string) => a?.[k], row) ?? '').toLowerCase()

  const filtered = useMemo(() => {
    let r = data
    if (search && skeys.length > 0) {
      const q = search.toLowerCase()
      r = r.filter(row => skeys.some(k => gv(row, k).includes(q)))
    }
    filterSelects?.forEach(fs => { const v = fv[fs.key]; if (v) r = r.filter(row => String(row[fs.key]??'') === v) })
    dateFilters?.forEach(d => {
      if (df[d.key]) r = r.filter(row => row[d.key] && new Date(row[d.key]) >= new Date(df[d.key]))
      if (dt[d.key]) r = r.filter(row => row[d.key] && new Date(row[d.key]) <= new Date(dt[d.key]+'T23:59:59'))
    })
    rangeFilters?.forEach(rf => {
      const g = rf.getValue ?? ((row: any) => Number(row[rf.key]??0))
      if (rmin[rf.key]) r = r.filter(row => g(row) >= Number(rmin[rf.key]))
      if (rmax[rf.key]) r = r.filter(row => g(row) <= Number(rmax[rf.key]))
    })
    if (sortKey && sortDir) {
      r = [...r].sort((a,b) => {
        const c = String(a[sortKey]??'').localeCompare(String(b[sortKey]??''), 'es', { numeric: true })
        return sortDir === 'asc' ? c : -c
      })
    }
    return r
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, search, fv, df, dt, rmin, rmax, filterSelects, dateFilters, rangeFilters, sortKey, sortDir])

  const pages = Math.ceil(filtered.length / PAGE)
  const paged = filtered.slice((page-1)*PAGE, page*PAGE)
  const rp = () => setPage(1)

  const toggleSort = (k: string) => {
    if (sortKey===k) { if (sortDir==='asc') setSortDir('desc'); else { setSortKey(null); setSortDir(null) } }
    else { setSortKey(k); setSortDir('asc') }
  }

  const openCreate = () => {
    const d: Record<string,any> = {}; dfields.forEach(f => { d[f.key!] = f.default??'' })
    setForm(d); setEditR(null); setFErr(null); setModal(true)
  }
  const openEdit = (rec: any) => {
    const c: Record<string,any> = {}; dfields.forEach(f => { c[f.key!] = rec[f.key!]??'' })
    setForm(c); setEditR(rec); setFErr(null); setModal(true)
  }
  const openView = (rec: any) => { setViewR(rec); setViewM(true) }

  const handleSave = async () => {
    setSaving(true); setFErr(null)
    try {
      const p: Record<string,any> = {}
      dfields.forEach(f => {
        const v = form[f.key!]
        if (v===''||v==null) p[f.key!] = f.required ? v : null
        else if (f.type==='number') p[f.key!] = Number(v)
        else p[f.key!] = v
      })
      if (editR) await update(editR[idField], p); else await insert(p)
      setModal(false)
    } catch(e: any) { setFErr(e.message) }
    finally { setSaving(false) }
  }

  const handleDel = async () => {
    setDeling(true)
    try { await remove(delId); setDelId(null) }
    catch(e: any) { alert('Error: '+e.message) }
    finally { setDeling(false) }
  }

  const rf = (field: Field) => (
    <div className="form-group" key={field.key}
      style={field.colSpan==='full'||field.type==='textarea' ? { gridColumn:'1/-1' } : {}}>
      <label className="form-label">{field.label}{field.required&&<span className="form-required">*</span>}</label>
      {field.type==='select' ? (
        <select className="form-select" value={form[field.key!]??''} onChange={e => setForm(p=>({...p,[field.key!]:e.target.value}))}>
          <option value="">— Selecciona —</option>
          {(field.options??[]).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : field.type==='textarea' ? (
        <textarea className="form-textarea" value={form[field.key!]??''} style={{ minHeight:100, resize:'vertical' }}
          onChange={e=>setForm(p=>({...p,[field.key!]:e.target.value}))} placeholder={field.placeholder??''} />
      ) : (
        <input className="form-input" type={field.type??'text'} value={form[field.key!]??''}
          onChange={e=>setForm(p=>({...p,[field.key!]:e.target.value}))}
          placeholder={field.placeholder??''} required={field.required}
          step={field.type==='number'?(field.step??'any'):undefined} min={field.min} max={field.max} />
      )}
      {field.description&&<p className="form-hint">💡 {field.description}</p>}
    </div>
  )

  const dv = (row: any, key: string) => {
    const col = columns.find(c=>c.key===key); const raw = row[key]
    if (col?.render) { try { return col.render(raw,row) } catch { return String(raw??'—') } }
    if (raw==null) return '—'; if (typeof raw==='object') return JSON.stringify(raw); return String(raw)
  }

  const hasPanel = !!(
    (filterSelects&&filterSelects.length>0) ||
    (dateFilters&&dateFilters.length>0) ||
    (rangeFilters&&rangeFilters.length>0)
  )
  const hasSearch = skeys.length > 0

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-icon">{icon}</div>
          <div><h2>{title}</h2>{subtitle&&<p className="page-subtitle">{subtitle}</p>}</div>
        </div>
        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
          {hasPanel && (
            <button onClick={()=>setOpen(v=>!v)} style={{
              display:'inline-flex', alignItems:'center', gap:'0.4rem',
              height:38, padding:'0 1rem', borderRadius:RMD,
              border: open||nActive>0 ? ACT_BRD : BRD,
              background: open||nActive>0 ? 'rgba(196,122,44,0.12)' : IBG,
              color: open||nActive>0 ? 'var(--primary)' : 'var(--text-soft)',
              fontSize:'0.84rem', fontFamily:FONT, cursor:'pointer', fontWeight:600,
            }}>
              🎯 Filtros
              {nActive>0 && (
                <span style={{ minWidth:20, height:20, borderRadius:99, background:'var(--primary)', color:'#fff', fontSize:'0.65rem', fontWeight:700, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                  {nActive}
                </span>
              )}
              <span style={{ opacity:0.5, fontSize:'0.7rem' }}>{open?'▲':'▼'}</span>
            </button>
          )}
          <button className="btn btn-primary" onClick={openCreate}>+ Nuevo</button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom:'1rem' }}>⚠ {error}</div>}

      {/* Toolbar: search + clear + count */}
      {(hasSearch || hasPanel) && (
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap', marginBottom:'0.75rem' }}>
          {hasSearch && (
            <div style={{ position:'relative', flex:1, minWidth:180, maxWidth:360 }}>
              <span style={{ position:'absolute', left:'0.7rem', top:'50%', transform:'translateY(-50%)', opacity:0.4, pointerEvents:'none' }}>🔍</span>
              <input type="text" placeholder={searchPlaceholder??'Buscar…'} value={search}
                onChange={e=>{ setSearch(e.target.value); rp() }}
                style={{ width:'100%', height:36, background:IBG, border:BRD, borderRadius:RMD, padding:'0 0.9rem 0 2.1rem', color:TXT, fontSize:'0.84rem', fontFamily:FONT, outline:'none' }} />
            </div>
          )}
          {hasAny && (
            <button onClick={clearAll} style={{ height:36, padding:'0 0.8rem', background:'transparent', border:BRD, borderRadius:RMD, color:'var(--text-muted)', fontSize:'0.8rem', fontFamily:FONT, cursor:'pointer' }}>
              ✕ Limpiar
            </button>
          )}
          <span style={{ fontSize:'0.78rem', color:'var(--text-dim)', fontWeight:500, marginLeft:'auto' }}>
            {filtered.length}{data.length!==filtered.length&&<span style={{ color:'var(--text-muted)', fontWeight:400 }}> / {data.length}</span>}
          </span>
        </div>
      )}

      {/* Filter Panel */}
      {open && hasPanel && (
        <div style={{ background:'var(--bg-card)', border:BRD, borderRadius:'var(--r-lg)', padding:'1rem 1.25rem', marginBottom:'1rem' }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'1rem', alignItems:'flex-end' }}>
            {filterSelects?.map(fs=>(
              <div key={fs.key} style={{ display:'flex', flexDirection:'column', gap:'0.3rem', minWidth:160 }}>
                <label style={{ fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)' }}>{fs.label}</label>
                <select value={fv[fs.key]??''} onChange={e=>{ setFv(p=>({...p,[fs.key]:e.target.value})); rp() }}
                  style={{ height:38, minWidth:160, background:fv[fs.key]?ACT_BG:IBG, border:fv[fs.key]?ACT_BRD:BRD, borderRadius:RMD, color:TXT, fontSize:'0.84rem', fontFamily:FONT, padding:'0 0.6rem', outline:'none', cursor:'pointer' }}>
                  <option value="">— Todos —</option>
                  {fs.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
            {dateFilters?.map(d=>{
              const ac = !!(df[d.key]||dt[d.key])
              const dateStyle: React.CSSProperties = { height:38, width:140, background:ac?ACT_BG:IBG, border:ac?ACT_BRD:BRD, borderRadius:RMD, color:TXT, fontSize:'0.84rem', fontFamily:FONT, padding:'0 0.5rem', outline:'none' }
              return (
                <div key={d.key} style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
                  <label style={{ fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)' }}>📅 {d.label}</label>
                  <div style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
                    <input type="date" value={df[d.key]??''} onChange={e=>{ setDf(p=>({...p,[d.key]:e.target.value})); rp() }} style={dateStyle} />
                    <span style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>–</span>
                    <input type="date" value={dt[d.key]??''} onChange={e=>{ setDt(p=>({...p,[d.key]:e.target.value})); rp() }} style={dateStyle} />
                  </div>
                </div>
              )
            })}
            {rangeFilters?.map(r=>{
              const ac = !!(rmin[r.key]||rmax[r.key])
              const numStyle: React.CSSProperties = { height:38, width:110, background:ac?ACT_BG:IBG, border:ac?ACT_BRD:BRD, borderRadius:RMD, color:TXT, fontSize:'0.84rem', fontFamily:FONT, padding:'0 0.5rem', outline:'none' }
              return (
                <div key={r.key} style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
                  <label style={{ fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)' }}>{r.label}{r.unit?` (${r.unit})`:''}</label>
                  <div style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
                    <input type="number" placeholder="Mín" value={rmin[r.key]??''} onChange={e=>{ setRmin(p=>({...p,[r.key]:e.target.value})); rp() }} style={numStyle} />
                    <span style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>–</span>
                    <input type="number" placeholder="Máx" value={rmax[r.key]??''} onChange={e=>{ setRmax(p=>({...p,[r.key]:e.target.value})); rp() }} style={numStyle} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="loading-center"><div className="spinner"/><span>Cargando…</span></div>
      ) : filtered.length===0 ? (
        <div className="empty-state">
          <div className="empty-icon">{icon}</div>
          <p>No hay registros{hasAny?' que coincidan con los filtros':''}.</p>
          {!hasAny && <small>Haz clic en &quot;+ Nuevo&quot; para agregar el primero.</small>}
          {hasAny && <button className="btn btn-ghost btn-sm" onClick={clearAll} style={{ marginTop:'0.5rem' }}>✕ Limpiar filtros</button>}
        </div>
      ) : (
        <div className="data-table-wrap table-responsive">
          <table className="data-table">
            <thead><tr>
              {columns.map(col=>(
                <th key={col.key} className={col.sortable?'th-sortable':''} onClick={col.sortable?()=>toggleSort(col.key):undefined}>
                  {col.label}
                  {col.sortable&&<span className={`sort-icon${sortKey===col.key?(sortDir==='asc'?' asc':' desc'):''}`}>{sortKey===col.key?(sortDir==='asc'?' ↑':' ↓'):' ↕'}</span>}
                </th>
              ))}
              <th>Acciones</th>
            </tr></thead>
            <tbody>
              {paged.map(row=>(
                <tr key={row[idField]}>
                  {columns.map(col=>(
                    <td key={col.key}>{col.render?col.render(row[col.key],row):(row[col.key]??<span style={{ color:'var(--text-muted)' }}>—</span>)}</td>
                  ))}
                  <td>
                    <div className="actions">
                      <button className="btn btn-ghost btn-sm" onClick={()=>openView(row)}>👁</button>
                      <button className="btn btn-secondary btn-sm" onClick={()=>openEdit(row)}>✏ Editar</button>
                      {extraActions?.(row)}
                      <button className="btn btn-danger btn-sm" onClick={()=>setDelId(row[idField])}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading&&pages>1&&(
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'0.75rem', flexWrap:'wrap', gap:'0.5rem' }}>
          <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{(page-1)*PAGE+1}–{Math.min(page*PAGE,filtered.length)} de {filtered.length}</span>
          <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap' }}>
            <button className="btn btn-ghost btn-sm" disabled={page===1} onClick={()=>setPage(p=>p-1)}>‹ Ant</button>
            {Array.from({length:Math.min(pages,5)},(_,i)=>Math.max(1,Math.min(pages-4,page-2))+i).map(p=>(
              <button key={p} className={`btn btn-sm ${p===page?'btn-primary':'btn-ghost'}`} onClick={()=>setPage(p)}>{p}</button>
            ))}
            <button className="btn btn-ghost btn-sm" disabled={page===pages} onClick={()=>setPage(p=>p+1)}>Sig ›</button>
          </div>
        </div>
      )}

      {/* View Modal */}
      <Modal isOpen={viewM} onClose={()=>setViewM(false)} title={`Detalle — ${title}`}
        footer={<><button className="btn btn-secondary" onClick={()=>setViewM(false)}>Cerrar</button><button className="btn btn-primary" onClick={()=>{setViewM(false);openEdit(viewR)}}>✏ Editar</button></>}>
        {viewR&&<div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
          {columns.map(col=>(
            <div key={col.key} style={{ display:'flex', justifyContent:'space-between', gap:'1rem', padding:'0.5rem 0', borderBottom:'1px solid var(--border-soft)' }}>
              <span style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', flexShrink:0 }}>{col.label}</span>
              <span style={{ fontSize:'0.84rem', color:'var(--text-soft)', textAlign:'right' }}>{dv(viewR,col.key)}</span>
            </div>
          ))}
        </div>}
      </Modal>

      {/* Create/Edit Modal */}
      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editR?`Editar — ${title}`:`Nuevo — ${title}`}
        footer={<><button className="btn btn-secondary" onClick={()=>setModal(false)} disabled={saving}>Cancelar</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'⏳ Guardando…':editR?'Guardar cambios':'Crear registro'}</button></>}>
        {fErr&&<div className="alert alert-error" style={{ marginBottom:'1rem' }}>⚠ {fErr}</div>}
        <div className="form-grid-2">
          {fields.map((field,i)=>field.section
            ? <div key={`s${i}`} style={{ gridColumn:'1/-1' }}><div className="form-section-title">{field.section}</div></div>
            : rf(field)
          )}
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={delId!==null} onClose={()=>setDelId(null)} title="Confirmar eliminación"
        footer={<><button className="btn btn-secondary" onClick={()=>setDelId(null)} disabled={deling}>Cancelar</button><button className="btn btn-danger" onClick={handleDel} disabled={deling}>{deling?'⏳ Eliminando…':'Sí, eliminar'}</button></>}>
        <p style={{ color:'var(--text-soft)', fontSize:'0.9rem', lineHeight:1.6 }}>¿Estás seguro? Esta acción <strong>no se puede deshacer</strong>.</p>
      </Modal>
    </div>
  )
}
