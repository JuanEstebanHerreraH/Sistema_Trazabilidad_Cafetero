-- ═══════════════════════════════════════════════════════════════
-- PARCHE: Verificar nombres de constraints FK en tabla usuario
-- Ejecutar este SELECT para saber el nombre exacto de las FKs
-- ═══════════════════════════════════════════════════════════════

-- 1. Consulta diagnóstico: muestra todos los constraints de la tabla usuario
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name  AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'usuario'
  AND tc.table_schema = 'public'
ORDER BY tc.constraint_type, kcu.column_name;

-- ═══════════════════════════════════════════════════════════════
-- Si el constraint de idrol NO se llama "usuario_idrol_fkey",
-- ajusta el nombre en components/admin/Usuarios.tsx:
--
--   selectQuery="*, rol!TU_CONSTRAINT_NAME(nombre)"
--
-- Nombres comunes según cómo fue creada la tabla:
--   usuario_idrol_fkey          ← creada con Supabase UI
--   finca_idproductor_fkey      ← patrón tabla_columna_fkey
-- ═══════════════════════════════════════════════════════════════

-- 2. Si necesitas renombrar el constraint para que coincida:
-- (Solo ejecutar si el nombre difiere del esperado)

-- ALTER TABLE public.usuario
--   RENAME CONSTRAINT <nombre_actual> TO usuario_idrol_fkey;

-- 3. Alternativa: usar nombre de columna en lugar de constraint
-- En Supabase PostgREST también funciona:
--   selectQuery="*, rol!idrol(nombre)"
-- ═══════════════════════════════════════════════════════════════
