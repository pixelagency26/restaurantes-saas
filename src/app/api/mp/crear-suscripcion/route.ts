import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

const PRECIOS: Record<string, number> = { basico: 89900, pro: 149000 }
const NOMBRES: Record<string, string> = { basico: 'Básico', pro: 'Pro' }
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.restaurantsas.com'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { plan } = await req.json()
    if (!['basico', 'pro'].includes(plan)) {
      return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
    }

    const admin = adminClient()
    const { data: usuario } = await admin
      .from('usuarios')
      .select('negocio_id')
      .eq('id', user.id)
      .single()

    if (!usuario?.negocio_id) {
      return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 400 })
    }

    const { data: negocio } = await admin
      .from('negocios')
      .select('nombre, suscripcion_hasta')
      .eq('id', usuario.negocio_id)
      .single()

    if (!negocio) {
      return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 400 })
    }

    const externalRef = JSON.stringify({
      negocio_id: usuario.negocio_id,
      plan,
      tipo: 'renovar',
      suscripcion_hasta_actual: negocio.suscripcion_hasta || null,
    })

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{
          id: plan,
          title: `Restaurant sas - Plan ${NOMBRES[plan]}`,
          description: `Renovación mensual Plan ${NOMBRES[plan]}`,
          quantity: 1,
          currency_id: 'COP',
          unit_price: PRECIOS[plan],
        }],
        payer: { email: user.email },
        external_reference: externalRef,
        back_urls: {
          success: `${APP_URL}/pago-exitoso?plan=${plan}&tipo=renovar`,
          failure: `${APP_URL}/suscripcion-expirada?pago=fallido`,
          pending: `${APP_URL}/suscripcion-expirada?pago=pendiente`,
        },
        auto_return: 'approved',
        notification_url: `${APP_URL}/api/mp/webhook`,
        metadata: { negocio: negocio.nombre },
      }),
    })

    const mpData = await mpRes.json()
    if (!mpRes.ok || !mpData.init_point) {
      console.error('[mp-crear-suscripcion]', mpData)
      return NextResponse.json({ error: mpData.message || 'Error en MercadoPago' }, { status: 400 })
    }

    return NextResponse.json({ checkout_url: mpData.init_point })
  } catch (e) {
    console.error('[mp-crear-suscripcion]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
