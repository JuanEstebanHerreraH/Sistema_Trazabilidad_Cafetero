/**
 * MiniBarChart — gráfico de barras SVG inline, sin librerías.
 * Pensado para visualizaciones compactas (ventas por mes, procesos
 * por semana, etc.) dentro de los portales.
 */

export interface MiniBarPoint {
  label: string     // ej: 'Ene', 'S1', '20/4'
  value: number     // valor numérico
  valueLabel?: string  // texto opcional en el tooltip (ej: '$1.5M')
}

interface Props {
  data: MiniBarPoint[]
  title?: string
  subtitle?: string
  height?: number           // altura del área del chart (px)
  formatValue?: (n: number) => string
  emptyMessage?: string
  accentVar?: string        // nombre de variable CSS para el color de barras
}

export default function MiniBarChart({
  data,
  title,
  subtitle,
  height = 140,
  formatValue,
  emptyMessage = 'Sin datos para mostrar.',
  accentVar,
}: Props) {
  const hasData = data.length > 0 && data.some(d => d.value > 0)

  if (!hasData) {
    return (
      <div className="mini-chart">
        {(title || subtitle) && (
          <div className="mini-chart-head">
            {title && <h3 className="mini-chart-title">{title}</h3>}
            {subtitle && <span className="mini-chart-sub">{subtitle}</span>}
          </div>
        )}
        <div className="mini-chart-empty">{emptyMessage}</div>
      </div>
    )
  }

  const fmt = formatValue ?? ((n: number) => n.toLocaleString('es-CO'))
  const max = Math.max(...data.map(d => d.value), 1)
  const n = data.length

  // Layout del SVG (coordenadas internas, se escala con width 100%)
  const W = 400
  const H = height
  const padL = 8
  const padR = 8
  const padTop = 20     // espacio para labels numéricos arriba
  const padBottom = 24  // espacio para labels X abajo
  const chartW = W - padL - padR
  const chartH = H - padTop - padBottom
  const slot = chartW / n
  const barW = Math.min(slot * 0.62, 44)

  const barStyle = accentVar ? { fill: `var(${accentVar})` } : undefined

  return (
    <div className="mini-chart">
      {(title || subtitle) && (
        <div className="mini-chart-head">
          {title && <h3 className="mini-chart-title">{title}</h3>}
          {subtitle && <span className="mini-chart-sub">{subtitle}</span>}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={title ?? 'Gráfico'}>
        {/* Eje X (línea base sutil) */}
        <line
          x1={padL}
          y1={H - padBottom}
          x2={W - padR}
          y2={H - padBottom}
          className="mini-chart-axis"
        />

        {data.map((p, i) => {
          const h = (p.value / max) * chartH
          const x = padL + i * slot + (slot - barW) / 2
          const y = H - padBottom - h
          const showValue = p.value > 0
          return (
            <g key={i}>
              {/* Barra */}
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={4}
                ry={4}
                className="mini-chart-bar"
                style={barStyle}
              >
                <title>{`${p.label}: ${p.valueLabel ?? fmt(p.value)}`}</title>
              </rect>
              {/* Valor arriba de cada barra */}
              {showValue && (
                <text
                  x={x + barW / 2}
                  y={y - 5}
                  textAnchor="middle"
                  className="mini-chart-value"
                >
                  {p.valueLabel ?? fmt(p.value)}
                </text>
              )}
              {/* Label debajo */}
              <text
                x={x + barW / 2}
                y={H - padBottom + 15}
                textAnchor="middle"
                className="mini-chart-label"
              >
                {p.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
