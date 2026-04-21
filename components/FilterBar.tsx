'use client'
import { useState, ReactNode } from 'react'

export interface FilterBarProps {
  search?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string

  dateFrom?: string
  dateTo?: string
  onDateFromChange?: (v: string) => void
  onDateToChange?: (v: string) => void

  selects?: {
    label: string
    value: string
    onChange: (v: string) => void
    options: { value: string; label: string }[]
  }[]

  sortDir?: 'asc' | 'desc'
  onSortDirChange?: (v: 'asc' | 'desc') => void
  sortLabel?: string

  extra?: ReactNode

  onClear?: () => void
  activeCount?: number
}

export default function FilterBar({
  search, onSearchChange, searchPlaceholder = 'Buscar…',
  dateFrom, dateTo, onDateFromChange, onDateToChange,
  selects = [],
  sortDir, onSortDirChange, sortLabel = 'Fecha',
  extra, onClear, activeCount = 0,
}: FilterBarProps) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ marginBottom: '1rem' }}>
      {/* Top row: search + toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {onSearchChange && (
          <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
            <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem', pointerEvents: 'none' }}>🔍</span>
            <input
              className="form-input"
              style={{ paddingLeft: '2rem', height: 38 }}
              placeholder={searchPlaceholder}
              value={search ?? ''}
              onChange={e => onSearchChange(e.target.value)}
            />
          </div>
        )}

        {(selects.length > 0 || onDateFromChange || onSortDirChange) && (
          <button
            className={`btn btn-sm ${open ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setOpen(v => !v)}
            style={{ gap: '0.4rem', display: 'flex', alignItems: 'center' }}
          >
            ⚙ Filtros {activeCount > 0 && (
              <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '99px', fontSize: '0.65rem', padding: '0.1rem 0.4rem', fontWeight: 700 }}>
                {activeCount}
              </span>
            )}
          </button>
        )}

        {onSortDirChange && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onSortDirChange(sortDir === 'asc' ? 'desc' : 'asc')}
            title={`Ordenar por ${sortLabel}: ${sortDir === 'asc' ? 'más reciente' : 'más antiguo'}`}
          >
            {sortDir === 'asc' ? '↑' : '↓'} {sortLabel}
          </button>
        )}

        {activeCount > 0 && onClear && (
          <button className="btn btn-ghost btn-sm" onClick={onClear} style={{ color: 'var(--red, #f87171)' }}>
            ✕ Limpiar
          </button>
        )}

        {extra}
      </div>

      {/* Expanded panel */}
      {open && (
        <div style={{
          marginTop: '0.5rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-soft)',
          borderRadius: 'var(--r-xl)',
          padding: '1rem',
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}>
          {selects.map((s, i) => (
            <div key={i} className="form-group" style={{ margin: 0, minWidth: 150, flex: '1 1 150px' }}>
              <label className="form-label" style={{ fontSize: '0.72rem' }}>{s.label}</label>
              <select
                className="form-select"
                style={{ height: 36, fontSize: '0.82rem' }}
                value={s.value}
                onChange={e => s.onChange(e.target.value)}
              >
                <option value="">Todos</option>
                {s.options.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          ))}

          {onDateFromChange && (
            <div className="form-group" style={{ margin: 0, minWidth: 140, flex: '1 1 140px' }}>
              <label className="form-label" style={{ fontSize: '0.72rem' }}>Desde</label>
              <input
                type="date" className="form-input"
                style={{ height: 36, fontSize: '0.82rem' }}
                value={dateFrom ?? ''}
                onChange={e => onDateFromChange(e.target.value)}
              />
            </div>
          )}

          {onDateToChange && (
            <div className="form-group" style={{ margin: 0, minWidth: 140, flex: '1 1 140px' }}>
              <label className="form-label" style={{ fontSize: '0.72rem' }}>Hasta</label>
              <input
                type="date" className="form-input"
                style={{ height: 36, fontSize: '0.82rem' }}
                value={dateTo ?? ''}
                onChange={e => onDateToChange(e.target.value)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
