-- ═══════════════════════════════════════════════════════════════════════════
-- CAFÉTRACE — FIX: Clientes duplicados + constraint UNIQUE(email)
-- Ejecutar en: Supabase → SQL Editor → New Query → Run
-- EJECUTAR ANTES de deployar el nuevo PortalCliente.tsx
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0. DIAGNÓSTICO — Ver duplicados antes de limpiar ────────────────────
-- (Solo informativo, no modifica nada)
SELECT '=== DUPLICADOS POR EMAIL ===' AS info;
SELECT email, COUNT(*) AS cantidad, ARRAY_AGG(idcliente ORDER BY idcliente) AS ids
FROM public.cliente
WHERE email IS NOT NULL AND email != ''
GROUP BY email
HAVING COUNT(*) > 1;

SELECT '=== CLIENTES SIN EMAIL ===' AS info;
SELECT idcliente, nombre, email
FROM public.cliente
WHERE email IS NULL OR email = '';

SELECT '=== VENTAS ACTUALES ===' AS info;
SELECT v.idventa, v.idcliente, c.nombre, c.email, v.total_kg, v.precio_kg
FROM public.venta v
LEFT JOIN public.cliente c ON c.idcliente = v.idcliente
ORDER BY v.idventa DESC
LIMIT 20;

-- ── 1. VINCULAR clientes sin email con su usuario por nombre ────────────
UPDATE public.cliente c
SET email = u.email
FROM public.usuario u
WHERE LOWER(TRIM(u.nombre)) = LOWER(TRIM(c.nombre))
  AND (c.email IS NULL OR c.email = '')
  AND u.email IS NOT NULL
  AND u.email != '';

-- ── 2. CONSOLIDAR DUPLICADOS ────────────────────────────────────────────
-- Para cada email duplicado: quedarse con el idcliente que tiene más ventas
-- (o el más bajo si empatan), y reasignar las ventas de los demás.
DO $$
DECLARE
  rec RECORD;
  v_keep integer;
  v_dup  integer;
BEGIN
  -- Iterar sobre cada email que tenga duplicados
  FOR rec IN
    SELECT email
    FROM public.cliente
    WHERE email IS NOT NULL AND email != ''
    GROUP BY email
    HAVING COUNT(*) > 1
  LOOP
    -- Elegir el idcliente a conservar: el que tenga más ventas, luego el más bajo
    SELECT c.idcliente INTO v_keep
    FROM public.cliente c
    LEFT JOIN public.venta v ON v.idcliente = c.idcliente
    WHERE c.email = rec.email
    GROUP BY c.idcliente
    ORDER BY COUNT(v.idventa) DESC, c.idcliente ASC
    LIMIT 1;

    -- Reasignar ventas de todos los duplicados al cliente principal
    UPDATE public.venta
    SET idcliente = v_keep
    WHERE idcliente IN (
      SELECT idcliente FROM public.cliente
      WHERE email = rec.email AND idcliente != v_keep
    );

    -- Eliminar los clientes duplicados (ya sin ventas asociadas)
    DELETE FROM public.cliente
    WHERE email = rec.email AND idcliente != v_keep;

    RAISE NOTICE 'Email %: conservado idcliente=%, duplicados eliminados', rec.email, v_keep;
  END LOOP;
END $$;

-- ── 3. ELIMINAR clientes huérfanos sin email y sin ventas ───────────────
DELETE FROM public.cliente
WHERE (email IS NULL OR email = '')
  AND idcliente NOT IN (SELECT DISTINCT idcliente FROM public.venta WHERE idcliente IS NOT NULL);

-- ── 4. AÑADIR CONSTRAINT UNIQUE en cliente.email ────────────────────────
-- Primero crea index si no existe, luego el constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_cliente_email_unique
  ON public.cliente (email)
  WHERE email IS NOT NULL AND email != '';

-- Constraint que usa el index (para que el upsert ON CONFLICT funcione)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cliente_email_unique' AND conrelid = 'public.cliente'::regclass
  ) THEN
    ALTER TABLE public.cliente
      ADD CONSTRAINT cliente_email_unique UNIQUE USING INDEX idx_cliente_email_unique;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Constraint ya existe o no se pudo crear: %', SQLERRM;
END $$;

-- ── 5. VERIFICACIÓN POST-FIX ────────────────────────────────────────────
SELECT '=== CLIENTES FINALES ===' AS info;
SELECT idcliente, nombre, email, telefono
FROM public.cliente
ORDER BY idcliente;

SELECT '=== DUPLICADOS RESTANTES (debería estar vacío) ===' AS info;
SELECT email, COUNT(*) AS cantidad
FROM public.cliente
WHERE email IS NOT NULL AND email != ''
GROUP BY email
HAVING COUNT(*) > 1;

SELECT '=== VENTAS CON CLIENTE ===' AS info;
SELECT v.idventa, v.idcliente, c.nombre AS cliente, c.email, v.total_kg,
       COALESCE(v.total_kg * v.precio_kg, 0) AS total_cop
FROM public.venta v
LEFT JOIN public.cliente c ON c.idcliente = v.idcliente
ORDER BY v.idventa DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN — Ahora deploya el nuevo PortalCliente.tsx
-- ═══════════════════════════════════════════════════════════════════════════
