import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

type PerfilUsuario = {
  id: string
  negocio_id: string | null
  rol: string
  nombre?: string | null
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Faltan variables de entorno de Supabase')
  }

  return createSupabaseAdmin(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function requireGerente() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
      admin: null,
      usuario: null,
    }
  }

  const admin = createAdminClient()
  const { data: usuario, error } = await admin
    .from('usuarios')
    .select('id, negocio_id, rol, nombre')
    .eq('id', user.id)
    .maybeSingle<PerfilUsuario>()

  if (error || !usuario) {
    return {
      error: NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 }),
      admin: null,
      usuario: null,
    }
  }

  if (usuario.rol !== 'gerente') {
    return {
      error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }),
      admin: null,
      usuario: null,
    }
  }

  return { error: null, admin, usuario }
}
