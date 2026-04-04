<div align="center">

# ☕ Café Almacén

### Sistema de gestión para café especial

*Inventario · Producción · Ventas · Trazabilidad*

---

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

</div>

---

## 📌 ¿Qué es Café Almacén?

Café Almacén es una plataforma web de gestión integral para operaciones de café especial. Permite hacer seguimiento completo desde la cosecha en finca hasta la venta al cliente final, pasando por procesos de beneficio, almacenamiento y movimientos de inventario.

---

## 🧩 Módulos del sistema

| Ícono | Módulo | Descripción |
|:---:|---|---|
| 📊 | **Dashboard** | Estadísticas en tiempo real y actividad reciente |
| 👨‍🌾 | **Productores** | Registro de productores y sus datos de contacto |
| 🌿 | **Fincas** | Fincas vinculadas a cada productor |
| ☕ | **Lotes de Café** | Cosechas por variedad, peso y estado |
| ⚙️ | **Procesos** | Tipos de beneficio aplicados a los lotes |
| 📋 | **Registros** | Detalle de cada proceso realizado |
| 🏭 | **Almacenes** | Bodegas disponibles para almacenamiento |
| ↕️ | **Movimientos** | Entradas, salidas y traslados de inventario |
| 🤝 | **Clientes** | Compradores nacionales e internacionales |
| 💰 | **Ventas** | Registro de ventas con precios y cantidades |
| 🔐 | **Roles** | Niveles de acceso al sistema |
| 👥 | **Usuarios** | Gestión de usuarios con roles asignados |

---

## 🚀 Instalación local

### Requisitos previos
- Node.js 18+
- npm
- Cuenta en [Supabase](https://supabase.com)

### Pasos

**1. Clonar el repositorio**
```bash
git clone https://github.com/tu-usuario/cafe-almacen.git
cd cafe-almacen
```

**2. Instalar dependencias**
```bash
npm install
```

**3. Crear el archivo de variables de entorno**

Crea un archivo `.env.local` en la raíz del proyecto:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyxxxxxxxxxxxxxxxxxxxxxxxx
```

> 💡 Encuentra estas claves en Supabase: **Project Settings → API**

**4. Ejecutar en modo desarrollo**
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) ✅

---

## ☁️ Despliegue en Vercel

### 1️⃣ Subir el código a GitHub

```bash
git init
git add .
git commit -m "🚀 first commit"
git branch -M main
git remote add origin https://github.com/tu-usuario/cafe-almacen.git
git push -u origin main
```

### 2️⃣ Conectar con Vercel

1. Ve a [vercel.com](https://vercel.com) e inicia sesión con GitHub
2. Clic en **Add New Project**
3. Selecciona el repositorio `cafe-almacen`
4. En **Environment Variables** agrega:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Tu URL de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tu anon key de Supabase |

5. Clic en **Deploy** 🚀

En minutos tendrás una URL pública tipo `cafe-almacen.vercel.app`

---

## 🗄️ Configuración de Supabase

### Crear usuario administrador

1. Ve a tu proyecto en [supabase.com](https://supabase.com)
2. **Authentication → Users → Add user → Create new user**
3. Ingresa email y contraseña del administrador

### Tablas requeridas

```
productor          → Productores de café
finca              → Fincas por productor
lote_cafe          → Lotes cosechados
proceso            → Tipos de proceso de beneficio
registro_proceso   → Registros de procesos aplicados
almacen            → Bodegas de almacenamiento
movimiento_invent… → Movimientos de inventario
cliente            → Clientes compradores
venta              → Ventas realizadas
detalle_venta      → Detalle de cada venta
rol                → Roles del sistema
usuario            → Usuarios con acceso
```

---

## 📁 Estructura del proyecto

```
cafe-almacen/
│
├── 📁 app/                     # Rutas de Next.js (App Router)
│   ├── globals.css             # Estilos globales
│   ├── layout.tsx              # Layout raíz
│   ├── page.tsx                # Página de inicio
│   ├── 📁 login/
│   │   └── page.tsx
│   └── 📁 admin/
│       ├── layout.tsx          # Layout con sidebar (requiere auth)
│       ├── page.tsx            # Dashboard
│       ├── 📁 clientes/
│       ├── 📁 almacenes/
│       ├── 📁 fincas/
│       ├── 📁 lotes/
│       ├── 📁 movimientos/
│       ├── 📁 procesos/
│       ├── 📁 productores/
│       ├── 📁 registros/
│       ├── 📁 roles/
│       ├── 📁 usuarios/
│       └── 📁 ventas/
│
├── 📁 components/
│   ├── Sidebar.tsx             # Navegación lateral
│   ├── CrudPage.tsx            # Componente genérico CRUD
│   ├── Modal.tsx               # Modal reutilizable
│   └── 📁 admin/               # Componentes por módulo
│
├── 📁 hooks/
│   └── useCrud.ts              # Hook para operaciones CRUD
│
├── 📁 utils/supabase/
│   ├── client.ts               # Cliente para componentes
│   └── server.ts               # Cliente para server components
│
├── proxy.ts                    # Autenticación y redirecciones
├── .env.local                  # 🔒 Variables de entorno (NO subir)
└── .gitignore
```

---

## 🔒 Seguridad

- Las credenciales de Supabase están en `.env.local` — **nunca se suben a GitHub**
- El archivo `.gitignore` excluye automáticamente todos los archivos `.env`
- El sistema de autenticación usa Supabase Auth con sesiones seguras
- Las rutas `/admin/*` están protegidas y redirigen al login si no hay sesión

---

<div align="center">

Desarrollado con ☕ por el equipo de Café Almacén

</div>
