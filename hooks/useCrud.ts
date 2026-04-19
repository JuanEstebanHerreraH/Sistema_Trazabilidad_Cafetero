'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../utils/supabase/client'

const supabase = createClient()

export function useCrud(
  table: string,
  idField: string,
  selectQuery = '*',
  orderBy?: string
) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from(table).select(selectQuery)
    if (orderBy) q = (q as any).order(orderBy)
    const { data: rows, error: err } = await q
    if (err) setError(err.message)
    else { setData(rows ?? []); setError(null) }
    setLoading(false)
  }, [table, selectQuery, orderBy])

  useEffect(() => { refetch() }, [refetch])

  const insert = async (payload: Record<string, any>) => {
    const { error: err } = await supabase.from(table).insert(payload)
    if (err) throw new Error(err.message)
    await refetch()
  }

  const update = async (id: any, payload: Record<string, any>) => {
    const { error: err } = await supabase.from(table).update(payload).eq(idField, id)
    if (err) throw new Error(err.message)
    await refetch()
  }

  const remove = async (id: any) => {
    const { error: err } = await supabase.from(table).delete().eq(idField, id)
    if (err) throw new Error(err.message)
    await refetch()
  }

  return { data, loading, error, insert, update, remove, refetch }
}
