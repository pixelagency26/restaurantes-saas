import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('[mp-webhook] recibido:', JSON.stringify(body))

    // MercadoPago envía: { action, type, data: { id } }
    const { type, data } = body
    if (type !== 'payment' || !data?.id) {
      return NextResponse.json({ ok: true })
    }

    // Consultar el pago en MP
    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    })
    const payment = await paymentRes.json()
    console.log('[mp-webhook] pago status:', payment.status, 'ref:', payment.external_reference)

    if (payment.status !== 'approved') {
      return NextResponse.json({ ok: true })
    }

    if (!payment.external_reference) {
      console.error('[mp-webhook] sin external_reference')
      return NextResponse.json({ ok: true })
    }

    const ref = JSON.parse(payment.external_reference) as {
      negocio_id: string
      plan: string
      tipo: 'nuevo' | 'upgrade' | 'renovar'
      suscripcion_hasta_actual: string | null
    }

    const admin = adminClient()
    const ahora = new Date()

    // ── Calcular nueva fecha de suscripción ──────────────────────
    let nuevaHasta: Date

    if (ref.tipo === 'upgrade') {
      // Upgrade: mantener los días restantes del plan actual, solo cambia el plan
      // Si quedaban días → mantener esa fecha; si estaba vencido → +30 desde hoy
      if (ref.suscripcion_hasta_actual && new Date(ref.suscripcion_hasta_actual) > ahora) {
        nuevaHasta = new Date(ref.suscripcion_hasta_actual)
      } else {
        nuevaHasta = new Date(ahora)
        nuevaHasta.setDate(nuevaHasta.getDate() + 30)
      }
    } else {
      // nuevo / renovar: extender 30 días desde el fin del período vigente (o desde hoy si vencido)
      const base = ref.suscripcion_hasta_actual && new Date(ref.suscripcion_hasta_actual) > ahora
        ? new Date(ref.suscripcion_hasta_actual)
        : new Date(ahora)
      base.setDate(base.getDate() + 30)
      nuevaHasta = base
    }

    // ── Actualizar negocio ────────────────────────────────────────
    const { error } = await admin.from('negocios').update({
      plan: ref.plan,
      suscripcion_activa: true,
      suscripcion_hasta: nuevaHasta.toISOString(),
      mp_subscription_id: String(payment.id),
    }).eq('id', ref.negocio_id)

    if (error) {
      console.error('[mp-webhook] error actualizando negocio:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[mp-webhook] suscripción activada:', ref.negocio_id, ref.plan, nuevaHasta.toISOString())
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[mp-webhook] error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// MP a veces envía GET para verificar la URL
export async function GET() {
  return NextResponse.json({ ok: true })
}
