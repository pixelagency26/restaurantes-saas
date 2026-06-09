import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { plan } = await req.json()
    if (!['basico', 'pro'].includes(plan)) {
      return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Obtener negocio_id del usuario
    const { data: usuario } = await admin
      .from('usuarios')
      .select('negocio_id')
      .eq('id', user.id)
      .single()

    if (!usuario?.negocio_id) {
      return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 400 })
    }

    const planId = plan === 'pro'
      ? process.env.MP_PLAN_PRO_ID
      : process.env.MP_PLAN_BASICO_ID

    // Crear suscripción en MercadoPago con negocio_id como external_reference
    const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        preapproval_plan_id: planId,
        payer_email: user.email,
        external_reference: usuario.negocio_id,
        back_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.restaurantsas.com'}/gerencia`,
      }),
    })

    const mpData = await mpRes.json()
    if (!mpRes.ok || !mpData.init_point) {
      console.error('[mp-crear-suscripcion]', mpData)
      return NextResponse.json({ error: mpData.message || 'Error en MercadoPago' }, { status: 400 })
    }

    // Guardar mp_subscription_id y actualizar plan en la DB
    await admin.from('negocios').update({
      mp_subscription_id: mpData.id,
      plan,
    }).eq('id', usuario.negocio_id)

    return NextResponse.json({ checkout_url: mpData.init_point })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
