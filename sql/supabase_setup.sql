-- ============================================================
-- EJECUTAR EN SUPABASE → SQL EDITOR
-- Sistema de Trazabilidad Cafetero — Setup completo
-- ============================================================

-- ── 1. RESET ADMIN ──────────────────────────────────────────
-- Elimina el admin anterior y crea el nuevo
DELETE FROM public.usuario WHERE email IN ('admin@cafe.com', 'BasesDatosCunAV@gmail.com');
DELETE FROM auth.users    WHERE email IN ('admin@cafe.com', 'BasesDatosCunAV@gmail.com');

INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change,
  email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated',
  'BasesDatosCunAV@gmail.com',
  crypt('BdACn*26', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}', '{}',
  NOW(), NOW(), '', '', '', ''
);

INSERT INTO public.usuario (nombre, email, password_hash, idrol, estado_aprobacion, auth_uid)
SELECT
  'Administrador', 'BasesDatosCunAV@gmail.com',
  crypt('BdACn*26', gen_salt('bf')),
  (SELECT idrol FROM public.rol WHERE nombre = 'Administrador' LIMIT 1),
  'aprobado',
  a.id
FROM auth.users a WHERE a.email = 'BasesDatosCunAV@gmail.com';

-- ── 2. VINCULAR auth_uid PARA USUARIOS EXISTENTES ──────────
UPDATE public.usuario u
SET auth_uid = a.id
FROM auth.users a
WHERE u.email = a.email
  AND u.auth_uid IS NULL;

-- ── 3. ROLES BASE (si no existen) ───────────────────────────
INSERT INTO public.rol (nombre, descripcion) VALUES
  ('Administrador', 'Acceso total al sistema'),
  ('Productor',     'Gestión de fincas y lotes'),
  ('Catador',       'Evaluación de calidad del café'),
  ('Transportista', 'Gestión de movimientos de inventario'),
  ('Cliente',       'Compra de lotes disponibles')
ON CONFLICT (nombre) DO NOTHING;

-- ── 4. PROCESOS BASE (si no existen) ────────────────────────
INSERT INTO public.proceso (nombre, descripcion) VALUES
  ('Lavado',         'Beneficio húmedo: despulpado, fermentación y lavado'),
  ('Natural',        'Secado del grano con la cereza completa'),
  ('Honey',          'Secado con parte del mucílago adherido al grano'),
  ('Anaeróbico',     'Fermentación en ambiente sin oxígeno'),
  ('Doble fermentación', 'Dos etapas de fermentación para perfil complejo'),
  ('Cata de calidad','Evaluación organoléptica y puntaje de taza')
ON CONFLICT (nombre) DO NOTHING;

-- ── 5. CORREGIR USUARIOS SIN ESTADO APROBACION ──────────────
-- Los clientes auto-aprobados (registrados con rol Cliente) deben quedar aprobados
UPDATE public.usuario u
SET estado_aprobacion = 'aprobado',
    idrol = (SELECT idrol FROM public.rol WHERE nombre = 'Cliente' LIMIT 1)
WHERE u.idrol = (SELECT idrol FROM public.rol WHERE nombre = 'Cliente' LIMIT 1)
  AND u.estado_aprobacion = 'pendiente';

-- ── 6. VERIFICACIÓN FINAL ────────────────────────────────────
SELECT
  u.idusuario, u.nombre, u.email,
  r.nombre AS rol,
  u.estado_aprobacion,
  CASE WHEN u.auth_uid IS NOT NULL THEN '✓ Vinculado' ELSE '✗ SIN auth_uid' END AS auth_status
FROM public.usuario u
LEFT JOIN public.rol r ON u.idrol = r.idrol
ORDER BY u.idusuario;
