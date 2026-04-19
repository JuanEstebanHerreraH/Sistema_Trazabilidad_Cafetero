-- ═══════════════════════════════════════════════════════════════════════════
-- CAFÉTRACE — SQL COMPLETO v4
-- Ejecutar en: Supabase → SQL Editor → New Query → Run
-- Idempotente: se puede correr varias veces sin romper datos.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. ROLES BASE ───────────────────────────────────────────────────────────
INSERT INTO public.rol (nombre, descripcion) VALUES
  ('Administrador', 'Acceso total al sistema'),
  ('Productor',     'Gestión de fincas y lotes propios'),
  ('Catador',       'Evaluación de calidad del café'),
  ('Transportista', 'Gestión de movimientos de inventario'),
  ('Cliente',       'Portal de compra de lotes'),
  ('Operador',      'Gestión operativa y trazabilidad'),
  ('Vendedor',      'Gestión de ventas y clientes')
ON CONFLICT (nombre) DO NOTHING;

-- ── 2. PROCESOS BASE ────────────────────────────────────────────────────────
INSERT INTO public.proceso (nombre, descripcion) VALUES
  ('Lavado',             'Beneficio húmedo: despulpado, fermentación y lavado'),
  ('Natural',            'Secado del grano con la cereza completa'),
  ('Honey',              'Secado con parte del mucílago adherido al grano'),
  ('Anaeróbico',         'Fermentación en ambiente sin oxígeno'),
  ('Doble fermentación', 'Dos etapas de fermentación para perfil complejo'),
  ('Cata de calidad',    'Evaluación organoléptica y puntaje de taza')
ON CONFLICT (nombre) DO NOTHING;

-- ── 3. RLS: HABILITAR Y CREAR POLÍTICAS PERMISIVAS ──────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'productor','finca','lote_cafe','almacen','movimiento_inventario',
    'cliente','venta','detalle_venta','proceso','registro_proceso',
    'rol','usuario','solicitud_rol'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_authenticated_all" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "allow_authenticated_all" ON public.%I
       FOR ALL USING (auth.role() = ''authenticated'')
       WITH CHECK (auth.role() = ''authenticated'')', t);
  END LOOP;
END $$;

-- ── 4. TRIGGER: Descontar stock al insertar detalle_venta ───────────────────
CREATE OR REPLACE FUNCTION public.fn_trigger_descontar_stock_venta()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_peso_actual numeric;
  v_peso_nuevo  numeric;
BEGIN
  SELECT peso_kg INTO v_peso_actual FROM public.lote_cafe WHERE idlote_cafe = NEW.idlote_cafe;
  IF v_peso_actual IS NULL THEN
    RAISE EXCEPTION 'Lote % no encontrado.', NEW.idlote_cafe;
  END IF;
  v_peso_nuevo := GREATEST(0, v_peso_actual - NEW.cantidad);
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
  FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_descontar_stock_venta();

-- ── 5. TRIGGER: Actualizar total de venta ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_trigger_actualizar_total_venta()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.venta
  SET
    total_kg  = (SELECT COALESCE(SUM(cantidad), 0) FROM public.detalle_venta WHERE idventa = NEW.idventa),
    precio_kg = (SELECT CASE WHEN SUM(cantidad) > 0
                 THEN SUM(cantidad * precio_venta) / SUM(cantidad) ELSE 0 END
                 FROM public.detalle_venta WHERE idventa = NEW.idventa)
  WHERE idventa = NEW.idventa;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_actualizar_total_venta ON public.detalle_venta;
CREATE TRIGGER trg_actualizar_total_venta
  AFTER INSERT ON public.detalle_venta
  FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_actualizar_total_venta();

-- ── 6. FUNCIÓN: Stock de almacén ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_stock_almacen(p_idalmacen integer)
RETURNS numeric LANGUAGE plpgsql STABLE AS $$
DECLARE v_stock numeric := 0;
BEGIN
  SELECT COALESCE(SUM(
    CASE
      WHEN tipo = 'entrada'  AND idalmacen_destino = p_idalmacen THEN cantidad
      WHEN tipo = 'salida'   AND idalmacen_origen  = p_idalmacen THEN -cantidad
      WHEN tipo = 'traslado' AND idalmacen_destino = p_idalmacen THEN cantidad
      WHEN tipo = 'traslado' AND idalmacen_origen  = p_idalmacen THEN -cantidad
      ELSE 0
    END
  ), 0) INTO v_stock
  FROM public.movimiento_inventario
  WHERE idalmacen_origen = p_idalmacen OR idalmacen_destino = p_idalmacen;
  RETURN GREATEST(v_stock, 0);
END;
$$;

-- ── 7. VISTA: Almacenes con stock ───────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_almacen_stock AS
SELECT
  a.idalmacen, a.nombre, a.ubicacion, a.capacidad_kg,
  public.fn_stock_almacen(a.idalmacen) AS stock_actual,
  CASE
    WHEN a.capacidad_kg IS NOT NULL AND a.capacidad_kg > 0
    THEN ROUND((public.fn_stock_almacen(a.idalmacen) / a.capacidad_kg) * 100, 1)
    ELSE NULL
  END AS porcentaje_ocupacion
FROM public.almacen a;

-- ── 8. VISTA: Ventas completas ──────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_venta_completa AS
SELECT
  v.idventa, v.fecha_venta,
  c.nombre AS cliente_nombre,
  v.total_kg, v.precio_kg,
  COALESCE(v.total_kg * v.precio_kg, 0) AS total_cop,
  v.notas, v.idcliente,
  (SELECT COUNT(*) FROM public.detalle_venta dv WHERE dv.idventa = v.idventa) AS num_items
FROM public.venta v
LEFT JOIN public.cliente c ON c.idcliente = v.idcliente;

-- ── 9. ÍNDICES DE RENDIMIENTO ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mov_almacen_origen  ON public.movimiento_inventario(idalmacen_origen);
CREATE INDEX IF NOT EXISTS idx_mov_almacen_destino ON public.movimiento_inventario(idalmacen_destino);
CREATE INDEX IF NOT EXISTS idx_mov_lote            ON public.movimiento_inventario(idlote_cafe);
CREATE INDEX IF NOT EXISTS idx_detalle_venta_idv   ON public.detalle_venta(idventa);
CREATE INDEX IF NOT EXISTS idx_detalle_venta_lote  ON public.detalle_venta(idlote_cafe);
CREATE INDEX IF NOT EXISTS idx_lote_estado         ON public.lote_cafe(estado);
CREATE INDEX IF NOT EXISTS idx_venta_cliente       ON public.venta(idcliente);
CREATE INDEX IF NOT EXISTS idx_usuario_auth_uid    ON public.usuario(auth_uid);
CREATE INDEX IF NOT EXISTS idx_usuario_email       ON public.usuario(email);

-- ── 10. CORREGIR CLIENTES SIN EMAIL ─────────────────────────────────────────
-- Vincular clientes de la tabla pública con sus emails de la tabla usuario
UPDATE public.cliente c
SET email = u.email
FROM public.usuario u
WHERE u.nombre = c.nombre
  AND c.email IS NULL
  AND u.email IS NOT NULL;

-- ── 11. AUTO-APROBAR CLIENTES PENDIENTES ─────────────────────────────────────
UPDATE public.usuario
SET estado_aprobacion = 'aprobado',
    idrol = (SELECT idrol FROM public.rol WHERE nombre = 'Cliente' LIMIT 1)
WHERE idrol = (SELECT idrol FROM public.rol WHERE nombre = 'Cliente' LIMIT 1)
  AND estado_aprobacion = 'pendiente';

-- ── 12. VERIFICACIÓN FINAL ───────────────────────────────────────────────────
SELECT 'Roles' AS tabla, COUNT(*) AS total FROM public.rol
UNION ALL
SELECT 'Usuarios', COUNT(*) FROM public.usuario
UNION ALL
SELECT 'Lotes', COUNT(*) FROM public.lote_cafe
UNION ALL
SELECT 'Ventas', COUNT(*) FROM public.venta
UNION ALL
SELECT 'Detalle ventas', COUNT(*) FROM public.detalle_venta;

-- Verificar triggers
SELECT trigger_name, event_object_table, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN v4 — Recarga la app con Ctrl+Shift+R después de ejecutar
-- ═══════════════════════════════════════════════════════════════════════════
