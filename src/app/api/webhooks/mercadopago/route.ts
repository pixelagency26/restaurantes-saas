import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { type, data } = body

    // MercadoPago envía distintos tipos de eventos
    // Documentación: https://www.mercadopago.com.co/developers/es/docs/subscriptions/webhooks

    if (type === 'subscription_preapproval') {
      // Evento de suscripción (alta, pago, cancelación)
      const subscriptionId = data?.id
      if (!subscriptionId) return NextResponse.json({ ok: true })

      // Consultar estado actual en MercadoPago
      const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${subscriptionId}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      })
      const sub = await mpRes.json()

      const db = admin()

      // Buscar el negocio por mp_subscription_id
      const { data: neg } = await db
        .from('negocios')
        .select('id, plan')
        .eq('mp_subscription_id', subscriptionId)
        .single()

      if (!neg) {
        // Primera vez: el negocio se vincula por external_reference (negocio_id)
        const negocioId = sub.external_reference
        if (!negocioId) return NextResponse.json({ ok: true })

        if (sub.status === 'authorized') {
          const hasta = new Date()
          hasta.setMonth(hasta.getMonth() + 1)
          await db.from('negocios').update({
            mp_subscription_id: subscriptionId,
            suscripcion_activa: true,
            suscripcion_hasta: hasta.toISOString(),
            plan: sub.reason?.includes('Pro') ? 'pro' : 'basico',
          }).eq('id', negocioId)
        }
        return NextResponse.json({ ok: true })
      }

      // Negocio ya vinculado — actualizar según estado
      if (sub.status === 'authorized') {
        const hasta = new Date()
        hasta.setMonth(hasta.getMonth() + 1)
        await db.from('negocios').update({
          suscripcion_activa: true,
          suscripcion_hasta: hasta.toISOString(),
        }).eq('id', neg.id)
      } else if (['cancelled', 'paused', 'pending'].includes(sub.status)) {
        await db.from('negocios').update({
          suscripcion_activa: false,
        }).eq('id', neg.id)
      }
    }

    if (type === 'payment') {
      // Pago puntual de una suscripción — extender fecha si es exitoso
      const paymentId = data?.id
      if (!paymentId) return NextResponse.json({ ok: true })

      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      })
      const payment = await mpRes.json()

      if (payment.status === 'approved' && payment.external_reference) {
        const db = admin()
        const hasta = new Date()
        hasta.setMonth(hasta.getMonth() + 1)
        await db.from('negocios').update({
          suscripcion_activa: true,
          suscripcion_hasta: hasta.toISOString(),
        }).eq('id', payment.external_reference)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[webhook-mp]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
