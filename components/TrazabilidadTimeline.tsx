/**
 * TrazabilidadTimeline — vista visual del recorrido completo de un lote
 * de café, pensada para usuario final. Timeline vertical con hitos
 * cronológicos: finca → cosecha → procesos → cata → bodegas → venta.
 */

interface LoteTrazabilidad {
  idlote_cafe: number
  variedad: string
  fecha_cosecha: string
  peso_kg: number
  precio_kg?: number | null
  finca?: {
    nombre: string
    ubicacion?: string | null
    productor?: { nombre: string } | null
  } | null
  registro_proceso?: {
    fecha_inicio?: string | null
    fecha_fin?: string | null
    responsable?: string | null
    proceso?: { nombre: string } | null
  }[]
}

interface VentaInfo {
  idventa: number
  fecha_venta: string
  cantidad: number
  precio_venta: number
}

export default function TrazabilidadTimeline({
  lote,
  venta,
}: {
  lote: LoteTrazabilidad
  venta?: VentaInfo | null
}) {
  const fmtFecha = (f: string | null | undefined) => {
    if (!f) return '—'
    try {
      return new Date(f).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return f
    }
  }

  const fmtCortaFecha = (f: string | null | undefined) => {
    if (!f) return '—'
    try {
      return new Date(f).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return f
    }
  }

  const procesos = (lote.registro_proceso ?? []).filter((p) => p.proceso?.nombre)

  return (
    <div className="trazabilidad-timeline">
      <div className="traz-titulo">
        <span>🌍</span>
        <span>Recorrido del café</span>
      </div>
      <div className="traz-sub">
        Cada paso registrado por quien lo hizo. Este es el viaje completo de tu <strong>{lote.variedad}</strong>.
      </div>

      <div className="traz-linea-vertical">
        {/* 1. FINCA */}
        {lote.finca && (
          <div className="traz-paso">
            <div className="traz-punto traz-p-finca" aria-hidden="true">🌱</div>
            <div className="traz-cuerpo">
              <div className="traz-etapa">Origen</div>
              <div className="traz-titulo-paso">
                {lote.finca.nombre}
              </div>
              <div className="traz-detalle">
                {lote.finca.productor
                  ? <>Cultivado por <strong>{lote.finca.productor.nombre}</strong>.</>
                  : <>Finca de origen del lote.</>}
                {lote.finca.ubicacion && <> Ubicada en <strong>{lote.finca.ubicacion}</strong>.</>}
              </div>
            </div>
          </div>
        )}

        {/* 2. COSECHA */}
        <div className="traz-paso">
          <div className="traz-punto traz-p-cosecha" aria-hidden="true">🌾</div>
          <div className="traz-cuerpo">
            <div className="traz-etapa">Cosecha</div>
            <div className="traz-titulo-paso">
              Variedad {lote.variedad}
            </div>
            <div className="traz-detalle">
              Café recogido en la finca. Lote registrado con identificador único
              para poder seguirlo en cada paso.
            </div>
            <div className="traz-metadatos">
              <span className="traz-meta">📅 <strong>{fmtFecha(lote.fecha_cosecha)}</strong></span>
              <span className="traz-meta">⚖️ Peso inicial <strong>{lote.peso_kg} kg</strong></span>
              <span className="traz-meta">🏷️ Lote <strong>#{lote.idlote_cafe}</strong></span>
            </div>
          </div>
        </div>

        {/* 3. PROCESOS (uno por cada registro_proceso) */}
        {procesos.length > 0 ? (
          procesos.map((p, i) => (
            <div className="traz-paso" key={`proc-${i}`}>
              <div className="traz-punto traz-p-proceso" aria-hidden="true">🧪</div>
              <div className="traz-cuerpo">
                <div className="traz-etapa">Proceso {i + 1}</div>
                <div className="traz-titulo-paso">
                  {p.proceso?.nombre}
                </div>
                <div className="traz-detalle">
                  Fase de beneficio del café. Es aquí donde se define parte
                  importante del sabor y aroma que vas a percibir en la taza.
                </div>
                <div className="traz-metadatos">
                  {p.fecha_inicio && (
                    <span className="traz-meta">
                      🟢 Inicio <strong>{fmtCortaFecha(p.fecha_inicio)}</strong>
                    </span>
                  )}
                  {p.fecha_fin && (
                    <span className="traz-meta">
                      🔴 Fin <strong>{fmtCortaFecha(p.fecha_fin)}</strong>
                    </span>
                  )}
                  {p.responsable && (
                    <span className="traz-meta">
                      👤 Por <strong>{p.responsable}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="traz-paso">
            <div className="traz-punto traz-p-proceso" aria-hidden="true">🧪</div>
            <div className="traz-cuerpo">
              <div className="traz-etapa">Procesos</div>
              <div className="traz-titulo-paso">Aún sin procesos registrados</div>
              <div className="traz-detalle">
                Cuando se registren los procesos aplicados a este lote,
                aparecerán aquí uno por uno.
              </div>
            </div>
          </div>
        )}

        {/* 4. VENTA (si aplica) */}
        {venta && (
          <div className="traz-paso">
            <div className="traz-punto traz-p-venta" aria-hidden="true">☕</div>
            <div className="traz-cuerpo">
              <div className="traz-etapa">Tu compra</div>
              <div className="traz-titulo-paso">
                Llegó a tu taza
              </div>
              <div className="traz-detalle">
                Este es el punto donde el café salió de nuestras bodegas
                y llegó a vos. Cerrando el círculo de trazabilidad.
              </div>
              <div className="traz-metadatos">
                <span className="traz-meta">📅 <strong>{fmtFecha(venta.fecha_venta)}</strong></span>
                <span className="traz-meta">⚖️ <strong>{venta.cantidad} kg</strong></span>
                <span className="traz-meta">
                  💰 <strong>${(venta.cantidad * venta.precio_venta).toLocaleString('es-CO')} COP</strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="traz-nota">
        <strong>✓ Trazabilidad verificada.</strong> Todos estos datos están
        registrados en nuestra base de datos con quién los cargó y cuándo.
        No se pueden modificar sin dejar rastro.
      </div>
    </div>
  )
}
