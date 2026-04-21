-- ============================================================
-- MIGRACIÓN v5: Campo calificacion en registro_proceso
-- EJECUTAR EN SUPABASE → SQL EDITOR
-- ============================================================

-- 1. Agregar columna calificacion (0-10, dos decimales)
ALTER TABLE public.registro_proceso
  ADD COLUMN IF NOT EXISTS calificacion NUMERIC(4,2)
    CHECK (calificacion >= 0 AND calificacion <= 10);

-- 2. Poblar calificacion desde notas existentes
--    Formato detectado: "texto | 9.0"  →  extrae el número al final
UPDATE public.registro_proceso
SET calificacion = (
  regexp_match(notas, '\|\s*([0-9]+(?:\.[0-9]+)?)\s*$')
)[1]::numeric
WHERE notas ~ '\|\s*[0-9]+(?:\.[0-9]+)?\s*$'
  AND calificacion IS NULL;

-- 3. Limpiar el pipe y número de notas (dejar solo el texto descriptivo)
UPDATE public.registro_proceso
SET notas = TRIM(regexp_replace(notas, '\s*\|.*$', ''))
WHERE notas ~ '\|'
  AND calificacion IS NOT NULL;

-- 4. Verificar resultado
SELECT
  idregistro_proceso,
  lc.variedad         AS lote,
  p.nombre            AS proceso,
  rp.notas,
  rp.calificacion,
  u.nombre            AS responsable
FROM public.registro_proceso rp
LEFT JOIN public.lote_cafe  lc ON lc.idlote_cafe  = rp.idlote_cafe
LEFT JOIN public.proceso     p  ON p.idproceso     = rp.idproceso
LEFT JOIN public.usuario     u  ON u.idusuario     = rp.idusuario
ORDER BY rp.idregistro_proceso;
