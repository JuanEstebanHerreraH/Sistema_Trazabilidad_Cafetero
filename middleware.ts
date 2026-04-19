import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as any)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Helper: redirect helper
  const to = (path: string) => {
    const url = request.nextUrl.clone()
    url.pathname = path
    return NextResponse.redirect(url)
  }

  // ── No autenticado → redirigir a /login ──────────────────────────
  if (!user) {
    if (pathname.startsWith('/admin') || pathname.startsWith('/portal') ||
        pathname.startsWith('/operador') || pathname.startsWith('/vendedor') ||
        pathname.startsWith('/cliente')) {
      return to('/login')
    }
    if (pathname === '/') return to('/login')
    return supabaseResponse
  }

  // ── Autenticado: obtener rol ──────────────────────────────────────
  let rolNombre = ''
  try {
    const { data } = await supabase
      .from('usuario')
      .select('rol:idrol(nombre), estado_aprobacion')
      .eq('auth_uid', user.id)
      .maybeSingle()

    rolNombre = (data as any)?.rol?.nombre ?? ''
    const estado = (data as any)?.estado_aprobacion ?? 'pendiente'

    // Si el usuario no está aprobado y trata de acceder a zonas protegidas
    if (estado !== 'aprobado' && !pathname.startsWith('/portal')) {
      if (pathname !== '/login' && pathname !== '/register') {
        return to('/portal')
      }
    }
  } catch {}

  // ── Redirigir /login y /register si ya autenticado ────────────────
  if (pathname === '/login' || pathname === '/register') {
    if (rolNombre === 'Administrador') return to('/admin')
    if (rolNombre === 'Vendedor') return to('/vendedor')
    if (rolNombre === 'Operador') return to('/operador')
    return to('/portal')
  }

  // ── Redirigir raíz ────────────────────────────────────────────────
  if (pathname === '/') {
    if (rolNombre === 'Administrador') return to('/admin')
    if (rolNombre === 'Vendedor') return to('/vendedor')
    if (rolNombre === 'Operador') return to('/operador')
    return to('/portal')
  }

  // ── Proteger /admin: solo Administrador ───────────────────────────
  if (pathname.startsWith('/admin') && rolNombre !== 'Administrador') {
    if (rolNombre === 'Vendedor') return to('/vendedor')
    if (rolNombre === 'Operador') return to('/operador')
    return to('/portal')
  }

  // ── Proteger /vendedor ────────────────────────────────────────────
  if (pathname.startsWith('/vendedor') && rolNombre !== 'Vendedor' && rolNombre !== 'Administrador') {
    return to('/portal')
  }

  // ── Proteger /operador ────────────────────────────────────────────
  if (pathname.startsWith('/operador') && rolNombre !== 'Operador' && rolNombre !== 'Administrador') {
    return to('/portal')
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
