import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

const PRECIOS: Record<string, number> = { starter: 19000, basico: 89900, pro: 149000 }
const NOMBRES: Record<string, string> = { starter: 'Básico', basico: 'Profesional', pro: 'Pro' }
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

    const body = await req.json()
    const plan: 'basico' | 'pro' = body.plan
    const tipo: 'nuevo' | 'upgrade' | 'renovar' = body.tipo || 'nuevo'

    if (!['starter', 'basico', 'pro'].includes(plan))
      return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
    if (!['nuevo', 'upgrade', 'renovar'].includes(tipo))
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

    const admin = adminClient()

    // Obtener datos del negocio
    const { data: usuario } = await admin
      .from('usuarios')
      .select('negocio_id')
      .eq('id', user.id)
      .single()
    if (!usuario?.negocio_id)
      return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 400 })

    const { data: negocio } = await admin
      .from('negocios')
      .select('nombre, plan, suscripcion_activa, suscripcion_hasta')
      .eq('id', usuario.negocio_id)
      .single()
    if (!negocio)
      return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 400 })

    // ── Calcular monto y descripción ──────────────────────────────
    let amount = PRECIOS[plan]
    let title = `Restaurant sas - Plan ${NOMBRES[plan]}`
    let description = `Suscripción mensual Plan ${NOMBRES[plan]}`

    const ahora = new Date()
    const hastaActual = negocio.suscripcion_hasta ? new Date(negocio.suscripcion_hasta) : null

    if (tipo === 'upgrade' && negocio.plan && negocio.plan !== plan) {
      // Prorrateo: crédito por días restantes del plan actual
      const diasRestantes = hastaActual && hastaActual > ahora
        ? Math.ceil((hastaActual.getTime() - ahora.getTime()) / 86400000)
        : 0
      const precioActual = PRECIOS[negocio.plan] || 0
      const tarifaDiaria = precioActual / 30
      const credito = Math.floor(tarifaDiaria * diasRestantes)
      amount = Math.max(PRECIOS[plan] - credito, 5000) // mínimo $5.000 COP
      title = `Upgrade a Plan ${NOMBRES[plan]}`
      description = diasRestantes > 0
        ? `Upgrade de ${NOMBRES[negocio.plan]} a ${NOMBRES[plan]} (${diasRestantes} días de crédito aplicado: -$${credito.toLocaleString('es-CO')})`
        : `Upgrade de ${NOMBRES[negocio.plan]} a ${NOMBRES[plan]}`
    } else if (tipo === 'nuevo') {
      description = `Primer pago Plan ${NOMBRES[plan]} — inicia después del período de prueba`
    }

    // ── external_reference: info para el webhook ──────────────────
    const externalRef = JSON.stringify({
      negocio_id: usuario.negocio_id,
      plan,
      tipo,
      suscripcion_hasta_actual: hastaActual ? hastaActual.toISOString() : null,
    })

    // ── Crear preferencia en Checkout Pro ─────────────────────────
    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{
          id: plan,
          title,
          description,
          quantity: 1,
          currency_id: 'COP',
          unit_price: amount,
        }],
        payer: { email: user.email },
        external_reference: externalRef,
        back_urls: {
          success: `${APP_URL}/pago-exitoso?plan=${plan}&tipo=${tipo}`,
          failure:  `${APP_URL}/gerencia?pago=fallido`,
          pending:  `${APP_URL}/gerencia?pago=pendiente`,
        },
        auto_return: 'approved',
        notification_url: `${APP_URL}/api/mp/webhook`,
        metadata: { negocio: negocio.nombre },
      }),
    })

    const mpData = await mpRes.json()

    if (!mpRes.ok || !mpData.init_point) {
      console.error('[mp-iniciar-pago]', mpData)
      return NextResponse.json({ error: mpData.message || 'Error en MercadoPago' }, { status: 400 })
    }

    return NextResponse.json({
      checkout_url: mpData.init_point,
      amount,
      description,
    })
  } catch (e) {
    console.error('[mp-iniciar-pago]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
