-- ============================================================
-- MIGRACIÓN: Añadir precio_kg a lote_cafe
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- ============================================================

-- 1. Agregar columna precio_kg al lote (definido por el admin/productor)
ALTER TABLE public.lote_cafe
  ADD COLUMN IF NOT EXISTS precio_kg numeric DEFAULT 18500;

-- 2. Actualizar lotes existentes con precio por defecto
UPDATE public.lote_cafe
  SET precio_kg = 18500
  WHERE precio_kg IS NULL;

-- 3. Hacer la columna NOT NULL con default
ALTER TABLE public.lote_cafe
  ALTER COLUMN precio_kg SET NOT NULL,
  ALTER COLUMN precio_kg SET DEFAULT 18500;

-- ============================================================
-- RESULTADO: 
-- - Los admins/productores pueden fijar el precio desde el panel
-- - Los clientes ven el precio fijo (read-only), no pueden modificarlo
-- - Al comprar X kg, el sistema descuenta del peso_kg del lote
-- - Si peso_kg llega a 0 → estado cambia a 'vendido' automáticamente
-- ============================================================
