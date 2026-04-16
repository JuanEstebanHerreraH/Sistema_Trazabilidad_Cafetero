-- ═══════════════════════════════════════════════════════════════
-- CAFÉ ALMACÉN — Migración v2
-- Sistema de Registro, Solicitudes de Rol y Responsive Design
-- ═══════════════════════════════════════════════════════════════
-- INSTRUCCIONES:
--   Ejecutar en el editor SQL de Supabase (sql editor).
--   Se puede ejecutar varias veces sin romper datos existentes
--   gracias al uso de IF NOT EXISTS y ON CONFLICT.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Columnas nuevas en tabla usuario ─────────────────────────
ALTER TABLE public.usuario
  ADD COLUMN IF NOT EXISTS telefono           text,
  ADD COLUMN IF NOT EXISTS rol_solicitado     integer,
  ADD COLUMN IF NOT EXISTS estado_aprobacion  text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS auth_uid           uuid;

-- Restricciones separadas (por si alguna ya existía)
DO $$
BEGIN
  -- FK rol_solicitado → rol
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'usuario_rol_solicitado_fkey'
  ) THEN
    ALTER TABLE public.usuario
      ADD CONSTRAINT usuario_rol_solicitado_fkey
      FOREIGN KEY (rol_solicitado) REFERENCES public.rol(idrol);
  END IF;

  -- CHECK estado_aprobacion
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'usuario_estado_aprobacion_check'
  ) THEN
    ALTER TABLE public.usuario
      ADD CONSTRAINT usuario_estado_aprobacion_check
      CHECK (estado_aprobacion IN ('pendiente', 'aprobado', 'rechazado'));
  END IF;

  -- UNIQUE auth_uid
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'usuario_auth_uid_key'
  ) THEN
    ALTER TABLE public.usuario
      ADD CONSTRAINT usuario_auth_uid_key UNIQUE (auth_uid);
  END IF;
END $$;

-- ── 2. Tabla de solicitudes de rol ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.solicitud_rol (
  idsolicitud         bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  idusuario           integer       NOT NULL REFERENCES public.usuario(idusuario) ON DELETE CASCADE,
  tipo_rol            text          NOT NULL,
  datos_formulario    jsonb         NOT NULL DEFAULT '{}',
  estado_revision     text          NOT NULL DEFAULT 'pendiente',
  notas_admin         text,
  fecha_envio         timestamptz   NOT NULL DEFAULT now(),
  fecha_revision      timestamptz,
  idusuario_revisor   integer       REFERENCES public.usuario(idusuario),
  created_at          timestamptz   DEFAULT now(),
  CONSTRAINT solicitud_rol_pkey            PRIMARY KEY (idsolicitud),
  CONSTRAINT solicitud_rol_estado_check    CHECK (estado_revision IN ('pendiente', 'aprobado', 'rechazado'))
);

-- ── 3. Índices para rendimiento ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_solicitud_rol_estado
  ON public.solicitud_rol(estado_revision);

CREATE INDEX IF NOT EXISTS idx_solicitud_rol_usuario
  ON public.solicitud_rol(idusuario);

CREATE INDEX IF NOT EXISTS idx_usuario_estado_aprobacion
  ON public.usuario(estado_aprobacion);

CREATE INDEX IF NOT EXISTS idx_usuario_auth_uid
  ON public.usuario(auth_uid);

-- ── 4. Roles predeterminados del sistema ─────────────────────────
INSERT INTO public.rol (nombre, descripcion) VALUES
  ('Administrador', 'Control total del sistema'),
  ('Productor',     'Dueño o administrador de finca cafetera'),
  ('Transportista', 'Responsable del transporte de carga'),
  ('Catador',       'Evaluador de calidad del café'),
  ('Cliente',       'Comprador o consumidor de café')
ON CONFLICT (nombre) DO NOTHING;

-- ── 5. Marcar usuarios existentes como aprobados ─────────────────
-- Los usuarios creados antes de esta migración se marcan como aprobados
-- para no bloquear el acceso del equipo existente
UPDATE public.usuario
SET estado_aprobacion = 'aprobado'
WHERE estado_aprobacion = 'pendiente'
  AND created_at < now() - interval '1 minute'; -- solo usuarios previos

-- ── 6. RLS: Habilitar seguridad a nivel de fila ──────────────────
ALTER TABLE public.solicitud_rol ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas anteriores si existen, para recrearlas limpias
DROP POLICY IF EXISTS "usuario_ve_su_solicitud"    ON public.solicitud_rol;
DROP POLICY IF EXISTS "usuario_crea_solicitud"     ON public.solicitud_rol;
DROP POLICY IF EXISTS "admin_gestiona_solicitudes" ON public.solicitud_rol;

-- Política: un usuario autenticado puede ver sus propias solicitudes
CREATE POLICY "usuario_ve_su_solicitud"
  ON public.solicitud_rol FOR SELECT
  USING (
    idusuario IN (
      SELECT idusuario FROM public.usuario
      WHERE auth_uid = auth.uid()
    )
  );

-- Política: un usuario autenticado puede crear su propia solicitud
CREATE POLICY "usuario_crea_solicitud"
  ON public.solicitud_rol FOR INSERT
  WITH CHECK (
    idusuario IN (
      SELECT idusuario FROM public.usuario
      WHERE auth_uid = auth.uid()
    )
  );

-- Política: administradores pueden ver y modificar todas las solicitudes
-- NOTA: Personaliza esta política según tu lógica de roles en Supabase.
-- Opción simple: permitir todo a usuarios autenticados (ajustar en producción)
CREATE POLICY "admin_gestiona_solicitudes"
  ON public.solicitud_rol FOR ALL
  USING (auth.role() = 'authenticated');

-- ── 7. Vista útil: solicitudes con datos de usuario ──────────────
CREATE OR REPLACE VIEW public.v_solicitudes_rol AS
  SELECT
    s.idsolicitud,
    s.tipo_rol,
    s.datos_formulario,
    s.estado_revision,
    s.notas_admin,
    s.fecha_envio,
    s.fecha_revision,
    u.idusuario,
    u.nombre   AS usuario_nombre,
    u.email    AS usuario_email,
    u.telefono AS usuario_telefono,
    u.estado_aprobacion
  FROM public.solicitud_rol s
  JOIN public.usuario        u ON u.idusuario = s.idusuario;

-- ── FIN DE MIGRACIÓN v2 ──────────────────────────────────────────
-- Verificación rápida (descomenta para revisar después de correr):
-- SELECT * FROM public.v_solicitudes_rol LIMIT 10;
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'usuario' AND table_schema = 'public';
