-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN v6: Reseñas de lotes por usuarios (clientes)
-- Separadas de los registros de proceso (catadores)
-- ══════════════════════════════════════════════════════════════

-- Tabla de reseñas de lotes
CREATE TABLE IF NOT EXISTS public.resena_lote (
  idresena       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  idlote_cafe    integer NOT NULL REFERENCES public.lote_cafe(idlote_cafe) ON DELETE CASCADE,
  idusuario      integer REFERENCES public.usuario(idusuario) ON DELETE SET NULL,
  calificacion   numeric(3,1) CHECK (calificacion >= 0 AND calificacion <= 10),
  texto          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_resena_lote_idlote    ON public.resena_lote(idlote_cafe);
CREATE INDEX IF NOT EXISTS idx_resena_lote_idusuario ON public.resena_lote(idusuario);

-- RLS
ALTER TABLE public.resena_lote ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_authenticated_all" ON public.resena_lote;
CREATE POLICY "allow_authenticated_all" ON public.resena_lote
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Vista combinada de reseñas (catadores + clientes)
DROP VIEW IF EXISTS public.v_resenas_lote;
CREATE VIEW public.v_resenas_lote AS
  -- Reseñas de catadores (registro_proceso con notas o calificacion)
  SELECT
    rp.idregistro_proceso  AS id,
    rp.idlote_cafe,
    lc.variedad,
    rp.idusuario,
    u.nombre               AS autor,
    r.nombre               AS rol_autor,
    'catador'::text        AS tipo,
    rp.calificacion,
    rp.notas               AS texto,
    pr.nombre              AS proceso_nombre,
    rp.fecha_inicio        AS created_at
  FROM public.registro_proceso rp
  LEFT JOIN public.lote_cafe lc ON lc.idlote_cafe = rp.idlote_cafe
  LEFT JOIN public.usuario   u  ON u.idusuario    = rp.idusuario
  LEFT JOIN public.rol       r  ON r.idrol        = u.idrol
  LEFT JOIN public.proceso   pr ON pr.idproceso   = rp.idproceso
  WHERE rp.notas IS NOT NULL OR rp.calificacion IS NOT NULL

  UNION ALL

  -- Reseñas de clientes (resena_lote)
  SELECT
    rl.idresena            AS id,
    rl.idlote_cafe,
    lc.variedad,
    rl.idusuario,
    u.nombre               AS autor,
    r.nombre               AS rol_autor,
    'cliente'::text        AS tipo,
    rl.calificacion,
    rl.texto,
    NULL::text             AS proceso_nombre,
    rl.created_at
  FROM public.resena_lote rl
  LEFT JOIN public.lote_cafe lc ON lc.idlote_cafe = rl.idlote_cafe
  LEFT JOIN public.usuario   u  ON u.idusuario    = rl.idusuario
  LEFT JOIN public.rol       r  ON r.idrol        = u.idrol;

-- Grant access
GRANT SELECT ON public.v_resenas_lote TO authenticated;
GRANT ALL    ON public.resena_lote    TO authenticated;
GRANT USAGE  ON SEQUENCE resena_lote_idresena_seq TO authenticated;
