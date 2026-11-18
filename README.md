# Café Almacén

**Gestión y trazabilidad de café especial, desde la finca hasta la venta.**

Plataforma web para relacionar productores, fincas, lotes, procesos, almacenes y movimientos de inventario con clientes y ventas. Incluye áreas de administración y portales según el rol del usuario.

**Next.js 14 · React 18 · TypeScript · Supabase · PostgreSQL**

[Explorar el código](https://github.com/JuanEstebanHerreraH/Sistema_Trazabilidad_Cafetero) · [Reportar un problema](https://github.com/JuanEstebanHerreraH/Sistema_Trazabilidad_Cafetero/issues)

## Qué permite explorar

| Área | Funciones |
| --- | --- |
| Origen | Registro de productores, fincas y lotes de café. |
| Producción | Procesos y registros asociados a los lotes. |
| Inventario | Almacenes, entradas, salidas y traslados. |
| Comercial | Clientes, ventas y detalle de venta. |
| Acceso | Inicio de sesión, usuarios, roles y solicitudes de acceso. |
| Consulta | Dashboard y vistas del portal. |

## Decisión de implementación

El modelo relacional mantiene la relación entre el origen del café, sus procesos y sus movimientos. Next.js organiza las rutas y vistas; Supabase aporta autenticación y acceso a PostgreSQL. Los componentes CRUD y el hook `useCrud` evitan repetir la misma estructura de edición en cada módulo.

## Estado y límites

El repositorio contiene la aplicación y scripts de evolución de base de datos. Para ejecutarlo se necesita **un proyecto propio de Supabase con el esquema esperado**: instalar las dependencias no crea la base automáticamente.

Los scripts SQL existentes parten de tablas previas, algunos modifican usuarios administrativos y otros incluyen políticas permisivas para usuarios autenticados. Deben revisarse en una base de pruebas; no constituyen una configuración lista para producción ni garantizan por sí solos aislamiento por rol.

## Ejecutar localmente

Necesitas Node.js compatible con Next.js 14, npm y tu proyecto de Supabase. Usa una versión de Node mantenida y compatible con las dependencias del proyecto.

~~~sh
git clone https://github.com/JuanEstebanHerreraH/Sistema_Trazabilidad_Cafetero.git
cd Sistema_Trazabilidad_Cafetero
npm install
~~~

Crea `.env.local` en la raíz:

~~~dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU-CLAVE-PUBLICA-ANON
~~~

Son la URL del proyecto y la clave pública del cliente. **No uses una clave service_role en una variable NEXT_PUBLIC_.** El archivo local de entorno no debe publicarse.

Prepara el esquema, las relaciones y los permisos en tu base de pruebas antes de iniciar la aplicación. Los archivos de [sql/](sql/) son migraciones y utilidades administrativas; revisa sus requisitos y efectos antes de ejecutarlos, especialmente los que restablecen usuarios. No reutilices credenciales de ejemplo.

~~~sh
npm run dev
~~~

Abre [localhost:3000](http://localhost:3000). Crea tus usuarios desde Supabase Auth y vincúlalos al modelo de usuarios y roles del proyecto.

<details>
<summary><strong>Estructura, construcción y publicación</strong></summary>

| Ruta | Responsabilidad |
| --- | --- |
| `app/` | Páginas y rutas de Next.js App Router. |
| `app/admin/` | Gestión de productores, lotes, procesos, inventario y ventas. |
| `app/portal/` | Vistas del portal. |
| `components/` | Interfaz y componentes reutilizables. |
| `hooks/` | Lógica compartida de acceso y operaciones CRUD. |
| `utils/supabase/` | Clientes Supabase para navegador y servidor. |
| `middleware.ts` | Intercepción de solicitudes. |
| `sql/` | Migraciones y scripts administrativos. |

### Comprobar la compilación

~~~sh
npm run build
npm start
~~~

El script `npm run lint` está definido en package.json. No se documenta una suite automática de pruebas como si ya estuviera ejecutada.

### Publicar tu propia instancia

Importa el repositorio en Vercel como proyecto Next.js y configura las mismas variables de entorno para tu instancia de Supabase. Antes de habilitar usuarios reales, valida las políticas RLS, los permisos por rol y la configuración de autenticación con datos de prueba.

</details>

## Licencia

Código bajo licencia MIT. Las dependencias conservan sus licencias respectivas.
