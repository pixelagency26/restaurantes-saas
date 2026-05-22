import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

const adminClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function verificarAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  // Superadmin por env var
  if (user.email === process.env.ADMIN_EMAIL) return true

  // Sub-admin registrado en la tabla admins
  const { data: rec } = await adminClient()
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single()

  return !!rec
}

export async function GET() {
  try {
    const esAdmin = await verificarAdmin()
    if (!esAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const admin = adminClient()

    const { data: negocios, error } = await admin
      .from('negocios')
      .select('id, nombre, plan, suscripcion_activa, suscripcion_hasta, mp_subscription_id, created_at')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Enriquecer con datos del gerente
    const enriched = await Promise.all((negocios || []).map(async (neg) => {
      const { data: gerente } = await admin
        .from('usuarios')
        .select('nombre, id')
        .eq('negocio_id', neg.id)
        .eq('rol', 'gerente')
        .single()

      let gerente_email = ''
      if (gerente?.id) {
        const { data: authUser } = await admin.auth.admin.getUserById(gerente.id)
        gerente_email = authUser?.user?.email || ''
      }

      return { ...neg, gerente_nombre: gerente?.nombre || '', gerente_email }
    }))

    return NextResponse.json({ negocios: enriched })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
