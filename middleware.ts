import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware de Next.js — Café Almacén v2
 *
 * Responsabilidades:
 *  1. Refrescar el token de sesión de Supabase en cada request
 *  2. Proteger las rutas /admin: redirigir a /login si no hay sesión
 *  3. Redirigir a /admin si ya hay sesión y el usuario intenta ir a /login o /register
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Crear cliente de Supabase SSR que opera sobre las cookies del request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Propagar cookies en el request y en la respuesta
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: getUser() refresca el token si está por expirar.
  // No usar getSession() aquí — puede devolver datos obsoletos del cookie.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Rutas protegidas: /admin/** ───────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!user) {
      // Sin sesión → redirigir al login
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      return NextResponse.redirect(loginUrl)
    }
  }

  // ── Redirigir si ya está autenticado y va a /login o /register ──
  if ((pathname === '/login' || pathname === '/register') && user) {
    const adminUrl = request.nextUrl.clone()
    adminUrl.pathname = '/admin'
    return NextResponse.redirect(adminUrl)
  }

  // ── Redirigir raíz '/' al login si no está autenticado ─────────
  if (pathname === '/' && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // ── Redirigir raíz '/' al admin si ya está autenticado ─────────
  if (pathname === '/' && user) {
    const adminUrl = request.nextUrl.clone()
    adminUrl.pathname = '/admin'
    return NextResponse.redirect(adminUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Ejecutar middleware en todas las rutas EXCEPTO:
     * - _next/static  (archivos estáticos)
     * - _next/image   (optimización de imágenes)
     * - favicon.ico
     * - archivos con extensión (png, jpg, svg, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
