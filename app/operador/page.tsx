'use client'
import React from 'react'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '../../utils/supabase/client'

interface UsuarioPortal { idusuario: number; nombre: string; email: string }

export default function OperadorPage() {
  const supabase = createClient()
  const [usuario, setUsuario] = useState<UsuarioPortal | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      let { data } = await supabase.from('usuario')
        .select('idusuario, nombre, email, rol:idrol(nombre)')
        .eq('auth_uid', user.id).maybeSingle()
      if (!data && user.email) {
        const r = await supabase.from('usuario')
          .select('idusuario, nombre, email, rol:idrol(nombre)')
          .eq('email', user.email).maybeSingle()
        data = r.data
      }
      const rol = (data as any)?.rol?.nombre
      if (rol === 'Administrador') { window.location.href = '/admin'; return }
      if (rol !== 'Operador') { window.location.href = '/portal'; return }
      setUsuario(data as any)
      setLoading(false)
    })()
  }, [])

  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = '/login' }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="loading-center"><div className="spinner" /><span>Cargando portal operador…</span></div>
    </div>
  )

  if (!usuario) return null
  return <PortalOperador usuario={usuario} onLogout={handleLogout} />
}

function PortalOperador({ usuario, onLogout }: { usuario: UsuarioPortal; onLogout: () => void }) {
  const supabase = createClient()
  const [tab, setTab] = useState<'lotes' | 'movimientos' | 'registros'>('lotes')
  const [lotes, setLotes] = useState<any[]>([])
  const [movimientos, setMovimientos] = useState<any[]>([])
  const [registros, setRegistros] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: l }, { data: m }, { data: r }] = await Promise.all([
      supabase.from('lote_cafe').select('idlote_cafe, variedad, peso_kg, estado, precio_kg, finca:idfinca(nombre)').order('created_at', { ascending: false }).limit(60),
      supabase.from('movimiento_inventario').select('idmovimiento_inventario, tipo, fecha_movimiento, cantidad, notas, lote_cafe:idlote_cafe(variedad), almacen_origen:idalmacen_origen(nombre), almacen_destino:idalmacen_destino(nombre)').order('fecha_movimiento', { ascending: false }).limit(60),
      supabase.from('registro_proceso').select('idregistro_proceso, fecha_inicio, fecha_fin, notas, lote_cafe:idlote_cafe(variedad, peso_kg), proceso:idproceso(nombre)').order('fecha_inicio', { ascending: false }).limit(60),
    ])
    setLotes(l ?? [])
    setMovimientos(m ?? [])
    setRegistros(r ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { cargar() }, [cargar])

  const estadoBadge: Record<string, string> = { disponible: 'badge-green', en_proceso: 'badge-amber', vendido: 'badge-blue', exportado: 'badge-purple' }
  const tipoBadge: Record<string, string> = { entrada: 'badge-green', salida: 'badge-red', traslado: 'badge-blue' }

  const totalKgDisponible = lotes.filter(l => l.estado === 'disponible').reduce((s: number, l: any) => s + Number(l.peso_kg ?? 0), 0)
  const totalKgEnProceso  = lotes.filter(l => l.estado === 'en_proceso').reduce((s: number, l: any) => s + Number(l.peso_kg ?? 0), 0)

  return (
    <div className="portal-layout">
      <header className="portal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, var(--primary), var(--primary-deep))', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', boxShadow: '0 2px 10px var(--primary-glow)' }}>☕</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>CaféTrace</div>
            <div style={{ fontSize: '0.67rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>⚙️ Operador</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.84rem', color: 'var(--text)', fontWeight: 600 }}>{usuario.nombre}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{usuario.email}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onLogout}>Salir</button>
        </div>
      </header>

      <main className="portal-main">
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--text)', marginBottom: '0.2rem' }}>
            Portal Operador
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.84rem' }}>
            Gestión operativa de inventario, lotes y procesos de beneficio.
          </p>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          {[
            { icon: '☕', label: 'Lotes totales',     val: lotes.length,         color: 'var(--primary)' },
            { icon: '✅', label: 'Kg disponibles',    val: `${totalKgDisponible.toLocaleString('es-CO')} kg`, color: 'var(--green)' },
            { icon: '⚙️', label: 'Kg en proceso',    val: `${totalKgEnProceso.toLocaleString('es-CO')} kg`,  color: 'var(--amber)' },
            { icon: '🔄', label: 'Movimientos hoy',   val: movimientos.filter(m => new Date(m.fecha_movimiento).toDateString() === new Date().toDateString()).length, color: 'var(--blue)' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ '--accent': s.color } as any}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="tabs">
          {([
            ['lotes',       `☕ Lotes (${lotes.length})`],
            ['movimientos', `🔄 Movimientos (${movimientos.length})`],
            ['registros',   `⚙️ Procesos (${registros.length})`],
          ] as const).map(([t, lbl]) => (
            <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{lbl}</button>
          ))}
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
        ) : tab === 'lotes' ? (
          <OperadorLotes lotes={lotes} />
        ) : tab === 'movimientos' ? (
          <OperadorMovimientos movimientos={movimientos} />
        ) : (
          <OperadorProcesos registros={registros} />
        )}
      </main>
    </div>
  )
}

// ── Lotes with filters ─────────────────────────────────────────────────────────
function OperadorLotes({ lotes }: { lotes: any[] }) {
  const [busqueda, setBusqueda] = React.useState('')
  const [filtroEstado, setFiltroEstado] = React.useState('')
  const [showF, setShowF] = React.useState(false)

  const estadoBadge: Record<string, string> = { disponible: 'badge-green', en_proceso: 'badge-amber', vendido: 'badge-blue', exportado: 'badge-purple' }

  const filtrados = lotes.filter(l => {
    const q = busqueda.toLowerCase()
    return (!busqueda || l.variedad.toLowerCase().includes(q) || (l.finca?.nombre ?? '').toLowerCase().includes(q))
      && (!filtroEstado || l.estado === filtroEstado)
  })

  return (
    <>
      <div className="toolbar-v2">
        <div className="toolbar-search" style={{ flex: 1 }}>
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Buscar variedad o finca…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowF(v => !v)} style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
          ⚙ Filtros {filtroEstado && <span className="filter-badge">1</span>}
        </button>
        {(busqueda || filtroEstado) && <button className="filter-clear" onClick={() => { setBusqueda(''); setFiltroEstado('') }}>✕ Limpiar</button>}
        <span className="toolbar-count">{filtrados.length} lote{filtrados.length !== 1 ? 's' : ''}</span>
      </div>
      {showF && (
        <div className="filter-bar">
          <div className="filter-row">
            <span className="filter-label">Estado</span>
            <div className="filter-chips">
              {[{v:'',l:'Todos'},{v:'disponible',l:'✅ Disponible'},{v:'en_proceso',l:'⚙ En proceso'},{v:'vendido',l:'💰 Vendido'},{v:'exportado',l:'✈ Exportado'}]
                .map(o => <button key={o.v} className={`filter-chip${filtroEstado===o.v?' active':''}`} onClick={() => setFiltroEstado(o.v)}>{o.l}</button>)}
            </div>
          </div>
        </div>
      )}
      {filtrados.length === 0
        ? <div className="empty-state"><div className="empty-icon">☕</div><p>Sin lotes con esos filtros.</p></div>
        : (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
            {filtrados.map((l: any) => (
              <div key={l.idlote_cafe} className="record-card" style={{ display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap', padding:'0.65rem 1rem' }}>
                <div style={{ flex:'1 1 160px' }}>
                  <div style={{ fontWeight:700, color:'var(--text)', fontSize:'0.9rem' }}>{l.variedad}</div>
                  <div style={{ fontSize:'0.73rem', color:'var(--text-dim)' }}>🌿 {l.finca?.nombre ?? '—'}</div>
                </div>
                <div style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap', alignItems:'center' }}>
                  <div className="record-field">
                    <span className="record-field-label">Stock</span>
                    <span className="record-field-value" style={{ color:'var(--primary)' }}>{Number(l.peso_kg).toLocaleString('es-CO')} kg</span>
                  </div>
                  <div className="record-field">
                    <span className="record-field-label">Bultos</span>
                    <span className="record-field-value" style={{ color:'var(--amber)' }}>📦 {(l.peso_kg/70).toFixed(2)}</span>
                  </div>
                  <div className="record-field">
                    <span className="record-field-label">Precio/kg</span>
                    <span className="record-field-value">${Number(l.precio_kg??0).toLocaleString('es-CO')}</span>
                  </div>
                  <span className={`badge ${estadoBadge[l.estado]??'badge-muted'}`}>{l.estado?.replace('_',' ')}</span>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </>
  )
}

// ── Movimientos with filters ───────────────────────────────────────────────────
function OperadorMovimientos({ movimientos }: { movimientos: any[] }) {
  const [busqueda, setBusqueda] = React.useState('')
  const [filtroTipo, setFiltroTipo] = React.useState('')
  const [showF, setShowF] = React.useState(false)
  const [page, setPage] = React.useState(1)
  const PAGE = 15
  const tipoBadge: Record<string,string> = { entrada:'badge-green', salida:'badge-red', traslado:'badge-blue' }

  const filtrados = movimientos.filter(m => {
    const q = busqueda.toLowerCase()
    return (!busqueda || (m.lote_cafe?.variedad??'').toLowerCase().includes(q) || (m.almacen_origen?.nombre??'').toLowerCase().includes(q) || (m.almacen_destino?.nombre??'').toLowerCase().includes(q))
      && (!filtroTipo || m.tipo === filtroTipo)
  })
  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE))
  const paged = filtrados.slice((page-1)*PAGE, page*PAGE)

  return (
    <>
      <div className="toolbar-v2">
        <div className="toolbar-search" style={{ flex:1 }}>
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Buscar lote, origen, destino…" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPage(1) }} />
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowF(v=>!v)} style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
          ⚙ Filtros {filtroTipo && <span className="filter-badge">1</span>}
        </button>
        {(busqueda||filtroTipo) && <button className="filter-clear" onClick={() => { setBusqueda(''); setFiltroTipo(''); setPage(1) }}>✕ Limpiar</button>}
        <span className="toolbar-count">{filtrados.length} movimiento{filtrados.length!==1?'s':''}</span>
      </div>
      {showF && (
        <div className="filter-bar">
          <div className="filter-row">
            <span className="filter-label">Tipo</span>
            <div className="filter-chips">
              {[{v:'',l:'Todos'},{v:'entrada',l:'📥 Entrada'},{v:'salida',l:'📤 Salida'},{v:'traslado',l:'🔄 Traslado'}]
                .map(o => <button key={o.v} className={`filter-chip${filtroTipo===o.v?' active':''}`} onClick={() => { setFiltroTipo(o.v); setPage(1) }}>{o.l}</button>)}
            </div>
          </div>
        </div>
      )}
      {filtrados.length === 0
        ? <div className="empty-state"><div className="empty-icon">🔄</div><p>Sin movimientos con esos filtros.</p></div>
        : (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
              {paged.map((m: any) => (
                <div key={m.idmovimiento_inventario} className="record-card" style={{ display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap', padding:'0.6rem 1rem' }}>
                  <span className={`badge ${tipoBadge[m.tipo]??'badge-muted'}`} style={{ minWidth:68, justifyContent:'center', flexShrink:0 }}>
                    {m.tipo==='entrada'?'📥':m.tipo==='salida'?'📤':'🔄'} {m.tipo}
                  </span>
                  <div style={{ flex:'1 1 140px' }}>
                    <div style={{ fontWeight:700, color:'var(--text)', fontSize:'0.88rem' }}>{m.lote_cafe?.variedad??'—'}</div>
                    <div style={{ fontSize:'0.72rem', color:'var(--text-dim)' }}>{new Date(m.fecha_movimiento).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})}</div>
                  </div>
                  <div style={{ display:'flex', gap:'1.25rem', flexWrap:'wrap', alignItems:'center' }}>
                    <div className="record-field"><span className="record-field-label">Cantidad</span><span className="record-field-value" style={{ color:'var(--primary)' }}>{Number(m.cantidad).toLocaleString('es-CO')} kg</span></div>
                    <div className="record-field"><span className="record-field-label">Origen</span><span className="record-field-value">{m.almacen_origen?.nombre??'—'}</span></div>
                    <div className="record-field"><span className="record-field-label">Destino</span><span className="record-field-value">{m.almacen_destino?.nombre??'—'}</span></div>
                    {m.notas && <div className="record-field" style={{ maxWidth:160 }}><span className="record-field-label">Notas</span><span className="record-field-value" style={{ fontWeight:400, fontSize:'0.74rem', color:'var(--text-muted)' }}>{String(m.notas).slice(0,50)}{m.notas.length>50?'…':''}</span></div>}
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="pagination-bar">
                <div className="pagination-info">{(page-1)*PAGE+1}–{Math.min(filtrados.length,page*PAGE)} de {filtrados.length}</div>
                <div className="pagination-controls">
                  <button className="page-btn page-btn-wide" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>← Ant</button>
                  {Array.from({length:totalPages},(_,i)=>i+1).filter(p=>p===1||p===totalPages||Math.abs(p-page)<=1)
                    .reduce<(number|'…')[]>((acc,p,i,arr)=>{ if(i>0&&(p as number)-(arr[i-1] as number)>1)acc.push('…'); acc.push(p); return acc },[])
                    .map((p,i)=> p==='…'?<span key={`e${i}`} className="page-ellipsis">…</span>
                      :<button key={p} className={`page-btn${page===p?' active':''}`} onClick={()=>setPage(p as number)}>{p}</button>)}
                  <button className="page-btn page-btn-wide" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Sig →</button>
                </div>
              </div>
            )}
          </>
        )
      }
    </>
  )
}

// ── Procesos with filters ──────────────────────────────────────────────────────
function OperadorProcesos({ registros }: { registros: any[] }) {
  const [busqueda, setBusqueda] = React.useState('')
  const [filtroProceso, setFiltroProceso] = React.useState('')
  const [showF, setShowF] = React.useState(false)
  const [expanded, setExpanded] = React.useState<number|null>(null)

  const procesosUnicos = Array.from(new Set(registros.map(r => r.proceso?.nombre).filter(Boolean)))
  const filtrados = registros.filter(r => {
    const q = busqueda.toLowerCase()
    return (!busqueda || (r.lote_cafe?.variedad??'').toLowerCase().includes(q) || (r.proceso?.nombre??'').toLowerCase().includes(q))
      && (!filtroProceso || r.proceso?.nombre === filtroProceso)
  })

  const diffDias = (r: any) => {
    if (!r.fecha_inicio || !r.fecha_fin) return null
    const h = (new Date(r.fecha_fin).getTime() - new Date(r.fecha_inicio).getTime()) / 36e5
    return h < 24 ? `${Math.round(h)}h` : `${Math.round(h/24)}d`
  }

  return (
    <>
      <div className="toolbar-v2">
        <div className="toolbar-search" style={{ flex:1 }}>
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Buscar lote o proceso…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        {procesosUnicos.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={() => setShowF(v=>!v)} style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
            ⚙ Filtros {filtroProceso && <span className="filter-badge">1</span>}
          </button>
        )}
        {(busqueda||filtroProceso) && <button className="filter-clear" onClick={() => { setBusqueda(''); setFiltroProceso('') }}>✕ Limpiar</button>}
        <span className="toolbar-count">{filtrados.length} registro{filtrados.length!==1?'s':''}</span>
      </div>
      {showF && procesosUnicos.length > 0 && (
        <div className="filter-bar">
          <div className="filter-row">
            <span className="filter-label">Proceso</span>
            <div className="filter-chips">
              <button className={`filter-chip${filtroProceso===''?' active':''}`} onClick={() => setFiltroProceso('')}>Todos</button>
              {procesosUnicos.map(p => (
                <button key={p} className={`filter-chip chip-amber${filtroProceso===p?' active':''}`} onClick={() => setFiltroProceso(p)}>{p}</button>
              ))}
            </div>
          </div>
        </div>
      )}
      {filtrados.length === 0
        ? <div className="empty-state"><div className="empty-icon">⚙️</div><p>Sin registros con esos filtros.</p></div>
        : (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem' }}>
            {filtrados.map((r: any) => {
              const isOpen = expanded === r.idregistro_proceso
              const dur = diffDias(r)
              return (
                <div key={r.idregistro_proceso} style={{ background:'var(--bg-card)', border:`1px solid ${isOpen?'var(--primary)':'var(--border-soft)'}`, borderRadius:'var(--r-lg)', overflow:'hidden', transition:'border-color 0.15s' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.55rem 0.9rem', cursor:'pointer', flexWrap:'wrap' }}
                    onClick={() => setExpanded(isOpen ? null : r.idregistro_proceso)}>
                    <span className="badge badge-amber" style={{ fontSize:'0.65rem', padding:'0.1rem 0.4rem', flexShrink:0 }}>{r.proceso?.nombre??'—'}</span>
                    <span style={{ fontWeight:700, color:'var(--text)', fontSize:'0.86rem', flex:1, minWidth:100 }}>☕ {r.lote_cafe?.variedad??'—'}</span>
                    <span style={{ fontSize:'0.78rem', color:'var(--text-dim)' }}>{new Date(r.fecha_inicio).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})}</span>
                    {dur && <span className="badge badge-blue" style={{ fontSize:'0.62rem' }}>{dur}</span>}
                    <span style={{ marginLeft:'auto', color:'var(--text-muted)', fontSize:'0.75rem' }}>{isOpen?'▲':'▼'}</span>
                  </div>
                  {isOpen && (
                    <div style={{ borderTop:'1px solid var(--border-soft)', padding:'0.65rem 0.9rem', background:'var(--bg-1)' }}>
                      <div style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap', marginBottom:'0.3rem' }}>
                        <div className="record-field"><span className="record-field-label">Inicio</span><span className="record-field-value">{new Date(r.fecha_inicio).toLocaleDateString('es-CO',{dateStyle:'medium'})}</span></div>
                        <div className="record-field"><span className="record-field-label">Fin</span><span className="record-field-value">{r.fecha_fin ? new Date(r.fecha_fin).toLocaleDateString('es-CO',{dateStyle:'medium'}) : '—'}</span></div>
                        {r.lote_cafe?.peso_kg && <div className="record-field"><span className="record-field-label">Kg lote</span><span className="record-field-value">{Number(r.lote_cafe.peso_kg).toLocaleString('es-CO')} kg</span></div>}
                      </div>
                      {r.notas && <div style={{ fontSize:'0.77rem', color:'var(--text-dim)', marginTop:'0.2rem' }}>📝 {r.notas}</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      }
    </>
  )
}
