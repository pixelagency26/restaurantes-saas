import { NextResponse } from 'next/server'
import { requireGerente } from '@/lib/api-auth'

async function validarUsuarioDelNegocio(id: string) {
  const auth = await requireGerente()
  if (auth.error) return { ...auth, objetivo: null }
  if (!auth.admin || !auth.usuario?.negocio_id) {
    return {
      error: NextResponse.json({ error: 'No se pudo validar el negocio' }, { status: 403 }),
      admin: null,
      usuario: null,
      objetivo: null,
    }
  }

  const { data: objetivo } = await auth.admin
    .from('usuarios')
    .select('id, negocio_id, rol')
    .eq('id', id)
    .maybeSingle()

  if (!objetivo || objetivo.negocio_id !== auth.usuario.negocio_id) {
    return {
      error: NextResponse.json({ error: 'Usuario no pertenece a tu negocio' }, { status: 403 }),
      admin: null,
      usuario: null,
      objetivo: null,
    }
  }

  if (objetivo.id === auth.usuario.id) {
    return {
      error: NextResponse.json({ error: 'No puedes modificar tu propio acceso desde esta accion' }, { status: 400 }),
      admin: null,
      usuario: null,
      objetivo: null,
    }
  }

  return { ...auth, objetivo }
}

export async function PATCH(request: Request) {
  try {
    const { id, nuevaPassword, activo } = await request.json()
    if (!id) return NextResponse.json({ error: 'Falta el ID del usuario' }, { status: 400 })

    const auth = await validarUsuarioDelNegocio(id)
    if (auth.error) return auth.error
    if (!auth.admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    if (nuevaPassword) {
      const { error } = await auth.admin.auth.admin.updateUserById(id, { password: nuevaPassword })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (activo !== undefined) {
      const { error } = await auth.admin.auth.admin.updateUserById(id, {
        ban_duration: activo ? 'none' : '876600h',
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      await auth.admin
        .from('usuarios')
        .update({ activo })
        .eq('id', id)
        .eq('negocio_id', auth.usuario!.negocio_id)
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Error interno: ${message}` }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Falta el ID del usuario' }, { status: 400 })

    const auth = await validarUsuarioDelNegocio(id)
    if (auth.error) return auth.error
    if (!auth.admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    await auth.admin
      .from('usuarios')
      .delete()
      .eq('id', id)
      .eq('negocio_id', auth.usuario!.negocio_id)

    const { error } = await auth.admin.auth.admin.deleteUser(id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Error interno: ${message}` }, { status: 500 })
  }
}
