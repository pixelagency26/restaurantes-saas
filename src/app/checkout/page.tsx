'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const PLAN_NOMBRES: Record<string, string> = { basico: 'Básico', pro: 'Pro' }
const PLAN_PRECIOS: Record<string, string> = { basico: '$89.900 COP/mes', pro: '$149.900 COP/mes' }

function CheckoutForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') as 'basico' | 'pro' | null
  const tipo = (searchParams.get('tipo') || 'nuevo') as 'nuevo' | 'upgrade' | 'renovar'
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<{ amount: number; description: string } | null>(null)

  useEffect(() => {
    if (!plan) { router.push('/gerencia'); return }

    async function redirigirAMP() {
      try {
        const res = await fetch('/api/mp/iniciar-pago', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan, tipo }),
        })
        const data = await res.json()
        if (!res.ok || !data.checkout_url) {
          setError(data.error || 'No se pudo iniciar el pago. Intenta de nuevo.')
          return
        }
        setInfo({ amount: data.amount, description: data.description })
        // Pequeña pausa para que el usuario vea el monto antes de redirigir
        setTimeout(() => { window.location.href = data.checkout_url }, 1200)
      } catch (e) {
        setError('Error de conexión: ' + String(e))
      }
    }

    redirigirAMP()
  }, [plan, tipo])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="text-6xl">⚠️</div>
          <h1 className="text-2xl font-black text-gray-900">Algo salió mal</h1>
          <p className="text-gray-500 text-sm leading-relaxed">{error}</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => { setError(null); window.location.reload() }}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl transition-colors">
              Reintentar
            </button>
            <Link href="/gerencia"
              className="w-full block text-center border-2 border-gray-200 hover:border-gray-300 text-gray-600 font-bold py-4 rounded-2xl transition-colors text-sm">
              Ir al panel sin pagar
            </Link>
          </div>
          <p className="text-xs text-gray-400">
            ¿Necesitas ayuda?{' '}
            <a href="https://wa.me/573205612477?text=Hola%2C%20tuve%20un%20problema%20al%20pagar%20en%20Restaurant%20sas"
              target="_blank" rel="noopener noreferrer"
              className="text-orange-500 font-semibold hover:underline">
              Escríbenos por WhatsApp
            </a>
          </p>
        </div>
      </div>
    )
  }

  const tipoLabel: Record<string, string> = {
    nuevo:   'Activar suscripción',
    upgrade: `Upgrade a Plan ${PLAN_NOMBRES[plan || 'pro']}`,
    renovar: `Renovar Plan ${PLAN_NOMBRES[plan || 'basico']}`,
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
            <span className="text-xl">🍽️</span>
          </div>
          <span className="font-black text-gray-900 text-xl">Restaurant Pix</span>
        </div>

        {/* Spinner */}
        <div className="flex justify-center">
          <div className="w-14 h-14 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        </div>

        <div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">
            {plan ? tipoLabel[tipo] : 'Preparando tu pago…'}
          </h1>
          {info ? (
            <div className="space-y-2">
              <p className="text-3xl font-black text-orange-500">
                ${info.amount.toLocaleString('es-CO')} COP
              </p>
              <p className="text-gray-500 text-sm leading-relaxed">{info.description}</p>
              <p className="text-xs text-gray-400 mt-1">Redirigiendo a MercadoPago…</p>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              Plan {PLAN_NOMBRES[plan || 'basico']} — {PLAN_PRECIOS[plan || 'basico']}
            </p>
          )}
        </div>

        {tipo === 'nuevo' && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-xs text-blue-700 text-left">
            <p className="font-bold mb-1">💡 ¿Aún tienes días de prueba?</p>
            <p>No los pierdes. Tu suscripción empieza a contar desde que termine el período de prueba.</p>
          </div>
        )}

        <p className="text-xs text-gray-400">
          Si no te redirige automáticamente,{' '}
          <button onClick={() => window.location.reload()}
            className="text-orange-500 font-semibold hover:underline">
            haz clic aquí
          </button>
        </p>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutForm />
    </Suspense>
  )
}
