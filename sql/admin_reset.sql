-- ============================================================
-- RESET ADMIN: Eliminar admin anterior y crear nuevo
-- Ejecutar en Supabase → SQL Editor (paso a paso)
-- ============================================================

-- PASO 1: Eliminar admin anterior de public.usuario
DELETE FROM public.usuario 
WHERE email = 'admin@cafe.com';

-- PASO 2: Eliminar de auth.users
DELETE FROM auth.users 
WHERE email = 'admin@cafe.com';

-- PASO 3: Crear nuevo usuario en auth.users
INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change,
  email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'BasesDatosCunAV@gmail.com',
  crypt('BdACn*26', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  NOW(), NOW(),
  '', '', '', ''
);

-- PASO 4: Crear en public.usuario vinculado al auth recién creado
INSERT INTO public.usuario (
  nombre, email, password_hash,
  idrol, estado_aprobacion, auth_uid
)
SELECT
  'Administrador',
  'BasesDatosCunAV@gmail.com',
  crypt('BdACn*26', gen_salt('bf')),
  (SELECT idrol FROM public.rol WHERE nombre = 'Administrador' LIMIT 1),
  'aprobado',
  a.id
FROM auth.users a
WHERE a.email = 'BasesDatosCunAV@gmail.com';

-- PASO 5: Verificar
SELECT u.idusuario, u.nombre, u.email, r.nombre AS rol, u.estado_aprobacion, u.auth_uid
FROM public.usuario u
LEFT JOIN public.rol r ON u.idrol = r.idrol
WHERE u.email = 'BasesDatosCunAV@gmail.com';
