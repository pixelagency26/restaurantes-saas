import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rutas que NO necesitan estar logueado
const RUTAS_PUBLICAS   = ['/login', '/reset-password', '/registro', '/suscripcion-expirada']
// Páginas del cliente que escanea el QR — acceso libre siempre
const RUTAS_CLIENTE_QR = ['/mesa', '/domi-pedido', '/restaurante']
// Rutas accesibles para cualquier usuario autenticado (sin importar rol)
const RUTAS_CON_SESION = ['/onboarding', '/checkout', '/suscripcion-expirada']
// Rutas del panel que requieren suscripción activa
const RUTAS_PANEL = ['/gerencia', '/mesera', '/cocina', '/domi']

// Qué panel corresponde a cada rol
const RUTA_POR_ROL: Record<string, string> = {
  gerente: '/gerencia',
  mesera:  '/mesera',
  cocina:  '/cocina',
  domi:    '/domi',
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── API routes: nunca redirigir, dejar pasar siempre ─────────
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // ── Páginas QR del cliente: siempre abiertas, sin login ──────
  if (RUTAS_CLIENTE_QR.some(r => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request: { headers: request.headers } })

  // Crear cliente de Supabase con las cookies de la petición
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Verificar si hay sesión activa
  const { data: { user } } = await supabase.auth.getUser()
  const esPublica = RUTAS_PUBLICAS.some(r => pathname.startsWith(r))

  // ── Landing page: siempre pública ────────────────────────────
  if (pathname === '/') return response

  // ── Sin sesión ───────────────────────────────────────────────
  if (!user) {
    // Puede ver rutas públicas sin problema
    if (esPublica) return response
    // Cualquier otra ruta → al login
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ── Rutas accesibles para cualquier usuario autenticado ──────
  if (RUTAS_CON_SESION.some(r => pathname.startsWith(r))) return response

  // ── Panel admin: superadmin o admin registrado ───────────────
  if (pathname.startsWith('/admin')) {
    const isSuperAdmin = user.email === process.env.ADMIN_EMAIL
    if (!isSuperAdmin) {
      const { data: adminRec } = await supabase
        .from('admins').select('id').eq('email', user.email).maybeSingle()
      if (!adminRec) return NextResponse.redirect(new URL('/login', request.url))
    }
    return response
  }

  // ── Con sesión: obtener el rol del usuario ───────────────────
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  const rutaCorrecta = usuario ? RUTA_POR_ROL[usuario.rol] : null

  // Logueado intentando abrir /login o /registro → mandarlo a su panel
  // Excepción: /reset-password siempre debe mostrarse para completar el cambio de clave
  if (esPublica && !pathname.startsWith('/reset-password')) {
    return NextResponse.redirect(new URL(rutaCorrecta || '/login', request.url))
  }

  // ── Chequeo de suscripción para rutas del panel ──────────────
  if (RUTAS_PANEL.some(r => pathname.startsWith(r))) {
    const { data: neg } = await supabase
      .from('negocios')
      .select('suscripcion_activa, suscripcion_hasta')
      .eq('id', (await supabase.from('usuarios').select('negocio_id').eq('id', user.id).single()).data?.negocio_id)
      .single()
    const ahora = new Date()
    const hasta = neg?.suscripcion_hasta ? new Date(neg.suscripcion_hasta) : null
    const activa = neg?.suscripcion_activa === true || (hasta !== null && hasta > ahora)
    if (!activa) {
      return NextResponse.redirect(new URL('/suscripcion-expirada', request.url))
    }
  }

  // Logueado en una ruta que no le corresponde → redirigir a la suya
  // (ej: una mesera escribiendo /gerencia en la barra de direcciones)
  if (rutaCorrecta && !pathname.startsWith(rutaCorrecta) && pathname !== '/') {
    return NextResponse.redirect(new URL(rutaCorrecta, request.url))
  }

  return response
}

// Aplicar el middleware a todas las rutas excepto archivos estáticos
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
