-- ═══════════════════════════════════════════════════════════════════════════
-- CAFÉ ALMACÉN — Migración v3: Interactividad Dinámica
-- ═══════════════════════════════════════════════════════════════════════════
-- INSTRUCCIONES:
--   1. Copiar TODO este archivo
--   2. Ir a Supabase → SQL Editor → New Query
--   3. Pegar y ejecutar (Run)
--   Se puede ejecutar varias veces sin romper datos existentes.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. CORREGIR RLS EN TODAS LAS TABLAS ─────────────────────────────────
-- Este es el arreglo principal: si RLS está habilitado sin políticas,
-- las queries devuelven vacío (esto causa que Productores no muestre datos).
-- Habilitamos RLS + políticas permisivas para usuarios autenticados.

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'productor','finca','lote_cafe','almacen',
      'movimiento_inventario','cliente','venta','detalle_venta',
      'proceso','registro_proceso','rol','usuario'
    ])
  LOOP
    -- Habilitar RLS en todas las tablas
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Eliminar política anterior si existe
    EXECUTE format('DROP POLICY IF EXISTS "allow_authenticated_all" ON public.%I', t);

    -- Crear política: usuarios autenticados pueden hacer todo (CRUD completo)
    EXECUTE format(
      'CREATE POLICY "allow_authenticated_all" ON public.%I
       FOR ALL
       USING (auth.role() = ''authenticated'')
       WITH CHECK (auth.role() = ''authenticated'')',
      t
    );
  END LOOP;
END $$;

-- ── 2. FUNCIÓN: Calcular stock actual de un almacén ─────────────────────
-- Suma entradas/traslados-destino y resta salidas/traslados-origen
CREATE OR REPLACE FUNCTION public.fn_stock_almacen(p_idalmacen integer)
RETURNS numeric
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_stock numeric := 0;
BEGIN
  SELECT COALESCE(SUM(
    CASE
      WHEN tipo = 'entrada'  AND idalmacen_destino = p_idalmacen THEN cantidad
      WHEN tipo = 'salida'   AND idalmacen_origen  = p_idalmacen THEN -cantidad
      WHEN tipo = 'traslado' AND idalmacen_destino = p_idalmacen THEN cantidad
      WHEN tipo = 'traslado' AND idalmacen_origen  = p_idalmacen THEN -cantidad
      ELSE 0
    END
  ), 0)
  INTO v_stock
  FROM public.movimiento_inventario
  WHERE idalmacen_origen = p_idalmacen
     OR idalmacen_destino = p_idalmacen;

  RETURN GREATEST(v_stock, 0);
END;
$$;

-- ── 3. FUNCIÓN: Detalle de lotes en un almacén ──────────────────────────
-- Devuelve los lotes y kg que tiene un almacén según movimientos
CREATE OR REPLACE FUNCTION public.fn_contenido_almacen(p_idalmacen integer)
RETURNS TABLE(idlote_cafe integer, variedad text, kg_en_almacen numeric)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.idlote_cafe,
    lc.variedad,
    GREATEST(0, SUM(
      CASE
        WHEN m.tipo = 'entrada'  AND m.idalmacen_destino = p_idalmacen THEN m.cantidad
        WHEN m.tipo = 'salida'   AND m.idalmacen_origen  = p_idalmacen THEN -m.cantidad
        WHEN m.tipo = 'traslado' AND m.idalmacen_destino = p_idalmacen THEN m.cantidad
        WHEN m.tipo = 'traslado' AND m.idalmacen_origen  = p_idalmacen THEN -m.cantidad
        ELSE 0
      END
    )) AS kg_en_almacen
  FROM public.movimiento_inventario m
  JOIN public.lote_cafe lc ON lc.idlote_cafe = m.idlote_cafe
  WHERE m.idalmacen_origen = p_idalmacen
     OR m.idalmacen_destino = p_idalmacen
  GROUP BY m.idlote_cafe, lc.variedad
  HAVING SUM(
    CASE
      WHEN m.tipo = 'entrada'  AND m.idalmacen_destino = p_idalmacen THEN m.cantidad
      WHEN m.tipo = 'salida'   AND m.idalmacen_origen  = p_idalmacen THEN -m.cantidad
      WHEN m.tipo = 'traslado' AND m.idalmacen_destino = p_idalmacen THEN m.cantidad
      WHEN m.tipo = 'traslado' AND m.idalmacen_origen  = p_idalmacen THEN -m.cantidad
      ELSE 0
    END
  ) > 0;
END;
$$;

-- ── 4. TRIGGER: Validar capacidad de almacén antes de mover ─────────────
-- Si el almacén destino tiene capacidad_kg definida y se va a superar, ERROR
CREATE OR REPLACE FUNCTION public.fn_trigger_validar_capacidad()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_capacidad   numeric;
  v_stock_actual numeric;
  v_nombre_almacen text;
BEGIN
  -- Solo validar si hay almacén destino (entradas y traslados)
  IF NEW.idalmacen_destino IS NULL THEN
    RETURN NEW;
  END IF;

  -- Obtener capacidad del almacén destino
  SELECT capacidad_kg, nombre
  INTO v_capacidad, v_nombre_almacen
  FROM public.almacen
  WHERE idalmacen = NEW.idalmacen_destino;

  -- Si no tiene capacidad definida, permitir
  IF v_capacidad IS NULL OR v_capacidad <= 0 THEN
    RETURN NEW;
  END IF;

  -- Calcular stock actual
  v_stock_actual := public.fn_stock_almacen(NEW.idalmacen_destino);

  -- Verificar que no se exceda
  IF (v_stock_actual + NEW.cantidad) > v_capacidad THEN
    RAISE EXCEPTION 'CAPACIDAD_EXCEDIDA: El almacén "%" tiene % kg de % kg de capacidad. No se pueden agregar % kg más. Espacio disponible: % kg.',
      v_nombre_almacen,
      v_stock_actual,
      v_capacidad,
      NEW.cantidad,
      (v_capacidad - v_stock_actual);
  END IF;

  RETURN NEW;
END;
$$;

-- Crear el trigger (drop si existía)
DROP TRIGGER IF EXISTS trg_validar_capacidad_almacen ON public.movimiento_inventario;
CREATE TRIGGER trg_validar_capacidad_almacen
  BEFORE INSERT ON public.movimiento_inventario
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trigger_validar_capacidad();

-- ── 5. TRIGGER: Auto-descontar stock del lote al insertar detalle_venta ─
-- Cuando se crea una línea de detalle_venta, descuenta peso_kg del lote
-- y marca como 'vendido' si queda en 0
CREATE OR REPLACE FUNCTION public.fn_trigger_descontar_stock_venta()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_peso_actual numeric;
  v_peso_nuevo  numeric;
BEGIN
  -- Obtener peso actual del lote
  SELECT peso_kg INTO v_peso_actual
  FROM public.lote_cafe
  WHERE idlote_cafe = NEW.idlote_cafe;

  IF v_peso_actual IS NULL THEN
    RAISE EXCEPTION 'Lote con id % no encontrado.', NEW.idlote_cafe;
  END IF;

  v_peso_nuevo := GREATEST(0, v_peso_actual - NEW.cantidad);

  -- Actualizar lote: descontar peso y cambiar estado si se agotó
  UPDATE public.lote_cafe
  SET peso_kg = v_peso_nuevo,
      estado  = CASE WHEN v_peso_nuevo <= 0 THEN 'vendido' ELSE estado END
  WHERE idlote_cafe = NEW.idlote_cafe;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_descontar_stock_venta ON public.detalle_venta;
CREATE TRIGGER trg_descontar_stock_venta
  AFTER INSERT ON public.detalle_venta
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trigger_descontar_stock_venta();

-- ── 6. TRIGGER: Actualizar total de venta al insertar detalle ───────────
-- Mantiene venta.total_kg y calcula un precio promedio ponderado
CREATE OR REPLACE FUNCTION public.fn_trigger_actualizar_total_venta()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.venta
  SET total_kg  = (SELECT COALESCE(SUM(cantidad), 0) FROM public.detalle_venta WHERE idventa = NEW.idventa),
      precio_kg = (SELECT CASE WHEN SUM(cantidad) > 0
                   THEN SUM(cantidad * precio_venta) / SUM(cantidad)
                   ELSE 0 END
                   FROM public.detalle_venta WHERE idventa = NEW.idventa)
  WHERE idventa = NEW.idventa;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_actualizar_total_venta ON public.detalle_venta;
CREATE TRIGGER trg_actualizar_total_venta
  AFTER INSERT ON public.detalle_venta
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trigger_actualizar_total_venta();

-- ── 7. VISTA: Almacenes con stock calculado ─────────────────────────────
CREATE OR REPLACE VIEW public.v_almacen_stock AS
SELECT
  a.idalmacen,
  a.nombre,
  a.ubicacion,
  a.capacidad_kg,
  public.fn_stock_almacen(a.idalmacen) AS stock_actual,
  CASE
    WHEN a.capacidad_kg IS NOT NULL AND a.capacidad_kg > 0
    THEN ROUND((public.fn_stock_almacen(a.idalmacen) / a.capacidad_kg) * 100, 1)
    ELSE NULL
  END AS porcentaje_ocupacion,
  CASE
    WHEN a.capacidad_kg IS NOT NULL AND a.capacidad_kg > 0
    THEN GREATEST(0, a.capacidad_kg - public.fn_stock_almacen(a.idalmacen))
    ELSE NULL
  END AS espacio_disponible
FROM public.almacen a;

-- ── 8. VISTA: Ventas con detalles completos ─────────────────────────────
CREATE OR REPLACE VIEW public.v_venta_completa AS
SELECT
  v.idventa,
  v.fecha_venta,
  c.nombre AS cliente_nombre,
  v.total_kg,
  v.precio_kg,
  COALESCE(v.total_kg * v.precio_kg, 0) AS total_cop,
  v.notas,
  v.idcliente,
  (SELECT COUNT(*) FROM public.detalle_venta dv WHERE dv.idventa = v.idventa) AS num_items
FROM public.venta v
LEFT JOIN public.cliente c ON c.idcliente = v.idcliente;

-- ── 9. ÍNDICES para rendimiento ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mov_almacen_origen
  ON public.movimiento_inventario(idalmacen_origen);
CREATE INDEX IF NOT EXISTS idx_mov_almacen_destino
  ON public.movimiento_inventario(idalmacen_destino);
CREATE INDEX IF NOT EXISTS idx_mov_lote
  ON public.movimiento_inventario(idlote_cafe);
CREATE INDEX IF NOT EXISTS idx_detalle_venta_idventa
  ON public.detalle_venta(idventa);
CREATE INDEX IF NOT EXISTS idx_detalle_venta_lote
  ON public.detalle_venta(idlote_cafe);
CREATE INDEX IF NOT EXISTS idx_lote_cafe_estado
  ON public.lote_cafe(estado);
CREATE INDEX IF NOT EXISTS idx_venta_cliente
  ON public.venta(idcliente);

-- ── 10. VERIFICACIÓN ────────────────────────────────────────────────────
-- Ejecuta estas queries después para verificar:

-- ¿RLS policies están activas?
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

-- ¿Las funciones se crearon?
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- ¿Los triggers se crearon?
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;

-- ¿Stock de almacenes?
SELECT * FROM public.v_almacen_stock;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN DE MIGRACIÓN v3
-- Después de ejecutar, recarga la app (Ctrl+Shift+R en el navegador)
-- ═══════════════════════════════════════════════════════════════════════════
