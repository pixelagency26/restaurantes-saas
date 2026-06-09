import { NextResponse } from 'next/server'
import { requireGerente } from '@/lib/api-auth'

const ROLES_PERMITIDOS = new Set(['mesera', 'cocina', 'domi'])

export async function POST(request: Request) {
  try {
    const auth = await requireGerente()
    if (auth.error) return auth.error
    if (!auth.admin || !auth.usuario?.negocio_id) {
      return NextResponse.json({ error: 'No se pudo validar el negocio' }, { status: 403 })
    }

    const { email, password, nombre, rol } = await request.json()

    if (!email || !password || !nombre || !rol) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
    }

    if (!ROLES_PERMITIDOS.has(rol)) {
      return NextResponse.json({ error: 'Rol no permitido' }, { status: 400 })
    }

    const supabaseAdmin = auth.admin
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: String(email).toLowerCase().trim(),
      password,
      email_confirm: true,
    })

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message || 'Error al crear usuario en Auth' },
        { status: 400 }
      )
    }

    const { error: dbError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: data.user.id,
        negocio_id: auth.usuario.negocio_id,
        nombre: String(nombre).trim(),
        rol,
      })

    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(data.user.id)
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, nombre: String(nombre).trim() })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[crear-usuario] Error inesperado:', message)
    return NextResponse.json({ error: `Error interno: ${message}` }, { status: 500 })
  }
}
