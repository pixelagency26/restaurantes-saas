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
    .select('id, puede_suscripciones')
    .eq('email', user.email)
    .single()

  return !!rec && rec.puede_suscripciones !== false
}

export async function POST(req: Request) {
  try {
    const esAdmin = await verificarAdmin()
    if (!esAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { negocio_id, tipo } = await req.json()
    if (!negocio_id || !tipo) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

    const admin = adminClient()

    // Obtener fecha actual de suscripción
    const { data: neg } = await admin
      .from('negocios')
      .select('suscripcion_hasta, suscripcion_activa')
      .eq('id', negocio_id)
      .single()

    let update: Record<string, unknown> = {}

    switch (tipo) {
      case 'activar': {
        const base = neg?.suscripcion_hasta && new Date(neg.suscripcion_hasta) > new Date()
          ? new Date(neg.suscripcion_hasta)
          : new Date()
        base.setDate(base.getDate() + 30)
        update = { suscripcion_activa: false, suscripcion_hasta: base.toISOString() }
        break
      }
      case 'desactivar':
        update = { suscripcion_activa: false, suscripcion_hasta: new Date(Date.now() - 1000).toISOString() }
        break
      case 'extender30': {
        const base = neg?.suscripcion_hasta && new Date(neg.suscripcion_hasta) > new Date()
          ? new Date(neg.suscripcion_hasta)
          : new Date()
        base.setDate(base.getDate() + 30)
        update = { suscripcion_hasta: base.toISOString() }
        break
      }
      case 'extender365': {
        const base = neg?.suscripcion_hasta && new Date(neg.suscripcion_hasta) > new Date()
          ? new Date(neg.suscripcion_hasta)
          : new Date()
        base.setFullYear(base.getFullYear() + 1)
        update = { suscripcion_hasta: base.toISOString() }
        break
      }
      case 'pro':
        update = { plan: 'pro' }
        break
      case 'basico':
        update = { plan: 'basico' }
        break
      default:
        return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }

    const { error } = await admin.from('negocios').update(update).eq('id', negocio_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
